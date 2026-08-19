/**
 * 管理后台 · 完税证明二维码 / 查询验证码替换
 */
const { getPool } = require('../shared/db');

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

async function handleAdminNajiluQrSave(req, res) {
  try {
    var b = req.body || {};
    var username = String(b.username || '').trim().substring(0, 255);
    var issueId = String(b.issue_id || b.id || '').trim().substring(0, 128);
    if (!username || !issueId) {
      return res.status(400).json({ code: 400, msg: '请提供用户名与开具记录 id' });
    }
    var queryCode = normalizeQueryCode(b.query_code);
    if (queryCode && !isValidQueryCode(queryCode)) {
      return res.status(400).json({ code: 400, msg: '查询验证码须为 16 位字母或数字' });
    }
    var mode = String(b.mode || 'block').trim().toLowerCase();
    if (mode !== 'qr' && mode !== 'block' && mode !== 'clear') {
      mode = 'block';
    }

    var pool = getPool();
    await ensureNajiluQrColumns(pool);

    var rel = '';
    if (req.file && req.file.filename) {
      rel = normalizeUploadRel('uploads/' + req.file.filename);
    } else if (b.image_path) {
      rel = normalizeUploadRel(b.image_path);
    }

    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        `SELECT id, user_id, query_code, qr_image_url, qr_block_image_url
         FROM tax_issue_applications WHERE id = ? AND user_id = ? LIMIT 1`,
        [issueId, username]
      );
      if (!rows || !rows.length) {
        return res.status(404).json({ code: 404, msg: '未找到该用户的开具记录' });
      }
      var cur = rows[0];
      var nextQuery = queryCode || (cur.query_code != null ? String(cur.query_code) : '');
      var nextQr = cur.qr_image_url != null ? String(cur.qr_image_url) : '';
      var nextBlock = cur.qr_block_image_url != null ? String(cur.qr_block_image_url) : '';

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

      await conn.execute(
        `UPDATE tax_issue_applications
         SET query_code = ?, qr_image_url = ?, qr_block_image_url = ?
         WHERE id = ? AND user_id = ?`,
        [nextQuery, nextQr || null, nextBlock || null, issueId, username]
      );

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
      }

      res.json({
        code: 200,
        msg: 'ok',
        data: {
          id: issueId,
          username: username,
          query_code: nextQuery,
          qr_image_url: nextQr,
          qr_block_image_url: nextBlock,
          mode: mode,
          account_locked: mode !== 'clear'
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[najilu-qr] save', e);
    res.status(500).json({
      code: 500,
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
      const [rows] = await conn.execute(
        `SELECT id, apply_time, period_start, period_end, record_no, scope, status,
                query_code, qr_image_url, qr_block_image_url, created_at, updated_at
         FROM tax_issue_applications
         WHERE user_id = ?
         ORDER BY created_at DESC, apply_time DESC
         LIMIT 30`,
        [username]
      );
        var list = (rows || []).map(function (r) {
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

function getHandlers() {
  return {
    handleAdminNajiluQrSave: handleAdminNajiluQrSave,
    handleAdminNajiluQrList: handleAdminNajiluQrList
  };
}

module.exports = {
  getHandlers: getHandlers,
  ensureNajiluQrColumns: ensureNajiluQrColumns,
  ensureUserQrOverrideTable: ensureUserQrOverrideTable,
  resolveUserQrOverride: resolveUserQrOverride,
  upsertUserQrOverride: upsertUserQrOverride,
  clearUserQrOverride: clearUserQrOverride,
  normalizeQueryCode: normalizeQueryCode
};
