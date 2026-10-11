"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";

// ---------------------------------------------------------------------------
// Saved products
// ---------------------------------------------------------------------------

const saveProductSchema = z.object({
  productId: z.string().uuid("Invalid product ID."),
});

export type BuyerActionState = {
  ok: boolean;
  message: string;
};

const okState: BuyerActionState = { ok: true, message: "" };
const errState = (message: string): BuyerActionState => ({ ok: false, message });

export async function saveProduct(
  _prev: BuyerActionState,
  formData: FormData,
): Promise<BuyerActionState> {
  const parsed = saveProductSchema.safeParse({
    productId: formData.get("productId"),
  });
  if (!parsed.success) {
    return errState("Invalid product.");
  }

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return errState("You must be signed in to save products.");
  }

  const { error } = await supabase
    .from("saved_products")
    .insert({ buyer_id: user.id, product_id: parsed.data.productId });

  if (error) {
    if (error.code === "23505") {
      return okState; // Already saved — idempotent.
    }
    console.error("saveProduct failed:", error.code, error.message);
    return errState("Could not save the product. Try again.");
  }

  revalidatePath("/account/saved");
  return okState;
}

export async function unsaveProduct(
  _prev: BuyerActionState,
  formData: FormData,
): Promise<BuyerActionState> {
  const parsed = saveProductSchema.safeParse({
    productId: formData.get("productId"),
  });
  if (!parsed.success) {
    return errState("Invalid product.");
  }

  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) {
    return errState("You must be signed in.");
  }

  const { error } = await supabase
    .from("saved_products")
    .delete()
    .eq("buyer_id", user.id)
    .eq("product_id", parsed.data.productId);

  if (error) {
    console.error("unsaveProduct failed:", error.code, error.message);
    return errState("Could not remove the product. Try again.");
  }

  revalidatePath("/account/saved");
  return okState;
}

// ---------------------------------------------------------------------------
// Recently viewed
// ---------------------------------------------------------------------------

export async function recordRecentlyViewed(productId: string): Promise<void> {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return;

  // Upsert: update last_viewed_at if the row already exists.
  const { error } = await supabase
    .from("recently_viewed")
    .upsert(
      { buyer_id: user.id, product_id: productId, last_viewed_at: new Date().toISOString() },
      { onConflict: "buyer_id,product_id" },
    );

  if (error) {
    console.error("recordRecentlyViewed failed:", error.code, error.message);
    return;
  }

  // Trim history to the 50 most recent rows for this buyer.
  // Delete rows that are older than the 50th most recent.
  const { data: recentIds } = await supabase
    .from("recently_viewed")
    .select("id")
    .eq("buyer_id", user.id)
    .order("last_viewed_at", { ascending: false })
    .limit(50);

  if (recentIds && recentIds.length === 50) {
    const keepIds = new Set(recentIds.map((r) => r.id as string));
    await supabase
      .from("recently_viewed")
      .delete()
      .eq("buyer_id", user.id)
      .not("id", "in", `[${[...keepIds].join(",")}]`);
  }
}
