-- 个税当天无限下单曾写入 pricing_variant=tax_edit_unlimited（18 字），超出 VARCHAR(16) 导致创建订单失败
ALTER TABLE payment_orders
  MODIFY COLUMN pricing_variant VARCHAR(32) NULL
    COMMENT 'control|treatment|tax_daily|rename|…';
