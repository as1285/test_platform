/**
 * 支付页 UX 监控（不接第三方）：埋点入库 + 频率邮件告警 + 过期账号合成探活。
 * 收件人复用 MONITOR_ALERT_EMAIL。
 */
'use strict';

const http = require('http');
const jwt = require('jsonwebtoken');
const mail = require('./mail');
const config = require('./src/shared/config');

const MONITOR_ALERT_EMAIL = process.env.MONITOR_ALERT_EMAIL || '498771018@qq.com';
const ENABLED = process.env.PURCHASE_UX_ALERT_ENABLED !== '0';
const CHECK_INTERVAL_MS = Math.max(
  60000,
  parseInt(process.env.PURCHASE_UX_ALERT_INTERVAL_MS || '120000', 10) || 120000
);
const WINDOW_MINUTES = Math.max(
  1,
  parseInt(process.env.PURCHASE_UX_ALERT_WINDOW_MINUTES || '5', 10) || 5
);
const MIN_EVENTS = Math.max(
  1,
  parseInt(process.env.PURCHASE_UX_ALERT_MIN_EVENTS || '3', 10) || 3
);
const COOLDOWN_MS = Math.max(
  60000,
  parseInt(process.env.PURCHASE_UX_ALERT_COOLDOWN_MS || '1800000', 10) || 1800000
);
const PROBE_ENABLED = process.env.PURCHASE_UX_PROBE_ENABLED !== '0';
const PROBE_USER = String(process.env.PURCHASE_UX_PROBE_USER || '__probe_expired_buy__').trim();
const ALERT_EVENT_KEYS = [
  'track_purchase_boot_fail',
  'track_purchase_pay_blocked',
  'track_alipay_order_create_fail',
  'probe_purchase_expired_block'
];

var _pool = null;
var _timer = null;
var _lastAlertAt = 0;
var _schemaReady = false;

