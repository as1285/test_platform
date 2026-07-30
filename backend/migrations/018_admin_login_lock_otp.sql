-- 管理登录加固：邮箱 OTP、连续失败计数与锁定
ALTER TABLE admin_accounts
  ADD COLUMN email VARCHAR(255) NULL COMMENT '管理登录 OTP 收件邮箱' AFTER full_name;

ALTER TABLE admin_accounts
  ADD COLUMN login_fail_count INT NOT NULL DEFAULT 0 COMMENT '连续登录失败次数' AFTER banned;

ALTER TABLE admin_accounts
  ADD COLUMN locked_until DATETIME NULL COMMENT '锁定截止时间' AFTER login_fail_count;
