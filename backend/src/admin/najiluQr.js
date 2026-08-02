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

      res.json({
        code: 200,
        msg: 'ok',
        data: {
          id: issueId,
          username: username,
          query_code: nextQuery,
          qr_image_url: nextQr,
          qr_block_image_url: nextBlock,
          mode: mode
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
      res.json({ code: 200, data: { applications: list } });
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
  normalizeQueryCode: normalizeQueryCode
};
