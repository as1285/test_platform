-- 完税二维码替换：付费终身解锁
ALTER TABLE users
  ADD COLUMN najilu_qr_unlocked TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1=已购买完税二维码替换权益（终身）' AFTER zaizhi_cert_unlocked;
