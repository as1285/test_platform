-- 账号级完税二维码：后台替换一次后，App 再生成沿用此码，不再新生成
CREATE TABLE IF NOT EXISTS user_najilu_qr_override (
  user_id VARCHAR(255) NOT NULL COMMENT '账号 username' PRIMARY KEY,
  query_code VARCHAR(32) NULL,
  qr_image_url VARCHAR(512) NULL,
  qr_block_image_url VARCHAR(512) NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
