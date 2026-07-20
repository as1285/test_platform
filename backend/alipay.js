'use strict';

const crypto = require('crypto');

function envText(name) {
  return String(process.env[name] || '').trim();
}

function pemFromEnv(name) {
  var value = envText(name);
  if (!value) return '';
  return value.replace(/\\n/g, '\n');
}

function formatTimestamp(date) {
  function pad(n) {
    return String(n).padStart(2, '0');
  }
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate()) +
    ' ' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes()) +
    ':' +
    pad(date.getSeconds())
  );
}

function canonicalize(params) {
  return Object.keys(params)
    .filter(function (key) {
      return key !== 'sign' && key !== 'sign_type' && params[key] != null && params[key] !== '';
    })
    .sort()
    .map(function (key) {
      return key + '=' + params[key];
    })
    .join('&');
}

function getConfig() {
  var amount = envText('ALIPAY_PRODUCT_AMOUNT');
  return {
    appId: envText('ALIPAY_APP_ID'),
    privateKey: pemFromEnv('ALIPAY_PRIVATE_KEY'),
    publicKey: pemFromEnv('ALIPAY_PUBLIC_KEY'),
    notifyUrl: envText('ALIPAY_NOTIFY_URL'),
    returnUrl: envText('ALIPAY_RETURN_URL'),
    gateway: envText('ALIPAY_GATEWAY') || 'https://openapi.alipay.com/gateway.do',
    productTitle: envText('ALIPAY_PRODUCT_TITLE') || '个税记录平台激活码',
    productAmount: amount
  };
}

function normalizeAmount(value) {
  var raw = String(value || '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return '';
  var cents = Math.round(Number(raw) * 100);
  if (!isFinite(cents) || cents < 1 || cents > 100000000) return '';
  return (cents / 100).toFixed(2);
}

function isConfigured() {
  var cfg = getConfig();
  return !!(
    cfg.appId &&
    cfg.privateKey &&
    cfg.publicKey &&
    cfg.notifyUrl &&
    normalizeAmount(cfg.productAmount)
  );
}

function sign(params, privateKey) {
  var signer = crypto.createSign('RSA-SHA256');
  signer.update(canonicalize(params), 'utf8');
  signer.end();
  return signer.sign(privateKey, 'base64');
}

function buildPagePayUrl(order) {
  var cfg = getConfig();
  if (!isConfigured()) {
    throw new Error('支付宝支付尚未配置');
  }
  var params = {
    app_id: cfg.appId,
    method: 'alipay.trade.page.pay',
    charset: 'utf-8',
    sign_type: 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: '1.0',
    notify_url: cfg.notifyUrl,
    biz_content: JSON.stringify({
      out_trade_no: order.outTradeNo,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: order.amount,
      subject: order.subject,
      timeout_express: '30m'
    })
  };
  if (cfg.returnUrl) params.return_url = cfg.returnUrl;
  params.sign = sign(params, cfg.privateKey);
  return (
    cfg.gateway +
    '?' +
    Object.keys(params)
      .map(function (key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
      })
      .join('&')
  );
}

function verifyNotify(params) {
  var cfg = getConfig();
  if (!isConfigured() || !params || !params.sign) return false;
  if (String(params.app_id || '') !== cfg.appId) return false;
  if (String(params.sign_type || 'RSA2').toUpperCase() !== 'RSA2') return false;
  try {
    var verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(canonicalize(params), 'utf8');
    verifier.end();
    return verifier.verify(cfg.publicKey, String(params.sign), 'base64');
  } catch (e) {
    return false;
  }
}

module.exports = {
  getConfig: getConfig,
  isConfigured: isConfigured,
  normalizeAmount: normalizeAmount,
  buildPagePayUrl: buildPagePayUrl,
  verifyNotify: verifyNotify
};
