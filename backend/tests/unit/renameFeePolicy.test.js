'use strict';

const {
  normalizeRenameFeeConfig,
  parseRenameFeeConfigFromAdmin,
  formatYuanLabel,
  isRenameFeeCharged,
  RENAME_FEE_DEFAULT_AMOUNT
} = require('../../src/user/renameFeePolicy');

describe('renameFeePolicy', () => {
  it('defaults to 10.00', () => {
    expect(RENAME_FEE_DEFAULT_AMOUNT).toBe('10.00');
    expect(normalizeRenameFeeConfig({})).toEqual({ amount: '10.00' });
  });

  it('normalizes and parses admin amount including 0', () => {
    expect(normalizeRenameFeeConfig({ amount: '12.5' })).toEqual({ amount: '12.50' });
    expect(normalizeRenameFeeConfig({ fee_amount: '8' })).toEqual({ amount: '8.00' });
    expect(parseRenameFeeConfigFromAdmin({ amount: '0' })).toEqual({ amount: '0.00' });
    expect(parseRenameFeeConfigFromAdmin({ amount: '0.00' })).toEqual({ amount: '0.00' });
    expect(parseRenameFeeConfigFromAdmin({ amount: '-1' })).toBeNull();
    expect(parseRenameFeeConfigFromAdmin({ amount: '15' })).toEqual({ amount: '15.00' });
  });

  it('does not charge when amount is 0', () => {
    expect(isRenameFeeCharged('0')).toBe(false);
    expect(isRenameFeeCharged('0.00')).toBe(false);
    expect(isRenameFeeCharged('10')).toBe(true);
    expect(isRenameFeeCharged('0.01')).toBe(true);
  });

  it('formats yuan labels', () => {
    expect(formatYuanLabel('10.00')).toBe('10');
    expect(formatYuanLabel('12.50')).toBe('12.50');
    expect(formatYuanLabel('0.00')).toBe('0');
  });
});
