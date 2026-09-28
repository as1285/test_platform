ALTER TABLE users
  ADD COLUMN rename_fee_exempt TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '1=取消五次改名后的收费限制' AFTER banned;

UPDATE users
SET rename_fee_exempt = 1
WHERE username IN ('jing00001', '18355751265', '441623200711050335', 'zqx5201314');
