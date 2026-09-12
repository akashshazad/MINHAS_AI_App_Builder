
CREATE TABLE IF NOT EXISTS nativeBuildAuditEvents (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  entityType VARCHAR(32) NOT NULL,
  entityId VARCHAR(128) NOT NULL,
  action VARCHAR(64) NOT NULL,
  actor VARCHAR(128) NOT NULL,
  metadataJson LONGTEXT NULL,
  createdAt BIGINT NOT NULL,
  INDEX idx_nativeBuildAudit_entity (entityType, entityId, createdAt)
);


