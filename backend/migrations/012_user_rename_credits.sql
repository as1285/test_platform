-- 改名付费次数（中高频用户超免费次数后，每次改名消耗 1 次）
CREATE TABLE IF NOT EXISTS user_rename_credits (
  id BIGINT NOT NULL AUTO_INCREMENT,
  username VARCHAR(255) NOT NULL,
  payment_order_id BIGINT NULL,
  out_trade_no VARCHAR(64) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  consumed_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_rename_credit_user_free (username, consumed_at),
  KEY idx_rename_credit_order (payment_order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
