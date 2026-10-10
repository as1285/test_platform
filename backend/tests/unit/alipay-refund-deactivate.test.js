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
  it('applyActivationRefundForUser bans + deactivates + hides list row', () => {
    const fn = sliceFn(
      monolith,
      'async function applyActivationRefundForUser',
      'async function markAlipayOrderRefunded'
    );
    expect(fn).toContain('account_active = 0');
    expect(fn).toContain('activation_refunded_at');
    expect(fn).toContain('list_hidden_at');
    expect(fn).toContain('banned = 1');
    expect(fn).toContain('session_rev = session_rev + 1');
  });

  it('markAlipayOrderRefunded marks paid->refunded then applies activation refund', () => {
    const fn = sliceFn(
      monolith,
      'async function markAlipayOrderRefunded',
      'function isAlipayFullRefundNotify'
    );
    expect(fn).toContain("status = 'refunded'");
    expect(fn).toContain('applyActivationRefundForUser');
    expect(fn).toMatch(/String\(locked\.status\) === 'refunded'/);
    expect(fn).toMatch(/String\(locked\.status\) !== 'paid'/);
  });

  it('notify path treats paid + TRADE_CLOSED as refund', () => {
    expect(monolith).toContain('isAlipayFullRefundNotify');
    expect(monolith).toContain("tradeStatus === 'TRADE_CLOSED'");
    expect(monolith).toContain('markAlipayOrderRefunded');
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
