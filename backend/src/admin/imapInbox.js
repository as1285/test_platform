/**
 * 最小 IMAP 客户端：登录发件箱，拉取疑似退信原文。不引入第三方库。
 */
const tls = require('tls');

function quote(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function imapDate(d) {
  var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return d.getUTCDate() + '-' + months[d.getUTCMonth()] + '-' + d.getUTCFullYear();
}

function decodeMimeWords(s) {
  return String(s || '').replace(/=\?([^?]+)\?([bqBQ])\?([^?]+)\?=/g, function (_, cs, enc, data) {
    try {
      if (/b/i.test(enc)) return Buffer.from(data, 'base64').toString('utf8');
      var bytes = data.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, function (__, h) {
        return String.fromCharCode(parseInt(h, 16));
      });
      return Buffer.from(bytes, 'binary').toString('utf8');
    } catch (e0) {
      return data;
    }
  });
}

function parseHeaders(raw) {
  var text = String(raw || '');
  var get = function (name) {
    var re = new RegExp('^' + name + ':\\s*([^\\r\\n]*(?:\\r?\\n[ \\t][^\\r\\n]*)*)', 'im');
    var m = re.exec(text);
    return m ? decodeMimeWords(m[1].replace(/\r?\n[ \t]/g, ' ').trim()) : '';
  };
  return {
    from: get('From'),
    subject: get('Subject'),
    messageId: get('Message-ID') || get('Message-Id')
  };
}

