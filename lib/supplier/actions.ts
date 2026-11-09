"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, getSupplierContext, requireOwnerCompany } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  businessProfileSchema,
  kybSchema,
  marginPctSchema,
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

  // Verification is owner-only: staff manage the catalogue, never the company
  // profile. (submit_kyb stays owner-only at the database level too.)
  const ctx = await getSupplierContext(supabase, user.id);
  if (ctx?.role === "staff") {
    return {
      ok: false,
      message: "Only the business owner can manage the business profile.",
    };
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
  });

  if (!parsed.success) {
    console.error("submitKyb validation failed:", parsed.error.issues);
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  // Logo is optional: upload when provided, otherwise keep any stored one.
  const { data: preExisting } = await supabase
    .from("companies")
    .select("id, logo_path")
    .eq("owner_id", user.id)
    .maybeSingle();

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
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();

  const payload = {
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
    logo_path: logoPath,
  };

  if (existing) {
    const { error: updateError } = await supabase
      .from("companies")
      .update(payload)
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
      return { ok: false, message: "Could not activate. Try again." };
    }
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("companies")
      .insert({
        owner_id: user.id,
        ...payload,
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
      return { ok: false, message: "Could not activate. Try again." };
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

  const companyId = await requireOwnerCompany(supabase, user.id);

  const { data: existing } = await supabase
    .from("companies")
    .select("id, logo_path")
    .eq("id", companyId)
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
    .eq("id", companyId);
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

/**
 * Supplier-set margin, edited from Products → Margin. One margin for the whole
 * catalogue. Only margin_pct is written, so the business profile and
 * kyb_status are untouched and no re-verification is triggered.
 */
export async function updateMargin(
  _prevState: KybActionState,
  formData: FormData,
): Promise<KybActionState> {
  const { supabase, user } = await requireUser();

  const parsed = marginPctSchema.safeParse(formData.get("margin_pct"));
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  const { data, error } = await supabase
    .from("companies")
    .update({ margin_pct: parsed.data })
    .eq("id", await requireOwnerCompany(supabase, user.id))
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("updateMargin failed:", error);
    return { ok: false, message: "Could not save. Try again." };
  }
  // No row means the company was never created (or was removed) — same
  // distinction the business and products pages draw before onboarding.
  if (!data) {
    redirect("/supplier/onboarding");
  }

  revalidatePath("/supplier/dashboard");
  revalidatePath("/supplier/dashboard/products");
  revalidatePath("/supplier/dashboard/products/margin");
  return { ok: true, message: "Saved." };
}

export type AccountActionState = {
  ok: boolean;
  message: string;
};

/**
 * Delete the authenticated supplier's account.
 *
 * Only the company owner can do this: staff removing themselves from a team is
 * a separate flow, while this deletes the whole business account. Deleting the
 * auth user cascades through the database: profiles -> company -> products ->
 * images/variants, and company_members, so the supplier's entire footprint is
 * removed. The session is cleared so the client can navigate back to log in.
 */
export async function deleteAccount(): Promise<AccountActionState> {
  const { supabase, user } = await requireUser();

  const ctx = await getSupplierContext(supabase, user.id);
  if (!ctx || ctx.role !== "owner") {
    return {
      ok: false,
      message: "Only the business owner can delete the supplier account.",
    };
  }

  // Service role is required: auth.admin.deleteUser is not exposed to the
  // caller's regular (RLS-bound) token.
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("deleteAccount failed:", error);
    return { ok: false, message: "Could not delete account. Try again." };
  }

  // Clear the session now that the auth user no longer exists.
  await supabase.auth.signOut();
  return { ok: true, message: "Your supplier account has been deleted." };
}