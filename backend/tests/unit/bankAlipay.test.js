'use strict';

const {
  getBankProductConfig,
  isCmbPartnerOrderMeta,
  partnerUsername,
  createCmbOutTradeNo,
  CMB_SKU_ID,
  CMB_GRANT_KIND,
  CMB_VARIANT
} = require('../../src/partner/bankAlipay');

describe('bankAlipay partner helpers', () => {
  const prevTitle = process.env.BANK_ALIPAY_PRODUCT_TITLE;
  const prevAmount = process.env.BANK_ALIPAY_PRODUCT_AMOUNT;
  const prevAlipayAmount = process.env.ALIPAY_PRODUCT_AMOUNT;

  afterEach(() => {
    if (prevTitle == null) delete process.env.BANK_ALIPAY_PRODUCT_TITLE;
    else process.env.BANK_ALIPAY_PRODUCT_TITLE = prevTitle;
    if (prevAmount == null) delete process.env.BANK_ALIPAY_PRODUCT_AMOUNT;
    else process.env.BANK_ALIPAY_PRODUCT_AMOUNT = prevAmount;
    if (prevAlipayAmount == null) delete process.env.ALIPAY_PRODUCT_AMOUNT;
    else process.env.ALIPAY_PRODUCT_AMOUNT = prevAlipayAmount;
  });

  it('builds cmb partner username and order no', () => {
    expect(partnerUsername('42')).toBe('cmb:42');
    expect(createCmbOutTradeNo()).toMatch(/^CMB\d{14}[0-9A-F]{16}$/);
  });

  it('detects cmb partner order meta', () => {
    expect(isCmbPartnerOrderMeta({ sku_id: CMB_SKU_ID })).toBe(true);
    expect(isCmbPartnerOrderMeta({ grant_kind: CMB_GRANT_KIND })).toBe(true);
    expect(isCmbPartnerOrderMeta({ pricing_variant: CMB_VARIANT })).toBe(true);
    expect(isCmbPartnerOrderMeta({ sku_id: 'sku_199_perm' })).toBe(false);
  });

  it('reads bank product amount with alipay fallback', () => {
    process.env.BANK_ALIPAY_PRODUCT_TITLE = '招行激活';
    process.env.BANK_ALIPAY_PRODUCT_AMOUNT = '88.5';
    delete process.env.ALIPAY_PRODUCT_AMOUNT;
    var cfg = getBankProductConfig();
    expect(cfg.subject).toBe('招行激活');
    expect(cfg.amount).toBe('88.50');
    expect(cfg.sku_id).toBe(CMB_SKU_ID);

    delete process.env.BANK_ALIPAY_PRODUCT_AMOUNT;
    process.env.ALIPAY_PRODUCT_AMOUNT = '199';
    cfg = getBankProductConfig();
    expect(cfg.amount).toBe('199.00');
  });
});
