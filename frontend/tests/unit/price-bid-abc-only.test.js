import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const purchase = readFileSync(resolve(__dirname, '../../purchase.html'), 'utf8');

describe('心理价出价仅 ABC 渠道', () => {
  it('支付页非 ABC 不画出价入口', () => {
    expect(purchase).toContain('function isAbcSalesChannelForPriceBid');
    expect(purchase).toContain("bound === 'abc'");
    expect(purchase).toContain("urlCh === 'abc'");
    expect(purchase).toContain('hideAll || !isAbcSalesChannelForPriceBid() || !priceBidUi.enabled');
    expect(purchase).toContain('hideAll || !isAbcSalesChannelForPriceBid()');
    expect(purchase).toContain('isAbcSalesChannelForPriceBid() &&');
  });
});
