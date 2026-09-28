/**
 * 个税记录策略：是否允许同一用户同一月份保留多条记录。
 */
'use strict';

var SETTING_KEY_TAX_RECORDS_POLICY = 'tax_records_policy_json';

function parseBoolFlag(raw) {
  if (raw === true || raw === 1) return true;
  var s = String(raw == null ? '' : raw)
    .trim()
    .toLowerCase();
  return s === '1' || s === 'true' || s === 'on' || s === 'yes';
}

function defaultTaxRecordsPolicy() {
  return { allow_multiple_per_month: false };
}

function normalizeTaxRecordsPolicy(raw) {
  raw = raw && typeof raw === 'object' ? raw : {};
  return {
    allow_multiple_per_month: parseBoolFlag(raw.allow_multiple_per_month)
  };
}

function parseTaxRecordsPolicyFromAdmin(body) {
  return normalizeTaxRecordsPolicy(body && typeof body === 'object' ? body : {});
}

function isAllowMultiplePerMonth(policy) {
  return !!normalizeTaxRecordsPolicy(policy).allow_multiple_per_month;
}

module.exports = {
  SETTING_KEY_TAX_RECORDS_POLICY: SETTING_KEY_TAX_RECORDS_POLICY,
  parseBoolFlag: parseBoolFlag,
  defaultTaxRecordsPolicy: defaultTaxRecordsPolicy,
  normalizeTaxRecordsPolicy: normalizeTaxRecordsPolicy,
  parseTaxRecordsPolicyFromAdmin: parseTaxRecordsPolicyFromAdmin,
  isAllowMultiplePerMonth: isAllowMultiplePerMonth
};
