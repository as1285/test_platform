-- 运营向用户邮箱群发记录（按批次）
CREATE TABLE IF NOT EXISTS user_email_sends (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id VARCHAR(64) NOT NULL,
  username VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(200) NOT NULL,
  audience VARCHAR(64) NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'sent' COMMENT 'sent|failed|skipped',
  error_msg VARCHAR(512) NULL,
  admin_username VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_ues_batch (batch_id),
  KEY idx_ues_user (username),
  KEY idx_ues_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='运营邮件群发明细';
