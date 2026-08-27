'use strict';

const {
  normalizeRenameFeeConfig,
  parseRenameFeeConfigFromAdmin,
  formatYuanLabel,
  RENAME_FEE_DEFAULT_AMOUNT
} = require('../../src/user/renameFeePolicy');

describe('renameFeePolicy', () => {
  it('defaults to 10.00', () => {
    expect(RENAME_FEE_DEFAULT_AMOUNT).toBe('10.00');
    expect(normalizeRenameFeeConfig({})).toEqual({ amount: '10.00' });
  });

  it('normalizes and parses admin amount', () => {
    expect(normalizeRenameFeeConfig({ amount: '12.5' })).toEqual({ amount: '12.50' });
    expect(normalizeRenameFeeConfig({ fee_amount: '8' })).toEqual({ amount: '8.00' });
    expect(parseRenameFeeConfigFromAdmin({ amount: '0' })).toBeNull();
    expect(parseRenameFeeConfigFromAdmin({ amount: '15' })).toEqual({ amount: '15.00' });
  });

  it('formats yuan labels', () => {
    expect(formatYuanLabel('10.00')).toBe('10');
    expect(formatYuanLabel('12.50')).toBe('12.50');
  });
});
