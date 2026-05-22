/**
 * 注册防刷：验证码、IP/设备指纹限流、客户端校验、注册审计
 */
const crypto = require('crypto');

const CORDOVA_UA_RE = /TaxPlatformCordovaApp\//i;

var _pool = null;
var _captchaStore = new Map();
var CAPTCHA_TTL_MS = 5 * 60 * 1000;

function envInt(name, def, max) {
  var n = parseInt(process.env[name], 10);
  if (isNaN(n) || n < 0) return def;
  if (max != null && n > max) return max;
  return n;
}

function guardEnabled() {
  return String(process.env.REGISTER_GUARD_ENABLED || '1') !== '0';
}

function maxPerIpDay() {
  return envInt('REGISTER_MAX_PER_IP_DAY', 10, 200);
}

function maxPerFpDay() {
  return envInt('REGISTER_MAX_PER_FP_DAY', 5, 100);
}

function burstPerMinute() {
  return envInt('REGISTER_BURST_PER_MINUTE', 8, 60);
}

function failBackoffBaseMs() {
  return envInt('REGISTER_FAIL_BACKOFF_BASE_MS', 800, 30000);
}

function requireClientCheck() {
  return String(process.env.REGISTER_REQUIRE_CLIENT || '1') !== '0';
}

function allowWebRegister() {
  return String(process.env.REGISTER_ALLOW_WEB || '1') === '1';
}

