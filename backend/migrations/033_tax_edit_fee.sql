-- 高频改名 / 个税修改天数超限账号：¥20 单次修改额度、¥30 当天无限
CREATE TABLE IF NOT EXISTS user_tax_edit_credits (
  id BIGINT NOT NULL AUTO_INCREMENT,
  username VARCHAR(255) NOT NULL,
  payment_order_id BIGINT NULL,
  out_trade_no VARCHAR(64) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  consumed_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_tax_edit_credit_user_free (username, consumed_at),
  KEY idx_tax_edit_credit_order (payment_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_tax_edit_daily_unlocks (
  id BIGINT NOT NULL AUTO_INCREMENT,
  username VARCHAR(255) NOT NULL,
  unlock_date DATE NOT NULL COMMENT '北京日历日',
  payment_order_id BIGINT NULL,
  out_trade_no VARCHAR(64) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_tax_edit_unlock_user_day (username, unlock_date),
  KEY idx_tax_edit_unlock_order (payment_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
