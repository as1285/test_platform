'use strict';

const {
  normalizeTaxRecordsPolicy,
  parseTaxRecordsPolicyFromAdmin,
  isAllowMultiplePerMonth,
  defaultTaxRecordsPolicy,
  parseBoolFlag
} = require('../../src/tax/taxRecordsPolicy');

describe('taxRecordsPolicy', () => {
  it('defaults to one record per month', () => {
    expect(defaultTaxRecordsPolicy()).toEqual({ allow_multiple_per_month: false });
    expect(normalizeTaxRecordsPolicy({})).toEqual({ allow_multiple_per_month: false });
    expect(isAllowMultiplePerMonth(null)).toBe(false);
  });

  it('parses common truthy flags', () => {
    expect(parseBoolFlag('1')).toBe(true);
    expect(parseBoolFlag('true')).toBe(true);
    expect(parseBoolFlag(true)).toBe(true);
    expect(normalizeTaxRecordsPolicy({ allow_multiple_per_month: 'on' })).toEqual({
      allow_multiple_per_month: true
    });
    expect(isAllowMultiplePerMonth({ allow_multiple_per_month: 1 })).toBe(true);
  });

  it('admin parser matches normalize', () => {
    expect(parseTaxRecordsPolicyFromAdmin({ allow_multiple_per_month: false })).toEqual({
      allow_multiple_per_month: false
    });
    expect(parseTaxRecordsPolicyFromAdmin({ allow_multiple_per_month: true })).toEqual({
      allow_multiple_per_month: true
    });
  });
});
