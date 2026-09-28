-- 代理专属渠道：渠道级 SKU 专属价（JSON：sku_id → amount）
ALTER TABLE agent_channels
  ADD COLUMN sku_prices_json TEXT NULL COMMENT '渠道专属价 JSON，如 {"sku_300_7d":"199.00"}；空=全站价' AFTER ios_mobileconfig_url;
