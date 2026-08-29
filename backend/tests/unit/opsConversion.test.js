'use strict';

const { parseSegment, parseDays, HIGH_INCOME } = require('../../src/admin/opsConversion');

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
});
