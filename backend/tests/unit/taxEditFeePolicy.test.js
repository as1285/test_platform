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
  it('defaults to rename >6 and days >8', () => {
    expect(TAX_EDIT_FEE_RENAME_GT).toBe(6);
    expect(TAX_EDIT_FEE_DAYS_GT).toBe(8);
  });

  it('exempt accounts are never subject', () => {
    expect(isTaxEditFeeSubject({ exempt: true, nameChanges: 99, taxModDays: 99 })).toBe(false);
    expect(isPeerAccount({ exempt: true, nameChanges: 99, taxModDays: 99 })).toBe(false);
    var view = buildTaxEditFeePolicyView({
      nameChanges: 99,
      taxModDays: 99,
      exempt: true,
      today: '2026-08-27'
    });
    expect(view.subject).toBe(false);
    expect(view.peer_account).toBe(false);
    expect(view.need_fee).toBe(false);
    expect(view.can_edit_now).toBe(true);
    expect(view.rename_fee_exempt).toBe(true);
    expect(view.tax_edit_fee_exempt).toBe(true);
  });

  it('requires both rename and tax-mod days over threshold', () => {
    expect(isTaxEditFeeSubject({ nameChanges: 7, taxModDays: 8 })).toBe(false);
    expect(isTaxEditFeeSubject({ nameChanges: 6, taxModDays: 9 })).toBe(false);
    expect(isTaxEditFeeSubject({ nameChanges: 9, taxModDays: 0 })).toBe(false);
    expect(isTaxEditFeeSubject({ nameChanges: 0, taxModDays: 9 })).toBe(false);
    expect(isTaxEditFeeSubject({ nameChanges: 7, taxModDays: 9 })).toBe(true);
    expect(isPeerAccount({ nameChanges: 7, taxModDays: 9 })).toBe(true);
  });

  it('uses configured thresholds', () => {
    expect(
      isPeerAccount({ nameChanges: 4, taxModDays: 3, rename_gt: 3, days_gt: 2 })
    ).toBe(true);
    expect(
      isPeerAccount({ nameChanges: 4, taxModDays: 2, rename_gt: 3, days_gt: 2 })
    ).toBe(false);
  });

  it('requires fee unless daily unlock; leftover credits and session do not unlock', () => {
    expect(resolveTaxEditAccess({ nameChanges: 7, taxModDays: 9 }).need_fee).toBe(true);
    expect(
      resolveTaxEditAccess({ nameChanges: 7, taxModDays: 9, hasDailyUnlock: true }).can_edit_now
    ).toBe(true);
    expect(
      resolveTaxEditAccess({ nameChanges: 7, taxModDays: 9, unusedCredits: 1 }).can_edit_now
    ).toBe(false);
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

  it('builds client policy view with AND peer rule', () => {
    var notPeer = buildTaxEditFeePolicyView({
      nameChanges: 12,
      taxModDays: 3,
      today: '2026-08-27'
    });
    expect(notPeer.subject).toBe(false);
    expect(notPeer.peer_account).toBe(false);
    expect(notPeer.need_fee).toBe(false);
    expect(notPeer.rename_gt).toBe(6);
    expect(notPeer.days_gt).toBe(8);

    var peer = buildTaxEditFeePolicyView({
      nameChanges: 12,
      taxModDays: 9,
      today: '2026-08-27'
    });
    expect(peer.subject).toBe(true);
    expect(peer.peer_account).toBe(true);
    expect(peer.need_fee).toBe(true);
    expect(peer.daily_amount).toBe('30.00');
    expect(String(peer.peer_login_notice || '')).toContain('且');
    expect(peerLoginNotice()).toContain('且');
  });

  it('normalizes and parses admin amounts and thresholds', () => {
    expect(normalizeTaxEditFeeConfig({ daily_amount: '25.5' })).toEqual({
      daily_amount: '25.50',
      rename_gt: 6,
      days_gt: 8
    });
    expect(normalizeTaxEditFeeConfig({ daily_amount: '30', rename_gt: 4, days_gt: 10 })).toEqual({
      daily_amount: '30.00',
      rename_gt: 4,
      days_gt: 10
    });
    expect(parseTaxEditFeeConfigFromAdmin({ daily_amount: '0' })).toBeNull();
    expect(parseTaxEditFeeConfigFromAdmin({ daily_amount: '40', rename_gt: '5', days_gt: '7' })).toEqual({
      daily_amount: '40.00',
      rename_gt: 5,
      days_gt: 7
    });
    expect(parseTaxEditFeeConfigFromAdmin({ daily_amount: '40', rename_gt: '-1' })).toBeNull();
  });

  it('block message uses daily amount and AND copy', () => {
    var msg = taxEditFeeBlockMessage({ daily_amount: '25.00', rename_gt: 6, days_gt: 8 });
    expect(msg).toContain('¥25');
    expect(msg).toContain('且');
    expect(msg).toContain('当天无限修改');
  });
});
