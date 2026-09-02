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

/** 运营邮件海报图（相对站点根路径） */
var EMAIL_POSTER_PATHS = {
  activate: 'img/email/email-poster-activate.jpg',
  offer: 'img/email/email-poster-offer.jpg',
  refund: 'img/refund-ad.jpg'
};

/**
 * 运营邮件文案模板（后台可一键套用）
 * poster: activate | offer | refund | ''
 */
var EMAIL_COPY_TEMPLATES = {
  activate: {
    id: 'activate',
    label: '开通去水印',
    subject: '开通后去除水印，完整查看收入纳税明细',
    content:
      '你好，\n\n开通后可去除演示水印，完整查看与导出收入纳税明细、纳税记录。\n付款一般几秒内自动到账，点下方按钮即可前往开通。',
    link_url: 'purchase.html?from=email_activate',
    cta_label: '立即开通',
    poster: 'activate',
    benefits: '开通后可获得：去除水印 · 完整收入明细 · 纳税记录导出'
  },
  offer: {
    id: 'offer',
    label: '专属优惠提醒',
    subject: '你的专属优惠仍有效，打开即可按优惠价开通',
    content:
      '你好，\n\n你的专属优惠价仍然有效。打开支付页将按该价格下单；开通后去除水印，完整使用收入明细与纳税记录。\n优惠可能随时调整，建议尽早开通。',
    link_url: 'purchase.html?from=email_offer',
    cta_label: '按优惠价开通',
    poster: 'offer',
    benefits: '开通后可获得：去除水印 · 完整收入明细 · 纳税记录导出'
  },
  soft_recall: {
    id: 'soft_recall',
    label: '轻量召回',
    subject: '你的演示账号还在，开通即可完整体验',
    content:
      '你好，\n\n你之前留下的演示账号仍可继续使用。开通后去除水印，可完整查看收入纳税明细并导出纳税记录。\n若暂时不需要，忽略本邮件即可。',
    link_url: 'purchase.html?from=email_recall',
    cta_label: '去开通页看看',
    poster: 'activate',
    benefits: '开通后可获得：去除水印 · 完整收入明细 · 纳税记录导出'
  },
  refund: {
    id: 'refund',
    label: '二次退税广告',
    subject: '二次退税：对照近三年税额/收入，符合可微信咨询',
    content:
      '你好，\n\n可先对照：2023–2025 任一年已缴税额超过 5000 元，或任一年收入达到 15 万。\n符合的话，打开页面复制微信号，备注「二次退税」咨询；同一顾问也可问公积金提取。\n不强制，不符合可忽略本邮件。',
    link_url: 'refund_ad.html?from=email_refund',
    cta_label: '打开二次退税说明',
    poster: 'refund',
    benefits: '对照条件 · 一键复制微信 · 备注二次退税咨询'
  }
};

