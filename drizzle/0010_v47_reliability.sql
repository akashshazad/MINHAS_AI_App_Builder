
-- v4.7 reliability hardening. Idempotent for already-created installations.
ALTER TABLE nativeBuildJobs ADD COLUMN IF NOT EXISTS executionToken varchar(64) NULL;
CREATE TABLE IF NOT EXISTS apiRateLimitBuckets (
  bucketKey varchar(255) PRIMARY KEY,
  windowStart bigint NOT NULL,
  requestCount int NOT NULL,
  updatedAt bigint NOT NULL,
  INDEX idx_apiRateLimit_updated(updatedAt)
);


