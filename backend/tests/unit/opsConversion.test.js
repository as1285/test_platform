'use strict';

const {
  parseSegment,
  parseDays,
  HIGH_INCOME,
  REFUND_AD_MIN_INCOME,
  REFUND_AD_MIN_TAX,
  refundEligibleSql
} = require('../../src/admin/opsConversion');

describe('opsConversion helpers', () => {
  it('defaults unknown segment to all', () => {
    expect(parseSegment('')).toBe('all');
    expect(parseSegment('high_income')).toBe('high_income');
    expect(parseSegment('nope')).toBe('all');
  });

  it('clamps research days', () => {
    expect(parseDays('7', 7)).toBe(7);
    expect(parseDays('0', 7)).toBe(7);
    expect(parseDays('9999', 7)).toBe(366);
  });

  it('keeps high-income threshold at 15000', () => {
    expect(HIGH_INCOME).toBe(15000);
  });

  it('refund eligible sql uses 2023-2025 tax or 150000 income', () => {
    expect(REFUND_AD_MIN_TAX).toBe(5000);
    expect(REFUND_AD_MIN_INCOME).toBe(150000);
    var sql = refundEligibleSql('users.username');
    expect(sql).toContain('2025');
    expect(sql).toContain('2024');
    expect(sql).toContain('2023');
    expect(sql).toContain('150000');
    expect(sql).toContain('示例');
    expect(sql).toContain('users.username');
  });
});
