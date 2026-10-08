'use strict';

const {
  normalizeCmbActivateFeeConfig,
  parseCmbActivateFeeConfigFromAdmin,
  titleFromGrantDays,
  CMB_ACTIVATE_FEE_DEFAULT_AMOUNT,
  CMB_ACTIVATE_FEE_DEFAULT_GRANT_DAYS
} = require('../../src/partner/cmbActivateFeePolicy');

describe('cmbActivateFeePolicy', () => {
  const prevBankAmount = process.env.BANK_ALIPAY_PRODUCT_AMOUNT;
  const prevBankTitle = process.env.BANK_ALIPAY_PRODUCT_TITLE;
  const prevBankDays = process.env.BANK_ALIPAY_GRANT_DAYS;
  const prevAlipayAmount = process.env.ALIPAY_PRODUCT_AMOUNT;

  afterEach(() => {
    if (prevBankAmount == null) delete process.env.BANK_ALIPAY_PRODUCT_AMOUNT;
    else process.env.BANK_ALIPAY_PRODUCT_AMOUNT = prevBankAmount;
    if (prevBankTitle == null) delete process.env.BANK_ALIPAY_PRODUCT_TITLE;
    else process.env.BANK_ALIPAY_PRODUCT_TITLE = prevBankTitle;
    if (prevBankDays == null) delete process.env.BANK_ALIPAY_GRANT_DAYS;
    else process.env.BANK_ALIPAY_GRANT_DAYS = prevBankDays;
    if (prevAlipayAmount == null) delete process.env.ALIPAY_PRODUCT_AMOUNT;
    else process.env.ALIPAY_PRODUCT_AMOUNT = prevAlipayAmount;
  });

  it('defaults to 299 / 30 days when env empty', () => {
    delete process.env.BANK_ALIPAY_PRODUCT_AMOUNT;
    delete process.env.BANK_ALIPAY_PRODUCT_TITLE;
    delete process.env.BANK_ALIPAY_GRANT_DAYS;
    delete process.env.ALIPAY_PRODUCT_AMOUNT;
    expect(CMB_ACTIVATE_FEE_DEFAULT_AMOUNT).toBe('299.00');
    expect(CMB_ACTIVATE_FEE_DEFAULT_GRANT_DAYS).toBe(30);
    expect(normalizeCmbActivateFeeConfig({})).toEqual({
      amount: '299.00',
      grant_days: 30,
      title: '招商银行模拟器激活（1个月）'
    });
  });

  it('parses admin body and builds title from days', () => {
    expect(parseCmbActivateFeeConfigFromAdmin({ amount: '299', grant_days: 30 })).toEqual({
      amount: '299.00',
      grant_days: 30,
      title: '招商银行模拟器激活（1个月）'
    });
    expect(parseCmbActivateFeeConfigFromAdmin({ amount: '88', grant_days: 7 }).title).toBe(
      '招商银行模拟器激活（1周）'
    );
    expect(parseCmbActivateFeeConfigFromAdmin({ amount: '0' })).toBeNull();
  });

  it('keeps custom title when provided', () => {
    expect(
      parseCmbActivateFeeConfigFromAdmin({
        amount: '199',
        grant_days: 30,
        title: '招行专属激活'
      }).title
    ).toBe('招行专属激活');
  });

  it('titleFromGrantDays covers common durations', () => {
    expect(titleFromGrantDays(30)).toContain('1个月');
    expect(titleFromGrantDays(90)).toBe('招商银行模拟器激活（90天）');
  });
});
