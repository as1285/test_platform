/**
 * 完税证明二维码 / 查询验证码替换（管理端 + C 端）
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { getPool } = require('../shared/db');
const config = require('../shared/config');
const najiluQrFeePolicy = require('../user/najiluQrFeePolicy');

var NAJILU_QR_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
var NAJILU_QR_MAX_BYTES = 8 * 1024 * 1024;
var _najiluQrFeeConfigCache = null;
var _najiluQrFeeConfigCacheAt = 0;
var NAJILU_QR_FEE_CONFIG_CACHE_MS = 10000;

async function loadNajiluQrFeeConfig(force) {
  var now = Date.now();
  if (
    !force &&
    _najiluQrFeeConfigCache &&
    now - _najiluQrFeeConfigCacheAt < NAJILU_QR_FEE_CONFIG_CACHE_MS
  ) {
    return _najiluQrFeeConfigCache;
  }
  var out = najiluQrFeePolicy.defaultNajiluQrFeeConfig();
  try {
    var pool = getPool();
    const [rows] = await pool.execute(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      [najiluQrFeePolicy.SETTING_KEY_NAJILU_QR_FEE]
    );
    if (rows.length && rows[0].setting_value) {
      out = najiluQrFeePolicy.normalizeNajiluQrFeeConfig(
        JSON.parse(String(rows[0].setting_value))
      );
    }
  } catch (eCfg) {
    /* keep default */
  }
  _najiluQrFeeConfigCache = out;
  _najiluQrFeeConfigCacheAt = now;
  return out;
}

async function saveNajiluQrFeeConfigFromAdmin(body) {
  var next = najiluQrFeePolicy.parseNajiluQrFeeConfigFromAdmin(body);
  if (!next) {
    var err = new Error('请填写 0.01～99999.99 的完税二维码价格');
    err.statusCode = 400;
    throw err;
  }
  var pool = getPool();
  await pool.execute(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [najiluQrFeePolicy.SETTING_KEY_NAJILU_QR_FEE, JSON.stringify(next)]
  );
  _najiluQrFeeConfigCache = next;
  _najiluQrFeeConfigCacheAt = Date.now();
  return next;
}

async function ensureNajiluQrUnlockedColumn(pool) {
  if (!pool) return;
  try {
    var [rows] = await pool.execute(
      `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'najilu_qr_unlocked'`
    );
    if (!rows || !rows[0] || Number(rows[0].c) === 0) {
      await pool.execute(
        `ALTER TABLE users
         ADD COLUMN najilu_qr_unlocked TINYINT(1) NOT NULL DEFAULT 0
           COMMENT '1=已购买完税二维码替换权益（终身）'`
      );
    }
  } catch (e) {
    if (!e || !/Duplicate column/i.test(String(e.message || e))) {
      console.warn('[najilu-qr] ensure unlocked column', e && e.message ? e.message : e);
    }
  }
}

async function userHasNajiluQrUnlocked(username) {
  var uid = String(username || '').trim();
  if (!uid) return false;
  var pool = getPool();
  try {
    const [rows] = await pool.execute(
      'SELECT najilu_qr_unlocked FROM users WHERE username = ? LIMIT 1',
      [uid]
    );
    if (!rows.length) return false;
    var v = rows[0].najilu_qr_unlocked;
    return v === true || Number(v) === 1 || String(v) === '1';
  } catch (e) {
    if (e && /Unknown column.*najilu_qr_unlocked/i.test(String(e.message || e))) {
      await ensureNajiluQrUnlockedColumn(pool);
      return false;
    }
    throw e;
  }
}

async function markNajiluQrUnlocked(connOrPool, username) {
  var uid = String(username || '').trim();
  if (!uid || !connOrPool) return;
  await connOrPool.execute('UPDATE users SET najilu_qr_unlocked = 1 WHERE username = ?', [uid]);
}

/** C 端上传：写入公开 uploads，供纳税记录渲染引用 */
var userNajiluQrUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      fs.mkdir(config.UPLOAD_DIR, { recursive: true }, function (err) {
        cb(err, config.UPLOAD_DIR);
      });
    },
    filename: function (req, file, cb) {
      var ext = path.extname(file.originalname || '').toLowerCase();
      if (NAJILU_QR_IMAGE_EXT.indexOf(ext) < 0) {
        ext = '.png';
      }
      cb(null, 'najilu_qr_' + crypto.randomBytes(16).toString('hex') + ext);
    }
  }),
  limits: { fileSize: NAJILU_QR_MAX_BYTES },
  fileFilter: function (req, file, cb) {
    var ext = path.extname(file.originalname || '').toLowerCase();
    var mime = String(file.mimetype || '').toLowerCase();
    var okExt = NAJILU_QR_IMAGE_EXT.indexOf(ext) >= 0;
    var okMime = !mime || /^image\/(jpeg|png|webp)$/.test(mime);
    cb(okExt && okMime ? null : new Error('仅支持 jpg / png / webp，且不超过 8MB'), okExt && okMime);
  }
});

