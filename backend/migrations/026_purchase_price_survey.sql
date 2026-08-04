CREATE TABLE IF NOT EXISTS purchase_price_survey (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  sentiment VARCHAR(16) NOT NULL COMMENT 'expensive|fair|cheap',
  expected_price DECIMAL(10,2) NULL COMMENT '用户心理价位（元）',
  seen_sku_min DECIMAL(10,2) NULL,
  seen_sku_max DECIMAL(10,2) NULL,
  skipped TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=关闭/跳过未填完整',
  client_id VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_pps_username (username),
  KEY idx_pps_created (created_at),
  KEY idx_pps_sentiment (sentiment)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='支付页首次退出价格调研';
