'use strict';

/** 默认：改名大于 6 次且个税修改大于 8 天，同时满足才算同行（白名单除外） */
var TAX_EDIT_FEE_RENAME_GT = 6;
var TAX_EDIT_FEE_DAYS_GT = 8;

var TAX_EDIT_SINGLE_SKU_ID = 'sku_tax_edit_fee_20';
var TAX_EDIT_DAILY_SKU_ID = 'sku_tax_edit_unlimited_30';
var TAX_EDIT_DAILY_AMOUNT = '30.00';
var TAX_EDIT_DAILY_SUBJECT = '个税修改（当天无限）';
var SETTING_KEY_TAX_EDIT_FEE = 'tax_edit_fee_json';

function normalizeTaxEditFeeAmount(raw) {
  var s = String(raw == null ? '' : raw).replace(/,/g, '').replace(/，/g, '').trim();
  if (!s) return '';
  var n = Number(s);
  if (!isFinite(n) || n < 0.01 || n > 99999.99) return '';
  return n.toFixed(2);
}

function normalizePeerThreshold(raw, fallback) {
  var n = parseInt(String(raw == null ? '' : raw).trim(), 10);
  if (!isFinite(n) || n < 0 || n > 999) {
    return fallback;
  }
  return n;
}

function defaultTaxEditFeeConfig() {
  return {
    daily_amount: TAX_EDIT_DAILY_AMOUNT,
    rename_gt: TAX_EDIT_FEE_RENAME_GT,
    days_gt: TAX_EDIT_FEE_DAYS_GT
  };
}

function normalizeTaxEditFeeConfig(raw) {
  var def = defaultTaxEditFeeConfig();
  raw = raw && typeof raw === 'object' ? raw : {};
  return {
    daily_amount: normalizeTaxEditFeeAmount(raw.daily_amount) || def.daily_amount,
    rename_gt: normalizePeerThreshold(
      raw.rename_gt != null ? raw.rename_gt : raw.renameGt,
      def.rename_gt
    ),
    days_gt: normalizePeerThreshold(raw.days_gt != null ? raw.days_gt : raw.daysGt, def.days_gt)
  };
}

function parseTaxEditFeeConfigFromAdmin(body) {
  var raw = body && typeof body === 'object' ? body : {};
  var daily = normalizeTaxEditFeeAmount(raw.daily_amount);
  if (!daily) return null;
  var hasRename =
    raw.rename_gt != null && String(raw.rename_gt).trim() !== '';
  var hasDays = raw.days_gt != null && String(raw.days_gt).trim() !== '';
  var renameGt = normalizePeerThreshold(raw.rename_gt, -1);
  var daysGt = normalizePeerThreshold(raw.days_gt, -1);
  if (hasRename && renameGt < 0) return null;
  if (hasDays && daysGt < 0) return null;
  return {
    daily_amount: daily,
    rename_gt: hasRename ? renameGt : TAX_EDIT_FEE_RENAME_GT,
    days_gt: hasDays ? daysGt : TAX_EDIT_FEE_DAYS_GT
  };
}

function formatYuanLabel(raw) {
  var n = Number(String(raw == null ? '' : raw).replace(/,/g, '').trim());
  if (!isFinite(n) || n <= 0) return '';
  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
}

function resolvePeerThresholds(input) {
  var cfg = normalizeTaxEditFeeConfig(input || {});
  return {
    rename_gt: cfg.rename_gt,
    days_gt: cfg.days_gt
  };
}

var TAX_EDIT_FEE_WRITE_ACTIONS = {
  save_record: true,
  add_record: true,
  batch_save_records: true,
  batch_replace_records: true,
  delete_record: true,
  delete_all_records: true,
  restore_record: true,
  restore_all_deleted_records: true,
  restore_records_by_company: true,
  delete_records_by_year: true,
  delete_records_by_company: true,
  dedupe_records: true
};

function isTaxEditFeeWriteAction(action) {
  return !!TAX_EDIT_FEE_WRITE_ACTIONS[String(action || '')];
}

function isTaxEditSingleSkuId(skuId) {
  return String(skuId || '') === TAX_EDIT_SINGLE_SKU_ID;
}

function isTaxEditDailySkuId(skuId) {
  return String(skuId || '') === TAX_EDIT_DAILY_SKU_ID;
}

function isTaxEditFeeSkuId(skuId) {
  return isTaxEditSingleSkuId(skuId) || isTaxEditDailySkuId(skuId);
}

function isTaxEditFeeGrantKind(grantKind) {
  var k = String(grantKind || '');
  return k === 'tax_edit_single' || k === 'tax_edit_daily';
}

/**
 * 是否属于同行账号 / 个税修改付费对象：改名与个税修改天数同时超过阈值，且非白名单。
 */
function isTaxEditFeeSubject(input) {
  input = input || {};
  if (input.exempt) return false;
  var th = resolvePeerThresholds(input);
  var names = Number(input.nameChanges) || 0;
  var days = Number(input.taxModDays) || 0;
  return names > th.rename_gt && days > th.days_gt;
}

