'use strict';

var RENAME_FEE_DEFAULT_AMOUNT = '10.00';
var SETTING_KEY_RENAME_FEE = 'rename_fee_json';

function normalizeRenameFeeAmount(raw) {
  var s = String(raw == null ? '' : raw).replace(/,/g, '').replace(/，/g, '').trim();
  if (!s) return '';
  var n = Number(s);
  if (!isFinite(n) || n < 0 || n > 99999.99) return '';
  return n.toFixed(2);
}

/** 金额大于 0 才向用户收费；0 元表示改名不用付款 */
function isRenameFeeCharged(raw) {
  var n = Number(String(raw == null ? '' : raw).replace(/,/g, '').replace(/，/g, '').trim());
  return isFinite(n) && n > 0;
}

function defaultRenameFeeConfig() {
  return { amount: RENAME_FEE_DEFAULT_AMOUNT };
}

function normalizeRenameFeeConfig(raw) {
  var def = defaultRenameFeeConfig();
  raw = raw && typeof raw === 'object' ? raw : {};
  return {
    amount: normalizeRenameFeeAmount(raw.amount != null ? raw.amount : raw.fee_amount) || def.amount
  };
}

function parseRenameFeeConfigFromAdmin(body) {
  var raw = body && typeof body === 'object' ? body : {};
  var amount = normalizeRenameFeeAmount(raw.amount != null ? raw.amount : raw.fee_amount);
  if (!amount) return null;
  return { amount: amount };
}

function formatYuanLabel(raw) {
  var n = Number(String(raw == null ? '' : raw).replace(/,/g, '').trim());
  if (!isFinite(n) || n < 0) return '';
  if (n === 0) return '0';
  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
}

module.exports = {
  SETTING_KEY_RENAME_FEE: SETTING_KEY_RENAME_FEE,
  RENAME_FEE_DEFAULT_AMOUNT: RENAME_FEE_DEFAULT_AMOUNT,
  normalizeRenameFeeAmount: normalizeRenameFeeAmount,
  isRenameFeeCharged: isRenameFeeCharged,
  defaultRenameFeeConfig: defaultRenameFeeConfig,
  normalizeRenameFeeConfig: normalizeRenameFeeConfig,
  parseRenameFeeConfigFromAdmin: parseRenameFeeConfigFromAdmin,
  formatYuanLabel: formatYuanLabel
};