function normalizeQueryCode(raw) {
  return String(raw || '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .substring(0, 32);
}

function isValidQueryCode(code) {
  return /^[A-Z0-9]{16}$/.test(code);
}

function normalizeUploadRel(rel) {
  var s = String(rel || '').trim().replace(/\\/g, '/');
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s.substring(0, 512);
  s = s.replace(/^\/+/, '');
  if (s.indexOf('..') >= 0) return '';
  if (!/^uploads\//i.test(s)) {
    s = 'uploads/' + s.replace(/^uploads\//i, '');
  }
  return s.substring(0, 512);
}

async function ensureUserQrOverrideTable(connOrPool) {
  if (!connOrPool) return;
  await connOrPool.execute(`
    CREATE TABLE IF NOT EXISTS user_najilu_qr_override (
      user_id VARCHAR(255) NOT NULL COMMENT '账号 username' PRIMARY KEY,
      query_code VARCHAR(32) NULL,
      qr_image_url VARCHAR(512) NULL,
      qr_block_image_url VARCHAR(512) NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

function packQrOverride(row) {
  if (!row) return null;
  var queryCode = normalizeQueryCode(row.query_code);
  var qr = row.qr_image_url != null ? String(row.qr_image_url).trim() : '';
  var block = row.qr_block_image_url != null ? String(row.qr_block_image_url).trim() : '';
  if (!queryCode && !qr && !block) return null;
  return {
    query_code: queryCode,
    qr_image_url: qr,
    qr_block_image_url: block
  };
}

async function getStoredUserQrOverride(connOrPool, userId) {
  var uid = String(userId || '').trim();
  if (!uid) return null;
  try {
    const [rows] = await connOrPool.execute(
      `SELECT query_code, qr_image_url, qr_block_image_url
       FROM user_najilu_qr_override WHERE user_id = ? LIMIT 1`,
      [uid]
    );
    return packQrOverride(rows && rows[0]);
  } catch (e) {
    if (e && /doesn't exist|unknown table/i.test(String(e.message || e))) {
      return null;
    }
    throw e;
  }
}

async function inferUserQrOverrideFromIssues(connOrPool, userId) {
  var uid = String(userId || '').trim();
  if (!uid) return null;
  const [rows] = await connOrPool.execute(
    `SELECT query_code, qr_image_url, qr_block_image_url
     FROM tax_issue_applications
     WHERE user_id = ?
       AND (
         (qr_block_image_url IS NOT NULL AND qr_block_image_url <> '')
         OR (qr_image_url IS NOT NULL AND qr_image_url <> '')
       )
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 1`,
    [uid]
  );
  return packQrOverride(rows && rows[0]);
}

/** 账号已替换过二维码则返回该码；优先账号表，否则取最近一条带替换图的开具记录 */
async function resolveUserQrOverride(connOrPool, userId) {
  var stored = await getStoredUserQrOverride(connOrPool, userId);
  if (stored && (stored.qr_block_image_url || stored.qr_image_url)) {
    return stored;
  }
  return inferUserQrOverrideFromIssues(connOrPool, userId);
}

async function upsertUserQrOverride(conn, userId, override) {
  var uid = String(userId || '').trim();
  if (!uid || !override) return;
  await ensureUserQrOverrideTable(conn);
  await conn.execute(
    `INSERT INTO user_najilu_qr_override (user_id, query_code, qr_image_url, qr_block_image_url)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       query_code = VALUES(query_code),
       qr_image_url = VALUES(qr_image_url),
       qr_block_image_url = VALUES(qr_block_image_url)`,
    [
      uid,
      override.query_code || null,
      override.qr_image_url || null,
      override.qr_block_image_url || null
    ]
  );
}

async function clearUserQrOverride(conn, userId) {
  var uid = String(userId || '').trim();
  if (!uid) return;
  try {
    await conn.execute('DELETE FROM user_najilu_qr_override WHERE user_id = ?', [uid]);
  } catch (e) {
    if (!e || !/doesn't exist|unknown table/i.test(String(e.message || e))) {
      throw e;
    }
  }
}

async function ensureNajiluQrColumns(pool) {
  var cols = [
    [
      'qr_image_url',
      "ALTER TABLE tax_issue_applications ADD COLUMN qr_image_url VARCHAR(512) NULL COMMENT '自定义二维码图片'"
    ],
    [
      'qr_block_image_url',
      "ALTER TABLE tax_issue_applications ADD COLUMN qr_block_image_url VARCHAR(512) NULL COMMENT '二维码+验证码整块图'"
    ]
  ];
  for (var i = 0; i < cols.length; i++) {
    var name = cols[i][0];
    var sql = cols[i][1];
    try {
      var [rows] = await pool.execute(
        `SELECT COUNT(*) AS c FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tax_issue_applications' AND COLUMN_NAME = ?`,
        [name]
      );
      if (!rows || !rows[0] || Number(rows[0].c) === 0) {
        await pool.execute(sql);
      }
    } catch (e) {
      if (!e || !/Duplicate column/i.test(String(e.message || e))) {
        console.warn('[najilu-qr] ensure column', name, e && e.message ? e.message : e);
      }
    }
  }
  try {
    await ensureUserQrOverrideTable(pool);
  } catch (eTbl) {
    console.warn('[najilu-qr] ensure override table', eTbl && eTbl.message ? eTbl.message : eTbl);
  }
  try {
    await ensureNajiluQrSavesTable(pool);
  } catch (eSav) {
    console.warn('[najilu-qr] ensure saves table', eSav && eSav.message ? eSav.message : eSav);
  }
}

