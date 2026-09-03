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
    var data = await saveUserQrOverrideCore({
      username: username,
      issueId: issueId,
      queryCode: b.query_code,
      mode: b.mode,
      imageRel: rel,
      requireIssue: false
    });
    data.unlocked = unlocked;
    data.watermark = !unlocked;
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
