import { unstable_cache } from "next/cache";
import { createClient as createAnonClient } from "@supabase/supabase-js";
import {
  escapeIlikePattern,
  SUGGEST_CATEGORY_LIMIT,
  SUGGEST_PRODUCT_LIMIT,
  type SearchSuggestResponse,
} from "./search-suggest";

/**
 * Cached suggestion reads for `/api/search/suggest`.
 *
 * Mirrors `lib/storefront-cache.ts`: builds its own cookie-less anon client
 * internally so the function is cacheable (the cookie-bound client in
 * `lib/supabase/server.ts` would opt out of the Data Cache). RLS still
 * applies, and the predicates match the storefront listing exactly
 * (approved / not-hidden products, active categories), whose policies grant
 * anon and authenticated the same SELECT — so one shared cache entry is
 * correct for every caller.
 *
 * Entries live 60 seconds: popular prefixes ("cotton", "steel") are served
 * from memory across shoppers and keystrokes, while new approvals surface
 * within a minute.
 */
function makePublicClient() {
  return createAnonClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function fetchSuggestions(query: string): Promise<SearchSuggestResponse> {
  const pattern = `%${escapeIlikePattern(query)}%`;
  const supabase = makePublicClient();

  const [productsRes, categoriesRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, title")
      .eq("status", "approved")
      .eq("is_hidden", false)
      .ilike("title", pattern)
      .order("created_at", { ascending: false })
      .limit(SUGGEST_PRODUCT_LIMIT),
    supabase
      .from("categories")
      .select("id, name, slug")
      .eq("is_active", true)
      .ilike("name", pattern)
      .order("name")
      .limit(SUGGEST_CATEGORY_LIMIT),
  ]);

  // Degrade to whatever half succeeded: a suggestions dropdown must never
  // break typing. Failures are logged server-side for debugging.
  if (productsRes.error) {
    console.error("[search-suggest] products query failed:", productsRes.error.message);
  }
  if (categoriesRes.error) {
    console.error("[search-suggest] categories query failed:", categoriesRes.error.message);
  }

  return {
    products: (productsRes.data ?? []) as SearchSuggestResponse["products"],
    categories: (categoriesRes.data ?? []) as SearchSuggestResponse["categories"],
  };
}

export const getCachedSuggestions = unstable_cache(fetchSuggestions, ["search-suggest"], {
  revalidate: 60,
});
