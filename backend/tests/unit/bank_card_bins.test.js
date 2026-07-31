'use strict';

const { inferBankNameFromCardNo } = require('../../bank_card_bins');

describe('bank_card_bins', () => {
  it('matches longest prefix', () => {
    expect(inferBankNameFromCardNo('6222021234567890')).toBe('中国工商银行');
    expect(inferBankNameFromCardNo('6227 0012 3456 7890')).toBe('中国建设银行');
    expect(inferBankNameFromCardNo('6214830011223344')).toBe('招商银行');
  });

  it('falls back for unknown', () => {
    expect(inferBankNameFromCardNo('9999999999999999')).toBe('银行卡');
    expect(inferBankNameFromCardNo('')).toBe('银行卡');
  });
});
