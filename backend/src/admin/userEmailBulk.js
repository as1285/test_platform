/**
 * 运营：向已留邮箱的用户群发邮件（复用站内信人群筛选 + SMTP）
 */
var MSG_EMAIL_BULK_MAX = 200;
var MSG_EMAIL_SEND_GAP_MS = 120;
var EMAIL_SKIP_MARKER_PREFIX = '@@email_bulk:';

function isValidUserEmail(raw) {
  var s = raw == null ? '' : String(raw).trim();
  if (!s || s.length > 255) return false;
  /* 宽松校验：有 @ 与域名点，避免过度拒绝国内邮箱 */
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function resolvePublicOrigin(deps) {
  var raw =
    (deps && deps.publicSiteUrl) ||
    process.env.PUBLIC_SITE_URL ||
    process.env.APP_URL ||
    process.env.SITE_PUBLIC_ORIGIN ||
    '';
  return String(raw || '').trim().replace(/\/+$/, '');
}

function buildCtaUrl(deps, linkUrl) {
  var rel = String(linkUrl || 'purchase.html').trim() || 'purchase.html';
  if (/^https?:\/\//i.test(rel)) return rel;
  rel = rel.replace(/^\//, '');
  var origin = resolvePublicOrigin(deps);
  if (!origin) return rel;
  return origin + '/' + rel;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildEmailBodies(subject, content, ctaUrl) {
  var text =
    String(content || '').trim() +
    (ctaUrl ? '\n\n打开链接：' + ctaUrl + '\n' : '\n') +
    '\n如不想再收到此类邮件，可回复本邮件说明，或在 App「个人信息」中清空邮箱。';
  var html =
    '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#333;">' +
    '<p style="white-space:pre-wrap;margin:0 0 16px;">' +
    escapeHtml(content).replace(/\n/g, '<br>') +
    '</p>' +
    (ctaUrl
      ? '<p style="margin:0 0 16px;"><a href="' +
        escapeHtml(ctaUrl) +
        '" style="display:inline-block;padding:10px 18px;background:#1e6fff;color:#fff;text-decoration:none;border-radius:8px;">前往查看</a></p>' +
        '<p style="margin:0 0 8px;font-size:12px;color:#888;">或复制链接：' +
        escapeHtml(ctaUrl) +
        '</p>'
      : '') +
    '<p style="margin:16px 0 0;font-size:12px;color:#999;">如不想再收到，可回复说明或在 App 个人信息中清空邮箱。</p>' +
    '</div>';
  return { text: text, html: html, subject: String(subject || '通知').trim().slice(0, 120) };
}

/**
 * @param {object} deps
 * @param {() => any} deps.getPool
 * @param {{ isMailConfigured: Function, sendMail: Function }} deps.mail
 * @param {(audience:string, where:string[], params:any[]) => void} deps.appendBulkMsgAudienceFilters
 * @param {Record<string, boolean>} deps.bulkAudienceSet
 * @param {(where:string[], params:any[], admin:any, col:string) => void} [deps.appendAdminUserScope]
 * @param {string} [deps.publicSiteUrl]
 */
function createUserEmailBulk(deps) {
  deps = deps || {};
  var mail = deps.mail;
  var audienceSet = deps.bulkAudienceSet || {};
  var extraAudience = {
    price_offer_unpaid: true,
    has_email_inactive: true
  };

  async function ensureTable() {
    var pool = deps.getPool();
    await pool.execute(
      `CREATE TABLE IF NOT EXISTS user_email_sends (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        batch_id VARCHAR(64) NOT NULL,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        subject VARCHAR(200) NOT NULL,
        audience VARCHAR(64) NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'sent',
        error_msg VARCHAR(512) NULL,
        admin_username VARCHAR(64) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_ues_batch (batch_id),
        KEY idx_ues_user (username),
        KEY idx_ues_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
    );
  }

  function appendEmailAudienceFilters(audience, where, params) {
    where.push("u.email IS NOT NULL AND TRIM(u.email) <> '' AND u.email LIKE '%@%.%'");
    if (audience === 'has_email_inactive') {
      where.push('(u.account_active IS NULL OR u.account_active = 0)');
      if (typeof deps.nonGuestUsernameSql === 'function') {
        where.push(deps.nonGuestUsernameSql('u.username'));
      }
      return;
    }
    if (audience === 'price_offer_unpaid') {
      if (typeof deps.nonGuestUsernameSql === 'function') {
        where.push(deps.nonGuestUsernameSql('u.username'));
      }
      where.push('(u.account_active IS NULL OR u.account_active = 0)');
      where.push(
        'EXISTS (SELECT 1 FROM user_price_offers o WHERE o.username = u.username AND o.enabled = 1)'
      );
      return;
    }
    if (typeof deps.appendBulkMsgAudienceFilters === 'function') {
      deps.appendBulkMsgAudienceFilters(audience, where, params);
    }
  }

  function isKnownAudience(audience) {
    return !!(audienceSet[audience] || extraAudience[audience]);
  }

  /**
   * opts: { audience, subject, content, linkUrl, dryRun, skipAlreadySent, admin }
   */
  async function sendBulk(opts) {
    opts = opts || {};
    await ensureTable();
    var audience = opts.audience != null ? String(opts.audience).trim() : 'has_email_inactive';
    if (!isKnownAudience(audience)) {
      var audErr = new Error('audience 无效');
      audErr.code = 400;
      throw audErr;
    }
    var subject = opts.subject != null ? String(opts.subject).trim() : '';
    var content = opts.content != null ? String(opts.content).trim() : '';
    var dryRun = opts.dryRun === true;
    var skipAlreadySent = opts.skipAlreadySent === true;
    if (!dryRun) {
      if (!subject) {
        var sErr = new Error('请填写邮件标题');
        sErr.code = 400;
        throw sErr;
      }
      if (!content) {
        var cErr = new Error('请填写邮件正文');
        cErr.code = 400;
        throw cErr;
      }
      if (!mail || !mail.isMailConfigured || !mail.isMailConfigured()) {
        var mErr = new Error('未配置 SMTP（请设置 SMTP_USER / SMTP_PASS）');
        mErr.code = 400;
        throw mErr;
      }
    }
    if (subject.length > 120) subject = subject.substring(0, 120);

    var where = [];
    var params = [];
    appendEmailAudienceFilters(audience, where, params);
    if (skipAlreadySent) {
      where.push(
        'NOT EXISTS (SELECT 1 FROM user_email_sends s WHERE s.username = u.username AND s.status = ? AND s.created_at >= (UTC_TIMESTAMP() - INTERVAL 7 DAY))'
      );
      params.push('sent');
    }
    if (opts.admin && typeof deps.appendAdminUserScope === 'function') {
      deps.appendAdminUserScope(where, params, opts.admin, 'u.username');
    }
    var whereSql = ' WHERE ' + where.join(' AND ');
    var pool = deps.getPool();
    const [countRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM users u' + whereSql,
      params
    );
    var total = Number(countRows[0] && countRows[0].total) || 0;
    if (dryRun) {
      return {
        dry_run: true,
        audience: audience,
        matched: total,
        with_email: total,
        max: MSG_EMAIL_BULK_MAX,
        skip_already_sent: skipAlreadySent,
        smtp_ready: !!(mail && mail.isMailConfigured && mail.isMailConfigured())
      };
    }
    if (total <= 0) {
      return { sent: 0, failed: 0, matched: 0, audience: audience, skip_already_sent: skipAlreadySent };
    }
    if (total > MSG_EMAIL_BULK_MAX) {
      var limErr = new Error(
        '匹配 ' + total + ' 人，超过单次邮件上限 ' + MSG_EMAIL_BULK_MAX + '（SMTP 限流）。请缩小范围或分批。'
      );
      limErr.code = 400;
      throw limErr;
    }

    const [userRows] = await pool.query(
      'SELECT u.username, u.email FROM users u' +
        whereSql +
        ' ORDER BY u.created_at DESC LIMIT ?',
      params.concat([MSG_EMAIL_BULK_MAX])
    );
    var batchId = 'em_' + Date.now().toString(36);
    var ctaUrl = buildCtaUrl(deps, opts.linkUrl || 'purchase.html');
    var bodies = buildEmailBodies(subject, content, ctaUrl);
    var adminName =
      opts.admin && opts.admin.username != null ? String(opts.admin.username).trim() : '';
    var sent = 0;
    var failed = 0;
    var i;
    for (i = 0; i < (userRows || []).length; i++) {
      var row = userRows[i];
      var uname = row.username != null ? String(row.username).trim() : '';
      var email = row.email != null ? String(row.email).trim() : '';
      if (!uname || !isValidUserEmail(email)) {
        failed += 1;
        continue;
      }
      var status = 'sent';
      var errMsg = null;
      try {
        await mail.sendMail({
          to: email,
          subject: bodies.subject,
          text: bodies.text,
          html: bodies.html
        });
        sent += 1;
      } catch (eSend) {
        status = 'failed';
        errMsg = String((eSend && eSend.message) || eSend || 'send failed').slice(0, 500);
        failed += 1;
      }
      try {
        await pool.execute(
          `INSERT INTO user_email_sends
            (batch_id, username, email, subject, audience, status, error_msg, admin_username)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [batchId, uname, email, bodies.subject, audience, status, errMsg, adminName || null]
        );
      } catch (eLog) {
        console.error('[user-email-bulk] log', eLog);
      }
      if (i + 1 < userRows.length) {
        await sleep(MSG_EMAIL_SEND_GAP_MS);
      }
    }
    return {
      sent: sent,
      failed: failed,
      matched: total,
      audience: audience,
      batch_id: batchId,
      link_url: ctaUrl,
      skip_already_sent: skipAlreadySent
    };
  }

  /** 单用户通知邮件（出价通过等）；失败不抛 */
  async function notifyUserEmail(username, subject, content, linkUrl) {
    if (!mail || !mail.isMailConfigured || !mail.isMailConfigured()) return { sent: false, reason: 'no_smtp' };
    var uid = String(username || '').trim();
    if (!uid) return { sent: false, reason: 'no_user' };
    var pool = deps.getPool();
    const [rows] = await pool.execute(
      'SELECT email FROM users WHERE username = ? LIMIT 1',
      [uid]
    );
    var email = rows[0] && rows[0].email != null ? String(rows[0].email).trim() : '';
    if (!isValidUserEmail(email)) return { sent: false, reason: 'no_email' };
    var ctaUrl = buildCtaUrl(deps, linkUrl || 'purchase.html');
    var bodies = buildEmailBodies(subject, content, ctaUrl);
    await mail.sendMail({
      to: email,
      subject: bodies.subject,
      text: bodies.text,
      html: bodies.html
    });
    try {
      await ensureTable();
      await pool.execute(
        `INSERT INTO user_email_sends
          (batch_id, username, email, subject, audience, status, error_msg, admin_username)
         VALUES (?, ?, ?, ?, ?, 'sent', NULL, ?)`,
        [
          'auto_' + Date.now().toString(36),
          uid,
          email,
          bodies.subject,
          'auto_notify',
          'system'
        ]
      );
    } catch (eLog) {
      /* 日志失败忽略 */
    }
    return { sent: true, email: email };
  }

  return {
    sendBulk: sendBulk,
    notifyUserEmail: notifyUserEmail,
    isValidUserEmail: isValidUserEmail,
    MSG_EMAIL_BULK_MAX: MSG_EMAIL_BULK_MAX,
    EMAIL_SKIP_MARKER_PREFIX: EMAIL_SKIP_MARKER_PREFIX
  };
}

module.exports = {
  createUserEmailBulk: createUserEmailBulk,
  isValidUserEmail: isValidUserEmail,
  buildEmailBodies: buildEmailBodies,
  buildCtaUrl: buildCtaUrl
};
