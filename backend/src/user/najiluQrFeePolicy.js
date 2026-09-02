'use strict';

var NAJILU_QR_FEE_DEFAULT_AMOUNT = '300.00';
var SETTING_KEY_NAJILU_QR_FEE = 'najilu_qr_fee_json';
var NAJILU_QR_SKU_ID = 'sku_najilu_qr_300';
var NAJILU_QR_SUBJECT = '完税二维码替换（终身）';

function normalizeNajiluQrFeeAmount(raw) {
  var s = String(raw == null ? '' : raw).replace(/,/g, '').replace(/，/g, '').trim();
  if (!s) return '';
  var n = Number(s);
  if (!isFinite(n) || n < 0.01 || n > 99999.99) return '';
  return n.toFixed(2);
}

function defaultNajiluQrFeeConfig() {
  return { amount: NAJILU_QR_FEE_DEFAULT_AMOUNT };
}

function normalizeNajiluQrFeeConfig(raw) {
  var def = defaultNajiluQrFeeConfig();
  raw = raw && typeof raw === 'object' ? raw : {};
  return {
    amount: normalizeNajiluQrFeeAmount(raw.amount != null ? raw.amount : raw.fee_amount) || def.amount
  };
}

function parseNajiluQrFeeConfigFromAdmin(body) {
  var raw = body && typeof body === 'object' ? body : {};
  var amount = normalizeNajiluQrFeeAmount(raw.amount != null ? raw.amount : raw.fee_amount);
  if (!amount) return null;
  return { amount: amount };
}

function isNajiluQrSkuId(skuId) {
  return String(skuId || '') === NAJILU_QR_SKU_ID;
}

function formatYuanLabel(raw) {
  var n = Number(String(raw == null ? '' : raw).replace(/,/g, '').trim());
  if (!isFinite(n) || n < 0) return '';
  if (n === 0) return '0';
  return n % 1 === 0 ? String(Math.round(n)) : n.toFixed(2);
}

module.exports = {
  SETTING_KEY_NAJILU_QR_FEE: SETTING_KEY_NAJILU_QR_FEE,
  NAJILU_QR_FEE_DEFAULT_AMOUNT: NAJILU_QR_FEE_DEFAULT_AMOUNT,
  NAJILU_QR_SKU_ID: NAJILU_QR_SKU_ID,
  NAJILU_QR_SUBJECT: NAJILU_QR_SUBJECT,
  normalizeNajiluQrFeeAmount: normalizeNajiluQrFeeAmount,
  defaultNajiluQrFeeConfig: defaultNajiluQrFeeConfig,
  normalizeNajiluQrFeeConfig: normalizeNajiluQrFeeConfig,
  parseNajiluQrFeeConfigFromAdmin: parseNajiluQrFeeConfigFromAdmin,
  isNajiluQrSkuId: isNajiluQrSkuId,
  formatYuanLabel: formatYuanLabel
};
