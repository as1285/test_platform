'use strict';

const {
  normalizeNajiluQrFeeConfig,
  parseNajiluQrFeeConfigFromAdmin,
  NAJILU_QR_FEE_DEFAULT_AMOUNT,
  isNajiluQrSkuId
} = require('../../src/user/najiluQrFeePolicy');

describe('najiluQrFeePolicy', () => {
  it('defaults to 300.00', () => {
    expect(NAJILU_QR_FEE_DEFAULT_AMOUNT).toBe('300.00');
    expect(normalizeNajiluQrFeeConfig({})).toEqual({ amount: '300.00' });
  });

  it('parses admin body', () => {
    expect(parseNajiluQrFeeConfigFromAdmin({ amount: '299' })).toEqual({ amount: '299.00' });
    expect(parseNajiluQrFeeConfigFromAdmin({ amount: '0' })).toBeNull();
  });

  it('recognizes sku', () => {
    expect(isNajiluQrSkuId('sku_najilu_qr_300')).toBe(true);
    expect(isNajiluQrSkuId('sku_lizhi_cert_50')).toBe(false);
  });
});
