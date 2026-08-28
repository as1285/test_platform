CREATE TABLE IF NOT EXISTS cert_page_survey (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  product VARCHAR(16) NOT NULL COMMENT 'lizhi|zaizhi',
  sentiment VARCHAR(16) NOT NULL COMMENT 'expensive|fair|cheap|skipped',
  expected_price DECIMAL(10,2) NULL COMMENT '用户心理价位（元）',
  experience VARCHAR(16) NULL COMMENT 'good|ok|bad',
  improve_topic VARCHAR(32) NULL COMMENT 'form|preview|share|pay|price|other',
  seen_price DECIMAL(10,2) NULL COMMENT '用户当时看到的标价',
  unlocked TINYINT(1) NOT NULL DEFAULT 0 COMMENT '提交时是否已开通去水印',
  skipped TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=关闭/跳过未填完整',
  client_id VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uk_cps_user_product (username, product),
  KEY idx_cps_created (created_at),
  KEY idx_cps_product (product),
  KEY idx_cps_sentiment (sentiment)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='C端离职/在职证明离开页调研';
