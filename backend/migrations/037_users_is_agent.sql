ALTER TABLE users
  ADD COLUMN is_agent TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1=手动标记为代理账号' AFTER zaizhi_cert_unlocked;
