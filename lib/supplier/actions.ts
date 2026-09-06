"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  businessProfileSchema,
  kybSchema,
  validateDocFile,
  validateLogoFile,
} from "@/lib/supplier/kyb";

export type KybActionState = {
  ok: boolean;
  message: string;
};

const DOC_FIELDS = [
  { field: "gst_certificate", column: "gst_certificate_path", label: "GST certificate" },
  { field: "pan_card", column: "pan_card_path", label: "PAN card" },
  { field: "license", column: "license_path", label: "Business license" },
] as const;

async function uploadDoc(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  field: string,
  file: File,
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${userId}/${field}_${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from("company_docs")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) {
    throw new Error(`Could not upload ${field}. Try again.`);
  }
  return path;
}

export async function submitKyb(
  _prevState: KybActionState,
  formData: FormData,
): Promise<KybActionState | never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const parsed = kybSchema.safeParse({
    business_name: formData.get("business_name"),
    contact_person: formData.get("contact_person"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    city: formData.get("city"),
    state: formData.get("state"),
    pincode: formData.get("pincode"),
    gstin: formData.get("gstin"),
    pan: formData.get("pan"),
    bank_account: formData.get("bank_account"),
    bank_ifsc: formData.get("bank_ifsc"),
  });

  if (!parsed.success) {
    console.error("submitKyb validation failed:", parsed.error.issues);
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  // Validate + upload documents before touching the companies row.
  // Documents are mandatory: each needs a fresh upload or a stored path
  // from a previous submission (resubmit case).
  const { data: preExisting } = await supabase
    .from("companies")
    .select("gst_certificate_path, pan_card_path, license_path, logo_path")
    .eq("owner_id", user.id)
    .maybeSingle();

  const docPaths: Record<string, string> = {};
  try {
    for (const doc of DOC_FIELDS) {
      const value = formData.get(doc.field);
      const file = value instanceof File && value.size > 0 ? value : null;
      const fileError = validateDocFile(file);
      if (fileError) {
        return { ok: false, message: `${doc.label}: ${fileError}` };
      }
      if (file) {
        docPaths[doc.column] = await uploadDoc(supabase, user.id, doc.field, file);
      } else if (!preExisting?.[doc.column as keyof typeof preExisting]) {
        return { ok: false, message: `${doc.label} is required.` };
      }
    }
  } catch (err) {
    console.error("submitKyb upload failed:", err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Document upload failed.",
    };
  }

  // Logo is optional: upload when provided, otherwise keep any stored one.
  let logoPath = preExisting?.logo_path ?? null;
  const logoValue = formData.get("logo");
  const logoFile =
    logoValue instanceof File && logoValue.size > 0 ? logoValue : null;
  if (logoFile) {
    const logoError = validateLogoFile(logoFile);
    if (logoError) {
      return { ok: false, message: `Logo: ${logoError}` };
    }
    try {
      const safeName = logoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/logo_${Date.now()}_${safeName}`;
      const { error: logoUploadError } = await supabase.storage
        .from("company_logos")
        .upload(path, logoFile, {
          contentType: logoFile.type,
          upsert: false,
        });
      if (logoUploadError) {
        throw logoUploadError;
      }
      logoPath = path;
    } catch (err) {
      console.error("submitKyb logo upload failed:", err);
      return { ok: false, message: "Could not upload the logo. Try again." };
    }
  }

  const { data: existing } = await supabase
    .from("companies")
    .select("id, kyb_status")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (existing?.kyb_status === "verified") {
    return { ok: false, message: "Your business is already verified." };
  }

  const row = {
    owner_id: user.id,
    ...parsed.data,
    ...docPaths,
    logo_path: logoPath,
    kyb_status: "pending",
    submitted_at: new Date().toISOString(),
    rejection_note: null,
  };

  const { error: upsertError } = existing
    ? await supabase.from("companies").update(row).eq("owner_id", user.id)
    : await supabase.from("companies").insert(row);

  if (upsertError) {
    console.error("submitKyb companies save failed:", upsertError);
    return { ok: false, message: "Could not save. Try again." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ user_type: "supplier" })
    .eq("id", user.id);

  if (profileError) {
    console.error("submitKyb profile update failed:", profileError);
    return { ok: false, message: "Could not save. Try again." };
  }

  redirect("/supplier/dashboard");
}

/**
 * Edit-anytime business profile: logo, company name, contact name.
 * Column whitelist — kyb_status, documents, tax and bank fields are
 * untouched, so edits never trigger re-verification.
 */
export async function updateBusinessProfile(
  _prevState: KybActionState,
  formData: FormData,
): Promise<KybActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const parsed = businessProfileSchema.safeParse({
    business_name: formData.get("business_name"),
    contact_person: formData.get("contact_person"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  const { data: existing } = await supabase
    .from("companies")
    .select("id, logo_path")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!existing) {
    redirect("/supplier/onboarding");
  }

  let logoPath = existing.logo_path;
  const logoValue = formData.get("logo");
  const logoFile =
    logoValue instanceof File && logoValue.size > 0 ? logoValue : null;
  if (logoFile) {
    const logoError = validateLogoFile(logoFile);
    if (logoError) {
      return { ok: false, message: `Logo: ${logoError}` };
    }
    const safeName = logoFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/logo_${Date.now()}_${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("company_logos")
      .upload(path, logoFile, {
        contentType: logoFile.type,
        upsert: false,
      });
    if (uploadError) {
      console.error("updateBusinessProfile logo upload failed:", uploadError);
      return { ok: false, message: "Could not upload the logo. Try again." };
    }
    logoPath = path;
  }

  const { error } = await supabase
    .from("companies")
    .update({
      business_name: parsed.data.business_name,
      contact_person: parsed.data.contact_person,
      logo_path: logoPath,
    })
    .eq("owner_id", user.id);
  if (error) {
    console.error("updateBusinessProfile failed:", error);
    return { ok: false, message: "Could not save. Try again." };
  }

  if (logoFile && existing.logo_path) {
    await supabase.storage.from("company_logos").remove([existing.logo_path]);
  }

  revalidatePath("/supplier/dashboard");
  revalidatePath("/supplier/dashboard/business");
  return { ok: true, message: "Saved." };
}