function resolvePosterUrl(deps, posterKey) {
  var key = String(posterKey || '').trim().toLowerCase();
  if (!key || key === 'none' || key === '0') return '';
  var rel = EMAIL_POSTER_PATHS[key];
  if (!rel) return '';
  var origin = resolvePublicOrigin(deps);
  if (!origin) return '/' + rel.replace(/^\//, '');
  return origin + '/' + rel.replace(/^\//, '');
}

function resolveBodyOpts(deps, opts) {
  opts = opts || {};
  var posterKey = opts.poster != null ? opts.poster : opts.posterKey;
  if (posterKey == null || posterKey === '') {
    var aud = opts.audience != null ? String(opts.audience) : '';
    if (aud === 'price_offer_unpaid') posterKey = 'offer';
    else if (aud === 'refund_eligible') posterKey = 'refund';
    else posterKey = 'activate';
  }
  return {
    posterUrl: resolvePosterUrl(deps, posterKey),
    ctaLabel: opts.ctaLabel != null ? String(opts.ctaLabel).trim() : '',
    brandName: opts.brandName,
    benefits: opts.benefits != null ? String(opts.benefits).trim() : ''
  };
}

/**
 * @param {string} subject
 * @param {string} content
 * @param {string} ctaUrl
 * @param {{ posterUrl?: string, ctaLabel?: string, brandName?: string }} [opts]
 */
function buildEmailBodies(subject, content, ctaUrl, opts) {
  opts = opts || {};
  var brand = String(opts.brandName || '个人所得税').trim() || '个人所得税';
  var ctaLabel = String(opts.ctaLabel || '立即开通').trim() || '立即开通';
  var posterUrl = opts.posterUrl != null ? String(opts.posterUrl).trim() : '';
  var benefits =
    opts.benefits != null && String(opts.benefits).trim()
      ? String(opts.benefits).trim()
      : '开通后可获得：去除水印 · 完整收入明细 · 纳税记录导出';
  var bodyText = String(content || '').trim();
  var text =
    brand +
    '\n\n' +
    bodyText +
    (ctaUrl ? '\n\n' + ctaLabel + '：' + ctaUrl + '\n' : '\n') +
    '\n如不想再收到此类邮件，可回复本邮件说明，或在 App「个人信息」中清空邮箱。';

  var posterBlock = posterUrl
    ? '<tr><td style="padding:0;line-height:0;font-size:0;">' +
      (ctaUrl
        ? '<a href="' +
          escapeHtml(ctaUrl) +
          '" style="display:block;text-decoration:none;">'
        : '') +
      '<img src="' +
      escapeHtml(posterUrl) +
      '" width="560" alt="' +
      escapeHtml(brand) +
      '" style="display:block;width:100%;max-width:560px;height:auto;border:0;outline:none;">' +
      (ctaUrl ? '</a>' : '') +
      '</td></tr>'
    : '';

  var ctaBlock = ctaUrl
    ? '<tr><td style="padding:8px 28px 8px;">' +
      '<a href="' +
      escapeHtml(ctaUrl) +
      '" style="display:inline-block;padding:14px 28px;background:#1e6fff;color:#ffffff;text-decoration:none;border-radius:10px;font-size:16px;font-weight:600;line-height:1.2;">' +
      escapeHtml(ctaLabel) +
      '</a>' +
      '</td></tr>' +
      '<tr><td style="padding:4px 28px 0;font-size:12px;line-height:1.5;color:#94a3b8;">' +
      '或复制链接：' +
      escapeHtml(ctaUrl) +
      '</td></tr>'
    : '';

  var html =
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
    '<title>' +
    escapeHtml(subject || brand) +
    '</title></head><body style="margin:0;padding:0;background:#f1f5f9;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:20px 12px;">' +
    '<tr><td align="center">' +
    '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">' +
    '<tr><td style="padding:16px 28px;background:#0f172a;color:#ffffff;font-size:15px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">' +
    escapeHtml(brand) +
    '</td></tr>' +
    posterBlock +
    '<tr><td style="padding:22px 28px 8px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:#334155;white-space:pre-wrap;">' +
    escapeHtml(bodyText).replace(/\n/g, '<br>') +
    '</td></tr>' +
    '<tr><td style="padding:4px 28px 12px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#64748b;">' +
    escapeHtml(benefits) +
    '</td></tr>' +
    ctaBlock +
    '<tr><td style="padding:20px 28px 24px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.55;color:#94a3b8;border-top:1px solid #f1f5f9;">' +
    '本邮件由系统发送。如不想再收到，可回复说明，或在 App「个人信息」中清空邮箱。' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';

  return {
    text: text,
    html: html,
    subject: String(subject || '通知').trim().slice(0, 120),
    poster_url: posterUrl || '',
    cta_label: ctaLabel
  };
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
    has_email_inactive: true,
    has_email_all: true
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
    if (audience === 'has_email_all') {
      if (typeof deps.nonGuestUsernameSql === 'function') {
        where.push(deps.nonGuestUsernameSql('u.username'));
      }
      return;
    }
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
    var bodies = buildEmailBodies(subject, content, ctaUrl, resolveBodyOpts(deps, opts));
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
  async function notifyUserEmail(username, subject, content, linkUrl, extra) {
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
    var bodies = buildEmailBodies(
      subject,
      content,
      ctaUrl,
      resolveBodyOpts(deps, Object.assign({ poster: 'offer', ctaLabel: '查看专属价' }, extra || {}))
    );
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

  function hasEmailWhereSql() {
    return "u.email IS NOT NULL AND TRIM(u.email) <> '' AND u.email LIKE '%@%.%'";
  }

  /**
   * 已留邮箱用户列表
   * opts: { page, limit, q, active, admin }
   * active: '' | '1' | '0'
   */
  async function listUsers(opts) {
    opts = opts || {};
    await ensureTable();
    var page = parseInt(opts.page, 10) || 1;
    var limit = parseInt(opts.limit, 10) || 20;
    if (page < 1) page = 1;
    if (limit < 1) limit = 20;
    if (limit > 100) limit = 100;
    var offset = (page - 1) * limit;
    var q = opts.q != null ? String(opts.q).trim() : '';
    var active = opts.active != null ? String(opts.active).trim() : '';
    var where = [hasEmailWhereSql()];
    var params = [];
    if (typeof deps.nonGuestUsernameSql === 'function') {
      where.push(deps.nonGuestUsernameSql('u.username'));
    }
    if (active === '1') {
      where.push('u.account_active = 1');
    } else if (active === '0') {
      where.push('(u.account_active IS NULL OR u.account_active = 0)');
    }
    if (q) {
      where.push('(u.username LIKE ? OR u.real_name LIKE ? OR u.email LIKE ?)');
      params.push('%' + q + '%', '%' + q + '%', '%' + q + '%');
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
    const [rows] = await pool.query(
      `SELECT u.username, u.real_name, u.email, u.account_active, u.created_at,
              u.register_source_channel,
              (SELECT MAX(s.created_at) FROM user_email_sends s
                WHERE s.username = u.username AND s.status = 'sent') AS last_email_at,
              (SELECT s2.subject FROM user_email_sends s2
                WHERE s2.username = u.username AND s2.status = 'sent'
                ORDER BY s2.created_at DESC LIMIT 1) AS last_email_subject
       FROM users u` +
        whereSql +
        ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?',
      params.concat([limit, offset])
    );
    var users = (rows || []).map(function (r) {
      return {
        username: r.username != null ? String(r.username) : '',
        real_name: r.real_name != null ? String(r.real_name) : '',
        email: r.email != null ? String(r.email).trim() : '',
        account_active: Number(r.account_active) === 1,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : '',
        register_source_channel:
          r.register_source_channel != null ? String(r.register_source_channel).trim() : '',
        last_email_at: r.last_email_at ? new Date(r.last_email_at).toISOString() : '',
        last_email_subject: r.last_email_subject != null ? String(r.last_email_subject) : ''
      };
    });
    return {
      users: users,
      total: total,
      page: page,
      limit: limit,
      q: q,
      active: active,
      smtp_ready: !!(mail && mail.isMailConfigured && mail.isMailConfigured())
    };
  }

  /**
   * 向指定用户名列表发邮件
   * opts: { usernames, subject, content, linkUrl, dryRun, admin }
   */
  async function sendToUsernames(opts) {
    opts = opts || {};
    await ensureTable();
    var subject = opts.subject != null ? String(opts.subject).trim() : '';
    var content = opts.content != null ? String(opts.content).trim() : '';
    var dryRun = opts.dryRun === true;
    var rawNames = Array.isArray(opts.usernames) ? opts.usernames : [];
    var names = [];
    var seen = Object.create(null);
    var i;
    for (i = 0; i < rawNames.length; i++) {
      var n = rawNames[i] != null ? String(rawNames[i]).trim() : '';
      if (!n || seen[n]) continue;
      seen[n] = true;
      names.push(n);
    }
    if (!names.length) {
      var emptyErr = new Error('请选择要发送的用户');
      emptyErr.code = 400;
      throw emptyErr;
    }
    if (names.length > MSG_EMAIL_BULK_MAX) {
      var limErr = new Error('单次最多 ' + MSG_EMAIL_BULK_MAX + ' 人');
      limErr.code = 400;
      throw limErr;
    }
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

    var where = [hasEmailWhereSql(), 'u.username IN (' + names.map(function () {
      return '?';
    }).join(',') + ')'];
    var params = names.slice();
    if (typeof deps.nonGuestUsernameSql === 'function') {
      where.push(deps.nonGuestUsernameSql('u.username'));
    }
    if (opts.admin && typeof deps.appendAdminUserScope === 'function') {
      deps.appendAdminUserScope(where, params, opts.admin, 'u.username');
    }
    var whereSql = ' WHERE ' + where.join(' AND ');
    var pool = deps.getPool();
    const [userRows] = await pool.query(
      'SELECT u.username, u.email FROM users u' + whereSql + ' ORDER BY u.created_at DESC',
      params
    );
    var matched = (userRows || []).length;
    if (dryRun) {
      return {
        dry_run: true,
        matched: matched,
        requested: names.length,
        max: MSG_EMAIL_BULK_MAX,
        smtp_ready: !!(mail && mail.isMailConfigured && mail.isMailConfigured())
      };
    }
    if (matched <= 0) {
      return { sent: 0, failed: 0, matched: 0, requested: names.length };
    }

    var batchId = 'em_sel_' + Date.now().toString(36);
    var ctaUrl = buildCtaUrl(deps, opts.linkUrl || 'purchase.html');
    var bodies = buildEmailBodies(subject, content, ctaUrl, resolveBodyOpts(deps, opts));
    var adminName =
      opts.admin && opts.admin.username != null ? String(opts.admin.username).trim() : '';
    var sent = 0;
    var failed = 0;
    for (i = 0; i < userRows.length; i++) {
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
          [batchId, uname, email, bodies.subject, 'selected', status, errMsg, adminName || null]
        );
      } catch (eLog) {
        console.error('[user-email-selected] log', eLog);
      }
      if (i + 1 < userRows.length) {
        await sleep(MSG_EMAIL_SEND_GAP_MS);
      }
    }
    return {
      sent: sent,
      failed: failed,
      matched: matched,
      requested: names.length,
      batch_id: batchId,
      link_url: ctaUrl
    };
  }

  /**
   * 发送记录
   * opts: { page, limit, q, username, admin }
   */
  async function listSends(opts) {
    opts = opts || {};
    await ensureTable();
    var page = parseInt(opts.page, 10) || 1;
    var limit = parseInt(opts.limit, 10) || 20;
    if (page < 1) page = 1;
    if (limit < 1) limit = 20;
    if (limit > 100) limit = 100;
    var offset = (page - 1) * limit;
    var q = opts.q != null ? String(opts.q).trim() : '';
    var username = opts.username != null ? String(opts.username).trim() : '';
    /* user_email_sends 无 user_type；游客/归属过滤走 users 子查询 */
    var where = ['1=1'];
    var params = [];
    if (username) {
      where.push('s.username = ?');
      params.push(username);
    }
    if (q) {
      where.push('(s.username LIKE ? OR s.email LIKE ? OR s.subject LIKE ?)');
      params.push('%' + q + '%', '%' + q + '%', '%' + q + '%');
    }
    if (opts.admin && typeof deps.appendAdminUserScope === 'function') {
      var scopeWhere = ['u.username = s.username'];
      var scopeParams = [];
      deps.appendAdminUserScope(scopeWhere, scopeParams, opts.admin, 'u.username');
      where.push('EXISTS (SELECT 1 FROM users u WHERE ' + scopeWhere.join(' AND ') + ')');
      for (var si = 0; si < scopeParams.length; si++) {
        params.push(scopeParams[si]);
      }
    } else {
      where.push("LEFT(s.username, 8) <> '__guest_'");
    }
    var whereSql = ' WHERE ' + where.join(' AND ');
    var pool = deps.getPool();
    const [countRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM user_email_sends s' + whereSql,
      params
    );
    var total = Number(countRows[0] && countRows[0].total) || 0;
    const [rows] = await pool.query(
      `SELECT s.id, s.batch_id, s.username, s.email, s.subject, s.audience, s.status,
              s.error_msg, s.admin_username, s.created_at
       FROM user_email_sends s` +
        whereSql +
        ' ORDER BY s.created_at DESC, s.id DESC LIMIT ? OFFSET ?',
      params.concat([limit, offset])
    );
    var items = (rows || []).map(function (r) {
      return {
        id: Number(r.id) || 0,
        batch_id: r.batch_id != null ? String(r.batch_id) : '',
        username: r.username != null ? String(r.username) : '',
        email: r.email != null ? String(r.email) : '',
        subject: r.subject != null ? String(r.subject) : '',
        audience: r.audience != null ? String(r.audience) : '',
        status: r.status != null ? String(r.status) : '',
        error_msg: r.error_msg != null ? String(r.error_msg) : '',
        admin_username: r.admin_username != null ? String(r.admin_username) : '',
        created_at: r.created_at ? new Date(r.created_at).toISOString() : ''
      };
    });
    return { items: items, total: total, page: page, limit: limit, q: q, username: username };
  }

  /**
   * 清空用户邮箱（管理纠错）
   * opts: { username, admin }
   */
  async function clearUserEmail(opts) {
    opts = opts || {};
    var uid = opts.username != null ? String(opts.username).trim() : '';
    if (!uid) {
      var e0 = new Error('缺少用户名');
      e0.code = 400;
      throw e0;
    }
    var where = ['u.username = ?'];
    var params = [uid];
    if (typeof deps.nonGuestUsernameSql === 'function') {
      where.push(deps.nonGuestUsernameSql('u.username'));
    }
    if (opts.admin && typeof deps.appendAdminUserScope === 'function') {
      deps.appendAdminUserScope(where, params, opts.admin, 'u.username');
    }
    var pool = deps.getPool();
    const [result] = await pool.execute(
      'UPDATE users u SET u.email = NULL WHERE ' + where.join(' AND ') + ' LIMIT 1',
      params
    );
    var affected = result && (result.affectedRows != null ? result.affectedRows : result.changedRows);
    if (!affected) {
      var e1 = new Error('用户不存在或无权操作');
      e1.code = 404;
      throw e1;
    }
    return { username: uid, cleared: true };
  }

  return {
    sendBulk: sendBulk,
    sendToUsernames: sendToUsernames,
    listUsers: listUsers,
    listSends: listSends,
    clearUserEmail: clearUserEmail,
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
  buildCtaUrl: buildCtaUrl,
  resolvePosterUrl: resolvePosterUrl,
  EMAIL_COPY_TEMPLATES: EMAIL_COPY_TEMPLATES,
  EMAIL_POSTER_PATHS: EMAIL_POSTER_PATHS
};
