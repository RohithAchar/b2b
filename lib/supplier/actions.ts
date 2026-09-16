"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
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
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
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
  const { supabase, user } = await requireUser();

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
      const fileError = await validateDocFile(file);
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
    const logoError = await validateLogoFile(logoFile);
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
  if (existing?.kyb_status === "pending") {
    return { ok: false, message: "Your application is already under review." };
  }

  if (existing) {
    // Content-only update; approval fields are owned by admin/RPCs.
    const { error: updateError } = await supabase
      .from("companies")
      .update({
        business_name: parsed.data.business_name,
        contact_person: parsed.data.contact_person,
        phone: parsed.data.phone,
        address: parsed.data.address,
        city: parsed.data.city,
        state: parsed.data.state,
        pincode: parsed.data.pincode,
        gstin: parsed.data.gstin,
        pan: parsed.data.pan,
        bank_account: parsed.data.bank_account,
        bank_ifsc: parsed.data.bank_ifsc,
        ...docPaths,
        logo_path: logoPath,
      })
      .eq("owner_id", user.id);

    if (updateError) {
      console.error("submitKyb companies update failed:", updateError);
      return { ok: false, message: "Could not save. Try again." };
    }

    const { error: submitError } = await supabase.rpc("submit_kyb", {
      p_company_id: existing.id,
    });
    if (submitError) {
      console.error("submitKyb rpc failed:", submitError);
      return { ok: false, message: "Could not submit. Try again." };
    }
  } else {
    // Fresh application: insert as draft (RLS requires it), then submit.
    const { data: inserted, error: insertError } = await supabase
      .from("companies")
      .insert({
        owner_id: user.id,
        ...parsed.data,
        ...docPaths,
        logo_path: logoPath,
        kyb_status: "draft",
      })
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("submitKyb companies insert failed:", insertError);
      return { ok: false, message: "Could not save. Try again." };
    }

    const { error: submitError } = await supabase.rpc("submit_kyb", {
      p_company_id: inserted.id,
    });
    if (submitError) {
      console.error("submitKyb rpc failed:", submitError);
      return { ok: false, message: "Could not submit. Try again." };
    }
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
  const { supabase, user } = await requireUser();

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
    const logoError = await validateLogoFile(logoFile);
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