CREATE TABLE IF NOT EXISTS schema_migrations (
  version INT NOT NULL PRIMARY KEY,
  applied_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS anonymous_sessions (
  owner_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  expires_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS user_state (
  owner_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  schema_version INT NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1,
  payload JSON NOT NULL,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_user_state_session FOREIGN KEY (owner_id) REFERENCES anonymous_sessions(owner_id) ON DELETE CASCADE
) ENGINE=InnoDB;
INSERT IGNORE INTO schema_migrations(version) VALUES (1);
CREATE TABLE IF NOT EXISTS accounts (
  id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  owner_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  email VARCHAR(254) NOT NULL,
  normalized_email VARCHAR(254) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL UNIQUE,
  password_hash VARCHAR(512) NULL,
  google_subject VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_account_owner FOREIGN KEY(owner_id) REFERENCES anonymous_sessions(owner_id) ON DELETE CASCADE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS account_sessions (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  owner_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_account_session FOREIGN KEY(owner_id) REFERENCES anonymous_sessions(owner_id) ON DELETE CASCADE
) ENGINE=InnoDB;
INSERT IGNORE INTO schema_migrations(version) VALUES (2);
CREATE TABLE IF NOT EXISTS source_runs (
  source_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  checked_at DATETIME(6) NOT NULL,
  result VARCHAR(50) NOT NULL,
  candidate_count INT NOT NULL,
  content_hash CHAR(64) NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS intake_candidates (
  id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  source_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  url VARCHAR(2000) NOT NULL,
  title_hint VARCHAR(300) NOT NULL,
  state VARCHAR(30) NOT NULL DEFAULT 'pending_review',
  first_seen_at DATETIME(6) NOT NULL,
  last_seen_at DATETIME(6) NOT NULL
) ENGINE=InnoDB;
INSERT IGNORE INTO schema_migrations(version) VALUES (3);
CREATE TABLE IF NOT EXISTS password_recovery (
  email_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  account_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
  request_id CHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  requested_at DATETIME(6) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  delivered BOOLEAN NOT NULL DEFAULT 0,
  grant_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
  grant_expires_at DATETIME(6) NULL,
  INDEX ix_recovery_expiry(expires_at),
  CONSTRAINT fk_recovery_account FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB;
INSERT IGNORE INTO schema_migrations(version) VALUES (4);
CREATE TABLE IF NOT EXISTS source_pages (
  url_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  source_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  url VARCHAR(2000) NOT NULL,
  attempted_at DATETIME(6) NOT NULL,
  checked_at DATETIME(6) NULL,
  result VARCHAR(50) NOT NULL,
  content_hash CHAR(64) NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS discovered_listings (
  id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  url_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  source_id VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  page_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  payload JSON NOT NULL,
  first_seen_at DATETIME(6) NOT NULL,
  checked_at DATETIME(6) NOT NULL,
  INDEX ix_discovered_source(source_id)
) ENGINE=InnoDB;
INSERT IGNORE INTO schema_migrations(version) VALUES (5);
