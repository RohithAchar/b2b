import type { SupabaseClient } from "@supabase/supabase-js";
import {
  IMAGE_SEARCH_DEFAULT_THRESHOLD,
  IMAGE_SEARCH_MATCH_COUNT,
  type ImageSearchResult,
} from "./image-search-config.ts";
import { dedupeImageMatches } from "./image-search-matches.ts";
import { IMAGE_EMBEDDING_MODEL } from "./image-embedding-model.ts";

/**
 * Server-only. Runs the pgvector similarity search for one uploaded image.
 *
 * The query vector is passed straight to match_product_images and is never
 * written anywhere, so the buyer's photo leaves no trace beyond the product ids
 * that come back.
 */

type RpcMatchRow = {
  product_image_id: string;
  product_id: string;
  similarity: number;
};

export type ProductImageSearchResult = {
  results: ImageSearchResult[];
  /** Image rows the RPC returned before de-duplication. Logged, not returned. */
  imageMatches: number;
  /** Wall-clock duration of the RPC call. */
  rpcMs: number;
};

export class ImageSearchUnavailableError extends Error {
  // Same reason as ImageEmbeddingError.cause: strip-only TypeScript.
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ImageSearchUnavailableError";
    this.cause = cause;
  }
}

/**
 * Rank storefront products against a query embedding.
 *
 * Pass the request-scoped Supabase client: the storefront grid is public, so
 * anonymous buyers search through their `anon` grant on the SECURITY DEFINER
 * RPC. No service-role credential is involved in reading.
 */
export async function findSimilarProducts(
  supabase: SupabaseClient,
  embedding: readonly number[],
  options: { threshold?: number; matchCount?: number } = {},
): Promise<ProductImageSearchResult> {
  const startedAt = Date.now();

  const { data, error } = await supabase.rpc("match_product_images", {
    p_query_embedding: embedding as unknown as string,
    p_match_threshold: options.threshold ?? IMAGE_SEARCH_DEFAULT_THRESHOLD,
    p_match_count: options.matchCount ?? IMAGE_SEARCH_MATCH_COUNT,
    p_model: IMAGE_EMBEDDING_MODEL,
  });

  if (error) {
    throw new ImageSearchUnavailableError(error.message);
  }

  const rows = (data ?? []) as RpcMatchRow[];

  return {
    results: dedupeImageMatches(
      rows.map((row) => ({ productId: row.product_id, similarity: row.similarity })),
    ),
    imageMatches: rows.length,
    rpcMs: Date.now() - startedAt,
  };
}