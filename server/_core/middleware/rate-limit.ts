
import type { NextFunction, Request, Response } from "express";
import mysql from "mysql2/promise";

type Bucket = { timestamps: number[] };

export class ApiRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  constructor(private readonly limit = 120, private readonly windowMs = 60_000, private readonly maxKeys = 20_000) {}
  check(key: string, now = Date.now()) {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxKeys) this.prune(now);
      bucket = { timestamps: [] };
      this.buckets.set(key, bucket);
    }
    const cutoff = now - this.windowMs;
    bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
    if (bucket.timestamps.length >= this.limit) return { allowed: false, remaining: 0, retryAfterMs: Math.max(1000, bucket.timestamps[0] + this.windowMs - now) };
    bucket.timestamps.push(now);
    return { allowed: true, remaining: Math.max(0, this.limit - bucket.timestamps.length), retryAfterMs: 0 };
  }
  prune(now = Date.now()) {
    const cutoff = now - this.windowMs;
    for (const [key, bucket] of this.buckets) {
      bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
      if (!bucket.timestamps.length) this.buckets.delete(key);
    }
  }
}

class DistributedRateLimiter {
  private pool: mysql.Pool | null = null;
  private ready = false;
  constructor(private readonly url = process.env.DATABASE_URL, private readonly limit = 120, private readonly windowMs = 60_000) {}
  private async ensure() {
    if (!this.url) return false;
    this.pool ??= mysql.createPool(this.url);
    if (!this.ready) {
      await this.pool.execute(`CREATE TABLE IF NOT EXISTS apiRateLimitBuckets (bucketKey varchar(255) primary key, windowStart bigint not null, requestCount int not null, updatedAt bigint not null, index idx_apiRateLimit_updated(updatedAt))`);
      this.ready = true;
    }
    return true;
  }
  async check(key: string, now = Date.now()) {
    if (!(await this.ensure())) return null;
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;
    const [result] = await this.pool!.execute(
      `INSERT INTO apiRateLimitBuckets (bucketKey,windowStart,requestCount,updatedAt) VALUES (?,?,1,?) ON DUPLICATE KEY UPDATE requestCount=IF(windowStart=?,requestCount+1,1),windowStart=IF(windowStart=?,windowStart,?),updatedAt=?`,
      [key, windowStart, now, windowStart, windowStart, windowStart, now],
    );
    const [rows] = await this.pool!.execute(`SELECT windowStart,requestCount FROM apiRateLimitBuckets WHERE bucketKey=? LIMIT 1`, [key]);
    const row = (rows as any[])[0];
    if (!row) return null;
    const count = Number(row.requestCount);
    const start = Number(row.windowStart);
    return { allowed: count <= this.limit, remaining: Math.max(0, this.limit - count), retryAfterMs: count > this.limit ? Math.max(1000, start + this.windowMs - now) : 0 };
  }
}

export function createApiRateLimitMiddleware() {
  const local = new ApiRateLimiter(Number(process.env.API_RATE_LIMIT || 120));
  const distributed = process.env.API_RATE_LIMIT_DISTRIBUTED === "true" ? new DistributedRateLimiter(undefined, Number(process.env.API_RATE_LIMIT || 120)) : null;
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || req.socket.remoteAddress || "unknown";
    try {
      const result = (await distributed?.check(key)) ?? local.check(key);
      res.setHeader("X-RateLimit-Remaining", String(result.remaining));
      if (!result.allowed) {
        res.setHeader("Retry-After", String(Math.ceil(result.retryAfterMs / 1000)));
        return res.status(429).json({ error: "Rate limit exceeded" });
      }
      return next();
    } catch (error) {
      // Rate limiting must fail closed in explicitly distributed mode; local mode remains available.
      if (distributed) return res.status(503).json({ error: "Rate limiting service unavailable" });
      console.error("[rate-limit] failed", error);
      return next();
    }
  };
}


