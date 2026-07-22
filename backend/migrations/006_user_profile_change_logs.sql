CREATE TABLE IF NOT EXISTS user_profile_change_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL COMMENT '账号',
  field_key VARCHAR(64) NOT NULL COMMENT '字段：real_name 等',
  before_value VARCHAR(512) NULL,
  after_value VARCHAR(512) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_upc_user_field_time (username, field_key, created_at),
  INDEX idx_upc_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
