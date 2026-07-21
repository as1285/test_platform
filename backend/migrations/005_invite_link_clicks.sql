CREATE TABLE IF NOT EXISTS invite_link_clicks (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  invite_code VARCHAR(16) NOT NULL,
  inviter_username VARCHAR(255) NULL,
  visitor_client_id VARCHAR(128) NULL,
  visitor_ip VARCHAR(64) NULL,
  page_path VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_invite_clicks_code_time (invite_code, created_at),
  INDEX idx_invite_clicks_inviter_time (inviter_username, created_at),
  INDEX idx_invite_clicks_dedupe (invite_code, visitor_client_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
