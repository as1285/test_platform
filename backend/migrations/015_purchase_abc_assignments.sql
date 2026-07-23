-- 支付页 A/B/C sticky 分配（按用户名锁定，改占比不影响已分配用户）
CREATE TABLE IF NOT EXISTS pricing_ab_assignments (
  username VARCHAR(64) NOT NULL,
  variant VARCHAR(8) NOT NULL COMMENT 'a|b|c',
  source VARCHAR(32) NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
