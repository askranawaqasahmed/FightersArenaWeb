// Minimal in-memory sliding-window limiter. Per-instance only: counts reset on
// restart and are not shared across nodes — replace with a DB/redis-backed
// limiter before scaling beyond a single server process.
const buckets = new Map<string, number[]>();

export type RateLimitOptions = { limit: number; windowMs: number };

export function checkRateLimit(key: string, { limit, windowMs }: RateLimitOptions): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  const hits = (buckets.get(key) ?? []).filter((at) => at > windowStart);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 10_000) {
    for (const [bucketKey, bucketHits] of buckets) {
      if (!bucketHits.some((at) => at > windowStart)) buckets.delete(bucketKey);
    }
  }
  return true;
}

export function resetRateLimits() {
  buckets.clear();
}
