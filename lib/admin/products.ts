"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { LOGIN_PATH } from "@/lib/auth/paths";
import type { AdminActionState } from "@/lib/admin/actions";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(LOGIN_PATH);
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_type")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.user_type !== "admin") redirect("/");
  return { supabase, user };
}

const idSchema = z.object({ id: z.string().uuid("Invalid product.") });
const rejectSchema = idSchema.extend({
  note: z.string().trim().min(10, "Write at least a sentence so the supplier knows what to fix."),
});

export async function approveProduct(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { supabase, user } = await requireAdmin();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, message: "Invalid product." };
  const { error } = await supabase
    .from("products")
    .update({ status: "approved", rejection_note: null, reviewed_by: user.id })
    .eq("id", parsed.data.id)
    .in("status", ["pending", "rejected"]);
  if (error) {
    console.error("approveProduct failed:", error);
    return { ok: false, message: "Could not approve. Try again." };
  }
  revalidatePath("/admin/dashboard/products");
  return { ok: true, message: "Approved." };
}

export async function rejectProduct(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { supabase, user } = await requireAdmin();
  const parsed = rejectSchema.safeParse({ id: formData.get("id"), note: formData.get("note") });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }
  const { error } = await supabase
    .from("products")
    .update({
      status: "rejected",
      rejection_note: parsed.data.note,
      reviewed_by: user.id,
    })
    .eq("id", parsed.data.id)
    .eq("status", "pending");
  if (error) {
    console.error("rejectProduct failed:", error);
    return { ok: false, message: "Could not send back. Try again." };
  }
  revalidatePath("/admin/dashboard/products");
  return { ok: true, message: "Sent back with note." };
}
