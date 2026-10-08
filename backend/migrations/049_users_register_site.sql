-- 同库双域名：用户注册站点归因（与推广渠道正交）
-- 切换日 SITE_CUTOVER_YMD（默认 2026-10-08）之前一律算 lkj

ALTER TABLE users
  ADD COLUMN register_site VARCHAR(32) NULL COMMENT '注册站点 getjob68|lkj|unknown' AFTER sales_promo_channel,
  ADD COLUMN register_host VARCHAR(255) NULL COMMENT '注册时 Host' AFTER register_site;

CREATE INDEX idx_users_register_site ON users (register_site);

-- 切换日前 → lkj
UPDATE users
SET register_site = 'lkj',
    register_host = COALESCE(NULLIF(TRIM(register_host), ''), 'lkj.qiyun888.top')
WHERE (register_site IS NULL OR TRIM(register_site) = '')
  AND DATE(DATE_ADD(created_at, INTERVAL 8 HOUR)) < '2026-10-08';

-- 其余未写入 → unknown（上线后新注册会按请求 Host 写入）
UPDATE users
SET register_site = 'unknown'
WHERE register_site IS NULL OR TRIM(register_site) = '';
