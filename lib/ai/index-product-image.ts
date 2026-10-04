import type { SupabaseClient } from "@supabase/supabase-js";
// Explicit .ts specifiers: this module is also loaded by
// scripts/backfill-product-image-embeddings.ts through Node's native TypeScript
// support, which does not do extensionless resolution.
import { publicImageUrl } from "../storage.ts";
import { IMAGE_INDEXING_TIMEOUT_MS } from "./image-search-config.ts";
import { IMAGE_EMBEDDING_MODEL } from "./image-embedding-model.ts";
import { getImageEmbeddingViaService } from "./image-inference-client.ts";

/**
 * Server-only. Generates and stores CLIP embeddings for catalog product images.
 *
 * Embeddings always come from the shared inference service
 * (services/image-search/) via getImageEmbeddingViaService — this module never
 * imports the local Transformers.js runtime, so no app route or server action
 * that reaches it can pull ML/native binaries into the Vercel bundle. Offline
 * CLI runs without service credentials use the local path inside
 * scripts/backfill-product-image-embeddings.ts instead.
 *
 * Writes go through a service-role client (lib/supabase/admin.ts) because
 * product_image_embeddings deliberately grants nothing to anon/authenticated;
 * the table is only ever written from here.
 */

export type ProductImageSource = {
  id: string;
  product_id: string;
  path: string;
};

export type IndexOutcome = { indexed: number; failed: number };

const PRODUCT_IMAGES_BUCKET = "product_images";

/** Fetch bytes for one catalog image. The bucket is public (see the migration). */
async function fetchImageBytes(url: string): Promise<Blob> {
  const response = await fetch(url, { cache: "force-cache" });
  if (!response.ok) {
    throw new Error(`storage returned ${response.status}`);
  }
  return response.blob();
}

/**
 * Embed one product image and upsert it.
 *
 * Upsert on (product_image_id, model) so re-running replaces the vector instead
 * of accumulating duplicates — that is what makes indexing retryable.
 */
export async function indexProductImage(
  supabase: SupabaseClient,
  image: ProductImageSource,
): Promise<void> {
  const blob = await fetchImageBytes(publicImageUrl(PRODUCT_IMAGES_BUCKET, image.path));
  const embedding = await getImageEmbeddingViaService(blob);

  const { error } = await supabase.from("product_image_embeddings").upsert(
    {
      product_image_id: image.id,
      product_id: image.product_id,
      embedding,
      model: IMAGE_EMBEDDING_MODEL,
    },
    { onConflict: "product_image_id,model" },
  );

  if (error) {
    throw new Error(`could not store embedding: ${error.message}`);
  }
}

async function indexImages(supabase: SupabaseClient, productId: string): Promise<IndexOutcome> {
  const { data, error } = await supabase
    .from("product_images")
    .select("id, product_id, path")
    .eq("product_id", productId);

  if (error) {
    throw new Error(`could not read product images: ${error.message}`);
  }

  const images = (data ?? []) as ProductImageSource[];
  const outcome: IndexOutcome = { indexed: 0, failed: 0 };

  for (const image of images) {
    try {
      await indexProductImage(supabase, image);
      outcome.indexed += 1;
    } catch (err) {
      outcome.failed += 1;
      console.error(
        `[image-search] indexing failed for image ${image.id}: ${(err as Error).message}`,
      );
    }
  }

  return outcome;
}

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    const timer = setTimeout(() => {
      console.warn(
        `[image-search] ${label} exceeded ${ms}ms and was abandoned; run \`pnpm embeddings:backfill\` to finish it.`,
      );
      resolve(null);
    }, ms);

    work
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        console.error(`[image-search] ${label} failed: ${(err as Error).message}`);
        resolve(null);
      });
  });
}

/**
 * Index every image of a product after a save.
 *
 * Never throws and never rejects: a product save must succeed even when the
 * model cannot load, a storage object is missing, or the insert fails.
 *
 * Awaited rather than fire-and-forget because a detached promise is not
 * guaranteed to run on a serverless runtime once the response is flushed, and
 * an un-indexed image is a silently degraded search. The bounded timeout is
 * what keeps the admin UI responsive: with a warm model this is ~100 ms per
 * image, while a cold start would otherwise block the save on a model download.
 * Anything the timeout drops stays re-indexable via `pnpm embeddings:backfill`.
 */
export async function indexProductImages(
  supabase: SupabaseClient,
  productId: string,
): Promise<IndexOutcome> {
  const startedAt = Date.now();

  const outcome = await withTimeout(
    indexImages(supabase, productId),
    IMAGE_INDEXING_TIMEOUT_MS,
    `indexing images for product ${productId}`,
  );

  if (outcome) {
    console.log(
      `[image-search] product ${productId}: ${outcome.indexed} embedded, ${outcome.failed} failed in ${Date.now() - startedAt}ms`,
    );
  }

  return outcome ?? { indexed: 0, failed: 0 };
}