CREATE TABLE IF NOT EXISTS user_bilibili_share_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  share_session_id CHAR(36) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  completed_at DATETIME NULL,
  reserved_order_no VARCHAR(64) NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_bilibili_share_user_session (username, share_session_id),
  INDEX idx_bilibili_share_user_reward (username, status, consumed_at, reserved_order_no),
  INDEX idx_bilibili_share_reserved_order (reserved_order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE payment_orders
  ADD COLUMN list_amount DECIMAL(10,2) NULL
    COMMENT '优惠前金额' AFTER amount;

ALTER TABLE payment_orders
  ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00
    COMMENT '分享活动优惠金额' AFTER list_amount;

ALTER TABLE payment_orders
  ADD COLUMN share_discount_count INT NOT NULL DEFAULT 0
    COMMENT '本单使用的有效分享次数' AFTER discount_amount;
