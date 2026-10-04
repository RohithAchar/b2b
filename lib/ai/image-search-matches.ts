import { IMAGE_SEARCH_MAX_PRODUCTS, type ImageSearchResult } from "./image-search-config.ts";

/**
 * Collapse image-level matches to products.
 *
 * A product owns several images, so a single product can match on more than one
 * of them. One product is returned once, carrying the highest similarity it
 * scored, and products come back ordered by that score descending. Ties keep
 * first-seen order, which the RPC already sorts by distance, so the ranking is
 * deterministic.
 */
export function dedupeImageMatches(
  matches: readonly ImageSearchResult[],
  maxProducts: number = IMAGE_SEARCH_MAX_PRODUCTS,
): ImageSearchResult[] {
  const bestByProduct = new Map<string, number>();

  for (const match of matches) {
    const current = bestByProduct.get(match.productId);
    if (current === undefined || match.similarity > current) {
      bestByProduct.set(match.productId, match.similarity);
    }
  }

  return [...bestByProduct.entries()]
    .map(([productId, similarity]) => ({ productId, similarity }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, Math.max(0, maxProducts));
}