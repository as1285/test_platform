-- 代理专属渠道：仅激活码 / 隐藏全部自助支付
-- 先加列默认 0，再把 C 方案渠道置为 1（避免误伤已配置 A/B 的代理渠道）

ALTER TABLE agent_channels
  ADD COLUMN hide_self_serve_pay TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '1=仅激活码，隐藏支付宝/闲鱼等自助支付'
  AFTER default_pricing_abc;

UPDATE agent_channels
SET hide_self_serve_pay = 1
WHERE LOWER(TRIM(IFNULL(default_pricing_abc, ''))) IN ('', 'c');

ALTER TABLE agent_channels
  MODIFY COLUMN owner_admin_username VARCHAR(64) NOT NULL DEFAULT '';
