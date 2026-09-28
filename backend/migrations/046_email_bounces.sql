CREATE TABLE IF NOT EXISTS email_bounces (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  username VARCHAR(255) NULL,
  bounce_type VARCHAR(16) NOT NULL DEFAULT 'hard' COMMENT 'hard|soft',
  reason VARCHAR(255) NULL,
  subject VARCHAR(255) NULL,
  message_id VARCHAR(255) NULL,
  first_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hit_count INT UNSIGNED NOT NULL DEFAULT 1,
  dismissed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_email_bounce (email),
  KEY idx_bounce_type (bounce_type, dismissed_at),
  KEY idx_bounce_last (last_seen_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='SMTP 退信收集：用于判断用户邮箱是否有效';
