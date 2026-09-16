"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guard";
import type { AdminActionState } from "@/lib/admin/actions";

const idSchema = z.object({ id: z.string().uuid("Invalid product.") });
const rejectSchema = idSchema.extend({
  note: z.string().trim().min(10, "Write at least a sentence so the supplier knows what to fix."),
});

export async function approveProduct(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const { supabase } = await requireAdmin();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, message: "Invalid product." };

  const { error } = await supabase.rpc("approve_product", {
    p_product_id: parsed.data.id,
  });

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
  const { supabase } = await requireAdmin();
  const parsed = rejectSchema.safeParse({ id: formData.get("id"), note: formData.get("note") });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the form." };
  }

  const { error } = await supabase.rpc("reject_product", {
    p_product_id: parsed.data.id,
    p_note: parsed.data.note,
  });

  if (error) {
    console.error("rejectProduct failed:", error);
    return { ok: false, message: "Could not send back. Try again." };
  }
  revalidatePath("/admin/dashboard/products");
  return { ok: true, message: "Sent back with note." };
}