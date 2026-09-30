/**
 * Pure parsing/URL helpers for the /products listing.
 *
 * These live apart from the page component so they can be unit tested
 * directly, and so the server component and the client filter bar build
 * identical URLs.
 */

export type ProductSort =
  | "relevance"
  | "newest"
  | "price_asc"
  | "price_desc"
  | "moq_asc";

export const VALID_SORTS: ProductSort[] = [
  "relevance",
  "newest",
  "price_asc",
  "price_desc",
  "moq_asc",
];

export function parseSort(value: string | undefined): ProductSort {
  if (value && VALID_SORTS.includes(value as ProductSort)) {
    return value as ProductSort;
  }
  return "relevance";
}

export function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

export function trimQuery(query: string | undefined): string {
  return query?.trim() ?? "";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A malformed ?img= would otherwise be forwarded into the ranking RPC, which
 * would then raise a uuid parse error and take down the whole page.
 */
export function parseImageQueryId(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return UUID_RE.test(trimmed) ? trimmed : null;
}

export type ListUrlParams = {
  query: string;
  categorySlug: string;
  sort: ProductSort;
  minPrice?: string;
  maxPrice?: string;
  minMoq?: string;
  maxMoq?: string;
  inStock?: string;
  negotiable?: string;
  sampleAvailable?: string;
  /** Present only in image-search mode; preserved across filter/page links. */
  imageQueryId?: string | null;
  page: number;
};

/**
 * Build a /products URL that preserves the current mode and filters.
 *
 * In image mode the ordering is visual distance, so `sort` is deliberately
 * dropped: emitting it would let a stale ?sort= re-order an image search
 * and contradict the "most similar first" contract the UI shows.
 */
export function buildPageUrl(params: ListUrlParams): string {
  const sp = new URLSearchParams();
  const imageMode = Boolean(params.imageQueryId);

  if (imageMode) {
    sp.set("img", params.imageQueryId as string);
  } else if (params.query) {
    sp.set("q", params.query);
  }

  if (params.categorySlug) sp.set("category", params.categorySlug);
  if (!imageMode && params.sort !== "relevance") sp.set("sort", params.sort);
  if (params.minPrice) sp.set("minPrice", params.minPrice);
  if (params.maxPrice) sp.set("maxPrice", params.maxPrice);
  if (params.minMoq) sp.set("minMoq", params.minMoq);
  if (params.maxMoq) sp.set("maxMoq", params.maxMoq);
  if (params.inStock === "true") sp.set("inStock", "true");
  if (params.negotiable === "true") sp.set("negotiable", "true");
  if (params.sampleAvailable === "true") sp.set("sampleAvailable", "true");
  sp.set("page", String(params.page));
  return `/products?${sp.toString()}`;
}
