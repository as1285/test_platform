'use strict';

const {
  isTaxEditFeeSubject,
  isPeerAccount,
  peerLoginNotice,
  resolveTaxEditAccess,
  isTaxEditFeeWriteAction,
  isTaxEditFeeSkuId,
  buildTaxEditFeePolicyView,
  taxEditFeeBlockMessage,
  normalizeTaxEditFeeConfig,
  parseTaxEditFeeConfigFromAdmin,
  TAX_EDIT_FEE_RENAME_GT,
  TAX_EDIT_FEE_DAYS_GT
} = require('../../src/tax/taxEditFeePolicy');

describe('taxEditFeePolicy', () => {
  it('uses >8 thresholds for peer / fee', () => {
    expect(TAX_EDIT_FEE_RENAME_GT).toBe(8);
    expect(TAX_EDIT_FEE_DAYS_GT).toBe(8);
  });

  it('exempt accounts are never subject', () => {
    expect(isTaxEditFeeSubject({ exempt: true, nameChanges: 99, taxModDays: 99 })).toBe(false);
    expect(isPeerAccount({ exempt: true, nameChanges: 99, taxModDays: 99 })).toBe(false);
  });

  it('rename exactly 8 is not subject', () => {
    expect(isTaxEditFeeSubject({ nameChanges: 8, taxModDays: 0 })).toBe(false);
    expect(isPeerAccount({ nameChanges: 8, taxModDays: 8 })).toBe(false);
  });

  it('rename 9 or tax days 9 is peer / subject', () => {
    expect(isTaxEditFeeSubject({ nameChanges: 9, taxModDays: 0 })).toBe(true);
    expect(isTaxEditFeeSubject({ nameChanges: 0, taxModDays: 9 })).toBe(true);
    expect(isPeerAccount({ nameChanges: 9, taxModDays: 0 })).toBe(true);
  });

  it('requires fee unless daily unlock; leftover credits and session do not unlock', () => {
    expect(resolveTaxEditAccess({ nameChanges: 9 }).need_fee).toBe(true);
    expect(resolveTaxEditAccess({ nameChanges: 9, hasDailyUnlock: true }).can_edit_now).toBe(true);
    expect(resolveTaxEditAccess({ nameChanges: 9, unusedCredits: 1 }).can_edit_now).toBe(false);
    expect(resolveTaxEditAccess({ nameChanges: 9, hasRecentSession: true }).can_edit_now).toBe(false);
    expect(resolveTaxEditAccess({ nameChanges: 3, taxModDays: 2 }).need_fee).toBe(false);
  });

  it('gates tax record writes only', () => {
    expect(isTaxEditFeeWriteAction('save_record')).toBe(true);
    expect(isTaxEditFeeWriteAction('batch_save_records')).toBe(true);
    expect(isTaxEditFeeWriteAction('log_issue_application')).toBe(false);
    expect(isTaxEditFeeSkuId('sku_tax_edit_fee_20')).toBe(true);
    expect(isTaxEditFeeSkuId('sku_tax_edit_unlimited_30')).toBe(true);
    expect(isTaxEditFeeSkuId('sku_rename_fee_10')).toBe(false);
  });

  it('builds client policy view with daily amount only', () => {
    var view = buildTaxEditFeePolicyView({
      nameChanges: 12,
      taxModDays: 3,
      unusedCredits: 0,
      today: '2026-08-27'
    });
    expect(view.subject).toBe(true);
    expect(view.peer_account).toBe(true);
    expect(view.need_fee).toBe(true);
    expect(view.single_amount).toBeUndefined();
    expect(view.daily_amount).toBe('30.00');
    expect(view.today).toBe('2026-08-27');
    expect(String(view.peer_login_notice || '')).toContain('同行账号');
    expect(peerLoginNotice()).toContain('付费');
  });

  it('normalizes and parses admin daily amount only', () => {
    expect(normalizeTaxEditFeeConfig({ single_amount: '15', daily_amount: '25.5' })).toEqual({
      daily_amount: '25.50'
    });
    expect(normalizeTaxEditFeeConfig({})).toEqual({ daily_amount: '30.00' });
    expect(parseTaxEditFeeConfigFromAdmin({ daily_amount: '0' })).toBeNull();
    expect(parseTaxEditFeeConfigFromAdmin({ single_amount: '12.3', daily_amount: '40' })).toEqual({
      daily_amount: '40.00'
    });
    expect(parseTaxEditFeeConfigFromAdmin({ daily_amount: '40' })).toEqual({
      daily_amount: '40.00'
    });
  });

  it('block message uses daily amount only', () => {
    var msg = taxEditFeeBlockMessage({ single_amount: '15.00', daily_amount: '25.00' });
    expect(msg).not.toContain('¥15');
    expect(msg).toContain('¥25');
    expect(msg).toContain('当天无限修改');
  });
});
