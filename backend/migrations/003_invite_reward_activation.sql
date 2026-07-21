ALTER TABLE users
  ADD COLUMN activation_kind VARCHAR(16) NOT NULL DEFAULT 'none'
    COMMENT 'none|trial|permanent' AFTER account_active;

ALTER TABLE users
  ADD COLUMN active_until DATETIME NULL
    COMMENT 'trial 到期时间；permanent 为 NULL' AFTER activation_kind;

ALTER TABLE users
  ADD COLUMN invite_code VARCHAR(16) NULL
    COMMENT '专属邀请码' AFTER sales_promo_channel;

ALTER TABLE users
  ADD COLUMN invited_by VARCHAR(255) NULL
    COMMENT '邀请人 username（注册时写入，只写一次）' AFTER invite_code;

ALTER TABLE users
  ADD UNIQUE KEY uk_users_invite_code (invite_code);

ALTER TABLE users
  ADD INDEX idx_users_invited_by (invited_by);

ALTER TABLE users
  ADD INDEX idx_users_active_until (activation_kind, active_until);

UPDATE users
SET activation_kind = 'permanent', active_until = NULL
WHERE account_active = 1 AND activation_kind = 'none';

UPDATE users
SET activation_kind = 'none', active_until = NULL
WHERE account_active = 0 AND activation_kind = 'none';

ALTER TABLE activation_codes
  ADD COLUMN grant_days INT NULL
    COMMENT 'NULL=永久；正整数=激活后赠送天数' AFTER expires_at;

CREATE TABLE IF NOT EXISTS user_invites (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  inviter_username VARCHAR(255) NOT NULL,
  invitee_username VARCHAR(255) NOT NULL,
  invitee_client_id VARCHAR(128) NULL,
  registered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  first_activated_at DATETIME NULL,
  reward_status VARCHAR(16) NOT NULL DEFAULT 'none'
    COMMENT 'none|pending|granted|rejected|skipped_cap|skipped_self',
  reward_days INT NOT NULL DEFAULT 7,
  grant_at DATETIME NULL,
  granted_at DATETIME NULL,
  reject_reason VARCHAR(255) NULL,
  transferable_code VARCHAR(64) NULL
    COMMENT '永久邀请人获可转赠时效码',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_invites_invitee (invitee_username),
  INDEX idx_user_invites_inviter_status (inviter_username, reward_status, grant_at),
  INDEX idx_user_invites_client (invitee_client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activation_grants (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  days INT NOT NULL,
  source VARCHAR(32) NOT NULL COMMENT 'invite_reward|trial_code|admin|alipay',
  ref_id VARCHAR(64) NULL,
  active_until_after DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_activation_grants_user (username, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('invite_enabled', '0');

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('invite_reward_days', '7');

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('invite_monthly_cap', '4');

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('invite_grant_delay_hours', '48');
