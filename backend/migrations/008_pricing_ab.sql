-- 定价 A/B：订单快照字段
ALTER TABLE payment_orders
  ADD COLUMN pricing_variant VARCHAR(16) NULL
    COMMENT 'control|treatment' AFTER amount;

ALTER TABLE payment_orders
  ADD COLUMN sku_id VARCHAR(64) NULL
    COMMENT 'sku_49_24h 等' AFTER pricing_variant;

ALTER TABLE payment_orders
  ADD COLUMN grant_kind VARCHAR(16) NULL
    COMMENT 'trial|permanent' AFTER sku_id;

ALTER TABLE payment_orders
  ADD COLUMN grant_days INT NULL AFTER grant_kind;

ALTER TABLE payment_orders
  ADD COLUMN grant_hours INT NULL AFTER grant_days;

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES
  ('pricing_ab_json', '{"enabled":true,"treatment_percent":50}');
