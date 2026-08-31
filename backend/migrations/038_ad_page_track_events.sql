-- 广告页（二次退税）停留与操作明细
CREATE TABLE IF NOT EXISTS ad_page_track_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NULL,
  client_id VARCHAR(128) NULL,
  device_fp CHAR(64) NULL,
  event_key VARCHAR(80) NOT NULL,
  dwell_seconds INT UNSIGNED NULL,
  meta_json VARCHAR(1024) NULL,
  ip VARCHAR(128) NULL,
  user_agent VARCHAR(512) NULL,
  created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_created (created_at),
  INDEX idx_event_created (event_key, created_at),
  INDEX idx_user_created (username, created_at),
  INDEX idx_client_created (client_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
