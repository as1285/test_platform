-- 代理专属渠道：渠道 ID 绑定下属代理账号，注册/登录用户归其名下，并可强制默认支付方案（通常为 C）
CREATE TABLE IF NOT EXISTS agent_channels (
  channel_id VARCHAR(64) NOT NULL COMMENT '推广渠道 ch，如 agent_zhang',
  owner_admin_username VARCHAR(64) NOT NULL COMMENT '下属代理后台账号',
  default_pricing_abc VARCHAR(8) NOT NULL DEFAULT '' COMMENT 'a|b|c，空=跟随增长分流',
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (channel_id),
  KEY idx_agent_channels_owner (owner_admin_username),
  KEY idx_agent_channels_enabled (enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户归属下属代理（由专属渠道注册/登录写入；与激活码上线并行，用于子管理员可见范围）
ALTER TABLE users
  ADD COLUMN owner_agent_admin VARCHAR(64) NULL COMMENT '专属渠道绑定的下属代理账号' AFTER sales_promo_channel;
