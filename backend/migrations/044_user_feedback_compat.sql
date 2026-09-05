-- 兼容 BUG 反馈：在已有 user_feedback 上补截图、设备与联系方式
ALTER TABLE user_feedback
  ADD COLUMN image_urls TEXT NULL COMMENT 'JSON 数组：private/compat-feedback/...' AFTER content,
  ADD COLUMN user_agent VARCHAR(512) NULL AFTER image_urls,
  ADD COLUMN device_info VARCHAR(255) NULL AFTER user_agent,
  ADD COLUMN contact VARCHAR(64) NULL AFTER device_info;
