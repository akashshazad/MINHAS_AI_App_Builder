
export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterMs: number };

type Bucket = { started: number[] };

/** Small in-process guard. In multi-instance production, place a shared rate limiter at the edge. */
export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  constructor(private readonly limit = 30, private readonly windowMs = 60_000, private readonly maxKeys = 10_000) {}
  check(key: string, now = Date.now()): RateLimitResult {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxKeys) this.prune(now);
      bucket = { started: [] };
      this.buckets.set(key, bucket);
    }
    const cutoff = now - this.windowMs;
    bucket.started = bucket.started.filter((t) => t > cutoff);
    if (bucket.started.length >= this.limit) {
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(1_000, bucket.started[0] + this.windowMs - now) };
    }
    bucket.started.push(now);
    return { allowed: true, remaining: Math.max(0, this.limit - bucket.started.length), retryAfterMs: 0 };
  }
  prune(now = Date.now()) {
    const cutoff = now - this.windowMs;
    for (const [key, bucket] of this.buckets) {
      bucket.started = bucket.started.filter((t) => t > cutoff);
      if (!bucket.started.length) this.buckets.delete(key);
    }
  }
}


