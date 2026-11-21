import type { SupabaseClient } from "@supabase/supabase-js";

/** Most products shown in the "Buy again" rail (also the card loader's limit). */
export const BUY_AGAIN_LIMIT = 12;

type OrderedItem = { product_id: string | null };

/**
 * Distinct product ids from order lines already sorted newest first: the most
 * recent purchase of each product wins, deleted products (null id) are
 * skipped. Pure, so it unit-tests without a database.
 */
export function distinctRecentProductIds(items: OrderedItem[], limit = BUY_AGAIN_LIMIT): string[] {
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.product_id || seen.has(item.product_id)) continue;
    seen.add(item.product_id);
    if (seen.size >= limit) break;
  }
  return [...seen];
}

/**
 * Products this buyer has ordered before, newest first. Reads only their own
 * order lines (RLS: order_items_buyer_select_own). A new account has none, so
 * the "Buy again" section stays hidden.
 */
export async function getBuyAgainProductIds(supabase: SupabaseClient, buyerId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select("product_id, orders!inner(buyer_id)")
    .eq("orders.buyer_id", buyerId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("Buy again lookup failed:", error.code, error.message);
    return [];
  }
  return distinctRecentProductIds((data ?? []) as OrderedItem[]);
}
