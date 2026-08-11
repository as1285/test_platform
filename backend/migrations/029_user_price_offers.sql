CREATE TABLE IF NOT EXISTS user_price_offers (
  username VARCHAR(255) NOT NULL,
  sku_id VARCHAR(64) NOT NULL COMMENT '标准开通 SKU，如 sku_600_perm',
  amount DECIMAL(10,2) NOT NULL COMMENT '专属成交价（元）',
  label VARCHAR(64) NULL COMMENT '支付页展示名（可空则用默认+专属价）',
  note VARCHAR(255) NULL COMMENT '后台备注',
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (username),
  KEY idx_upo_enabled_sku (enabled, sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='用户专属报价：覆盖支付页 SKU 金额';
