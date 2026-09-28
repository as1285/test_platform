'use strict';

const {
  isAllowSameMonthMulti,
  shouldAutoDedupeTaxRecords,
  parseAllowSameMonthMultiBody
} = require('../../src/shared/taxRecordSameMonthPref');

describe('taxRecordSameMonthPref', () => {
  it('treats 1 / true / "1" as on, everything else off', () => {
    expect(isAllowSameMonthMulti(1)).toBe(true);
    expect(isAllowSameMonthMulti(true)).toBe(true);
    expect(isAllowSameMonthMulti('1')).toBe(true);
    expect(isAllowSameMonthMulti(0)).toBe(false);
    expect(isAllowSameMonthMulti('0')).toBe(false);
    expect(isAllowSameMonthMulti(null)).toBe(false);
    expect(isAllowSameMonthMulti(undefined)).toBe(false);
  });

  it('skips auto-dedupe only when the pref is on', () => {
    expect(shouldAutoDedupeTaxRecords(0)).toBe(true);
    expect(shouldAutoDedupeTaxRecords(1)).toBe(false);
  });

  it('parses request body and requires the field', () => {
    expect(parseAllowSameMonthMultiBody(null)).toBe(null);
    expect(parseAllowSameMonthMultiBody({})).toBe(null);
    expect(parseAllowSameMonthMultiBody({ allow_same_month_multi: 1 })).toBe(1);
    expect(parseAllowSameMonthMultiBody({ allow_same_month_multi: '0' })).toBe(0);
    expect(parseAllowSameMonthMultiBody({ allow_same_month_multi: false })).toBe(0);
  });
});
