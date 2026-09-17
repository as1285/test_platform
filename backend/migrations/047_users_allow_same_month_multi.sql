ALTER TABLE users
  ADD COLUMN allow_same_month_multi TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1=允许同月多次添加个税记录（批量写入不自动去重）';
