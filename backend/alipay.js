'use strict';

const crypto = require('crypto');
const { AlipaySdk } = require('alipay-sdk');

/** 辅助函数：envText */
function envText(name) {
  return String(process.env[name] || '').trim();
}

/** 辅助函数：pemFromEnv */
function pemFromEnv(name) {
  var value = envText(name);
  if (!value) return '';
  value = value.replace(/\\n/g, '\n');
  if (/-----BEGIN [A-Z ]+-----/.test(value)) return value;

  /* 支付宝密钥工具复制的内容通常只有 Base64 主体；补齐 PEM 包装供 SDK / Node crypto 使用。 */
  var base64 = value.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return value;
  var lines = base64.match(/.{1,64}/g) || [];
  var type = /PRIVATE/.test(name) ? 'PRIVATE KEY' : 'PUBLIC KEY';
  return '-----BEGIN ' + type + '-----\n' + lines.join('\n') + '\n-----END ' + type + '-----';
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

/** 规范化金额为两位小数字符串 */
function normalizeAmount(value) {
  var raw = String(value || '').trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return '';
  var cents = Math.round(Number(raw) * 100);
  if (!isFinite(cents) || cents < 1 || cents > 100000000) return '';
  return (cents / 100).toFixed(2);
}

/** 判断支付宝是否已完整配置 */
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

var cachedSdk = null;
var cachedSdkKey = '';

/** 获取或懒加载支付宝 SDK 实例 */
function getSdk() {
  var cfg = getConfig();
  if (!isConfigured()) {
    throw new Error('支付宝支付尚未配置');
  }
  var key = [cfg.appId, cfg.privateKey, cfg.publicKey].join('\0');
  if (cachedSdk && cachedSdkKey === key) return cachedSdk;
  /* 密钥工具默认 PKCS8；与官方 SDK 文档 keyType 说明一致 */
  cachedSdk = new AlipaySdk({
    appId: cfg.appId,
    privateKey: cfg.privateKey,
    alipayPublicKey: cfg.publicKey,
    keyType: 'PKCS8',
    signType: 'RSA2',
    gateway: cfg.gateway
  });
  cachedSdkKey = key;
  return cachedSdk;
}

function pickTradePayload(result) {
  var data = result && result.data != null ? result.data : result;
  if (!data || typeof data !== 'object') return {};
  return data;
}

/**
 * 当面付预下单：返回可生成二维码的 qr_code 串。
 * @returns {Promise<{ qrCode: string, outTradeNo: string }>}
 */
async function createFaceToFaceQr(order) {
  var cfg = getConfig();
  var sdk = getSdk();
  var amount = normalizeAmount(order.amount);
  if (!amount) {
    throw new Error('订单金额无效');
  }
  var result = await sdk.curl('POST', '/v3/alipay/trade/precreate', {
    body: {
      notify_url: cfg.notifyUrl,
      out_trade_no: order.outTradeNo,
      total_amount: amount,
      subject: order.subject,
      product_code: 'FACE_TO_FACE_PAYMENT',
      timeout_express: '30m'
    }
  });
  var data = pickTradePayload(result);
  var httpStatus = result && result.responseHttpStatus != null ? Number(result.responseHttpStatus) : 0;
  var qrCode = String(data.qr_code || data.qrCode || '').trim();
  if (!qrCode) {
    var errMsg =
      data.message ||
      data.msg ||
      data.sub_msg ||
      data.subMsg ||
      data.code ||
      (result && result.message) ||
      (httpStatus && httpStatus !== 200 ? '支付宝预下单失败 HTTP ' + httpStatus : '') ||
      '支付宝预下单未返回二维码';
    var err = new Error(String(errMsg));
    err.alipayResult = result;
    throw err;
  }
  return { qrCode: qrCode, outTradeNo: String(order.outTradeNo) };
}

/**
 * 主动查单（回调丢失或验签失败时补开通）。
 * @returns {Promise<{ tradeStatus: string, tradeNo: string, totalAmount: string, buyerLogonId: string }|null>}
 */
async function queryTrade(outTradeNo) {
  var sdk = getSdk();
  var result = await sdk.curl('POST', '/v3/alipay/trade/query', {
    body: { out_trade_no: String(outTradeNo || '').trim() }
  });
  var data = pickTradePayload(result);
  var tradeStatus = String(data.trade_status || data.tradeStatus || '').trim();
  if (!tradeStatus) return null;
  return {
    tradeStatus: tradeStatus,
    tradeNo: String(data.trade_no || data.tradeNo || '').trim(),
    totalAmount: normalizeAmount(data.total_amount || data.totalAmount),
    buyerLogonId: String(data.buyer_logon_id || data.buyerLogonId || '').trim()
  };
}

/** 按支付宝规则拼接待验签字符串 */
function canonicalizeNotify(params, includeSignType) {
  return Object.keys(params || {})
    .filter(function (key) {
      if (key === 'sign') return false;
      if (!includeSignType && key === 'sign_type') return false;
      return params[key] != null && params[key] !== '';
    })
    .sort()
    .map(function (key) {
      return key + '=' + params[key];
    })
    .join('&');
}

/** 用支付宝公钥做 RSA2 验签 */
function verifyWithPublicKey(params, publicKeyPem) {
  if (!params || !params.sign || !publicKeyPem) return false;
  var sign = String(params.sign);
  var variants = [true, false];
  for (var i = 0; i < variants.length; i++) {
    try {
      var content = canonicalizeNotify(params, variants[i]);
      var verifier = crypto.createVerify('RSA-SHA256');
      verifier.update(content, 'utf8');
      verifier.end();
      if (verifier.verify(publicKeyPem, sign, 'base64')) return true;
    } catch (e) {}
  }
  return false;
}

/** 校验支付宝异步通知签名与 app_id */
function verifyNotify(params) {
  if (!isConfigured() || !params || !params.sign) return false;
  var cfg = getConfig();
  if (String(params.app_id || '') !== cfg.appId) return false;
  try {
    var sdk = getSdk();
    if (typeof sdk.checkNotifySignV2 === 'function' && sdk.checkNotifySignV2(params)) {
      return true;
    }
    if (typeof sdk.checkNotifySign === 'function' && sdk.checkNotifySign(params)) {
      return true;
    }
  } catch (e) {
    console.warn('alipay sdk notify verify error', e && e.message);
  }
  /* SDK 验签失败时再用原生 RSA2 兜底（含/不含 sign_type） */
  return verifyWithPublicKey(params, cfg.publicKey);
}

module.exports = {
  getConfig: getConfig,
  isConfigured: isConfigured,
  normalizeAmount: normalizeAmount,
  createFaceToFaceQr: createFaceToFaceQr,
  queryTrade: queryTrade,
  verifyNotify: verifyNotify
};
