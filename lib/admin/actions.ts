"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";

export type AdminActionState = {
  ok: boolean;
  message: string;
};

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(LOGIN_PATH);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.user_type !== "admin") {
    redirect("/");
  }

  return { supabase, user };
}

const idSchema = z.object({ id: z.string().uuid("Invalid application.") });

const rejectSchema = idSchema.extend({
  note: z.string().trim().min(10, "Write at least a sentence so the supplier knows what to fix."),
});

export async function approveCompany(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState | never> {
  const { supabase, user } = await requireAdmin();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { ok: false, message: "Invalid application." };
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, kyb_status")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (!company || (company.kyb_status !== "pending" && company.kyb_status !== "rejected")) {
    return { ok: false, message: "This application can no longer be approved." };
  }

  const { error } = await supabase
    .from("companies")
    .update({
      kyb_status: "verified",
      verified_at: new Date().toISOString(),
      reviewed_by: user.id,
      rejection_note: null,
    })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("approveCompany failed:", error);
    return { ok: false, message: "Could not approve. Try again." };
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/dashboard/supplier-verification");
  redirect("/admin/dashboard/supplier-verification?tab=pending");
}

export async function rejectCompany(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState | never> {
  const { supabase, user } = await requireAdmin();
  const parsed = rejectSchema.safeParse({
    id: formData.get("id"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the form and try again.",
    };
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, kyb_status")
    .eq("id", parsed.data.id)
    .maybeSingle();

  if (!company || company.kyb_status !== "pending") {
    return { ok: false, message: "This application can no longer be sent back." };
  }

  const { error } = await supabase
    .from("companies")
    .update({
      kyb_status: "rejected",
      reviewed_by: user.id,
      rejection_note: parsed.data.note,
    })
    .eq("id", parsed.data.id);

  if (error) {
    console.error("rejectCompany failed:", error);
    return { ok: false, message: "Could not send back. Try again." };
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/dashboard/supplier-verification");
  redirect("/admin/dashboard/supplier-verification?tab=pending");
}
