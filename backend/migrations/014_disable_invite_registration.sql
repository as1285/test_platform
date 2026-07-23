-- 邀请注册 / 邀请有礼功能下线：关闭开关（历史 user_invites / invite_link_clicks / users.invite_code 保留兼容）
UPDATE app_settings SET setting_value = '0' WHERE setting_key = 'invite_enabled';

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('invite_enabled', '0');