async function ensureNajiluQrSavesTable(connOrPool) {
  if (!connOrPool) return;
  await connOrPool.execute(`
    CREATE TABLE IF NOT EXISTS najilu_qr_saves (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
      demo TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=未付费带水印 0=已解锁去水印',
      mode VARCHAR(16) NOT NULL DEFAULT 'block' COMMENT 'block|qr|clear',
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      KEY idx_najilu_qr_saves_user_time (username, created_at),
      KEY idx_najilu_qr_saves_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='C端完税二维码替换保存记录'
  `);
}

async function logNajiluQrSave(connOrPool, username, demo, mode) {
  var uid = String(username || '').trim().substring(0, 64);
  if (!uid || !connOrPool) return;
  var m = String(mode || 'block').trim().toLowerCase();
  if (m !== 'qr' && m !== 'block' && m !== 'clear') m = 'block';
  try {
    await ensureNajiluQrSavesTable(connOrPool);
    await connOrPool.execute(
      `INSERT INTO najilu_qr_saves (username, demo, mode) VALUES (?, ?, ?)`,
      [uid, demo ? 1 : 0, m]
    );
  } catch (e) {
    console.error('[najilu-qr] log save', e && e.message ? e.message : e);
  }
}

function parseNajiluQrStatsDays(raw) {
  var n = parseInt(raw, 10);
  if (!isFinite(n) || n < 1) n = 7;
  if (n > 366) n = 366;
  return n;
}

function money2(n) {
  var v = Number(n);
  if (!isFinite(v)) v = 0;
  return (Math.round(v * 100) / 100).toFixed(2);
}

var NAJILU_QR_SKU_ID = najiluQrFeePolicy.NAJILU_QR_SKU_ID;
var USERNAME_JOIN_SAVES =
  'u.username COLLATE utf8mb4_unicode_ci = g.username COLLATE utf8mb4_unicode_ci';

function mapNajiluUsageUserRow(r) {
  return {
    username: r.username != null ? String(r.username) : '',
    real_name: r.real_name != null ? String(r.real_name) : '',
    unlocked: r.unlocked === true || Number(r.unlocked) === 1,
    has_override: r.has_override === true || Number(r.has_override) === 1,
    saves: Number(r.saves) || 0,
    saves_demo: Number(r.saves_demo) || 0,
    saves_unlocked: Number(r.saves_unlocked) || 0,
    paid_orders: Number(r.paid_orders) || 0,
    paid_amount: money2(r.paid_amount),
    last_saved_at: r.last_saved_at ? new Date(r.last_saved_at).toISOString() : '',
    last_paid_at: r.last_paid_at ? new Date(r.last_paid_at).toISOString() : '',
    last_used_at: r.last_used_at ? new Date(r.last_used_at).toISOString() : ''
  };
}

