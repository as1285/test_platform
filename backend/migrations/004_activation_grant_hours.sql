ALTER TABLE activation_codes
  ADD COLUMN grant_hours INT NULL
    COMMENT '激活后赠送小时数；可与 grant_days 叠加' AFTER grant_days;

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('invite_reward_hours', '0');
