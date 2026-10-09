import { NextResponse, type NextRequest } from "next/server";
import { isSearchSuggestRateLimited } from "@/lib/ai/search-suggest-rate-limit";
import {
  EMPTY_SUGGESTIONS,
  normalizeSuggestQuery,
  SUGGEST_MIN_CHARS,
} from "@/lib/search-suggest";
import { getCachedSuggestions } from "@/lib/search-suggestions-server";

/**
 * Live suggestions for the storefront search bars (`StorefrontSearchForm` and
 * the homepage `SearchMegaMenu`).
 *
 * Pipeline per request: normalize → minimum-length gate → per-client rate
 * limit (429 past 120 req/min) → shared 60-second cache keyed by normalized
 * query. The cached fetch uses the publishable key with the same RLS that
 * guards the listing (approved / not-hidden products, active categories),
 * whose policies grant anon and authenticated identical SELECT — so one
 * cache entry is correct for every caller.
 */
export async function GET(request: NextRequest) {
  const q = normalizeSuggestQuery(request.nextUrl.searchParams.get("q"));
  if (q.length < SUGGEST_MIN_CHARS) {
    return NextResponse.json(EMPTY_SUGGESTIONS);
  }

  if (isSearchSuggestRateLimited(clientId(request))) {
    return NextResponse.json(
      { error: "Too many suggestions requests. Wait a moment and try again.", code: "rate_limited" },
      { status: 429 },
    );
  }

  return NextResponse.json(await getCachedSuggestions(q));
}

/**
 * Best-effort client identity for throttling. Trusts forwarding headers only as
 * a rate-limit key, never for authorization. Same shape as the image-search
 * route so both endpoints key clients identically.
 */
function clientId(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
