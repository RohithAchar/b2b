"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { kybSchema, validateDocFile } from "@/lib/supplier/kyb";

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
    .select("gst_certificate_path, pan_card_path, license_path")
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

  redirect("/supplier/status");
}
