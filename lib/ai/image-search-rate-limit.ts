/**
 * Fixed-window rate limiter for search-by-image.
 *
 * In-process on purpose. CLIP inference is the expensive part of this feature,
 * so the limiter exists to stop one client from monopolising a warm function
 * instance, not to provide a distributed quota. On serverless each instance
 * keeps its own counters, which makes the effective limit scale with the
 * instance count — fine for abuse mitigation, not suitable for billing.
 *
 * A shared store is the only change needed if this ever has to be exact.
 */

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;

// Bounded so a burst of unique IPs cannot grow this without limit.
const MAX_TRACKED_CLIENTS = 5_000;

const globalStore = globalThis as unknown as {
  __imageSearchRateLimit?: Map<string, Bucket>;
};

const buckets: Map<string, Bucket> = (globalStore.__imageSearchRateLimit ??= new Map());

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

export function isImageSearchRateLimited(clientId: string, now = Date.now()): boolean {
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
export function resetImageSearchRateLimit(): void {
  buckets.clear();
}