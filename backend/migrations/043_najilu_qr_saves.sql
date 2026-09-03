-- C 端完税二维码替换保存记录（管理台统计用；后台手动替换不计）
CREATE TABLE IF NOT EXISTS najilu_qr_saves (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  demo TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=未付费带水印 0=已解锁去水印',
  mode VARCHAR(16) NOT NULL DEFAULT 'block' COMMENT 'block|qr|clear',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_najilu_qr_saves_user_time (username, created_at),
  KEY idx_najilu_qr_saves_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='C端完税二维码替换保存记录';
