import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const purchaseHtml = readFileSync(resolve(__dirname, '../../purchase.html'), 'utf8');

describe('C-end price bid floor (global min, not channel psych)', () => {
  it('submit path uses priceBidUi.minAmount only (渠道心理价不再当地板)', () => {
    expect(purchaseHtml).toContain('var bidMin = Number(priceBidUi.minAmount) || 0');
    expect(purchaseHtml).not.toContain('resolvePriceBidMinAmount(selectedSku');
    expect(purchaseHtml).not.toContain('sku.bid_min');
    expect(purchaseHtml).toMatch(/出价不能低于 ' \+ bidMin \+ ' 元/);
  });

  it('channel psych copy is strike-above-pay, not bid floor', () => {
    /* 后台渠道心理价文案：划线对照，须高于实付 */
    const adminHtml = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
    expect(adminHtml).toMatch(/须高于实付价/);
    expect(adminHtml).not.toMatch(/C 端出价下限/);
  });
});
