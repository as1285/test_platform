/**
 * 解析 SMTP 退信（DSN / QQ 系统退信），抽出原收件人与硬/软退信。
 */
var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,24}/g;

var HARD_RE =
  /user\s*unknown|user\s*not\s*found|mailbox\s*unavailable|mailbox\s*not\s*found|no\s*such\s*user|recipient\s*rejected|550\s*5\.1\.1|5\.1\.1|地址不存在|邮箱不存在|用户不存在|查无此用户|帐号不存在|账号不存在|该邮件地址不存在|收件人.*不存在/i;
var SOFT_RE =
  /mailbox\s*full|over\s*quota|452\s*4\.|4\.2\.2|421\s*|try\s*again|temporarily|邮箱已满|空间不足|稍后重试/i;

function normalizeEmail(raw) {
  var s = String(raw || '').trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^mailto:/i, '').replace(/[<>]/g, '').trim();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}$/.test(s)) return '';
  return s;
}

function uniqueEmails(list) {
  var seen = Object.create(null);
  var out = [];
  var i;
  for (i = 0; i < (list || []).length; i++) {
    var e = normalizeEmail(list[i]);
    if (!e || seen[e]) continue;
    seen[e] = 1;
    out.push(e);
  }
  return out;
}

function isLikelyBounceMail(meta) {
  meta = meta || {};
  var from = String(meta.from || '').toLowerCase();
  var subject = String(meta.subject || '');
  if (/mailer-daemon|postmaster|mail delivery|undeliverable/i.test(from)) return true;
  if (/投递失败|系统退信|无法投递|邮件退回|undelivered|delivery failure|failure notice|returned mail|delivery status/i.test(subject)) {
    return true;
  }
  return false;
}

function classifyBounce(text) {
  var t = String(text || '');
  if (HARD_RE.test(t)) return 'hard';
  if (SOFT_RE.test(t)) return 'soft';
  if (/550|553|5\.1\.|5\.7\./.test(t) && /recipient|user|mailbox|收件|用户|邮箱/.test(t)) {
    return 'hard';
  }
  return 'hard';
}

function extractBounceRecipients(text) {
  var raw = String(text || '').replace(/\u0000/g, ' ');
  var found = [];
  var patterns = [
    /Final-Recipient:\s*(?:rfc822;)?\s*([^\s;]+)/gi,
    /Original-Recipient:\s*(?:rfc822;)?\s*([^\s;]+)/gi,
    /(?:原收件人|原邮件收件人|收件人地址|收件人)\s*[：:]\s*([^\s,;，]+)/gi,
    /X-Failed-Recipients:\s*([^\s,;]+)/gi
  ];
  var i;
  for (i = 0; i < patterns.length; i++) {
    var re = patterns[i];
    var m;
    while ((m = re.exec(raw))) {
      found.push(m[1]);
    }
  }
  if (!found.length) {
    var all = raw.match(EMAIL_RE) || [];
    var skip = /postmaster|mailer-daemon|noreply|no-reply|mail\.qq\.com|tencent\.com/i;
    for (i = 0; i < all.length; i++) {
      if (!skip.test(all[i])) found.push(all[i]);
    }
  }
  return uniqueEmails(found);
}

function bounceReason(text) {
  var t = String(text || '').replace(/\s+/g, ' ').trim();
  if (HARD_RE.test(t)) {
    if (/满|quota|full/i.test(t)) return '邮箱已满';
    return '地址不存在或已失效';
  }
  if (SOFT_RE.test(t)) return '暂时无法投递';
  return '投递失败';
}

function parseBounceMessage(meta) {
  meta = meta || {};
  var subject = String(meta.subject || '');
  var from = String(meta.from || '');
  var body = String(meta.text || meta.body || '');
  var combined = subject + '\n' + from + '\n' + body;
  if (!isLikelyBounceMail({ from: from, subject: subject }) && !HARD_RE.test(combined) && !SOFT_RE.test(combined)) {
    return null;
  }
  var emails = extractBounceRecipients(combined);
  if (!emails.length) return null;
  return {
    emails: emails,
    bounce_type: classifyBounce(combined),
    reason: bounceReason(combined),
    subject: subject.slice(0, 180)
  };
}

module.exports = {
  normalizeEmail: normalizeEmail,
  uniqueEmails: uniqueEmails,
  isLikelyBounceMail: isLikelyBounceMail,
  classifyBounce: classifyBounce,
  extractBounceRecipients: extractBounceRecipients,
  bounceReason: bounceReason,
  parseBounceMessage: parseBounceMessage
};
