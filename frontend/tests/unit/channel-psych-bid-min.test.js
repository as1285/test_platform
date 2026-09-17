import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';

const purchaseHtml = readFileSync(resolve(__dirname, '../../purchase.html'), 'utf8');

function extractBidMinHelpers() {
  const start = purchaseHtml.indexOf('function formatPriceBidYuan(n)');
  expect(start).toBeGreaterThan(-1);
  const end = purchaseHtml.indexOf('\n    function purchaseBidUserKey', start);
  expect(end).toBeGreaterThan(start);
  return purchaseHtml.slice(start, end);
}

function loadHelpers() {
  const src = extractBidMinHelpers();
  const sandbox = { resultFormat: null, resultResolve: null };
  vm.runInNewContext(
    src + '\nresultFormat = formatPriceBidYuan;\nresultResolve = resolvePriceBidMinAmount;',
    sandbox
  );
  return {
    formatPriceBidYuan: sandbox.resultFormat,
    resolvePriceBidMinAmount: sandbox.resultResolve
  };
}

describe('channel psych bid_min on C-end bid sheet', () => {
  it('uses the higher of global min and sku.bid_min', () => {
    const { resolvePriceBidMinAmount, formatPriceBidYuan } = loadHelpers();
    expect(resolvePriceBidMinAmount(null, 30)).toBe(30);
    expect(resolvePriceBidMinAmount({ amount: '200.00' }, 30)).toBe(30);
    expect(resolvePriceBidMinAmount({ amount: '200.00', bid_min: '100.00' }, 30)).toBe(100);
    expect(resolvePriceBidMinAmount({ amount: '200.00', bid_min: '20' }, 30)).toBe(30);
    expect(formatPriceBidYuan(100)).toBe('100');
    expect(formatPriceBidYuan(99.5)).toBe('99.50');
  });

  it('submit path toasts when bid is below channel psych', () => {
    expect(purchaseHtml).toContain('resolvePriceBidMinAmount(selectedSku, priceBidUi.minAmount)');
    expect(purchaseHtml).toMatch(/出价不能低于 ' \+ formatPriceBidYuan\(bidMin\) \+ ' 元/);
  });
});
