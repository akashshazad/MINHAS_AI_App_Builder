
CREATE TABLE IF NOT EXISTS nativeReleases (
  id varchar(64) NOT NULL PRIMARY KEY,
  state varchar(24) NOT NULL,
  manifestJson longtext NOT NULL,
  gatesJson longtext NOT NULL,
  createdAt bigint NOT NULL,
  updatedAt bigint NOT NULL,
  KEY idx_nativeReleases_state (state),
  KEY idx_nativeReleases_created (createdAt)
);


