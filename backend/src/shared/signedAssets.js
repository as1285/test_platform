/**
 * 敏感静态资源（APK / mobileconfig）短时 HMAC 签名 URL。
 * 直链 /uploads/*.apk 由 nginx 拒绝；仅本模块签发的 /api/public/asset 可下载。
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SENSITIVE_EXT_RE = /\.(apk|mobileconfig)$/i;

function getSignSecret(cfg) {
  var s = String((cfg && cfg.ASSET_SIGN_SECRET) || '').trim();
  if (s) {
    return s;
  }
  return String((cfg && cfg.JWT_SECRET) || 'dev-jwt-secret-change-in-production');
}

function getTtlSec(cfg) {
  var n = parseInt((cfg && cfg.ASSET_SIGN_TTL_SEC) || '1800', 10);
  if (!Number.isFinite(n) || n < 60) {
    return 1800;
  }
  if (n > 86400) {
    return 86400;
  }
  return n;
}

/** 规范化为 /uploads/... 相对路径；非法则返回 '' */
function normalizeUploadRelPath(raw) {
  var s = String(raw || '').trim();
  if (!s) {
    return '';
  }
  try {
    if (/^https?:\/\//i.test(s)) {
      var u = new URL(s);
      s = u.pathname || '';
    }
  } catch (e0) {
    return '';
  }
  s = s.split('?')[0].split('#')[0];
  if (s.charAt(0) !== '/') {
    s = '/' + s;
  }
  s = s.replace(/\/+/g, '/');
  if (!/^\/uploads\//i.test(s)) {
    return '';
  }
  if (s.indexOf('..') >= 0 || s.indexOf('%2e') >= 0 || s.indexOf('%2E') >= 0) {
    return '';
  }
  if (!SENSITIVE_EXT_RE.test(s)) {
    return '';
  }
  if (s.length > 512) {
    return '';
  }
  return s;
}

function isSensitiveUploadPath(raw) {
  return !!normalizeUploadRelPath(raw);
}

function hmacSign(secret, relPath, expSec) {
  var payload = String(relPath) + '|' + String(expSec);
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex').slice(0, 40);
}

function timingSafeEqualHex(a, b) {
  var aa = String(a || '');
  var bb = String(b || '');
  if (aa.length !== bb.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(aa, 'utf8'), Buffer.from(bb, 'utf8'));
  } catch (e) {
    return false;
  }
}

/**
 * 把本地 uploads 敏感路径换成短时签名 URL；外链或不敏感路径原样返回。
 * @returns {string}
 */
function toSignedPublicAssetUrl(raw, cfg) {
  var rel = normalizeUploadRelPath(raw);
  if (!rel) {
    return String(raw || '').trim();
  }
  var ttl = getTtlSec(cfg);
  var exp = Math.floor(Date.now() / 1000) + ttl;
  var sig = hmacSign(getSignSecret(cfg), rel, exp);
  return (
    '/api/public/asset?p=' +
    encodeURIComponent(rel) +
    '&e=' +
    String(exp) +
    '&s=' +
    encodeURIComponent(sig)
  );
}

function verifySignedAssetQuery(query, cfg) {
  var rel = normalizeUploadRelPath(query && query.p);
  var exp = parseInt(query && query.e, 10);
  var sig = String((query && query.s) || '').trim().toLowerCase();
  if (!rel || !Number.isFinite(exp) || !sig) {
    return { ok: false, status: 400, msg: 'invalid signature params' };
  }
  var now = Math.floor(Date.now() / 1000);
  if (exp < now) {
    return { ok: false, status: 403, msg: 'link expired' };
  }
  if (exp > now + 86400 + 60) {
    return { ok: false, status: 403, msg: 'invalid expiry' };
  }
  var expect = hmacSign(getSignSecret(cfg), rel, exp);
  if (!timingSafeEqualHex(sig, expect)) {
    return { ok: false, status: 403, msg: 'bad signature' };
  }
  return { ok: true, rel: rel };
}

function resolveUploadAbsPath(uploadDir, relPath) {
  var rel = normalizeUploadRelPath(relPath);
  if (!rel) {
    return null;
  }
  var under = rel.replace(/^\/uploads\//i, '');
  var abs = path.resolve(uploadDir, under);
  var root = path.resolve(uploadDir);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    return null;
  }
  return abs;
}

function contentTypeForRel(rel) {
  if (/\.apk$/i.test(rel)) {
    return 'application/vnd.android.package-archive';
  }
  if (/\.mobileconfig$/i.test(rel)) {
    return 'application/x-apple-aspen-config';
  }
  return 'application/octet-stream';
}

function dispositionFilename(rel) {
  var base = path.basename(String(rel || ''));
  if (/\.apk$/i.test(base)) {
    return 'geshui.apk';
  }
  if (/\.mobileconfig$/i.test(base)) {
    return 'install.mobileconfig';
  }
  return base || 'download.bin';
}

/**
 * Express handler：校验签名后流式输出文件。
 */
function createPublicAssetHandler(deps) {
  var cfg = deps.config || {};
  var uploadDir = deps.uploadDir;

  return async function handlePublicAssetGet(req, res) {
    var checked = verifySignedAssetQuery(req.query || {}, cfg);
    if (!checked.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(checked.status || 403).json({ code: checked.status || 403, msg: checked.msg });
    }
    var abs = resolveUploadAbsPath(uploadDir, checked.rel);
    if (!abs) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(400).json({ code: 400, msg: 'invalid path' });
    }
    var st;
    try {
      st = await fs.promises.stat(abs);
    } catch (e) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ code: 404, msg: 'not found' });
    }
    if (!st.isFile()) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ code: 404, msg: 'not found' });
    }
    var ctype = contentTypeForRel(checked.rel);
    var fname = dispositionFilename(checked.rel);
    res.setHeader('Content-Type', ctype);
    res.setHeader('Content-Length', String(st.size));
    res.setHeader('Content-Disposition', 'attachment; filename="' + fname.replace(/"/g, '') + '"');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    var stream = fs.createReadStream(abs);
    stream.on('error', function () {
      if (!res.headersSent) {
        res.status(500).end();
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  };
}

module.exports = {
  SENSITIVE_EXT_RE,
  isSensitiveUploadPath,
  normalizeUploadRelPath,
  toSignedPublicAssetUrl,
  verifySignedAssetQuery,
  resolveUploadAbsPath,
  createPublicAssetHandler
};
