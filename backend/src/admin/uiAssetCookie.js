/**
 * 管理端静态资源门禁 cookie（admin_ui）。
 * 登录后写入 HttpOnly 签名，nginx auth_request 校验后再吐 admin_panel 等文件。
 */
'use strict';

const crypto = require('crypto');
const config = require('../shared/config');

const COOKIE_NAME = 'admin_ui';
const TTL_SEC = 12 * 60 * 60;
const HMAC_PREFIX = 'admin_ui|v1|';

function jwtSecret() {
  return String((config && config.JWT_SECRET) || '');
}

function hmacHex(secret, exp) {
  return crypto.createHmac('sha256', secret).update(HMAC_PREFIX + String(exp)).digest('hex').slice(0, 32);
}

function safeEqualHex(a, b) {
  var left = String(a || '');
  var right = String(b || '');
  if (!left || left.length !== right.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(left, 'utf8'), Buffer.from(right, 'utf8'));
  } catch (e) {
    return false;
  }
}

function requestIsHttps(req) {
  var raw = '';
  if (req && req.headers) {
    raw = String(req.headers['x-forwarded-proto'] || req.headers['x-forwarded-protocol'] || '');
  }
  var first = raw.split(',')[0].trim().toLowerCase();
  if (first === 'https') return true;
  if (req && req.secure) return true;
  return false;
}

function parseCookieHeader(header, name) {
  var raw = String(header || '');
  if (!raw) return '';
  var parts = raw.split(';');
  var want = String(name || '') + '=';
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i].trim();
    if (p.indexOf(want) === 0) {
      return p.slice(want.length);
    }
  }
  return '';
}

function signValue(nowSec, secret) {
  var exp = (Number(nowSec) || Math.floor(Date.now() / 1000)) + TTL_SEC;
  var key = secret != null ? String(secret) : jwtSecret();
  return 'v1.' + exp + '.' + hmacHex(key, exp);
}

function verifyValue(raw, nowSec, secret) {
  var s = String(raw || '').trim();
  var m = /^v1\.(\d{1,12})\.([0-9a-f]{32})$/i.exec(s);
  if (!m) return false;
  var exp = Number(m[1]);
  var now = Number(nowSec) || Math.floor(Date.now() / 1000);
  if (!isFinite(exp) || exp <= now) return false;
  var key = secret != null ? String(secret) : jwtSecret();
  return safeEqualHex(m[2].toLowerCase(), hmacHex(key, exp));
}

function cookieHeader(value, req, maxAge) {
  var parts = [
    COOKIE_NAME + '=' + String(value || ''),
    'Max-Age=' + String(maxAge == null ? TTL_SEC : maxAge),
    'Path=/',
    'HttpOnly',
    'SameSite=Lax'
  ];
  if (requestIsHttps(req)) parts.push('Secure');
  return parts.join('; ');
}

function setCookie(res, req) {
  if (!res || typeof res.setHeader !== 'function') return;
  res.setHeader('Set-Cookie', cookieHeader(signValue(Math.floor(Date.now() / 1000)), req, TTL_SEC));
}

function clearCookie(res, req) {
  if (!res || typeof res.setHeader !== 'function') return;
  res.setHeader('Set-Cookie', cookieHeader('', req, 0));
}

function readRequestCookie(req) {
  return parseCookieHeader(req && req.headers ? req.headers.cookie : '', COOKIE_NAME);
}

function verifyRequest(req) {
  return verifyValue(readRequestCookie(req), Math.floor(Date.now() / 1000));
}

function handleAssetAuth(req, res) {
  if (verifyRequest(req)) {
    return res.status(204).end();
  }
  return res.status(401).end();
}

function handleIssueCookie(req, res) {
  setCookie(res, req);
  return res.json({ code: 200, msg: 'ok' });
}

function handleLogout(req, res) {
  clearCookie(res, req);
  return res.json({ code: 200, msg: 'ok' });
}

module.exports = {
  COOKIE_NAME: COOKIE_NAME,
  TTL_SEC: TTL_SEC,
  signValue: signValue,
  verifyValue: verifyValue,
  parseCookieHeader: parseCookieHeader,
  setCookie: setCookie,
  clearCookie: clearCookie,
  verifyRequest: verifyRequest,
  handleAssetAuth: handleAssetAuth,
  handleIssueCookie: handleIssueCookie,
  handleLogout: handleLogout
};
