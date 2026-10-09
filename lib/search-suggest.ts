/**
 * Shared constants and pure helpers for storefront search suggestions.
 *
 * The suggest API (`/api/search/suggest`) and the client suggestion hook both
 * build on these so query normalization and `ilike` escaping stay identical on
 * each side of the fetch boundary.
 */

export const SUGGEST_MIN_CHARS = 2;
export const SUGGEST_MAX_QUERY = 100;
export const SUGGEST_PRODUCT_LIMIT = 6;
export const SUGGEST_CATEGORY_LIMIT = 4;

export type SuggestProduct = {
  id: string;
  title: string;
};

export type SuggestCategory = {
  id: string;
  name: string;
  slug: string;
};

export type SearchSuggestResponse = {
  products: SuggestProduct[];
  categories: SuggestCategory[];
};

export const EMPTY_SUGGESTIONS: SearchSuggestResponse = {
  products: [],
  categories: [],
};

/** Trim and bound raw input. Returns "" when there is nothing searchable. */
export function normalizeSuggestQuery(value: string | null | undefined): string {
  return (value ?? "").trim().slice(0, SUGGEST_MAX_QUERY);
}

/**
 * Escape user input for a PostgREST `ilike` pattern. `\`, `%`, and `_` are
 * wildcards/escapes in `LIKE` — without this a query like `100%` matches
 * everything containing `100`.
 */
export function escapeIlikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
