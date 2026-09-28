'use strict';

const {
  normalizeLizhiCertFeeConfig,
  parseLizhiCertFeeConfigFromAdmin,
  formatYuanLabel,
  LIZHI_CERT_FEE_DEFAULT_AMOUNT
} = require('../../src/user/lizhiCertFeePolicy');

describe('lizhiCertFeePolicy', () => {
  it('defaults to 50.00', () => {
    expect(LIZHI_CERT_FEE_DEFAULT_AMOUNT).toBe('50.00');
    expect(normalizeLizhiCertFeeConfig({})).toEqual({ amount: '50.00' });
  });

  it('normalizes and parses admin amount', () => {
    expect(normalizeLizhiCertFeeConfig({ amount: '39.9' })).toEqual({ amount: '39.90' });
    expect(normalizeLizhiCertFeeConfig({ fee_amount: '60' })).toEqual({ amount: '60.00' });
    expect(parseLizhiCertFeeConfigFromAdmin({ amount: '0' })).toBeNull();
    expect(parseLizhiCertFeeConfigFromAdmin({ amount: '-1' })).toBeNull();
    expect(parseLizhiCertFeeConfigFromAdmin({ amount: '45' })).toEqual({ amount: '45.00' });
  });

  it('formats yuan labels', () => {
    expect(formatYuanLabel('50.00')).toBe('50');
    expect(formatYuanLabel('39.90')).toBe('39.90');
  });
});
