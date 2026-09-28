-- 代理专属渠道：未配置/空 default_pricing_abc 一律按 C（不再跟随增长分流）
UPDATE agent_channels
SET default_pricing_abc = 'c'
WHERE TRIM(IFNULL(default_pricing_abc, '')) = '';

ALTER TABLE agent_channels
  MODIFY COLUMN default_pricing_abc VARCHAR(8) NOT NULL DEFAULT 'c'
    COMMENT 'a|b|c，空亦按 c（代理专属默认 C）';
