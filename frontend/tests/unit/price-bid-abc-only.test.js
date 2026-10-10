import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const purchase = readFileSync(resolve(__dirname, '../../purchase.html'), 'utf8');

describe('心理价出价仅 ABC 渠道', () => {
  it('支付页非 ABC 不画出价入口', () => {
    /* 出价入口现由 priceBidUi.enabled（接口）控制；仍保留 ABC 渠道辅助 */
    expect(purchase).toContain('function renderPriceBidEntry');
    expect(purchase).toContain('function syncPriceBidEntry');
    expect(purchase).toContain('hideAll || !priceBidUi.enabled');
    expect(purchase).toContain('function getPurchaseAbc');
    expect(purchase).toContain("getPurchaseAbc()");
    expect(purchase).toContain('price-bid');
  });
});
