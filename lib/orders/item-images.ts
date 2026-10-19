// Order line items only store a product id snapshot. To show a real thumbnail
// we resolve the first (lowest sort) image per product. product_images has a
// public read policy, so this works for both buyer and supplier views.

import type { SupabaseClient } from "@supabase/supabase-js";
import { publicTransformedImageUrl } from "@/lib/storage";

const BUCKET = "product_images";

/** Map of product id → thumbnail URL for the given order item product ids. */
export async function getOrderItemImages(
  supabase: SupabaseClient,
  productIds: (string | null)[],
): Promise<Map<string, string>> {
  const ids = [...new Set(productIds.filter((id): id is string => Boolean(id)))];
  const thumbnails = new Map<string, string>();
  if (ids.length === 0) {
    return thumbnails;
  }

  const { data } = await supabase
    .from("product_images")
    .select("product_id, path, sort")
    .in("product_id", ids)
    .order("sort", { ascending: true });

  for (const row of (data ?? []) as { product_id: string; path: string }[]) {
    if (!thumbnails.has(row.product_id)) {
      thumbnails.set(
        row.product_id,
        publicTransformedImageUrl(BUCKET, row.path, { width: 96 }),
      );
    }
  }
  return thumbnails;
}
