import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const purchase = readFileSync(resolve(__dirname, '../../purchase.html'), 'utf8');

describe('purchase 新站隐藏心理价', () => {
  it('getjob68 关闭出价入口、弹层与心理价文案；旧站逻辑仍保留', () => {
    expect(purchase).toContain('function purchaseHostIsGetjob68');
    expect(purchase).toContain('新站 getjob68 隐藏心理价出价入口；旧站 lkj 仍按 enabled 展示');
    expect(purchase).toContain('新站 getjob68：不开心理价出价 / 返回拦截');
    expect(purchase).toContain('新站不开放心理价出价（含离开页调研「偏贵」接力）');
    expect(purchase).toContain(
      'if (hideAll || !priceBidUi.enabled || purchaseHostIsGetjob68())'
    );
    expect(purchase).toContain('if (hideAll || purchaseHostIsGetjob68())');
    expect(purchase).toMatch(
      /function canOpenPriceBidSheet\(\) \{\s*if \(purchaseHostIsGetjob68\(\)\) return false;/
    );
    expect(purchase).toContain(
      "selected.psych_offer && !purchaseHostIsGetjob68()"
    );
    expect(purchase).toContain(
      "s.psych_offer && !purchaseHostIsGetjob68()"
    );
    /* 旧站入口 DOM / API 仍在，仅新站 Host 短路 */
    expect(purchase).toContain('id="priceBidTeaser"');
    expect(purchase).toContain('/api/payments/price-bid');
  });
});
