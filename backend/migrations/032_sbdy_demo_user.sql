ALTER TABLE users
  ADD COLUMN sbdy_demo_unlocked TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1=已购买社保演示生成权益（终身无限次）' AFTER zaizhi_cert_unlocked;

ALTER TABLE sbdy_demo_certs
  ADD COLUMN created_by_user VARCHAR(64) NULL COMMENT 'C端生成用户名（App 内自助）' AFTER created_by_admin;
