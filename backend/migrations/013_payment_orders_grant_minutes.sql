-- 支付宝套餐支持分钟级试用（如 9.9 / 30 分钟）
ALTER TABLE payment_orders
  ADD COLUMN grant_minutes INT NULL
    COMMENT '试用分钟；可与 grant_days/hours 叠加' AFTER grant_hours;