function createSession(opts) {
  opts = opts || {};
  var host = opts.host || process.env.IMAP_HOST || 'imap.qq.com';
  var port = parseInt(opts.port || process.env.IMAP_PORT || '993', 10) || 993;
  var user = opts.user || process.env.IMAP_USER || process.env.SMTP_USER || '';
  var pass = opts.pass || process.env.IMAP_PASS || process.env.SMTP_PASS || '';
  var timeout = parseInt(opts.timeout || '25000', 10) || 25000;
  var socket = null;
  var buf = Buffer.alloc(0);
  var waiters = [];
  var tagN = 0;

  function failAll(err) {
    var q = waiters.slice();
    waiters = [];
    q.forEach(function (w) {
      w.reject(err);
    });
  }

  function pump() {
    var i = 0;
    while (i < waiters.length) {
      var w = waiters[i];
      var parsed = tryRead(w.tag);
      if (!parsed) {
        i += 1;
        continue;
      }
      waiters.splice(i, 1);
      w.resolve(parsed);
    }
  }

  function tryRead(tag) {
    var s = buf.toString('utf8');
    var re = new RegExp('(?:^|\\r\\n)' + tag + ' (OK|NO|BAD)([^\\r\\n]*)\\r\\n', 'm');
    var m = re.exec(s);
    if (!m) return null;
    var end = m.index + m[0].length;
    if (m.index > 0 && s.charAt(m.index) !== '\r' && s.charAt(m.index) !== '\n') {
      /* keep */
    }
    var raw = s.slice(0, end);
    buf = buf.slice(Buffer.byteLength(raw, 'utf8'));
    return { status: m[1], text: String(m[2] || '').trim(), raw: raw };
  }

  function connect() {
    return new Promise(function (resolve, reject) {
      var done = false;
      socket = tls.connect({ host: host, port: port, servername: host }, function () {
        /* greeting comes as data */
      });
      socket.setTimeout(timeout);
      socket.on('data', function (chunk) {
        buf = Buffer.concat([buf, chunk]);
        if (!done && /\* OK /i.test(buf.toString('utf8'))) {
          done = true;
          resolve();
        }
        pump();
      });
      socket.on('error', function (e) {
        if (!done) {
          done = true;
          reject(e);
        } else failAll(e);
      });
      socket.on('timeout', function () {
        var e = new Error('IMAP 连接超时');
        if (!done) {
          done = true;
          reject(e);
        } else failAll(e);
        try {
          socket.destroy();
        } catch (e0) {}
      });
      socket.on('close', function () {
        failAll(new Error('IMAP 连接已关闭'));
      });
    });
  }

  function cmd(line) {
    tagN += 1;
    var tag = 'A' + String(tagN).padStart(3, '0');
    return new Promise(function (resolve, reject) {
      waiters.push({ tag: tag, resolve: resolve, reject: reject });
      socket.write(tag + ' ' + line + '\r\n');
      pump();
    });
  }

  async function login() {
    if (!user || !pass) throw new Error('未配置 IMAP 账号（与 SMTP 同一套授权码）');
    var r = await cmd('LOGIN ' + quote(user) + ' ' + quote(pass));
    if (r.status !== 'OK') throw new Error('IMAP 登录失败：' + (r.text || r.status));
  }

  async function selectInbox() {
    var r = await cmd('SELECT INBOX');
    if (r.status !== 'OK') throw new Error('无法打开收件箱：' + (r.text || r.status));
  }

  function parseSearchIds(raw) {
    var m = /\* SEARCH[^\r\n]*/i.exec(raw);
    if (!m) return [];
    return String(m[0])
      .replace(/^\* SEARCH/i, '')
      .trim()
      .split(/\s+/)
      .map(function (x) {
        return parseInt(x, 10);
      })
      .filter(function (n) {
        return isFinite(n) && n > 0;
      });
  }

  function extractLiteral(raw) {
    var m = /\{(\d+)\}\r\n/.exec(raw);
    if (!m) return raw;
    var start = m.index + m[0].length;
    var n = parseInt(m[1], 10) || 0;
    return raw.slice(start, start + n);
  }

  async function fetchOne(seq) {
    var r = await cmd('FETCH ' + seq + ' (BODY.PEEK[HEADER.FIELDS (FROM SUBJECT MESSAGE-ID)] BODY.PEEK[TEXT])');
    if (r.status !== 'OK') return null;
    var header = '';
    var text = '';
    var parts = r.raw.split(/BODY\[(?:HEADER(?:\.FIELDS[^\]]*)?|TEXT)\]/i);
    if (parts.length >= 2) header = extractLiteral(parts[1]);
    if (parts.length >= 3) text = extractLiteral(parts[2]);
    if (!header && !text) {
      text = r.raw.slice(0, 20000);
    }
    var h = parseHeaders(header);
    return {
      from: h.from,
      subject: h.subject,
      messageId: h.messageId,
      text: String(text || '').slice(0, 40000)
    };
  }

  async function fetchRecent(days, limit) {
    days = parseInt(days, 10);
    if (!isFinite(days) || days < 1) days = 14;
    if (days > 90) days = 90;
    limit = parseInt(limit, 10);
    if (!isFinite(limit) || limit < 1) limit = 80;
    if (limit > 200) limit = 200;
    await connect();
    try {
      await login();
      await selectInbox();
      var since = new Date(Date.now() - days * 86400000);
      var sr = await cmd('SEARCH SINCE ' + imapDate(since));
      if (sr.status !== 'OK') throw new Error('IMAP SEARCH 失败：' + (sr.text || sr.status));
      var ids = parseSearchIds(sr.raw);
      ids = ids.slice(-limit);
      var out = [];
      var i;
      for (i = 0; i < ids.length; i++) {
        try {
          var msg = await fetchOne(ids[i]);
          if (msg) out.push(msg);
        } catch (eOne) {
          /* skip one */
        }
      }
      try {
        await cmd('LOGOUT');
      } catch (eOut) {}
      return out;
    } finally {
      try {
        if (socket) socket.destroy();
      } catch (eC) {}
    }
  }

  return {
    fetchRecent: fetchRecent
  };
}

function isImapConfigured() {
  var user = process.env.IMAP_USER || process.env.SMTP_USER || '';
  var pass = process.env.IMAP_PASS || process.env.SMTP_PASS || '';
  return !!(user && pass);
}

module.exports = {
  createSession: createSession,
  isImapConfigured: isImapConfigured,
  parseHeaders: parseHeaders,
  imapDate: imapDate
};
