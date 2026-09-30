import type { SupabaseClient } from "@supabase/supabase-js";
import { publicImageUrl } from "@/lib/storage";
import {
  IMAGE_EMBEDDING_MODEL,
  embedImageBatch,
  isImageSearchConfigured,
} from "@/lib/embeddings";

const PRODUCT_IMAGE_BUCKET = "product_images";

/** Free tier is 100 RPM / 100K TPM; a 600x600 image is ~363 tokens. */
const DEFAULT_BATCH_SIZE = 8;

type ProductImageRow = { id: string; path: string };

/**
 * Embed any of a product's images that are missing a vector for the current
 * model, and upsert them into product_image_embeddings.
 *
 * Best-effort by design: an embedding failure must never fail a product save,
 * so callers can ignore the result. Missing rows are picked up later by
 * scripts/backfill-image-embeddings.mjs.
 *
 * Rows for a superseded model are left in place; the ranking RPC only compares
 * rows whose model matches the query, so stale rows are inert but are removed
 * by a re-index rather than silently mixing spaces.
 */
export async function indexProductImages(
  supabase: SupabaseClient,
  productId: string,
  options: { batchSize?: number; signal?: AbortSignal } = {},
): Promise<{ indexed: number; skipped: number }> {
  if (!isImageSearchConfigured()) {
    return { indexed: 0, skipped: 0 };
  }

  const { data: imageRows, error: imageError } = await supabase
    .from("product_images")
    .select("id, path")
    .eq("product_id", productId)
    .order("sort");

  if (imageError || !imageRows || imageRows.length === 0) {
    if (imageError) {
      console.error("indexProductImages: image lookup failed:", imageError.code, imageError.message);
    }
    return { indexed: 0, skipped: 0 };
  }

  const images = imageRows as ProductImageRow[];

  const { data: existingRows } = await supabase
    .from("product_image_embeddings")
    .select("product_image_id")
    .eq("product_id", productId)
    .eq("model", IMAGE_EMBEDDING_MODEL);

  const alreadyIndexed = new Set(
    ((existingRows ?? []) as { product_image_id: string }[]).map((r) => r.product_image_id),
  );

  const pending = images.filter((img) => !alreadyIndexed.has(img.id));
  if (pending.length === 0) {
    return { indexed: 0, skipped: images.length };
  }

  // Product images live in a public bucket, so the provider can fetch them
  // directly. That avoids downloading and re-encoding bytes we already stored.
  const urls = pending.map((img) => publicImageUrl(PRODUCT_IMAGE_BUCKET, img.path));

  const vectors = await embedImageBatch(urls, "retrieval.passage", {
    batchSize: options.batchSize ?? DEFAULT_BATCH_SIZE,
    signal: options.signal,
  });

  const rows = pending.map((img, i) => ({
    product_image_id: img.id,
    product_id: productId,
    model: IMAGE_EMBEDDING_MODEL,
    embedding: vectors[i],
  }));

  const { error: upsertError } = await supabase
    .from("product_image_embeddings")
    .upsert(rows, { onConflict: "product_image_id" });

  if (upsertError) {
    throw new Error(`product_image_embeddings upsert failed: ${upsertError.code} ${upsertError.message}`);
  }

  return { indexed: pending.length, skipped: alreadyIndexed.size };
}
