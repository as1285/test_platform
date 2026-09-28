/**
 * 退信收集：IMAP 拉发出件箱系统退信，标记无效邮箱，群发时跳过。
 */
const { getPool, getPoolOrNull } = require('../shared/db');
const parse = require('./emailBounceParse');
const imapInbox = require('./imapInbox');

var _timer = null;
var _syncing = false;

function hardBounceExistsSql(emailCol) {
  var col = emailCol || 'u.email';
  return (
    'EXISTS (SELECT 1 FROM email_bounces b WHERE b.email = LOWER(TRIM(' +
    col +
    ")) AND b.dismissed_at IS NULL AND b.bounce_type = 'hard')"
  );
}

async function lookupUsername(pool, email) {
  const [rows] = await pool.execute(
    'SELECT username FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1',
    [email]
  );
  return rows[0] && rows[0].username != null ? String(rows[0].username) : null;
}

async function upsertBounce(pool, item) {
  var email = parse.normalizeEmail(item.email);
  if (!email) return false;
  var bounceType = item.bounce_type === 'soft' ? 'soft' : 'hard';
  var reason = String(item.reason || '投递失败').slice(0, 255);
  var subject = String(item.subject || '').slice(0, 255);
  var messageId = item.message_id != null ? String(item.message_id).slice(0, 255) : null;
  var username = item.username || (await lookupUsername(pool, email));
  await pool.execute(
    `INSERT INTO email_bounces
       (email, username, bounce_type, reason, subject, message_id, first_seen_at, last_seen_at, hit_count, dismissed_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), 1, NULL)
     ON DUPLICATE KEY UPDATE
       username = COALESCE(VALUES(username), username),
       bounce_type = IF(VALUES(bounce_type) = 'hard' OR bounce_type = 'hard', 'hard', bounce_type),
       reason = VALUES(reason),
       subject = VALUES(subject),
       message_id = COALESCE(VALUES(message_id), message_id),
       last_seen_at = NOW(),
       hit_count = hit_count + 1,
       dismissed_at = NULL`,
    [email, username, bounceType, reason, subject, messageId]
  );
  if (bounceType === 'hard') {
    try {
      await pool.execute(
        `UPDATE user_email_sends
         SET status = 'failed',
             error_msg = IF(IFNULL(error_msg,'') = '', ?, error_msg)
         WHERE LOWER(TRIM(email)) = ? AND status = 'sent'
           AND created_at >= (UTC_TIMESTAMP() - INTERVAL 14 DAY)`,
        ['退信：' + reason, email]
      );
    } catch (eUp) {}
  }
  return true;
}

async function isHardBouncedEmail(email) {
  var e = parse.normalizeEmail(email);
  if (!e) return false;
  var pool = getPoolOrNull();
  if (!pool) return false;
  try {
    const [rows] = await pool.execute(
      "SELECT id FROM email_bounces WHERE email = ? AND dismissed_at IS NULL AND bounce_type = 'hard' LIMIT 1",
      [e]
    );
    return !!(rows && rows.length);
  } catch (e0) {
    return false;
  }
}

async function recordFromMessages(messages) {
  var pool = getPool();
  var scanned = 0;
  var matched = 0;
  var saved = 0;
  var i;
  var j;
  for (i = 0; i < (messages || []).length; i++) {
    scanned += 1;
    var parsed = parse.parseBounceMessage(messages[i] || {});
    if (!parsed) continue;
    matched += 1;
    for (j = 0; j < parsed.emails.length; j++) {
      var ok = await upsertBounce(pool, {
        email: parsed.emails[j],
        bounce_type: parsed.bounce_type,
        reason: parsed.reason,
        subject: parsed.subject,
        message_id: messages[i] && messages[i].messageId,
        username: null
      });
      if (ok) saved += 1;
    }
  }
  return { scanned: scanned, matched: matched, saved: saved };
}

async function syncInbox(opts) {
  opts = opts || {};
  if (_syncing) {
    var busy = new Error('正在拉取退信，请稍候');
    busy.code = 409;
    throw busy;
  }
  if (!imapInbox.isImapConfigured()) {
    var e0 = new Error('未配置邮箱授权码，无法拉取退信（与 SMTP 同一套）');
    e0.code = 400;
    throw e0;
  }
  _syncing = true;
  try {
    var session = imapInbox.createSession(opts);
    var messages = await session.fetchRecent(opts.days || 14, opts.limit || 80);
    var out = await recordFromMessages(messages);
    out.imap_ready = true;
    return out;
  } finally {
    _syncing = false;
  }
}

