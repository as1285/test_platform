-- 邀请有礼：注册奖 30 分钟 + 付费永久激活奖 3 天；均立即生效
ALTER TABLE user_invites
  ADD COLUMN reward_minutes INT NOT NULL DEFAULT 0
    COMMENT '注册奖励分钟数（与 reward_days/hours 叠加）' AFTER reward_days;

ALTER TABLE user_invites
  ADD COLUMN pay_reward_status VARCHAR(16) NOT NULL DEFAULT 'none'
    COMMENT 'none|pending|granted|rejected|skipped_cap' AFTER transferable_code;

ALTER TABLE user_invites
  ADD COLUMN pay_reward_days INT NOT NULL DEFAULT 3
    COMMENT '被邀请人付费永久激活后给邀请人的天数' AFTER pay_reward_status;

ALTER TABLE user_invites
  ADD COLUMN pay_granted_at DATETIME NULL AFTER pay_reward_days;

ALTER TABLE user_invites
  ADD COLUMN pay_transferable_code VARCHAR(64) NULL
    COMMENT '永久邀请人获可转赠时效码（付费奖励）' AFTER pay_granted_at;

ALTER TABLE activation_codes
  ADD COLUMN grant_minutes INT NULL
    COMMENT '时效码分钟；可与 grant_days/hours 叠加' AFTER grant_hours;

ALTER TABLE activation_grants
  MODIFY COLUMN days DECIMAL(12, 6) NOT NULL
    COMMENT '赠送天数（可含小时/分钟折算）';

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('invite_reward_minutes', '30');

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('invite_pay_reward_days', '3');

UPDATE app_settings SET setting_value = '0' WHERE setting_key = 'invite_reward_days';
UPDATE app_settings SET setting_value = '0' WHERE setting_key = 'invite_reward_hours';
UPDATE app_settings SET setting_value = '30' WHERE setting_key = 'invite_reward_minutes';
UPDATE app_settings SET setting_value = '3' WHERE setting_key = 'invite_pay_reward_days';
UPDATE app_settings SET setting_value = '0' WHERE setting_key = 'invite_grant_delay_hours';
