CREATE TABLE IF NOT EXISTS lizhi_cert_generations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  demo TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=带演示水印 0=已解锁去水印',
  company_name VARCHAR(128) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_lizhi_gen_user_time (username, created_at),
  KEY idx_lizhi_gen_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='C端离职证明生成记录';