async function listBounces(opts) {
  opts = opts || {};
  var page = parseInt(opts.page, 10) || 1;
  var limit = parseInt(opts.limit, 10) || 20;
  if (page < 1) page = 1;
  if (limit < 1) limit = 20;
  if (limit > 100) limit = 100;
  var bounceType = opts.bounce_type != null ? String(opts.bounce_type).trim() : '';
  var q = opts.q != null ? String(opts.q).trim() : '';
  var includeDismissed = opts.include_dismissed === '1' || opts.include_dismissed === 1;
  var where = [];
  var params = [];
  if (!includeDismissed) where.push('dismissed_at IS NULL');
  if (bounceType === 'hard' || bounceType === 'soft') {
    where.push('bounce_type = ?');
    params.push(bounceType);
  }
  if (q) {
    where.push('(email LIKE ? OR IFNULL(username,"") LIKE ? OR IFNULL(reason,"") LIKE ?)');
    params.push('%' + q + '%', '%' + q + '%', '%' + q + '%');
  }
  var whereSql = where.length ? ' WHERE ' + where.join(' AND ') : '';
  var pool = getPool();
  const [countRows] = await pool.query(
    'SELECT COUNT(*) AS total FROM email_bounces' + whereSql,
    params
  );
  var total = Number(countRows[0] && countRows[0].total) || 0;
  const [rows] = await pool.query(
    'SELECT email, username, bounce_type, reason, subject, first_seen_at, last_seen_at, hit_count, dismissed_at FROM email_bounces' +
      whereSql +
      ' ORDER BY last_seen_at DESC LIMIT ? OFFSET ?',
    params.concat([limit, (page - 1) * limit])
  );
  return {
    items: (rows || []).map(function (r) {
      return {
        email: r.email,
        username: r.username || '',
        bounce_type: r.bounce_type,
        reason: r.reason || '',
        subject: r.subject || '',
        first_seen_at: r.first_seen_at ? new Date(r.first_seen_at).toISOString() : '',
        last_seen_at: r.last_seen_at ? new Date(r.last_seen_at).toISOString() : '',
        hit_count: Number(r.hit_count) || 1,
        dismissed: !!(r.dismissed_at)
      };
    }),
    total: total,
    page: page,
    limit: limit,
    imap_ready: imapInbox.isImapConfigured()
  };
}

async function bounceCounts() {
  var pool = getPoolOrNull();
  var empty = { hard: 0, soft: 0 };
  if (!pool) return empty;
  try {
    const [rows] = await pool.query(
      "SELECT bounce_type, COUNT(*) AS n FROM email_bounces WHERE dismissed_at IS NULL GROUP BY bounce_type"
    );
    var out = { hard: 0, soft: 0 };
    (rows || []).forEach(function (r) {
      var k = r && r.bounce_type === 'soft' ? 'soft' : 'hard';
      out[k] += Number(r.n) || 0;
    });
    return out;
  } catch (e0) {
    return empty;
  }
}

async function dismissBounce(email) {
  var e = parse.normalizeEmail(email);
  if (!e) {
    var err = new Error('邮箱无效');
    err.code = 400;
    throw err;
  }
  var pool = getPool();
  const [result] = await pool.execute(
    'UPDATE email_bounces SET dismissed_at = NOW() WHERE email = ? LIMIT 1',
    [e]
  );
  var n = result && (result.affectedRows != null ? result.affectedRows : result.changedRows);
  if (!n) {
    var e1 = new Error('没有这条退信记录');
    e1.code = 404;
    throw e1;
  }
  return { email: e, dismissed: true };
}

function jsonErr(res, e, fallback) {
  var code = e && e.code === 400 ? 400 : e && e.code === 404 ? 404 : e && e.code === 409 ? 409 : 500;
  if (code === 500) console.error('[email-bounces]', e);
  return res.status(code).json({ code: code, msg: String((e && e.message) || fallback || '失败') });
}

async function handleAdminEmailBouncesList(req, res) {
  try {
    var q = req.query || {};
    var data = await listBounces({
      page: q.page,
      limit: q.limit,
      q: q.q,
      bounce_type: q.bounce_type,
      include_dismissed: q.include_dismissed
    });
    return res.json({ code: 200, data: data });
  } catch (e) {
    return jsonErr(res, e, '加载退信失败');
  }
}

async function handleAdminEmailBouncesSync(req, res) {
  try {
    var body = req.body || {};
    var data = await syncInbox({ days: body.days || 14, limit: body.limit || 80 });
    return res.json({ code: 200, data: data });
  } catch (e) {
    return jsonErr(res, e, '拉取退信失败');
  }
}

async function handleAdminEmailBouncesDismiss(req, res) {
  try {
    var body = req.body || {};
    var data = await dismissBounce(body.email);
    return res.json({ code: 200, data: data });
  } catch (e) {
    return jsonErr(res, e, '恢复失败');
  }
}

function scheduleBouncePoll() {
  if (_timer) return;
  var ms = parseInt(process.env.EMAIL_BOUNCE_POLL_MS || '900000', 10);
  if (!isFinite(ms) || ms < 60000) ms = 900000;
  var tick = function () {
    if (!imapInbox.isImapConfigured() || !getPoolOrNull()) return;
    syncInbox({ days: 7, limit: 60 }).catch(function (e) {
      console.warn('[email-bounces] poll', e && e.message);
    });
  };
  _timer = setInterval(tick, ms);
  if (_timer.unref) _timer.unref();
  setTimeout(tick, 45000);
}

function getHandlers() {
  return {
    handleAdminEmailBouncesList: handleAdminEmailBouncesList,
    handleAdminEmailBouncesSync: handleAdminEmailBouncesSync,
    handleAdminEmailBouncesDismiss: handleAdminEmailBouncesDismiss
  };
}

module.exports = {
  hardBounceExistsSql: hardBounceExistsSql,
  isHardBouncedEmail: isHardBouncedEmail,
  recordFromMessages: recordFromMessages,
  syncInbox: syncInbox,
  listBounces: listBounces,
  bounceCounts: bounceCounts,
  dismissBounce: dismissBounce,
  scheduleBouncePoll: scheduleBouncePoll,
  getHandlers: getHandlers
};
