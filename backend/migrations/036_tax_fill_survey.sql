CREATE TABLE IF NOT EXISTS tax_fill_survey (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  satisfaction VARCHAR(16) NOT NULL COMMENT 'good|ok|bad|skipped',
  improve_topic VARCHAR(32) NULL COMMENT 'start|paste|manual|generate|list|calc|other',
  suggestion VARCHAR(500) NULL COMMENT '用户优化建议原文',
  skipped TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=关闭/跳过未填完整',
  client_id VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_tfs_username (username),
  KEY idx_tfs_created (created_at),
  KEY idx_tfs_satisfaction (satisfaction)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='C端个税记录填写页体验调研';
