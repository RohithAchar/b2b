/**
 * Fixed-window rate limiter for search suggestions.
 *
 * Mirrors `image-search-rate-limit.ts`: in-process on purpose, per-client
 * buckets on a shared global so warm instances reuse counters, bounded client
 * map with pruning. The quota is deliberately loose — suggestions are cheap
 * substring reads and legitimate typing produces a steady trickle (one request
 * per 200 ms debounce) — so this only bites sustained hammering, not shoppers.
 */

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 120;

// Bounded so a burst of unique IPs cannot grow this without limit.
const MAX_TRACKED_CLIENTS = 5_000;

const globalStore = globalThis as unknown as {
  __searchSuggestRateLimit?: Map<string, Bucket>;
};

const buckets: Map<string, Bucket> = (globalStore.__searchSuggestRateLimit ??= new Map());

function prune(now: number): void {
  if (buckets.size < MAX_TRACKED_CLIENTS) return;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still oversized (every bucket live): drop the oldest insertion.
  while (buckets.size >= MAX_TRACKED_CLIENTS) {
    const oldest = buckets.keys().next();
    if (oldest.done) break;
    buckets.delete(oldest.value);
  }
}

export function isSearchSuggestRateLimited(clientId: string, now = Date.now()): boolean {
  const bucket = buckets.get(clientId);

  if (!bucket || bucket.resetAt <= now) {
    prune(now);
    buckets.set(clientId, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  bucket.count += 1;
  return bucket.count > MAX_REQUESTS_PER_WINDOW;
}

/** Test seam: drops all counters. */
export function resetSearchSuggestRateLimit(): void {
  buckets.clear();
}
