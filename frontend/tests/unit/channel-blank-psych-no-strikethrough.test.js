import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';

const purchaseHtml = readFileSync(resolve(__dirname, '../../purchase.html'), 'utf8');

function extractSkuListAnchorAmount() {
  const start = purchaseHtml.indexOf('function skuListAnchorAmount(sku, allSkus)');
  expect(start).toBeGreaterThan(-1);
  const end = purchaseHtml.indexOf('\n    function pickCheapestSkuId', start);
  expect(end).toBeGreaterThan(start);
  return purchaseHtml.slice(start, end);
}

function loadSkuListAnchorAmount() {
  const src = extractSkuListAnchorAmount();
  const sandbox = { result: null };
  vm.runInNewContext(src + '\nresult = skuListAnchorAmount;', sandbox);
  return sandbox.result;
}

describe('channel blank 心理价位 → no strikethrough', () => {
  it('does not invent ~35% inflated strike for channel_price without list_amount', () => {
    const fn = loadSkuListAnchorAmount();
    expect(fn({ amount: '99.00', channel_price: true }, [])).toBe('');
    expect(fn({ amount: '399.00', channel_price: true, list_amount: '' }, [])).toBe('');
    expect(
      fn({ amount: '300.00', channel_price: true, list_amount: undefined }, [
        { amount: '1998.00', grant_kind: 'permanent' }
      ])
    ).toBe('');
  });

  it('shows channel list_amount strikethrough when higher than sale price', () => {
    const fn = loadSkuListAnchorAmount();
    expect(
      fn({ amount: '399.00', list_amount: '598.00', channel_price: true }, [])
    ).toBe('598');
    expect(
      fn({ amount: '99.00', list_amount: '199.50', channel_price: true }, [])
    ).toBe('199.50');
  });

  it('ignores channel list_amount not above sale price', () => {
    const fn = loadSkuListAnchorAmount();
    expect(
      fn({ amount: '399.00', list_amount: '300.00', channel_price: true }, [])
    ).toBe('');
  });

  it('source comment documents blank psych = no channel strikethrough', () => {
    const chunk = extractSkuListAnchorAmount();
    expect(chunk).toMatch(/留空则不显示渠道划线|无本档 list_amount 即不划线/);
    expect(chunk).not.toMatch(/chInflated/);
  });
});