function appSignSecret() {
  return String(process.env.REGISTER_APP_SIGN_SECRET || process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production');
}

function chinaDateKeyNow() {
  var now = new Date();
  var utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  var cn = new Date(utcMs + 8 * 3600000);
  var y = cn.getUTCFullYear();
  var m = String(cn.getUTCMonth() + 1).padStart(2, '0');
  var d = String(cn.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function pruneCaptchaStore() {
  var now = Date.now();
  _captchaStore.forEach(function (v, k) {
    if (!v || v.exp < now) _captchaStore.delete(k);
  });
}

function initRegisterGuard(pool) {
  _pool = pool;
  setInterval(pruneCaptchaStore, 60000).unref();
}

function issueRegisterCaptcha() {
  pruneCaptchaStore();
  var a = 2 + Math.floor(Math.random() * 8);
  var b = 2 + Math.floor(Math.random() * 8);
  var id = crypto.randomBytes(12).toString('hex');
  var exp = Date.now() + CAPTCHA_TTL_MS;
  _captchaStore.set(id, { answer: String(a + b), exp: exp });
  return {
    captcha_id: id,
    question: a + ' + ' + b + ' = ?',
    expires_in: Math.floor(CAPTCHA_TTL_MS / 1000)
  };
}

function verifyRegisterCaptcha(captchaId, answer) {
  if (!captchaId || answer == null) return false;
  var row = _captchaStore.get(String(captchaId).trim());
  if (!row || row.exp < Date.now()) {
    if (row) _captchaStore.delete(String(captchaId).trim());
    return false;
  }
  _captchaStore.delete(String(captchaId).trim());
  return String(answer).trim() === row.answer;
}

function isCordovaUserAgent(req) {
  var ua = req && req.headers ? String(req.headers['user-agent'] || '') : '';
  return CORDOVA_UA_RE.test(ua);
}

function verifyAppSignHeader(req) {
  var raw = req && req.headers ? String(req.headers['x-tax-app-sign'] || '').trim() : '';
  if (!raw) return false;
  var parts = raw.split('.');
  if (parts.length !== 2) return false;
  var ts = parseInt(parts[0], 10);
  if (!isFinite(ts)) return false;
  var now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) return false;
  var expect = crypto.createHmac('sha256', appSignSecret()).update(String(ts)).digest('base64url');
  try {
    return crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(parts[1]));
  } catch (e) {
    return false;
  }
}

function isTrustedWebReferer(req) {
  if (!allowWebRegister()) return false;
  var ref = req && req.headers ? String(req.headers.referer || req.headers.referrer || '').trim() : '';
  if (!ref) return false;
  try {
    var ru = new URL(ref);
    var host = req.headers.host ? String(req.headers.host).split(':')[0] : '';
    if (!host) return false;
    return ru.hostname === host || ru.host === req.headers.host;
  } catch (e) {
    return false;
  }
}

function checkRegisterClient(req) {
  if (!requireClientCheck()) return { ok: true };
  if (isCordovaUserAgent(req)) return { ok: true };
  if (verifyAppSignHeader(req)) return { ok: true };
  if (isTrustedWebReferer(req)) return { ok: true };
  return { ok: false, reason: 'register_fail:invalid_client', msg: '请使用官方 App 或本站页面注册' };
}

function guardKeys(req, getClientIp, computeDeviceFingerprint) {
  var ip = getClientIp(req) || 'unknown';
  var fp = computeDeviceFingerprint(req) || 'unknown';
  return {
    ipKey: 'ip:' + ip.substring(0, 96),
    fpKey: 'fp:' + fp.substring(0, 96),
    ip: ip,
    fp: fp
  };
}

async function incrementGuardCounter(key, field) {
  if (!_pool) return;
  var day = chinaDateKeyCol();
  var col = field === 'fail' ? 'fail_cnt' : 'success_cnt';
  await _pool.execute(
    `INSERT INTO register_guard_counters (guard_key, stat_date, success_cnt, fail_cnt, last_attempt_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE ${col} = ${col} + 1, last_attempt_at = NOW()`,
    [key, day, field === 'success' ? 1 : 0, field === 'fail' ? 1 : 0]
  );
}

function chinaDateKeyCol() {
  return chinaDateKeyNow();
}

async function getGuardCounts(keys) {
  if (!_pool || !keys.length) return {};
  var day = chinaDateKeyCol();
  var ph = keys.map(function () {
    return '?';
  });
  var params = keys.concat([day]);
  var [rows] = await _pool.execute(
    'SELECT guard_key, success_cnt, fail_cnt FROM register_guard_counters WHERE guard_key IN (' +
      ph.join(',') +
      ') AND stat_date = ?',
    params
  );
  var map = {};
  rows.forEach(function (r) {
    map[r.guard_key] = {
      success: Number(r.success_cnt) || 0,
      fail: Number(r.fail_cnt) || 0
    };
  });
  return map;
}

async function getMinuteBurst(ipKey) {
  if (!_pool) return 0;
  var [rows] = await _pool.execute(
    `SELECT COUNT(*) AS c FROM register_guard_minute WHERE guard_key = ? AND window_start >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)`,
    [ipKey]
  );
  return rows.length ? Number(rows[0].c) || 0 : 0;
}

async function bumpMinuteBurst(ipKey) {
  if (!_pool) return;
  var win = new Date();
  win.setSeconds(0, 0);
  await _pool.execute(
    `INSERT INTO register_guard_minute (guard_key, window_start, cnt) VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE cnt = cnt + 1`,
    [ipKey, win]
  );
}

function computeFailBackoffMs(failCount) {
  var base = failBackoffBaseMs();
  var n = Math.min(Number(failCount) || 0, 8);
  return Math.min(base * Math.pow(2, n), 60000);
}

async function checkRegisterRateLimits(req, getClientIp, computeDeviceFingerprint) {
  var keys = guardKeys(req, getClientIp, computeDeviceFingerprint);
  var counts = await getGuardCounts([keys.ipKey, keys.fpKey]);
  var ipC = counts[keys.ipKey] || { success: 0, fail: 0 };
  var fpC = counts[keys.fpKey] || { success: 0, fail: 0 };
  var burst = await getMinuteBurst(keys.ipKey);

  if (burst >= burstPerMinute()) {
    return {
      ok: false,
      reason: 'register_fail:rate_burst',
      msg: '注册过于频繁，请稍后再试',
      backoff_ms: 60000
    };
  }

  if (ipC.success >= maxPerIpDay()) {
    return {
      ok: false,
      reason: 'register_fail:rate_ip_day',
      msg: '本 IP 今日注册次数已达上限',
      backoff_ms: 0
    };
  }

  if (fpC.success >= maxPerFpDay()) {
    return {
      ok: false,
      reason: 'register_fail:rate_fp_day',
      msg: '本设备今日注册次数已达上限',
      backoff_ms: 0
    };
  }

  var failN = ipC.fail + fpC.fail;
  if (failN > 0) {
    var backoff = computeFailBackoffMs(failN);
    var last = await getLastAttemptMs(keys.ipKey);
    if (last && Date.now() - last < backoff) {
      return {
        ok: false,
        reason: 'register_fail:backoff',
        msg: '请 ' + Math.ceil((backoff - (Date.now() - last)) / 1000) + ' 秒后再试',
        backoff_ms: backoff - (Date.now() - last)
      };
    }
  }

  return { ok: true, keys: keys };
}

async function getLastAttemptMs(ipKey) {
  if (!_pool) return 0;
  var [rows] = await _pool.execute(
    'SELECT UNIX_TIMESTAMP(last_attempt_at) * 1000 AS ts FROM register_guard_counters WHERE guard_key = ? AND stat_date = ? LIMIT 1',
    [ipKey, chinaDateKeyCol()]
  );
  return rows.length && rows[0].ts != null ? Number(rows[0].ts) : 0;
}

async function markRegisterAttemptSuccess(keys) {
  await incrementGuardCounter(keys.ipKey, 'success');
  await incrementGuardCounter(keys.fpKey, 'success');
  await bumpMinuteBurst(keys.ipKey);
}

async function markRegisterAttemptFail(keys) {
  await incrementGuardCounter(keys.ipKey, 'fail');
  await incrementGuardCounter(keys.fpKey, 'fail');
  await bumpMinuteBurst(keys.ipKey);
}

async function ensureRegisterGuardTables(conn) {
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS register_guard_counters (
      guard_key VARCHAR(128) NOT NULL,
      stat_date DATE NOT NULL,
      success_cnt INT UNSIGNED NOT NULL DEFAULT 0,
      fail_cnt INT UNSIGNED NOT NULL DEFAULT 0,
      last_attempt_at DATETIME NULL,
      PRIMARY KEY (guard_key, stat_date),
      INDEX idx_stat_date (stat_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await conn.execute(`
    CREATE TABLE IF NOT EXISTS register_guard_minute (
      guard_key VARCHAR(128) NOT NULL,
      window_start DATETIME NOT NULL,
      cnt INT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (guard_key, window_start)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function looksLikeBotUsername(username) {
  var u = String(username || '').trim();
  if (u.length !== 8) return false;
  return /^[A-Za-z0-9]{8}$/.test(u);
}

function buildBotPurgeWhere(body) {
  var startBj = body.start_bj != null ? String(body.start_bj).trim() : '2026-05-22 00:00:00';
  var endBj = body.end_bj != null ? String(body.end_bj).trim() : '2026-05-22 01:00:00';
  var onlyEight = body.only_eight_char !== false && body.only_eight_char !== '0';
  var onlyInactive = body.only_inactive !== false && body.only_inactive !== '0';
  var clauses = [
    "CONVERT_TZ(created_at,'+00:00','+08:00') >= ?",
    "CONVERT_TZ(created_at,'+00:00','+08:00') < ?"
  ];
  var params = [startBj, endBj];
  if (onlyEight) {
    clauses.push('CHAR_LENGTH(username) = 8');
    clauses.push("username REGEXP '^[A-Za-z0-9]{8}$'");
    clauses.push('username = real_name');
  }
  if (onlyInactive) {
    clauses.push('account_active = 0');
  }
  if (body.exclude_banned === true || body.exclude_banned === '1') {
    clauses.push('banned = 0');
  }
  return { sql: clauses.join(' AND '), params: params, startBj: startBj, endBj: endBj };
}

async function countBotPurgeCandidates(conn, criteria) {
  var w = buildBotPurgeWhere(criteria || {});
  var [[row]] = await conn.execute('SELECT COUNT(*) AS c FROM users WHERE ' + w.sql, w.params);
  return { count: Number(row.c) || 0, window: { start_bj: w.startBj, end_bj: w.endBj } };
}

async function deleteUserAndRelated(conn, username) {
  await conn.execute('DELETE FROM tax_records WHERE user_id = ?', [username]);
  await conn.execute('DELETE FROM tax_issue_applications WHERE user_id = ?', [username]);
  await conn.execute('DELETE FROM employers WHERE user_id = ?', [username]);
  await conn.execute('DELETE FROM family_members WHERE user_id = ?', [username]);
  await conn.execute('DELETE FROM bank_cards WHERE user_id = ?', [username]);
  await conn.execute('DELETE FROM messages WHERE user_id = ?', [username]);
  await conn.execute('DELETE FROM user_daily_activity WHERE username = ?', [username]);
  await conn.execute('DELETE FROM user_login_events WHERE username = ?', [username]);
  await conn.execute('DELETE FROM user_devices WHERE username = ?', [username]);
  await conn.execute('DELETE FROM user_page_events WHERE username = ?', [username]);
  await conn.execute('DELETE FROM users WHERE username = ?', [username]);
}

async function purgeBotUsersBatch(conn, criteria, options) {
  var batchSize = options && options.batch_size ? Math.min(Number(options.batch_size) || 200, 500) : 200;
  var mode = options && options.mode === 'ban' ? 'ban' : 'delete';
  var dryRun = !!(options && options.dry_run);
  var w = buildBotPurgeWhere(criteria || {});
  var preview = await countBotPurgeCandidates(conn, criteria);
  if (dryRun) {
    return { dry_run: true, matched: preview.count, window: preview.window, mode: mode };
  }
  var deleted = 0;
  var banned = 0;
  while (true) {
    var [rows] = await conn.execute(
      'SELECT username FROM users WHERE ' + w.sql + ' ORDER BY id ASC LIMIT ' + batchSize,
      w.params
    );
    if (!rows.length) break;
    for (var i = 0; i < rows.length; i++) {
      var uname = String(rows[i].username || '').trim();
      if (!uname) continue;
      if (mode === 'ban') {
        await conn.execute('UPDATE users SET banned = 1, session_rev = session_rev + 1 WHERE username = ?', [uname]);
        banned++;
      } else {
        await deleteUserAndRelated(conn, uname);
        deleted++;
      }
    }
  }
  return {
    dry_run: false,
    matched: preview.count,
    deleted: deleted,
    banned: banned,
    mode: mode,
    window: preview.window
  };
}

module.exports = {
  initRegisterGuard: initRegisterGuard,
  ensureRegisterGuardTables: ensureRegisterGuardTables,
  issueRegisterCaptcha: issueRegisterCaptcha,
  verifyRegisterCaptcha: verifyRegisterCaptcha,
  checkRegisterClient: checkRegisterClient,
  checkRegisterRateLimits: checkRegisterRateLimits,
  markRegisterAttemptSuccess: markRegisterAttemptSuccess,
  markRegisterAttemptFail: markRegisterAttemptFail,
  guardEnabled: guardEnabled,
  looksLikeBotUsername: looksLikeBotUsername,
  countBotPurgeCandidates: countBotPurgeCandidates,
  purgeBotUsersBatch: purgeBotUsersBatch,
  buildBotPurgeWhere: buildBotPurgeWhere,
  CORDOVA_UA_RE: CORDOVA_UA_RE
};
