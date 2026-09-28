ALTER TABLE users
  ADD COLUMN zaizhi_cert_unlocked TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1=已购买在职/工作证明生成权益（终身无限次）' AFTER lizhi_cert_unlocked;

CREATE TABLE IF NOT EXISTS zaizhi_cert_generations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  demo TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=带演示水印 0=已解锁去水印',
  company_name VARCHAR(128) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_zaizhi_gen_user_time (username, created_at),
  KEY idx_zaizhi_gen_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='C端在职/工作证明生成记录';
