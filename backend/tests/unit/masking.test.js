'use strict';

const {
  maskEmailAddress,
  maskBankCardNo,
  maskBankCardNoShort
} = require('../../src/domain/masking');

describe('domain/masking', () => {
  it('masks email local part', () => {
    expect(maskEmailAddress('ab@example.com')).toBe('a*@example.com');
    expect(maskEmailAddress('alice@example.com')).toBe('al***@example.com');
    expect(maskEmailAddress('bad')).toBe('***');
  });

  it('masks bank card numbers', () => {
    expect(maskBankCardNo('6222021234567890')).toBe('6222 **** 7890');
    expect(maskBankCardNo('123')).toBe('****');
    expect(maskBankCardNo('')).toBe('—');
  });

  it('maskBankCardNoShort keeps last 4', () => {
    expect(maskBankCardNoShort('6222021234567890')).toMatch(/7890$/);
  });
});