function resolvePublicHost() {
  var raw = String(process.env.PUBLIC_SITE_URL || process.env.APP_URL || '').trim();
  if (!raw) return '';
  try {
    if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw.replace(/^\/+/, '');
    return String(new URL(raw).hostname || '').toLowerCase();
  } catch (e) {
    return raw.replace(/^https?:\/\//i, '').split('/')[0] || '';
  }
}

function alertPrefix() {
  var host = resolvePublicHost();
  return host ? '[' + host + ']' : '[test_platform]';
}

function isAlertTrackAction(action) {
  var act = String(action || '').trim().toLowerCase();
  return ALERT_EVENT_KEYS.indexOf(act) >= 0;
}

/**
 * 纯函数：根据窗口内事件决定是否告警（单测用）。
 * @returns {{ shouldAlert: boolean, reason: string, stats: object }}
 */
function evaluateAlert(stats, opts) {
  opts = opts || {};
  var minEvents = opts.minEvents != null ? opts.minEvents : MIN_EVENTS;
  var total = Number(stats && stats.total) || 0;
  var expired = Number(stats && stats.activation_expired) || 0;
  var probeFail = Number(stats && stats.probe_fail) || 0;
  if (probeFail > 0) {
    return {
      shouldAlert: true,
      reason: '过期账号合成探活失败（支付接口仍被 activation_expired 拦截）',
      stats: stats
    };
  }
  if (expired >= 2) {
    return {
      shouldAlert: true,
      reason: '支付链路出现 activation_expired ×' + expired,
      stats: stats
    };
  }
  if (total >= minEvents) {
    return {
      shouldAlert: true,
      reason: '近窗支付页失败事件 ×' + total + '（阈值 ≥' + minEvents + '）',
      stats: stats
    };
  }
  return { shouldAlert: false, reason: '', stats: stats || {} };
}

async function ensureSchema(pool) {
  if (!pool || _schemaReady) return;
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS purchase_ux_events (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      event_key VARCHAR(80) NOT NULL,
      username VARCHAR(255) NULL,
      client_id VARCHAR(128) NULL,
      http_status INT NULL,
      biz_code INT NULL,
      reason VARCHAR(160) NULL,
      route_key VARCHAR(240) NULL,
      activation_expired TINYINT(1) NOT NULL DEFAULT 0,
      meta_json VARCHAR(1024) NULL,
      created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
      INDEX idx_pux_created (created_at),
      INDEX idx_pux_event_created (event_key, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  _schemaReady = true;
}

function sanitizeMeta(meta) {
  if (!meta || typeof meta !== 'object') return null;
  var out = {};
  var keys = Object.keys(meta).slice(0, 24);
  for (var i = 0; i < keys.length; i++) {
    var k = String(keys[i]).substring(0, 40);
    var v = meta[keys[i]];
    if (v == null) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = typeof v === 'string' ? v.substring(0, 160) : v;
    }
  }
  try {
    return JSON.stringify(out).substring(0, 1024);
  } catch (e) {
    return null;
  }
}

function clientIdFromReq(req) {
  try {
    if (req && req.clientDevicePayload && req.clientDevicePayload.client_id) {
      return String(req.clientDevicePayload.client_id).trim().substring(0, 128);
    }
  } catch (e) {}
  return '';
}

async function insertEvent(row) {
  if (!_pool) return;
  try {
    await ensureSchema(_pool);
  } catch (eSch) {
    console.error('[purchase-ux] ensureSchema', eSch && eSch.message);
    return;
  }
  var eventKey = String(row.event_key || '').trim().toLowerCase().substring(0, 80);
  if (!eventKey) return;
  _pool
    .execute(
      `INSERT INTO purchase_ux_events
       (event_key, username, client_id, http_status, biz_code, reason, route_key, activation_expired, meta_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventKey,
        row.username ? String(row.username).substring(0, 255) : null,
        row.client_id ? String(row.client_id).substring(0, 128) : null,
        row.http_status != null && isFinite(Number(row.http_status))
          ? Math.round(Number(row.http_status))
          : null,
        row.biz_code != null && isFinite(Number(row.biz_code))
          ? Math.round(Number(row.biz_code))
          : null,
        row.reason ? String(row.reason).substring(0, 160) : null,
        row.route_key ? String(row.route_key).substring(0, 240) : null,
        row.activation_expired ? 1 : 0,
        row.meta_json || null
      ]
    )
    .catch(function (e) {
      console.error('[purchase-ux] insert', e && e.message);
    });
}

/** 前端 track_* 入库（仅告警相关事件） */
function recordFromTrack(req, action, meta, pool) {
  if (!ENABLED || !isAlertTrackAction(action)) return;
  if (pool) _pool = pool;
  if (!_pool) return;
  var m = meta && typeof meta === 'object' ? meta : {};
  var expired =
    m.activation_expired === true ||
    m.activation_expired === 1 ||
    m.activation_expired === '1' ||
    String(m.reason || '').indexOf('activation_expired') >= 0 ||
    String(m.message || '').indexOf('试用已过期') >= 0;
  insertEvent({
    event_key: action,
    username: req && req.authUserId ? String(req.authUserId) : '',
    client_id: clientIdFromReq(req),
    http_status: m.http_status != null ? m.http_status : m.status,
    biz_code: m.biz_code != null ? m.biz_code : m.code,
    reason: m.reason || m.message || '',
    route_key: m.route || m.route_key || '',
    activation_expired: expired,
    meta_json: sanitizeMeta(m)
  });
}

async function loadWindowStats(pool, windowMinutes) {
  const [rows] = await pool.execute(
    `SELECT event_key,
            COUNT(*) AS cnt,
            SUM(CASE WHEN activation_expired = 1 THEN 1 ELSE 0 END) AS expired_cnt
     FROM purchase_ux_events
     WHERE created_at >= DATE_SUB(NOW(3), INTERVAL ? MINUTE)
       AND event_key IN (?, ?, ?, ?)
     GROUP BY event_key`,
    [windowMinutes].concat(ALERT_EVENT_KEYS)
  );
  var byKey = {};
  var total = 0;
  var expired = 0;
  var probeFail = 0;
  for (var i = 0; i < rows.length; i++) {
    var k = String(rows[i].event_key || '');
    var c = Number(rows[i].cnt) || 0;
    var e = Number(rows[i].expired_cnt) || 0;
    byKey[k] = { count: c, expired: e };
    total += c;
    expired += e;
    if (k === 'probe_purchase_expired_block') probeFail += c;
  }
  return { total: total, activation_expired: expired, probe_fail: probeFail, by_key: byKey };
}

async function sendAlertMail(decision) {
  if (!mail.isMailConfigured()) {
    console.warn('[purchase-ux] SMTP 未配置，跳过邮件:', decision.reason);
    return false;
  }
  var stats = decision.stats || {};
  var by = stats.by_key || {};
  var lines = [
    '支付页前端 UX 告警（自建，非第三方）。',
    '',
    '原因：' + decision.reason,
    '窗口：近 ' + WINDOW_MINUTES + ' 分钟',
    '失败总数：' + (stats.total || 0),
    'activation_expired：' + (stats.activation_expired || 0),
    '',
    '分事件：'
  ];
  ALERT_EVENT_KEYS.forEach(function (k) {
    var row = by[k] || { count: 0, expired: 0 };
    lines.push('- ' + k + ': ' + row.count + (row.expired ? ' (expired ' + row.expired + ')' : ''));
  });
  lines.push('');
  lines.push('时间：' + new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));
  lines.push('— ' + (resolvePublicHost() || 'test_platform') + ' 支付页 UX 监控');
  await mail.sendMail({
    to: MONITOR_ALERT_EMAIL,
    subject: alertPrefix() + ' 支付页异常：' + String(decision.reason || '').substring(0, 60),
    text: lines.join('\n')
  });
  return true;
}

function httpGetJson(path, token) {
  var port = parseInt(process.env.PORT || '3000', 10) || 3000;
  return new Promise(function (resolve, reject) {
    var req = http.request(
      {
        host: '127.0.0.1',
        port: port,
        path: path,
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + token,
          Accept: 'application/json',
          'X-Page-Path': '/purchase.html'
        },
        timeout: 8000
      },
      function (res) {
        var chunks = [];
        res.on('data', function (c) {
          chunks.push(c);
        });
        res.on('end', function () {
          var text = Buffer.concat(chunks).toString('utf8');
          var body = null;
          try {
            body = JSON.parse(text);
          } catch (e) {
            body = { raw: text.slice(0, 200) };
          }
          resolve({ status: res.statusCode || 0, body: body });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', function () {
      req.destroy();
      reject(new Error('probe timeout'));
    });
    req.end();
  });
}

async function ensureProbeUser(pool) {
  const [rows] = await pool.execute(
    'SELECT username FROM users WHERE username = ? LIMIT 1',
    [PROBE_USER]
  );
  if (!rows.length) {
    await pool.execute(
      `INSERT INTO users
       (username, salt, hash, real_name, account_active, activation_kind, active_until, banned, user_type, session_rev)
       VALUES (?, 'probe', 'probe', '支付探活过期号', 1, 'trial', '2020-01-01 00:00:00', 0, 0, 0)`,
      [PROBE_USER]
    );
  } else {
    await pool.execute(
      `UPDATE users
       SET account_active = 1, activation_kind = 'trial', active_until = '2020-01-01 00:00:00',
           banned = 0, session_rev = 0, user_type = 0
       WHERE username = ?`,
      [PROBE_USER]
    );
  }
}

async function runExpiredRepurchaseProbe(pool) {
  if (!PROBE_ENABLED) return { ok: true, skipped: true };
  await ensureProbeUser(pool);
  var token = jwt.sign({ sub: PROBE_USER, act: 1, srv: 0 }, config.JWT_SECRET, {
    expiresIn: '15m'
  });
  var pay = await httpGetJson('/api/payments/alipay/config', token);
  var expired = !!(pay.body && pay.body.activation_expired);
  if (pay.status === 401 && expired) {
    await insertEvent({
      event_key: 'probe_purchase_expired_block',
      username: PROBE_USER,
      http_status: pay.status,
      reason: 'expired_act1_blocked_alipay_config',
      route_key: '/api/payments/alipay/config',
      activation_expired: true,
      meta_json: JSON.stringify({ probe: 1, msg: (pay.body && pay.body.msg) || '' }).substring(
        0,
        1024
      )
    });
    return { ok: false, pay: pay };
  }
  if (pay.status >= 500) {
    await insertEvent({
      event_key: 'probe_purchase_expired_block',
      username: PROBE_USER,
      http_status: pay.status,
      reason: 'alipay_config_5xx',
      route_key: '/api/payments/alipay/config',
      activation_expired: false,
      meta_json: JSON.stringify({ probe: 1 }).substring(0, 1024)
    });
    return { ok: false, pay: pay };
  }
  return { ok: true, pay: pay };
}

async function tick() {
  if (!ENABLED || !_pool) return;
  try {
    await ensureSchema(_pool);
    if (PROBE_ENABLED) {
      try {
        await runExpiredRepurchaseProbe(_pool);
      } catch (eProbe) {
        console.error('[purchase-ux] probe', eProbe && eProbe.message);
        await insertEvent({
          event_key: 'probe_purchase_expired_block',
          username: PROBE_USER,
          reason:
            'probe_exception:' + String((eProbe && eProbe.message) || eProbe).substring(0, 120),
          route_key: 'probe',
          activation_expired: 0
        });
      }
    }
    var stats = await loadWindowStats(_pool, WINDOW_MINUTES);
    var decision = evaluateAlert(stats, { minEvents: MIN_EVENTS });
    if (!decision.shouldAlert) return;
    if (Date.now() - _lastAlertAt < COOLDOWN_MS) return;
    _lastAlertAt = Date.now();
    await sendAlertMail(decision);
    console.log('[purchase-ux] alert mailed:', decision.reason);
  } catch (e) {
    console.error('[purchase-ux] tick', e && e.message);
  }
}

function schedulePurchaseUxMonitor(getPool) {
  if (!ENABLED) {
    console.log('[purchase-ux] disabled (PURCHASE_UX_ALERT_ENABLED=0)');
    return;
  }
  function bindPool() {
    try {
      _pool = typeof getPool === 'function' ? getPool() : getPool;
    } catch (e) {
      _pool = null;
    }
  }
  bindPool();
  if (_timer) clearInterval(_timer);
  _timer = setInterval(function () {
    bindPool();
    tick();
  }, CHECK_INTERVAL_MS);
  if (_timer.unref) _timer.unref();
  setTimeout(function () {
    bindPool();
    tick();
  }, 45000);
  console.log(
    '[purchase-ux] scheduled interval=' +
      CHECK_INTERVAL_MS +
      'ms window=' +
      WINDOW_MINUTES +
      'm min=' +
      MIN_EVENTS +
      ' probe=' +
      (PROBE_ENABLED ? 'on' : 'off')
  );
}

module.exports = {
  ALERT_EVENT_KEYS: ALERT_EVENT_KEYS,
  evaluateAlert: evaluateAlert,
  isAlertTrackAction: isAlertTrackAction,
  recordFromTrack: recordFromTrack,
  schedulePurchaseUxMonitor: schedulePurchaseUxMonitor,
  ensureSchema: ensureSchema,
  runExpiredRepurchaseProbe: runExpiredRepurchaseProbe,
  loadWindowStats: loadWindowStats,
  _setPoolForTest: function (p) {
    _pool = p;
  }
};
