'use strict';

var CMB_ACTIVATE_FEE_DEFAULT_AMOUNT = '299.00';
var CMB_ACTIVATE_FEE_DEFAULT_GRANT_DAYS = 30;
var SETTING_KEY_CMB_ACTIVATE_FEE = 'cmb_activate_fee_json';

function envText(name) {
  return String(process.env[name] || '').trim();
}

function normalizeCmbActivateFeeAmount(raw) {
  var s = String(raw == null ? '' : raw).replace(/,/g, '').replace(/，/g, '').trim();
  if (!s) return '';
  var n = Number(s);
  if (!isFinite(n) || n < 0.01 || n > 99999.99) return '';
  return n.toFixed(2);
}

function normalizeCmbGrantDays(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  var n = parseInt(raw, 10);
  if (!isFinite(n) || n < 1 || n > 3650) return null;
  return n;
}

function normalizeCmbTitle(raw) {
  var s = String(raw == null ? '' : raw).trim();
  if (!s) return '';
  return s.slice(0, 128);
}

function titleFromGrantDays(days) {
  var d = normalizeCmbGrantDays(days);
  if (!d) return '招商银行模拟器激活';
  if (d === 30) return '招商银行模拟器激活（1个月）';
  if (d === 7) return '招商银行模拟器激活（1周）';
  if (d === 14) return '招商银行模拟器激活（2周）';
  if (d === 365) return '招商银行模拟器激活（1年）';
  return '招商银行模拟器激活（' + d + '天）';
}

function envDefaultAmount() {
  return (
    normalizeCmbActivateFeeAmount(envText('BANK_ALIPAY_PRODUCT_AMOUNT')) ||
    normalizeCmbActivateFeeAmount(envText('ALIPAY_PRODUCT_AMOUNT')) ||
    CMB_ACTIVATE_FEE_DEFAULT_AMOUNT
  );
}

function envDefaultGrantDays() {
  return (
    normalizeCmbGrantDays(envText('BANK_ALIPAY_GRANT_DAYS')) ||
    CMB_ACTIVATE_FEE_DEFAULT_GRANT_DAYS
  );
}

function envDefaultTitle(grantDays) {
  return normalizeCmbTitle(envText('BANK_ALIPAY_PRODUCT_TITLE')) || titleFromGrantDays(grantDays);
}

function defaultCmbActivateFeeConfig() {
  var grantDays = envDefaultGrantDays();
  return {
    amount: envDefaultAmount(),
    grant_days: grantDays,
    title: envDefaultTitle(grantDays)
  };
}

function normalizeCmbActivateFeeConfig(raw) {
  var def = defaultCmbActivateFeeConfig();
  raw = raw && typeof raw === 'object' ? raw : {};
  var grantDays =
    normalizeCmbGrantDays(raw.grant_days != null ? raw.grant_days : raw.days) || def.grant_days;
  var title = normalizeCmbTitle(raw.title != null ? raw.title : raw.subject);
  return {
    amount:
      normalizeCmbActivateFeeAmount(raw.amount != null ? raw.amount : raw.fee_amount) || def.amount,
    grant_days: grantDays,
    title: title || titleFromGrantDays(grantDays)
  };
}

function parseCmbActivateFeeConfigFromAdmin(body) {
  var raw = body && typeof body === 'object' ? body : {};
  var amount = normalizeCmbActivateFeeAmount(raw.amount != null ? raw.amount : raw.fee_amount);
  if (!amount) return null;
  var grantDays =
    normalizeCmbGrantDays(raw.grant_days != null ? raw.grant_days : raw.days) ||
    CMB_ACTIVATE_FEE_DEFAULT_GRANT_DAYS;
  var title = normalizeCmbTitle(raw.title != null ? raw.title : raw.subject);
  return {
    amount: amount,
    grant_days: grantDays,
    title: title || titleFromGrantDays(grantDays)
  };
}

module.exports = {
  SETTING_KEY_CMB_ACTIVATE_FEE: SETTING_KEY_CMB_ACTIVATE_FEE,
  CMB_ACTIVATE_FEE_DEFAULT_AMOUNT: CMB_ACTIVATE_FEE_DEFAULT_AMOUNT,
  CMB_ACTIVATE_FEE_DEFAULT_GRANT_DAYS: CMB_ACTIVATE_FEE_DEFAULT_GRANT_DAYS,
  normalizeCmbActivateFeeAmount: normalizeCmbActivateFeeAmount,
  normalizeCmbGrantDays: normalizeCmbGrantDays,
  titleFromGrantDays: titleFromGrantDays,
  defaultCmbActivateFeeConfig: defaultCmbActivateFeeConfig,
  normalizeCmbActivateFeeConfig: normalizeCmbActivateFeeConfig,
  parseCmbActivateFeeConfigFromAdmin: parseCmbActivateFeeConfigFromAdmin
};
