'use strict';

const { readFileSync } = require('fs');
const { resolve } = require('path');

const monolith = readFileSync(resolve(__dirname, '../../src/legacy/monolith.js'), 'utf8');
const alipay = readFileSync(resolve(__dirname, '../../alipay.js'), 'utf8');
const migration = readFileSync(
  resolve(__dirname, '../../migrations/048_refunded_orders_clear_activation.sql'),
  'utf8'
);

function sliceFn(src, startNeedle, endNeedle) {
  var start = src.indexOf(startNeedle);
  var end = src.indexOf(endNeedle, start + 1);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return src.slice(start, end);
}

describe('alipay refund cancels activation', () => {
  it('clears trial/permanent fields instead of only flipping account_active', () => {
    const fn = sliceFn(
      monolith,
      'async function applyActivationRefundForUser',
      'function isAlipayQueryFullRefund'
    );
    expect(fn).toContain("activation_kind = 'none'");
    expect(fn).toContain('active_until = NULL');
    expect(fn).toContain('isUserEffectivelyActive(row)');
    expect(fn).toContain('account_active = 0');
    expect(fn).toContain('activation_refunded_at');
  });

  it('repairs already-refunded activation orders and skips addons', () => {
    const fn = sliceFn(
      monolith,
      'async function markAlipayOrderRefunded',
      'function isAlipayFullRefundNotify'
    );
    expect(fn).toContain('isNonActivationSkuId(locked.sku_id, locked.grant_kind)');
    expect(fn).toMatch(/status\) === 'refunded'[\s\S]*applyActivationRefundForUser/);
    expect(fn).toContain('sku_id, grant_kind');
  });

  it('query sync treats paid + TRADE_CLOSED as refund', () => {
    const fn = sliceFn(
      monolith,
      'async function syncAlipayOrderWithTrade',
      'async function markAlipayOrderRefunded'
    );
    expect(fn).toContain("status === 'paid'");
    expect(fn).toContain('isAlipayQueryFullRefund');
    expect(fn).toContain('markAlipayOrderRefunded');
    expect(monolith).toContain("String(order.status) === 'pending' || String(order.status) === 'paid'");
  });

  it('queryTrade exposes refundFee for full-refund detection', () => {
    expect(alipay).toContain('refundFee: normalizeAmount(data.refund_fee || data.refundFee)');
  });

  it('backfill migration clears leftover activation after refund', () => {
    expect(migration).toContain("activation_kind = 'none'");
    expect(migration).toContain("status = 'refunded'");
    expect(migration).toContain("later.status = 'paid'");
    expect(migration).toContain('alipay_refund_backfill');
  });
});
