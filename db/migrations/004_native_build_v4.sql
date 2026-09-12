
-- MINHAS AI App Builder v4.0 release-control schema.
CREATE TABLE IF NOT EXISTS nativeReleases (
  id varchar(64) PRIMARY KEY,
  state varchar(24) NOT NULL,
  manifestJson longtext NOT NULL,
  gatesJson longtext NOT NULL,
  createdAt bigint NOT NULL,
  updatedAt bigint NOT NULL,
  INDEX idx_nativeReleases_state (state),
  INDEX idx_nativeReleases_created (createdAt)
);

-- Backward-compatible retry guard for installations created before v4.
SET @has_attempts := (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'nativeBuildJobs' AND column_name = 'attempts');
SET @sql := IF(@has_attempts = 0, 'ALTER TABLE nativeBuildJobs ADD COLUMN attempts int NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;