function isPeerAccount(input) {
  return isTaxEditFeeSubject(input);
}

function peerLoginNotice(input) {
  var th = resolvePeerThresholds(input);
  return (
    '该账号为同行账号。改名已超过 ' +
    th.rename_gt +
    ' 次且个税修改已超过 ' +
    th.days_gt +
    ' 天，后续修改个税需先付费后才能继续。'
  );
}

/**
 * 解析当前是否需要付费、能否立即修改。
 * 仅当天无限解锁可改；不再提供单次额度。
 */
function resolveTaxEditAccess(input) {
  input = input || {};
  var subject = isTaxEditFeeSubject(input);
  var hasDaily = !!input.hasDailyUnlock;
  var canNow = !subject || hasDaily;
  return {
    subject: subject,
    need_fee: subject && !canNow,
    can_edit_now: canNow,
    has_daily_unlock: hasDaily
  };
}

function taxEditFeeBlockMessage(policy) {
  var cfg = normalizeTaxEditFeeConfig(policy || {});
  var daily = formatYuanLabel(cfg.daily_amount) || '30';
  return (
    '同行账号后续修改需付费。改名已超过 ' +
    cfg.rename_gt +
    ' 次且个税修改已超过 ' +
    cfg.days_gt +
    ' 天，请先支付 ¥' +
    daily +
    ' 开通当天无限修改'
  );
}

function buildTaxEditFeePolicyView(input) {
  input = input || {};
  var cfg = normalizeTaxEditFeeConfig({
    daily_amount: input.dailyAmount != null ? input.dailyAmount : input.daily_amount,
    rename_gt: input.renameGt != null ? input.renameGt : input.rename_gt,
    days_gt: input.daysGt != null ? input.daysGt : input.days_gt
  });
  var access = resolveTaxEditAccess(
    Object.assign({}, input, {
      rename_gt: cfg.rename_gt,
      days_gt: cfg.days_gt
    })
  );
  var peer = !!access.subject;
  return Object.assign({}, access, {
    peer_account: peer,
    peer_login_notice: peer ? peerLoginNotice(cfg) : '',
    name_change_count: Number(input.nameChanges) || 0,
    tax_mod_days: Number(input.taxModDays) || 0,
    rename_gt: cfg.rename_gt,
    days_gt: cfg.days_gt,
    rename_fee_exempt: !!input.exempt,
    tax_edit_fee_exempt: !!input.exempt,
    today: input.today != null ? String(input.today) : '',
    daily_amount: cfg.daily_amount,
    daily_sku_id: TAX_EDIT_DAILY_SKU_ID,
    daily_subject: TAX_EDIT_DAILY_SUBJECT
  });
}

module.exports = {
  TAX_EDIT_FEE_RENAME_GT: TAX_EDIT_FEE_RENAME_GT,
  TAX_EDIT_FEE_DAYS_GT: TAX_EDIT_FEE_DAYS_GT,
  SETTING_KEY_TAX_EDIT_FEE: SETTING_KEY_TAX_EDIT_FEE,
  TAX_EDIT_SINGLE_SKU_ID: TAX_EDIT_SINGLE_SKU_ID,
  TAX_EDIT_DAILY_SKU_ID: TAX_EDIT_DAILY_SKU_ID,
  TAX_EDIT_DAILY_AMOUNT: TAX_EDIT_DAILY_AMOUNT,
  TAX_EDIT_DAILY_SUBJECT: TAX_EDIT_DAILY_SUBJECT,
  normalizeTaxEditFeeAmount: normalizeTaxEditFeeAmount,
  normalizePeerThreshold: normalizePeerThreshold,
  defaultTaxEditFeeConfig: defaultTaxEditFeeConfig,
  normalizeTaxEditFeeConfig: normalizeTaxEditFeeConfig,
  parseTaxEditFeeConfigFromAdmin: parseTaxEditFeeConfigFromAdmin,
  formatYuanLabel: formatYuanLabel,
  resolvePeerThresholds: resolvePeerThresholds,
  isTaxEditFeeWriteAction: isTaxEditFeeWriteAction,
  isTaxEditSingleSkuId: isTaxEditSingleSkuId,
  isTaxEditDailySkuId: isTaxEditDailySkuId,
  isTaxEditFeeSkuId: isTaxEditFeeSkuId,
  isTaxEditFeeGrantKind: isTaxEditFeeGrantKind,
  isTaxEditFeeSubject: isTaxEditFeeSubject,
  isPeerAccount: isPeerAccount,
  peerLoginNotice: peerLoginNotice,
  resolveTaxEditAccess: resolveTaxEditAccess,
  taxEditFeeBlockMessage: taxEditFeeBlockMessage,
  buildTaxEditFeePolicyView: buildTaxEditFeePolicyView
};
