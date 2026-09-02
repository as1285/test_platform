'use strict';

var LIZHI_CERT_FEE_DEFAULT_AMOUNT = '50.00';
var SETTING_KEY_LIZHI_CERT_FEE = 'lizhi_cert_fee_json';

function normalizeLizhiCertFeeAmount(raw) {
  var s = String(raw == null ? '' : raw).replace(/,/g, '').replace(/，/g, '').trim();
  if (!s) return '';
  var n = Number(s);
  if (!isFinite(n) || n < 0.01 || n > 99999.99) return '';
  return n.toFixed(2);
}

function defaultLizhiCertFeeConfig() {
  return { amount: LIZHI_CERT_FEE_DEFAULT_AMOUNT };
}

function normalizeLizhiCertFeeConfig(raw) {
  var def = defaultLizhiCertFeeConfig();
  raw = raw && typeof raw === 'object' ? raw : {};
  return {
    amount: normalizeLizhiCertFeeAmount(raw.amount != null ? raw.amount : raw.fee_amount) || def.amount
  };
}

function parseLizhiCertFeeConfigFromAdmin(body) {
  var raw = body && typeof body === 'object' ? body : {};
  var amount = normalizeLizhiCertFeeAmount(raw.amount != null ? raw.amount : raw.fee_amount);
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
  SETTING_KEY_LIZHI_CERT_FEE: SETTING_KEY_LIZHI_CERT_FEE,
  LIZHI_CERT_FEE_DEFAULT_AMOUNT: LIZHI_CERT_FEE_DEFAULT_AMOUNT,
  normalizeLizhiCertFeeAmount: normalizeLizhiCertFeeAmount,
  defaultLizhiCertFeeConfig: defaultLizhiCertFeeConfig,
  normalizeLizhiCertFeeConfig: normalizeLizhiCertFeeConfig,
  parseLizhiCertFeeConfigFromAdmin: parseLizhiCertFeeConfigFromAdmin,
  formatYuanLabel: formatYuanLabel
};
