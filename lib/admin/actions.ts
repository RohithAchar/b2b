"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guard";

export type AdminActionState = {
  ok: boolean;
  message: string;
};

const idSchema = z.object({ id: z.string().uuid("Invalid application.") });

const rejectSchema = idSchema.extend({
  note: z.string().trim().min(10, "Write at least a sentence so the supplier knows what to fix."),
});

export async function approveCompany(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState | never> {
  const { supabase } = await requireAdmin();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) {
    return { ok: false, message: "Invalid application." };
  }

  const { error } = await supabase.rpc("approve_kyb", {
    p_company_id: parsed.data.id,
  });

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
  const { supabase } = await requireAdmin();
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

  const { error } = await supabase.rpc("reject_kyb", {
    p_company_id: parsed.data.id,
    p_note: parsed.data.note,
  });

  if (error) {
    console.error("rejectCompany failed:", error);
    return { ok: false, message: "Could not send back. Try again." };
  }

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/dashboard/supplier-verification");
  redirect("/admin/dashboard/supplier-verification?tab=pending");
}