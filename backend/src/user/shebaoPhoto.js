/**
 * C 端 · 用户社保照片上传（激活页等）
 * 仅需登录，不要求账号已激活。
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { getPool } = require('../shared/db');
const config = require('../shared/config');

var SHEBAO_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
var SHEBAO_MAX_BYTES = 5 * 1024 * 1024;
var SHEBAO_MAX_PER_USER = 20;
var SHEBAO_PRIVATE_DIR = path.join(config.UPLOAD_DIR, 'private', 'shebao');

var userShebaoPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      fs.mkdir(SHEBAO_PRIVATE_DIR, { recursive: true }, function (err) {
        cb(err, SHEBAO_PRIVATE_DIR);
      });
    },
    filename: function (req, file, cb) {
      var ext = path.extname(file.originalname || '').toLowerCase();
      if (SHEBAO_IMAGE_EXT.indexOf(ext) < 0) {
        ext = '.jpg';
      }
      cb(null, 'shebao_' + crypto.randomBytes(16).toString('hex') + ext);
    }
  }),
  limits: { fileSize: SHEBAO_MAX_BYTES },
  fileFilter: function (req, file, cb) {
    var ext = path.extname(file.originalname || '').toLowerCase();
    var mime = String(file.mimetype || '').toLowerCase();
    var okExt = SHEBAO_IMAGE_EXT.indexOf(ext) >= 0;
    var okMime = !mime || /^image\/(jpeg|png|gif|webp)$/.test(mime);
    cb(okExt && okMime ? null : new Error('仅支持 jpg / png / gif / webp，且不超过 5MB'), okExt && okMime);
  }
});

function clean(s) {
  return String(s == null ? '' : s).trim();
}

function toPublicItem(row) {
  var id = row.id != null ? Number(row.id) : 0;
  return {
    id: id,
    url: id ? '/api/user/shebao-photo/' + id + '/file' : '',
    original_name: row.original_name != null ? String(row.original_name) : '',
    file_size: row.file_size != null ? Number(row.file_size) : 0,
    created_at: row.created_at ? new Date(row.created_at).toISOString() : ''
  };
}

function safeDeleteUploadedFile(file) {
  if (!file || !file.path) return;
  fs.unlink(file.path, function () {});
}

async function handleUserShebaoPhotoList(req, res) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var uname = String(req.authUserId);
    var pool = getPool();
    const [rows] = await pool.execute(
      `SELECT id, image_path, original_name, file_size, created_at
       FROM user_shebao_photos
       WHERE username = ?
       ORDER BY id DESC
       LIMIT 50`,
      [uname]
    );
    return res.json({
      code: 200,
      data: {
        items: (rows || []).map(toPublicItem),
        max_count: SHEBAO_MAX_PER_USER,
        max_bytes: SHEBAO_MAX_BYTES
      }
    });
  } catch (e) {
    console.error('[shebao-photo] list', e);
    return res.status(500).json({ code: 500, msg: '读取失败' });
  }
}

async function handleUserShebaoPhotoFile(req, res) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var id = Number(req.params && req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 400, msg: '照片参数错误' });
    }
    var pool = getPool();
    const [rows] = await pool.execute(
      `SELECT image_path
       FROM user_shebao_photos
       WHERE id = ? AND username = ?
       LIMIT 1`,
      [id, String(req.authUserId)]
    );
    if (!rows.length) {
      return res.status(404).json({ code: 404, msg: '照片不存在' });
    }
    var filename = path.basename(clean(rows[0].image_path));
    if (!filename || !/^shebao_[a-f0-9]{32}\.(?:jpe?g|png|gif|webp)$/i.test(filename)) {
      return res.status(404).json({ code: 404, msg: '照片不存在' });
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(filename, { root: SHEBAO_PRIVATE_DIR }, function (err) {
      if (err && !res.headersSent) {
        res.status(err.statusCode === 404 ? 404 : 500).json({
          code: err.statusCode === 404 ? 404 : 500,
          msg: err.statusCode === 404 ? '照片不存在' : '读取照片失败'
        });
      }
    });
  } catch (e) {
    console.error('[shebao-photo] file', e);
    return res.status(500).json({ code: 500, msg: '读取照片失败' });
  }
}

async function handleUserShebaoPhotoUpload(req, res) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    if (!req.file) {
      return res.status(400).json({ code: 400, msg: '未选择图片或格式不支持' });
    }
    var uname = String(req.authUserId);
    var pool = getPool();
    const [cntRows] = await pool.execute(
      'SELECT COUNT(*) AS c FROM user_shebao_photos WHERE username = ?',
      [uname]
    );
    var cnt = cntRows && cntRows[0] ? Number(cntRows[0].c) || 0 : 0;
    if (cnt >= SHEBAO_MAX_PER_USER) {
      safeDeleteUploadedFile(req.file);
      return res.status(400).json({
        code: 400,
        msg: '最多上传 ' + SHEBAO_MAX_PER_USER + ' 张社保照片'
      });
    }
    var rel = 'private/shebao/' + req.file.filename;
    var original = clean(req.file.originalname).slice(0, 200);
    var size = req.file.size != null ? Number(req.file.size) : 0;
    const [result] = await pool.execute(
      `INSERT INTO user_shebao_photos (username, image_path, original_name, file_size)
       VALUES (?, ?, ?, ?)`,
      [uname, rel, original || null, size || null]
    );
    return res.json({
      code: 200,
      data: toPublicItem({
        id: result.insertId,
        image_path: rel,
        original_name: original,
        file_size: size,
        created_at: new Date()
      })
    });
  } catch (e) {
    safeDeleteUploadedFile(req.file);
    console.error('[shebao-photo] upload', e);
    return res.status(500).json({ code: 500, msg: '上传失败，请稍后重试' });
  }
}

function getHandlers() {
  return {
    handleUserShebaoPhotoList: handleUserShebaoPhotoList,
    handleUserShebaoPhotoFile: handleUserShebaoPhotoFile,
    handleUserShebaoPhotoUpload: handleUserShebaoPhotoUpload
  };
}

module.exports = {
  getHandlers: getHandlers,
  userShebaoPhotoUpload: userShebaoPhotoUpload,
  SHEBAO_MAX_BYTES: SHEBAO_MAX_BYTES
};