/** C 端完税二维码：付费解锁 + 替换保存次数 */
async function handleAdminNajiluQrStats(req, res) {
  try {
    var days = parseNajiluQrStatsDays(req.query && req.query.days);
    var cnPaidDay = 'DATE(DATE_ADD(paid_at, INTERVAL 8 HOUR))';
    var cnCreatedDay = 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
    var cnUpdatedDay = 'DATE(DATE_ADD(updated_at, INTERVAL 8 HOUR))';
    var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
    var sinceSql = ' >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY)';
    var gCreatedDay = cnCreatedDay.replace(/created_at/g, 'g.created_at');
    var oPaidDay = cnPaidDay.replace(/paid_at/g, 'o.paid_at');
    var pool = getPool();
    await ensureNajiluQrUnlockedColumn(pool);
    await ensureUserQrOverrideTable(pool);
    await ensureNajiluQrSavesTable(pool);
    const conn = await pool.getConnection();
    try {
      const [unlockRows] = await conn.query(
        `SELECT COUNT(*) AS n FROM users WHERE najilu_qr_unlocked = 1`
      );
      var lockedQrUsers = 0;
      try {
        const [lockRows] = await conn.query(
          `SELECT COUNT(*) AS n FROM user_najilu_qr_override
           WHERE (qr_image_url IS NOT NULL AND qr_image_url <> '')
              OR (qr_block_image_url IS NOT NULL AND qr_block_image_url <> '')`
        );
        lockedQrUsers = lockRows && lockRows[0] ? Number(lockRows[0].n) || 0 : 0;
      } catch (eLock) {
        lockedQrUsers = 0;
      }
      const [paidSumRows] = await conn.query(
        `SELECT COUNT(*) AS orders,
                COUNT(DISTINCT username) AS users,
                COALESCE(SUM(amount), 0) AS gmv
         FROM payment_orders
         WHERE status = 'paid'
           AND (sku_id = ? OR grant_kind = 'najilu_qr')
           AND paid_at IS NOT NULL
           AND ${cnPaidDay}${sinceSql}`,
        [NAJILU_QR_SKU_ID, days]
      );
      const [pendingRows] = await conn.query(
        `SELECT COUNT(*) AS n
         FROM payment_orders
         WHERE status = 'pending'
           AND (sku_id = ? OR grant_kind = 'najilu_qr')
           AND ${cnCreatedDay}${sinceSql}`,
        [NAJILU_QR_SKU_ID, days]
      );
      var saveSummary = {
        saves: 0,
        save_users: 0,
        saves_demo: 0,
        saves_unlocked: 0
      };
      var dailySaveMap = {};
      var recentSaves = [];
      var usageUsers = [];
      try {
        const [saveSumRows] = await conn.query(
          `SELECT COUNT(*) AS saves,
                  COUNT(DISTINCT username) AS save_users,
                  SUM(CASE WHEN demo = 1 THEN 1 ELSE 0 END) AS saves_demo,
                  SUM(CASE WHEN demo = 0 THEN 1 ELSE 0 END) AS saves_unlocked
           FROM najilu_qr_saves
           WHERE ${cnCreatedDay}${sinceSql}`,
          [days]
        );
        if (saveSumRows && saveSumRows[0]) {
          saveSummary.saves = Number(saveSumRows[0].saves) || 0;
          saveSummary.save_users = Number(saveSumRows[0].save_users) || 0;
          saveSummary.saves_demo = Number(saveSumRows[0].saves_demo) || 0;
          saveSummary.saves_unlocked = Number(saveSumRows[0].saves_unlocked) || 0;
        }
        const [dailySaveRows] = await conn.query(
          `SELECT ${cnCreatedDay} AS d,
                  COUNT(*) AS saves,
                  COUNT(DISTINCT username) AS save_users,
                  SUM(CASE WHEN demo = 1 THEN 1 ELSE 0 END) AS saves_demo,
                  SUM(CASE WHEN demo = 0 THEN 1 ELSE 0 END) AS saves_unlocked
           FROM najilu_qr_saves
           WHERE ${cnCreatedDay}${sinceSql}
           GROUP BY ${cnCreatedDay}
           ORDER BY d ASC`,
          [days]
        );
        (dailySaveRows || []).forEach(function (r) {
          var key = r.d ? String(r.d).slice(0, 10) : '';
          if (!key) return;
          dailySaveMap[key] = {
            saves: Number(r.saves) || 0,
            save_users: Number(r.save_users) || 0,
            saves_demo: Number(r.saves_demo) || 0,
            saves_unlocked: Number(r.saves_unlocked) || 0
          };
        });
        const [recentSaveRows] = await conn.query(
          `SELECT g.id, g.username, g.demo, g.mode, g.created_at,
                  u.real_name
           FROM najilu_qr_saves g
           LEFT JOIN users u ON ${USERNAME_JOIN_SAVES}
           WHERE ${gCreatedDay}${sinceSql}
           ORDER BY g.id DESC
           LIMIT 50`,
          [days]
        );
        recentSaves = (recentSaveRows || []).map(function (r) {
          return {
            id: r.id != null ? Number(r.id) : 0,
            username: r.username != null ? String(r.username) : '',
            real_name: r.real_name != null ? String(r.real_name) : '',
            demo: r.demo === true || Number(r.demo) === 1,
            mode: r.mode != null ? String(r.mode) : '',
            created_at: r.created_at ? new Date(r.created_at).toISOString() : ''
          };
        });

        const [usageRows] = await conn.query(
          `SELECT
             base.username,
             COALESCE(u.real_name, '') AS real_name,
             COALESCE(u.najilu_qr_unlocked, 0) AS unlocked,
             CASE WHEN ov.user_id IS NOT NULL THEN 1 ELSE 0 END AS has_override,
             COALESCE(g.saves, 0) AS saves,
             COALESCE(g.saves_demo, 0) AS saves_demo,
             COALESCE(g.saves_unlocked, 0) AS saves_unlocked,
             g.last_saved_at,
             COALESCE(p.paid_orders, 0) AS paid_orders,
             COALESCE(p.paid_amount, 0) AS paid_amount,
             p.last_paid_at,
             GREATEST(
               COALESCE(g.last_saved_at, '1970-01-01'),
               COALESCE(p.last_paid_at, '1970-01-01'),
               COALESCE(ov.updated_at, '1970-01-01')
             ) AS last_used_at
           FROM (
             SELECT username FROM najilu_qr_saves
             WHERE ${cnCreatedDay}${sinceSql}
             UNION
             SELECT username FROM payment_orders
             WHERE status = 'paid'
               AND (sku_id = ? OR grant_kind = 'najilu_qr')
               AND paid_at IS NOT NULL
               AND ${cnPaidDay}${sinceSql}
             UNION
             SELECT user_id AS username FROM user_najilu_qr_override
             WHERE (
               (qr_image_url IS NOT NULL AND qr_image_url <> '')
               OR (qr_block_image_url IS NOT NULL AND qr_block_image_url <> '')
             )
             AND ${cnUpdatedDay}${sinceSql}
           ) base
           LEFT JOIN users u
             ON u.username COLLATE utf8mb4_unicode_ci = base.username COLLATE utf8mb4_unicode_ci
           LEFT JOIN user_najilu_qr_override ov
             ON ov.user_id COLLATE utf8mb4_unicode_ci = base.username COLLATE utf8mb4_unicode_ci
           LEFT JOIN (
             SELECT username,
                    COUNT(*) AS saves,
                    SUM(CASE WHEN demo = 1 THEN 1 ELSE 0 END) AS saves_demo,
                    SUM(CASE WHEN demo = 0 THEN 1 ELSE 0 END) AS saves_unlocked,
                    MAX(created_at) AS last_saved_at
             FROM najilu_qr_saves
             WHERE ${cnCreatedDay}${sinceSql}
             GROUP BY username
           ) g ON g.username COLLATE utf8mb4_unicode_ci = base.username COLLATE utf8mb4_unicode_ci
           LEFT JOIN (
             SELECT username,
                    COUNT(*) AS paid_orders,
                    COALESCE(SUM(amount), 0) AS paid_amount,
                    MAX(paid_at) AS last_paid_at
             FROM payment_orders
             WHERE status = 'paid'
               AND (sku_id = ? OR grant_kind = 'najilu_qr')
               AND paid_at IS NOT NULL
               AND ${cnPaidDay}${sinceSql}
             GROUP BY username
           ) p ON p.username COLLATE utf8mb4_unicode_ci = base.username COLLATE utf8mb4_unicode_ci
           ORDER BY last_used_at DESC, base.username ASC
           LIMIT 200`,
          [
            days,
            NAJILU_QR_SKU_ID,
            days,
            days,
            days,
            NAJILU_QR_SKU_ID,
            days
          ]
        );
        usageUsers = (usageRows || []).map(mapNajiluUsageUserRow);
      } catch (saveErr) {
        console.error('[najilu-qr] stats saves', saveErr);
      }

      const [dailyPayRows] = await conn.query(
        `SELECT ${cnPaidDay} AS d,
                COUNT(*) AS paid_orders,
                COUNT(DISTINCT username) AS paid_users,
                COALESCE(SUM(amount), 0) AS gmv
         FROM payment_orders
         WHERE status = 'paid'
           AND (sku_id = ? OR grant_kind = 'najilu_qr')
           AND paid_at IS NOT NULL
           AND ${cnPaidDay}${sinceSql}
         GROUP BY ${cnPaidDay}
         ORDER BY d ASC`,
        [NAJILU_QR_SKU_ID, days]
      );
      var dayMap = {};
      (dailyPayRows || []).forEach(function (r) {
        var key = r.d ? String(r.d).slice(0, 10) : '';
        if (!key) return;
        dayMap[key] = {
          day: key,
          paid_orders: Number(r.paid_orders) || 0,
          paid_users: Number(r.paid_users) || 0,
          gmv: money2(r.gmv),
          saves: 0,
          save_users: 0,
          saves_demo: 0,
          saves_unlocked: 0
        };
      });
      Object.keys(dailySaveMap).forEach(function (key) {
        if (!dayMap[key]) {
          dayMap[key] = {
            day: key,
            paid_orders: 0,
            paid_users: 0,
            gmv: '0.00',
            saves: 0,
            save_users: 0,
            saves_demo: 0,
            saves_unlocked: 0
          };
        }
        Object.assign(dayMap[key], dailySaveMap[key]);
      });
      var daily = Object.keys(dayMap)
        .sort()
        .map(function (k) {
          return dayMap[k];
        });

      const [recentPayRows] = await conn.query(
        `SELECT o.out_trade_no, o.username, o.amount, o.paid_at, o.status,
                u.real_name
         FROM payment_orders o
         LEFT JOIN users u ON u.username = o.username
         WHERE o.status = 'paid'
           AND (o.sku_id = ? OR o.grant_kind = 'najilu_qr')
           AND o.paid_at IS NOT NULL
           AND ${oPaidDay}${sinceSql}
         ORDER BY o.paid_at DESC
         LIMIT 50`,
        [NAJILU_QR_SKU_ID, days]
      );
      var recentPaid = (recentPayRows || []).map(function (r) {
        return {
          out_trade_no: r.out_trade_no != null ? String(r.out_trade_no) : '',
          username: r.username != null ? String(r.username) : '',
          real_name: r.real_name != null ? String(r.real_name) : '',
          amount: money2(r.amount),
          paid_at: r.paid_at ? new Date(r.paid_at).toISOString() : '',
          status: r.status != null ? String(r.status) : ''
        };
      });

      if (!usageUsers.length && recentPaid.length) {
        var seen = {};
        usageUsers = recentPaid
          .filter(function (r) {
            if (!r.username || seen[r.username]) return false;
            seen[r.username] = 1;
            return true;
          })
          .map(function (r) {
            return mapNajiluUsageUserRow({
              username: r.username,
              real_name: r.real_name,
              unlocked: 0,
              has_override: 0,
              saves: 0,
              saves_demo: 0,
              saves_unlocked: 0,
              paid_orders: 1,
              paid_amount: r.amount,
              last_saved_at: null,
              last_paid_at: r.paid_at,
              last_used_at: r.paid_at
            });
          });
      }

      var paid = paidSumRows && paidSumRows[0] ? paidSumRows[0] : {};
      return res.json({
        code: 200,
        data: {
          period: {
            days: days,
            label: '最近 ' + days + ' 天',
            period_key: String(days)
          },
          note:
            '使用用户 = 区间内有 C 端替换保存、付费解锁，或更新了账号锁定二维码的账号；后台本页手动替换不计入。保存次数自统计上线后累计。',
          summary: {
            unlocked_users: unlockRows && unlockRows[0] ? Number(unlockRows[0].n) || 0 : 0,
            locked_qr_users: lockedQrUsers,
            paid_orders: Number(paid.orders) || 0,
            paid_users: Number(paid.users) || 0,
            gmv: money2(paid.gmv),
            pending_orders:
              pendingRows && pendingRows[0] ? Number(pendingRows[0].n) || 0 : 0,
            saves: saveSummary.saves,
            save_users: saveSummary.save_users,
            saves_demo: saveSummary.saves_demo,
            saves_unlocked: saveSummary.saves_unlocked,
            usage_users: usageUsers.length
          },
          daily: daily,
          usage_users: usageUsers,
          recent_paid: recentPaid,
          recent_saves: recentSaves
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[najilu-qr] stats', e);
    return res.status(500).json({ code: 500, msg: String(e.message || e) });
  }
}

async function listApplicationsForUser(conn, username) {
  const [rows] = await conn.execute(
    `SELECT id, apply_time, period_start, period_end, record_no, scope, status,
            query_code, qr_image_url, qr_block_image_url, created_at, updated_at
     FROM tax_issue_applications
     WHERE user_id = ?
     ORDER BY created_at DESC, apply_time DESC
     LIMIT 30`,
    [username]
  );
  return (rows || []).map(function (r) {
    return {
      id: r.id != null ? String(r.id) : '',
      apply_time: r.apply_time != null ? String(r.apply_time) : '',
      period_start: r.period_start != null ? String(r.period_start) : '',
      period_end: r.period_end != null ? String(r.period_end) : '',
      record_no: r.record_no != null ? String(r.record_no) : '',
      scope: r.scope != null ? String(r.scope) : '全国',
      status: r.status != null ? String(r.status) : '制作成功',
      query_code: r.query_code != null ? String(r.query_code) : '',
      qr_image_url: r.qr_image_url != null ? String(r.qr_image_url) : '',
      qr_block_image_url: r.qr_block_image_url != null ? String(r.qr_block_image_url) : '',
      created_at: r.created_at,
      updated_at: r.updated_at
    };
  });
}

/**
 * 保存账号默认二维码。
 * admin 须带 issueId；C 端可无开具记录，仅写入 override 表（之后生成沿用）。
 */
async function saveUserQrOverrideCore(opts) {
  var username = String((opts && opts.username) || '').trim().substring(0, 255);
  var issueId = String((opts && opts.issueId) || '').trim().substring(0, 128);
  var queryCode = normalizeQueryCode(opts && opts.queryCode);
  var mode = String((opts && opts.mode) || 'block').trim().toLowerCase();
  var rel = normalizeUploadRel((opts && opts.imageRel) || '');
  var requireIssue = !!(opts && opts.requireIssue);

  if (!username) {
    var eUser = new Error('请先登录');
    eUser.status = 401;
    throw eUser;
  }
  if (queryCode && !isValidQueryCode(queryCode)) {
    var eCode = new Error('查询验证码须为 16 位字母或数字');
    eCode.status = 400;
    throw eCode;
  }
  if (mode !== 'qr' && mode !== 'block' && mode !== 'clear') {
    mode = 'block';
  }
  if (requireIssue && !issueId && mode !== 'clear') {
    var eIssue = new Error('请提供开具记录 id');
    eIssue.status = 400;
    throw eIssue;
  }

  var pool = getPool();
  await ensureNajiluQrColumns(pool);
  const conn = await pool.getConnection();
  try {
    var cur = null;
    if (issueId) {
      const [rows] = await conn.execute(
        `SELECT id, user_id, query_code, qr_image_url, qr_block_image_url
         FROM tax_issue_applications WHERE id = ? AND user_id = ? LIMIT 1`,
        [issueId, username]
      );
      if (!rows || !rows.length) {
        var e404 = new Error('未找到该用户的开具记录');
        e404.status = 404;
        throw e404;
      }
      cur = rows[0];
    }

    var nextQuery =
      queryCode ||
      (cur && cur.query_code != null ? String(cur.query_code) : '');
    var nextQr = cur && cur.qr_image_url != null ? String(cur.qr_image_url) : '';
    var nextBlock =
      cur && cur.qr_block_image_url != null ? String(cur.qr_block_image_url) : '';

    if (mode === 'clear') {
      nextQr = '';
      nextBlock = '';
    } else if (rel) {
      if (mode === 'qr') {
        nextQr = rel;
        nextBlock = '';
      } else {
        nextBlock = rel;
        nextQr = '';
      }
    }

    if (mode !== 'clear' && !nextQr && !nextBlock && !nextQuery) {
      var eNeed = new Error('请填写验证码或上传替换图片');
      eNeed.status = 400;
      throw eNeed;
    }

    if (issueId && cur) {
      await conn.execute(
        `UPDATE tax_issue_applications
         SET query_code = ?, qr_image_url = ?, qr_block_image_url = ?
         WHERE id = ? AND user_id = ?`,
        [nextQuery || null, nextQr || null, nextBlock || null, issueId, username]
      );
    }

    if (mode === 'clear') {
      await clearUserQrOverride(conn, username);
      await conn.execute(
        `UPDATE tax_issue_applications
         SET qr_image_url = NULL, qr_block_image_url = NULL
         WHERE user_id = ?`,
        [username]
      );
      nextQr = '';
      nextBlock = '';
    } else if (nextQr || nextBlock) {
      await upsertUserQrOverride(conn, username, {
        query_code: nextQuery,
        qr_image_url: nextQr,
        qr_block_image_url: nextBlock
      });
      /* 该账号全部开具记录沿用同一张替换码，避免 App 再生成时画出新码 */
      await conn.execute(
        `UPDATE tax_issue_applications
         SET query_code = COALESCE(?, query_code), qr_image_url = ?, qr_block_image_url = ?
         WHERE user_id = ?`,
        [nextQuery || null, nextQr || null, nextBlock || null, username]
      );
    } else if (nextQuery) {
      /* 仅改验证码：写入 override，并尽量同步已有记录 */
      await upsertUserQrOverride(conn, username, {
        query_code: nextQuery,
        qr_image_url: '',
        qr_block_image_url: ''
      });
      if (issueId) {
        await conn.execute(
          `UPDATE tax_issue_applications SET query_code = ? WHERE user_id = ?`,
          [nextQuery, username]
        );
      }
    }

    return {
      id: issueId || '',
      username: username,
      query_code: nextQuery,
      qr_image_url: nextQr,
      qr_block_image_url: nextBlock,
      mode: mode,
      account_locked: mode !== 'clear'
    };
  } finally {
    conn.release();
  }
}

async function handleAdminNajiluQrSave(req, res) {
  try {
    var b = req.body || {};
    var username = String(b.username || '').trim().substring(0, 255);
    var issueId = String(b.issue_id || b.id || '').trim().substring(0, 128);
    if (!username) {
      return res.status(400).json({ code: 400, msg: '请提供用户名' });
    }
    var rel = '';
    if (req.file && req.file.filename) {
      rel = normalizeUploadRel('uploads/' + req.file.filename);
    } else if (b.image_path) {
      rel = normalizeUploadRel(b.image_path);
    }
    var data = await saveUserQrOverrideCore({
      username: username,
      issueId: issueId,
      queryCode: b.query_code,
      mode: b.mode,
      imageRel: rel,
      requireIssue: true
    });
    res.json({ code: 200, msg: 'ok', data: data });
  } catch (e) {
    var status = (e && e.status) || 500;
    if (status >= 500) console.error('[najilu-qr] save', e);
    res.status(status).json({
      code: status,
      msg: (e && e.message) || '保存失败'
    });
  }
}

async function handleAdminNajiluQrList(req, res) {
  try {
    var username = String((req.query && req.query.username) || '').trim().substring(0, 255);
    if (!username) {
      return res.status(400).json({ code: 400, msg: '请提供用户名' });
    }
    var pool = getPool();
    await ensureNajiluQrColumns(pool);
    const conn = await pool.getConnection();
    try {
      var list = await listApplicationsForUser(conn, username);
      var qrOverride = null;
      try {
        qrOverride = await resolveUserQrOverride(conn, username);
      } catch (eOv) {
        qrOverride = null;
      }
      res.json({
        code: 200,
        data: { applications: list, qr_override: qrOverride }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[najilu-qr] list', e);
    res.status(500).json({ code: 500, msg: (e && e.message) || '加载失败' });
  }
}

/** C 端：权益状态 + 价格。未付费也可生成，结果带水印；付款后去水印。 */
async function handleUserNajiluQrStatus(req, res) {
  try {
    var username = String(req.authUserId || '').trim().substring(0, 255);
    if (!username) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var pool = getPool();
    await ensureNajiluQrUnlockedColumn(pool);
    var unlocked = await userHasNajiluQrUnlocked(username);
    var feeCfg = await loadNajiluQrFeeConfig(false);
    return res.json({
      code: 200,
      data: {
        unlocked: unlocked,
        watermark: !unlocked,
        fee_amount: feeCfg.amount || najiluQrFeePolicy.NAJILU_QR_FEE_DEFAULT_AMOUNT,
        fee_subject: najiluQrFeePolicy.NAJILU_QR_SUBJECT,
        sku_id: najiluQrFeePolicy.NAJILU_QR_SKU_ID,
        product: 'najilu_qr',
        pay_disabled: false
      }
    });
  } catch (e) {
    console.error('[najilu-qr] status', e);
    return res.status(500).json({ code: 500, msg: '读取权益失败' });
  }
}

/** C 端：当前登录账号的开具记录 + 账号锁定二维码（未付费也可读） */
async function handleUserNajiluQrList(req, res) {
  try {
    var username = String(req.authUserId || '').trim().substring(0, 255);
    if (!username) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var unlocked = await userHasNajiluQrUnlocked(username);
    var pool = getPool();
    await ensureNajiluQrColumns(pool);
    const conn = await pool.getConnection();
    try {
      var list = await listApplicationsForUser(conn, username);
      var qrOverride = null;
      try {
        qrOverride = await resolveUserQrOverride(conn, username);
      } catch (eOv) {
        qrOverride = null;
      }
      res.json({
        code: 200,
        data: {
          applications: list,
          qr_override: qrOverride,
          username: username,
          unlocked: unlocked,
          watermark: !unlocked
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[najilu-qr] user list', e);
    res.status(500).json({ code: 500, msg: (e && e.message) || '加载失败' });
  }
}

/** C 端：保存/清除本人账号默认二维码（未付费也可保存；出图带水印） */
async function handleUserNajiluQrSave(req, res) {
  try {
    var username = String(req.authUserId || '').trim().substring(0, 255);
    if (!username) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var unlocked = await userHasNajiluQrUnlocked(username);
    var b = req.body || {};
    var issueId = String(b.issue_id || b.id || '').trim().substring(0, 128);
    var rel = '';
    if (req.file && req.file.filename) {
      rel = normalizeUploadRel('uploads/' + req.file.filename);
    } else if (b.image_path) {
      rel = normalizeUploadRel(b.image_path);
    }
    var mode = String(b.mode || 'block').trim().toLowerCase();
    var data = await saveUserQrOverrideCore({
      username: username,
      issueId: issueId,
      queryCode: b.query_code,
      mode: mode,
      imageRel: rel,
      requireIssue: false
    });
    data.unlocked = unlocked;
    data.watermark = !unlocked;
    try {
      var poolLog = getPool();
      await logNajiluQrSave(poolLog, username, !unlocked, data.mode || mode);
    } catch (eLog) {
      /* stats 非关键路径，忽略 */
    }
    res.json({ code: 200, msg: 'ok', data: data });
  } catch (e) {
    var status = (e && e.status) || 500;
    if (status >= 500) console.error('[najilu-qr] user save', e);
    res.status(status).json({
      code: status,
      msg: (e && e.message) || '保存失败'
    });
  }
}

function getHandlers() {
  return {
    handleAdminNajiluQrSave: handleAdminNajiluQrSave,
    handleAdminNajiluQrList: handleAdminNajiluQrList,
    handleAdminNajiluQrStats: handleAdminNajiluQrStats,
    handleUserNajiluQrStatus: handleUserNajiluQrStatus,
    handleUserNajiluQrList: handleUserNajiluQrList,
    handleUserNajiluQrSave: handleUserNajiluQrSave
  };
}

module.exports = {
  getHandlers: getHandlers,
  ensureNajiluQrColumns: ensureNajiluQrColumns,
  ensureUserQrOverrideTable: ensureUserQrOverrideTable,
  ensureNajiluQrUnlockedColumn: ensureNajiluQrUnlockedColumn,
  resolveUserQrOverride: resolveUserQrOverride,
  upsertUserQrOverride: upsertUserQrOverride,
  clearUserQrOverride: clearUserQrOverride,
  normalizeQueryCode: normalizeQueryCode,
  userNajiluQrUpload: userNajiluQrUpload,
  loadNajiluQrFeeConfig: loadNajiluQrFeeConfig,
  saveNajiluQrFeeConfigFromAdmin: saveNajiluQrFeeConfigFromAdmin,
  userHasNajiluQrUnlocked: userHasNajiluQrUnlocked,
  markNajiluQrUnlocked: markNajiluQrUnlocked
};
