/**
 * C 端 · 兼容 BUG 反馈（我要咨询）
 * 仅需登录，不要求账号已激活。图片落私有目录，管理台列表查看。
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { getPool } = require('../shared/db');
const config = require('../shared/config');
const mail = require('../../mail');
const { isValidUserEmail } = require('../admin/userEmailBulk');

var IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
var MAX_BYTES = 5 * 1024 * 1024;
var MAX_IMAGES = 6;
var CONTENT_MIN = 4;
var CONTENT_MAX = 2000;
var REPLY_MIN = 2;
var REPLY_MAX = 2000;
var MSG_COMPANY_SYSTEM_NOTICE = '系统通知';
var PRIVATE_DIR = path.join(config.UPLOAD_DIR, 'private', 'compat-feedback');
var FILE_RE = /^compat_[a-f0-9]{32}\.(?:jpe?g|png|gif|webp)$/i;
var TYPE_COMPAT = 'compat_bug';

var userCompatFeedbackUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      fs.mkdir(PRIVATE_DIR, { recursive: true }, function (err) {
        cb(err, PRIVATE_DIR);
      });
    },
    filename: function (req, file, cb) {
      var ext = path.extname(file.originalname || '').toLowerCase();
      if (IMAGE_EXT.indexOf(ext) < 0) {
        ext = '.jpg';
      }
      cb(null, 'compat_' + crypto.randomBytes(16).toString('hex') + ext);
    }
  }),
  limits: { fileSize: MAX_BYTES, files: MAX_IMAGES },
  fileFilter: function (req, file, cb) {
    var ext = path.extname(file.originalname || '').toLowerCase();
    var mime = String(file.mimetype || '').toLowerCase();
    var okExt = IMAGE_EXT.indexOf(ext) >= 0;
    var okMime = !mime || /^image\/(jpeg|png|gif|webp)$/.test(mime);
    cb(okExt && okMime ? null : new Error('仅支持 jpg / png / gif / webp，且不超过 5MB'), okExt && okMime);
  }
});

function clean(s) {
  return String(s == null ? '' : s).trim();
}

function normalizeContent(v) {
  var s = clean(v).replace(/\r\n/g, '\n');
  if (!s) return { error: '请填写问题描述' };
  if (s.length < CONTENT_MIN) {
    return { error: '请把遇到的情况写清楚（至少 ' + CONTENT_MIN + ' 个字）' };
  }
  if (s.length > CONTENT_MAX) s = s.slice(0, CONTENT_MAX);
  return { value: s };
}

function normalizeContact(v) {
  var s = clean(v).replace(/\s+/g, ' ');
  if (!s) return null;
  if (s.length > 64) s = s.slice(0, 64);
  return s;
}

function normalizeDeviceInfo(v) {
  var s = clean(v).replace(/\s+/g, ' ');
  if (!s) return null;
  if (s.length > 255) s = s.slice(0, 255);
  return s;
}

function normalizeUserAgent(v) {
  var s = clean(v);
  if (!s) return null;
  if (s.length > 512) s = s.slice(0, 512);
  return s;
}

function normalizeReply(v) {
  var s = clean(v).replace(/\r\n/g, '\n');
  if (!s) return { error: '请填写回复内容' };
  if (s.length < REPLY_MIN) {
    return { error: '回复至少 ' + REPLY_MIN + ' 个字' };
  }
  if (s.length > REPLY_MAX) s = s.slice(0, REPLY_MAX);
  return { value: s };
}

function snippetText(v, n) {
  var s = clean(v).replace(/\s+/g, ' ');
  if (!s) return '';
  if (s.length <= n) return s;
  return s.slice(0, n) + '…';
}

function buildReplyInbox(replyText, originalContent) {
  var reply = clean(replyText);
  var orig = snippetText(originalContent, 80);
  var body = '您提交的兼容问题我们已回复。';
  if (orig) body += '\n\n【您的反馈】\n' + orig;
  body += '\n\n【回复】\n' + reply;
  body += '\n\n可在「兼容问题反馈」页查看完整内容。';
  return {
    title: '兼容反馈已回复',
    content: body + '\n@@link:compat_bug.html',
    company_name: MSG_COMPANY_SYSTEM_NOTICE,
    link_url: 'compat_bug.html'
  };
}

async function sendReplyInbox(pool, username, replyText, originalContent) {
  var uid = clean(username);
  if (!uid || !pool) return { sent: false };
  var msg = buildReplyInbox(replyText, originalContent);
  var mid = 'msg_fb_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await pool.execute(
    'INSERT INTO messages (id, user_id, title, content, company_name, msg_date, is_read) VALUES (?, ?, ?, ?, ?, ?, 0)',
    [mid, uid, msg.title, msg.content, msg.company_name, new Date().toISOString().slice(0, 10)]
  );
  return { sent: true, message_id: mid };
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReplyEmail(replyText) {
  var reply = clean(replyText);
  return {
    subject: '兼容反馈已回复',
    text: reply,
    html:
      '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>' +
      '<body style="margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#334155;">' +
      '<div style="white-space:pre-wrap;">' +
      escapeHtml(reply).replace(/\n/g, '<br>') +
      '</div></body></html>'
  };
}

async function lookupUserEmail(pool, username) {
  var uid = clean(username);
  if (!uid || !pool) return '';
  try {
    const [rows] = await pool.execute('SELECT email FROM users WHERE username = ? LIMIT 1', [uid]);
    return rows && rows[0] && rows[0].email != null ? clean(rows[0].email) : '';
  } catch (e0) {
    return '';
  }
}

async function sendReplyEmail(pool, username, replyText, mailer) {
  mailer = mailer || mail;
  if (!mailer || !mailer.isMailConfigured || !mailer.isMailConfigured()) {
    return { sent: false, reason: 'no_smtp' };
  }
  var email = await lookupUserEmail(pool, username);
  if (!isValidUserEmail(email)) return { sent: false, reason: 'no_email' };
  var bodies = buildReplyEmail(replyText);
  await mailer.sendMail({
    to: email,
    subject: bodies.subject,
    text: bodies.text,
    html: bodies.html
  });
  return { sent: true, email: email };
}

function parseImageUrls(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .map(function (x) {
        return clean(x);
      })
      .filter(Boolean);
  }
  try {
    var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(function (x) {
        return clean(x);
      })
      .filter(Boolean);
  } catch (e0) {
    return [];
  }
}

function normalizeSubmitBody(b) {
  b = b || {};
  var content = normalizeContent(b.content != null ? b.content : b.description);
  if (content.error) return { error: content.error };
  return {
    feedback_type: TYPE_COMPAT,
    content: content.value,
    contact: normalizeContact(b.contact),
    device_info: normalizeDeviceInfo(b.device_info != null ? b.device_info : b.device),
    user_agent: normalizeUserAgent(b.user_agent)
  };
}

function deviceInfoFromRequest(req, bodyDevice) {
  var fromBody = normalizeDeviceInfo(bodyDevice);
  if (fromBody) return fromBody;
  var p = req && req.clientDevicePayload && typeof req.clientDevicePayload === 'object' ? req.clientDevicePayload : {};
  var parts = [];
  var model = clean(p.device_model || p.model);
  var platform = clean(p.platform);
  var screen = clean(p.screen);
  if (model) parts.push(model);
  if (platform) parts.push(platform);
  if (screen) parts.push(screen);
  return normalizeDeviceInfo(parts.join(' · '));
}

function userAgentFromRequest(req, bodyUa) {
  var fromBody = normalizeUserAgent(bodyUa);
  if (fromBody) return fromBody;
  var p = req && req.clientDevicePayload && typeof req.clientDevicePayload === 'object' ? req.clientDevicePayload : {};
  if (p.user_agent) return normalizeUserAgent(p.user_agent);
  return normalizeUserAgent(req && req.headers && req.headers['user-agent']);
}

function safeDeleteFiles(files) {
  (files || []).forEach(function (file) {
    if (file && file.path) fs.unlink(file.path, function () {});
  });
}

function relFromFile(file) {
  return 'private/compat-feedback/' + file.filename;
}

function toAdminImageUrl(feedbackId, index) {
  return '/api/admin/feedback/' + Number(feedbackId) + '/image/' + Number(index);
}

function toPublicItem(row, opts) {
  opts = opts || {};
  var id = row.id != null ? Number(row.id) : 0;
  var paths = parseImageUrls(row.image_urls);
  var images = paths.map(function (rel, i) {
    return {
      index: i,
      url: opts.admin ? toAdminImageUrl(id, i) : '',
      path: opts.includePath ? rel : undefined
    };
  });
  return {
    id: id,
    user_id: row.user_id != null ? String(row.user_id) : '',
    real_name: row.real_name_snapshot != null ? String(row.real_name_snapshot) : '',
    feedback_type: row.feedback_type != null ? String(row.feedback_type) : TYPE_COMPAT,
    content: row.content != null ? String(row.content) : '',
    contact: row.contact != null ? String(row.contact) : '',
    device_info: row.device_info != null ? String(row.device_info) : '',
    user_agent: row.user_agent != null ? String(row.user_agent) : '',
    image_count: images.length,
    images: images,
    admin_reply: row.admin_reply != null ? String(row.admin_reply) : '',
    replied_at: row.replied_at ? new Date(row.replied_at).toISOString() : '',
    replied_by: row.replied_by != null ? String(row.replied_by) : '',
    has_reply: !!(row.admin_reply && String(row.admin_reply).trim()),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : ''
  };
}

async function lookupRealName(pool, username) {
  try {
    const [rows] = await pool.execute('SELECT real_name FROM users WHERE username = ? LIMIT 1', [username]);
    if (rows && rows[0] && rows[0].real_name) return clean(rows[0].real_name).slice(0, 255);
  } catch (e0) {}
  return null;
}

async function handleFeedbackSubmit(req, res) {
  var files = Array.isArray(req.files) ? req.files : [];
  try {
    if (!req.authUserId) {
      safeDeleteFiles(files);
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    if (files.length > MAX_IMAGES) {
      safeDeleteFiles(files);
      return res.status(400).json({ code: 400, msg: '最多上传 ' + MAX_IMAGES + ' 张图片' });
    }
    var body = req.body && typeof req.body === 'object' ? req.body : {};
    var row = normalizeSubmitBody(body);
    if (row.error) {
      safeDeleteFiles(files);
      return res.status(400).json({ code: 400, msg: row.error });
    }
    row.device_info = deviceInfoFromRequest(req, body.device_info || body.device);
    row.user_agent = userAgentFromRequest(req, body.user_agent);
    var paths = files.map(relFromFile);
    var uname = String(req.authUserId);
    var pool = getPool();
    var realName = await lookupRealName(pool, uname);
    const [result] = await pool.execute(
      `INSERT INTO user_feedback
        (user_id, real_name_snapshot, feedback_type, content, image_urls, user_agent, device_info, contact)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uname,
        realName,
        row.feedback_type,
        row.content,
        paths.length ? JSON.stringify(paths) : null,
        row.user_agent,
        row.device_info,
        row.contact
      ]
    );
    return res.json({
      code: 200,
      msg: '已提交，感谢反馈',
      data: {
        id: result.insertId,
        image_count: paths.length
      }
    });
  } catch (e) {
    safeDeleteFiles(files);
    console.error('[compat-feedback] submit', e);
    return res.status(500).json({ code: 500, msg: '提交失败，请稍后重试' });
  }
}

async function handleAdminFeedbackList(req, res) {
  try {
    var q = req.query || {};
    var page = parseInt(q.page, 10);
    var limit = parseInt(q.limit, 10);
    if (!Number.isInteger(page) || page < 1) page = 1;
    if (!Number.isInteger(limit) || limit < 1) limit = 30;
    if (limit > 100) limit = 100;
    var offset = (page - 1) * limit;
    var keyword = clean(q.q);
    var status = clean(q.status).toLowerCase();
    var pool = getPool();
    var where = "feedback_type = 'compat_bug'";
    var binds = [];
    if (keyword) {
      where += ' AND (user_id LIKE ? OR real_name_snapshot LIKE ? OR content LIKE ? OR device_info LIKE ?)';
      var like = '%' + keyword + '%';
      binds.push(like, like, like, like);
    }
    if (status === 'pending') {
      where += " AND (admin_reply IS NULL OR TRIM(admin_reply) = '')";
    } else if (status === 'replied') {
      where += " AND admin_reply IS NOT NULL AND TRIM(admin_reply) <> ''";
    }
    const [cntRows] = await pool.execute(
      'SELECT COUNT(*) AS c FROM user_feedback WHERE ' + where,
      binds
    );
    var total = cntRows && cntRows[0] ? Number(cntRows[0].c) || 0 : 0;
    const [rows] = await pool.query(
      `SELECT id, user_id, real_name_snapshot, feedback_type, content, image_urls,
              user_agent, device_info, contact, admin_reply, replied_at, replied_by, created_at
       FROM user_feedback
       WHERE ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      binds.concat([limit, offset])
    );
    return res.json({
      code: 200,
      data: {
        items: (rows || []).map(function (r) {
          return toPublicItem(r, { admin: true });
        }),
        total: total,
        page: page,
        limit: limit
      }
    });
  } catch (e) {
    console.error('[compat-feedback] admin list', e);
    return res.status(500).json({ code: 500, msg: '读取失败' });
  }
}

async function handleUserFeedbackMine(req, res) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, user_id, real_name_snapshot, feedback_type, content, image_urls,
              user_agent, device_info, contact, admin_reply, replied_at, replied_by, created_at
       FROM user_feedback
       WHERE feedback_type = ? AND user_id = ?
       ORDER BY id DESC
       LIMIT 30`,
      [TYPE_COMPAT, String(req.authUserId)]
    );
    return res.json({
      code: 200,
      data: {
        items: (rows || []).map(function (r) {
          return toPublicItem(r, { admin: false });
        })
      }
    });
  } catch (e) {
    console.error('[compat-feedback] mine', e);
    return res.status(500).json({ code: 500, msg: '读取失败' });
  }
}

async function handleAdminFeedbackReply(req, res) {
  try {
    var id = Number(req.params && req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 400, msg: '参数错误' });
    }
    var body = req.body && typeof req.body === 'object' ? req.body : {};
    var reply = normalizeReply(body.reply != null ? body.reply : body.admin_reply);
    if (reply.error) {
      return res.status(400).json({ code: 400, msg: reply.error });
    }
    var adminName = '';
    if (req.admin && req.admin.username) {
      adminName = clean(req.admin.username).slice(0, 255);
    }
    var pool = getPool();
    const [rows] = await pool.execute(
      'SELECT id, user_id, content FROM user_feedback WHERE id = ? AND feedback_type = ? LIMIT 1',
      [id, TYPE_COMPAT]
    );
    if (!rows.length) {
      return res.status(404).json({ code: 404, msg: '记录不存在' });
    }
    await pool.execute(
      'UPDATE user_feedback SET admin_reply = ?, replied_at = NOW(), replied_by = ? WHERE id = ? AND feedback_type = ?',
      [reply.value, adminName || null, id, TYPE_COMPAT]
    );
    var inbox = { sent: false };
    var emailOut = { sent: false };
    try {
      inbox = await sendReplyInbox(pool, rows[0].user_id, reply.value, rows[0].content);
    } catch (eInbox) {
      console.error('[compat-feedback] inbox', eInbox);
    }
    try {
      emailOut = await sendReplyEmail(pool, rows[0].user_id, reply.value);
    } catch (eMail) {
      console.error('[compat-feedback] email', eMail);
    }
    const [fresh] = await pool.execute(
      `SELECT id, user_id, real_name_snapshot, feedback_type, content, image_urls,
              user_agent, device_info, contact, admin_reply, replied_at, replied_by, created_at
       FROM user_feedback WHERE id = ? LIMIT 1`,
      [id]
    );
    var msg = '已保存回复';
    if (inbox.sent && emailOut.sent) {
      msg = '已回复，并已站内信和邮件通知用户';
    } else if (inbox.sent) {
      msg = '已回复并通知用户';
    } else if (emailOut.sent) {
      msg = '已回复并已邮件通知用户';
    }
    return res.json({
      code: 200,
      msg: msg,
      data: {
        item: fresh[0] ? toPublicItem(fresh[0], { admin: true }) : null,
        inbox_sent: !!inbox.sent,
        email_sent: !!emailOut.sent
      }
    });
  } catch (e) {
    console.error('[compat-feedback] admin reply', e);
    return res.status(500).json({ code: 500, msg: '回复失败，请稍后重试' });
  }
}

async function handleAdminFeedbackImage(req, res) {
  try {
    var id = Number(req.params && req.params.id);
    var idx = Number(req.params && req.params.index);
    if (!Number.isInteger(id) || id <= 0 || !Number.isInteger(idx) || idx < 0) {
      return res.status(400).json({ code: 400, msg: '参数错误' });
    }
    var pool = getPool();
    const [rows] = await pool.execute(
      'SELECT image_urls FROM user_feedback WHERE id = ? AND feedback_type = ? LIMIT 1',
      [id, TYPE_COMPAT]
    );
    if (!rows.length) {
      return res.status(404).json({ code: 404, msg: '记录不存在' });
    }
    var paths = parseImageUrls(rows[0].image_urls);
    var rel = paths[idx] || '';
    var filename = path.basename(rel);
    if (!filename || !FILE_RE.test(filename)) {
      return res.status(404).json({ code: 404, msg: '图片不存在' });
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(filename, { root: PRIVATE_DIR }, function (err) {
      if (err && !res.headersSent) {
        res.status(err.statusCode === 404 ? 404 : 500).json({
          code: err.statusCode === 404 ? 404 : 500,
          msg: err.statusCode === 404 ? '图片不存在' : '读取图片失败'
        });
      }
    });
  } catch (e) {
    console.error('[compat-feedback] admin image', e);
    return res.status(500).json({ code: 500, msg: '读取图片失败' });
  }
}

function getHandlers() {
  return {
    handleFeedbackSubmit: handleFeedbackSubmit,
    handleUserFeedbackMine: handleUserFeedbackMine,
    handleAdminFeedbackList: handleAdminFeedbackList,
    handleAdminFeedbackReply: handleAdminFeedbackReply,
    handleAdminFeedbackImage: handleAdminFeedbackImage
  };
}

module.exports = {
  getHandlers: getHandlers,
  userCompatFeedbackUpload: userCompatFeedbackUpload,
  normalizeSubmitBody: normalizeSubmitBody,
  normalizeContent: normalizeContent,
  normalizeReply: normalizeReply,
  buildReplyInbox: buildReplyInbox,
  buildReplyEmail: buildReplyEmail,
  sendReplyEmail: sendReplyEmail,
  toPublicItem: toPublicItem,
  parseImageUrls: parseImageUrls,
  TYPE_COMPAT: TYPE_COMPAT,
  MAX_BYTES: MAX_BYTES,
  MAX_IMAGES: MAX_IMAGES,
  CONTENT_MIN: CONTENT_MIN,
  CONTENT_MAX: CONTENT_MAX,
  REPLY_MIN: REPLY_MIN,
  REPLY_MAX: REPLY_MAX
};
