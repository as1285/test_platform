-- 安装引导埋点按域名归因（与 users.register_site 对齐）
ALTER TABLE install_guide_track_events
  ADD COLUMN request_host VARCHAR(255) NULL COMMENT '请求 Host' AFTER user_agent,
  ADD COLUMN register_site VARCHAR(32) NULL COMMENT '站点 getjob68|lkj|unknown' AFTER request_host;

CREATE INDEX idx_ig_track_site_created ON install_guide_track_events (register_site, created_at);
