
import crypto from "node:crypto";

type Entry = { fingerprint: string; createdAt: number; response: unknown };

export class IdempotencyCache {
  private readonly entries = new Map<string, Entry>();
  constructor(private readonly ttlMs = 15 * 60_000, private readonly maxEntries = 10_000) {}
  fingerprint(value: unknown) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
  get(key: string, fingerprint: string, now = Date.now()) {
    const entry = this.entries.get(key);
    if (!entry || now - entry.createdAt > this.ttlMs) { this.entries.delete(key); return null; }
    if (entry.fingerprint !== fingerprint) throw new Error("Idempotency-Key was reused with a different request.");
    return entry.response;
  }
  set(key: string, fingerprint: string, response: unknown, now = Date.now()) {
    if (this.entries.size >= this.maxEntries) this.prune(now);
    this.entries.set(key, { fingerprint, createdAt: now, response });
  }
  prune(now = Date.now()) { for (const [key, entry] of this.entries) if (now - entry.createdAt > this.ttlMs) this.entries.delete(key); }
}


