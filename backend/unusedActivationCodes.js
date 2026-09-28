/**
 * 每天定时删除「未使用」的普通激活码（无效库存）。
 * 已使用的不删；渠道批量 / 周卡库存不删。
 *
 * CLI：node unusedActivationCodes.js --purge
 *      node unusedActivationCodes.js --purge --force
 */
'use strict';

const mysql = require('mysql2/promise');

const SETTING_LAST_DAY = 'unused_codes_last_purge_day';
const DEFAULT_HOUR = 3;
const DEFAULT_MIN_AGE_HOURS = 24;
const DELETE_BATCH = 2000;

function purgeEnabled() {
  var v = String(process.env.UNUSED_CODES_PURGE_ENABLED || '1').trim();
  return v !== '0' && v !== 'false' && v !== 'off';
}

function purgeHour() {
  var n = parseInt(process.env.UNUSED_CODES_PURGE_HOUR || String(DEFAULT_HOUR), 10);
  if (!isFinite(n)) return DEFAULT_HOUR;
  return Math.max(0, Math.min(23, n));
}

function minAgeHours() {
  var n = parseInt(process.env.UNUSED_CODES_PURGE_MIN_AGE_HOURS || String(DEFAULT_MIN_AGE_HOURS), 10);
  if (!isFinite(n)) return DEFAULT_MIN_AGE_HOURS;
  return Math.max(0, Math.min(8760, n));
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

/** 中国日历（不依赖主机 TZ） */
function chinaParts(now) {
  var t = now instanceof Date ? now : new Date();
  var utcMs = t.getTime() + t.getTimezoneOffset() * 60000;
  var cn = new Date(utcMs + 8 * 3600000);
  return {
    y: cn.getFullYear(),
    m: cn.getMonth() + 1,
    d: cn.getDate(),
    h: cn.getHours(),
    key: cn.getFullYear() + '-' + pad2(cn.getMonth() + 1) + '-' + pad2(cn.getDate())
  };
}

/**
 * 未使用普通码条件：used_count=0，且备注不含「批量」「周卡」。
 * @param {{ ownerAdmin?: string, minAgeHours?: number }} opts
 */
function unusedGeneralWhereSql(opts) {
  opts = opts || {};
  var conditions = ['used_count = 0'];
  conditions.push("(note IS NULL OR (note NOT LIKE '%批量%' AND note NOT LIKE '%周卡%'))");
  var params = [];
  var owner = opts.ownerAdmin != null ? String(opts.ownerAdmin).trim() : '';
  if (owner) {
    conditions.push('owner_admin_username = ?');
    params.push(owner);
  }
  var age = opts.minAgeHours;
  if (age != null && Number(age) > 0) {
    var hours = Math.max(1, Math.min(8760, parseInt(age, 10) || 1));
    conditions.push('created_at < DATE_SUB(NOW(), INTERVAL ' + hours + ' HOUR)');
  }
  return { sql: conditions.join(' AND '), params: params };
}

function shouldPurgeNow(now, lastDay, hourThreshold) {
  var p = chinaParts(now);
  var last = String(lastDay || '');
  if (last >= p.key) return false;
  var hour = hourThreshold == null ? purgeHour() : hourThreshold;
  if (p.h < hour) return false;
  return true;
}

async function readSetting(conn, key) {
  const [rows] = await conn.execute(
    'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
    [key]
  );
  if (!rows.length || rows[0].setting_value == null) return '';
  return String(rows[0].setting_value).trim();
}

async function writeSetting(conn, key, value) {
  await conn.execute(
    'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ' +
      'ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
    [key, String(value)]
  );
}

/**
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} db
 * @param {{ ownerAdmin?: string, minAgeHours?: number, batchSize?: number }} opts
 */
async function purgeUnusedGeneralCodes(db, opts) {
  opts = opts || {};
  var where = unusedGeneralWhereSql(opts);
  var batch = Math.max(100, Math.min(10000, parseInt(opts.batchSize, 10) || DELETE_BATCH));
  var ownConn = false;
  var conn = db;
  if (db && typeof db.getConnection === 'function') {
    conn = await db.getConnection();
    ownConn = true;
  }
  var deleted = 0;
  try {
    for (;;) {
      const [result] = await conn.execute(
        'DELETE FROM activation_codes WHERE ' + where.sql + ' LIMIT ' + batch,
        where.params
      );
      var n = result && result.affectedRows != null ? Number(result.affectedRows) : 0;
      deleted += n;
      if (n < batch) break;
    }
  } finally {
    if (ownConn && conn) conn.release();
  }
  return { deleted: deleted };
}

/**
 * 每日任务：北京时间到达设定小时后，清一次「未使用普通码」。
 * @param {import('mysql2/promise').Pool} pool
 * @param {{ force?: boolean, now?: Date }} opts
 */
async function runUnusedCodesPurge(pool, opts) {
  opts = opts || {};
  if (!purgeEnabled() && !opts.force) {
    return { skipped: true, reason: 'disabled', deleted: 0 };
  }
  var now = opts.now instanceof Date ? opts.now : new Date();
  var today = chinaParts(now).key;
  var conn = await pool.getConnection();
  try {
    var last = await readSetting(conn, SETTING_LAST_DAY);
    if (!opts.force && !shouldPurgeNow(now, last, purgeHour())) {
      return { skipped: true, reason: 'not-due', last: last, today: today, deleted: 0 };
    }
    var result = await purgeUnusedGeneralCodes(conn, {
      minAgeHours: minAgeHours()
    });
    await writeSetting(conn, SETTING_LAST_DAY, today);
    return {
      skipped: false,
      today: today,
      last: last,
      deleted: result.deleted
    };
  } finally {
    conn.release();
  }
}

var _running = false;
var _timer = null;

async function tickUnusedCodesPurge(pool, reason) {
  if (!purgeEnabled() || !pool || _running) return null;
  _running = true;
  try {
    var result = await runUnusedCodesPurge(pool, { force: false });
    if (result && !result.skipped) {
      console.log(
        '[unused-codes] ' +
          reason +
          ' deleted=' +
          result.deleted +
          ' day=' +
          result.today
      );
    }
    return result;
  } catch (e) {
    console.error('[unused-codes] ' + reason + ' failed', e);
    return null;
  } finally {
    _running = false;
  }
}

function scheduleUnusedCodesPurge(getPool) {
  if (!purgeEnabled()) {
    console.log('[unused-codes] disabled (UNUSED_CODES_PURGE_ENABLED=0)');
    return;
  }
  var getter = typeof getPool === 'function' ? getPool : function () { return getPool; };
  setTimeout(function () {
    tickUnusedCodesPurge(getter(), 'startup');
  }, 120 * 1000);
  if (_timer) clearInterval(_timer);
  _timer = setInterval(function () {
    tickUnusedCodesPurge(getter(), 'interval');
  }, 60 * 1000);
  console.log(
    '[unused-codes] scheduled daily Asia/Shanghai ' +
      pad2(purgeHour()) +
      ':00 (min_age_hours=' +
      minAgeHours() +
      ')'
  );
}

async function createStandalonePool() {
  return mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'personal_tax',
    waitForConnections: true,
    connectionLimit: 2
  });
}

async function cliMain(argv) {
  var args = argv.slice(2);
  if (args.indexOf('--help') >= 0 || args.indexOf('-h') >= 0) {
    console.log('Usage: node unusedActivationCodes.js --purge [--force]');
    return;
  }
  if (args.indexOf('--purge') < 0) {
    console.log('pass --purge to delete unused general activation codes');
    return;
  }
  var pool = await createStandalonePool();
  try {
    var result = await runUnusedCodesPurge(pool, { force: args.indexOf('--force') >= 0 });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

module.exports = {
  SETTING_LAST_DAY,
  unusedGeneralWhereSql,
  shouldPurgeNow,
  chinaParts,
  purgeUnusedGeneralCodes,
  runUnusedCodesPurge,
  scheduleUnusedCodesPurge,
  purgeEnabled,
  purgeHour,
  minAgeHours
};

if (require.main === module) {
  cliMain(process.argv).catch(function (e) {
    console.error(e);
    process.exit(1);
  });
}
