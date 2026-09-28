ALTER TABLE users
  ADD COLUMN lizhi_cert_unlocked TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1=已购买离职证明生成权益（终身无限次）' AFTER rename_fee_exempt;
