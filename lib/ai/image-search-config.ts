/**
 * Tunables for search-by-image. Client-safe (no server imports) so the storefront
 * and the API route read the same limits.
 *
 * MODEL / DIMENSION live in lib/ai/image-embeddings.ts, which is server-only.
 */

/**
 * Minimum cosine similarity for a product image to be returned.
 *
 * This is a distance threshold, NOT a confidence percentage: a result at 0.70
 * does not mean "70% sure this is the same product". CLIP's score distribution
 * depends entirely on the model and on how homogeneous the catalog is, so this
 * number has to be tuned against real queries on real catalog images — raise it
 * to tighten results, lower it to surface more, noisier candidates.
 *
 * Measured floor: two unrelated noise images already score ~0.91 under this
 * model, so the interesting range for photographs sits well below that. See
 * docs/image-search.md for how to re-tune.
 */
export const IMAGE_SEARCH_DEFAULT_THRESHOLD = 0.55;

/**
 * Image rows fetched from match_product_images. Deliberately larger than
 * IMAGE_SEARCH_MAX_PRODUCTS: the RPC ranks individual images and a product with
 * several photos can consume several of these slots, so this has to be
 * comfortably above the product count we want back.
 */
export const IMAGE_SEARCH_MATCH_COUNT = 60;

/**
 * Hard ceiling on products kept after de-duplication, and therefore on how many
 * ids can travel in a result token. Bounds the /products URL.
 */
export const IMAGE_SEARCH_MAX_PRODUCTS = 60;

/** Matches the 5 MB storage trigger limit for the product_images bucket. */
export const IMAGE_SEARCH_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Field name of the uploaded image in the multipart body. */
export const IMAGE_SEARCH_UPLOAD_FIELD = "image";

/**
 * How long a product save waits for image embeddings before giving up and
 * leaving the catalog images un-indexed for `pnpm embeddings:backfill` to pick
 * up. Bounded because the first request after a cold start pays a model
 * download that can take minutes, and a product save must not hang on it.
 */
export const IMAGE_INDEXING_TIMEOUT_MS = 15_000;

/** Page size for the backfill script. */
export const IMAGE_BACKFILL_BATCH_SIZE = 50;

export type ImageSearchResult = {
  productId: string;
  similarity: number;
};

export type ImageSearchResponse = {
  results: ImageSearchResult[];
};