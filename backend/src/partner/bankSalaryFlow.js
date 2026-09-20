/**
 * 银行模拟器对接：校验个税账号后返回可导入的工资流水。
 */
'use strict';

const crypto = require('crypto');
const { getPool } = require('../shared/db');
const config = require('../shared/config');
const { consumeRateLimit } = require('../shared/rateLimit');

const USER_TYPE_GUEST = 2;
const TAX_RECORD_NOT_DELETED_SQL = 'deleted_at IS NULL';

function clean(s) {
  return String(s == null ? '' : s).trim();
}

function parseAllowlist(raw) {
  return String(raw || '')
    .split(/[\s,]+/)
    .map(function (s) {
      return String(s || '').trim();
    })
    .filter(Boolean);
}

function getClientIp(req) {
  var cf = req && req.headers && req.headers['cf-connecting-ip'];
  if (cf) {
    var cfIp = String(cf).split(',')[0].trim();
    if (cfIp) return cfIp.replace(/^::ffff:/, '');
  }
  var xf = req && req.headers && req.headers['x-forwarded-for'];
  if (xf) {
    var first = String(xf).split(',')[0].trim();
    if (first) return first.replace(/^::ffff:/, '');
  }
  var rip = req && req.headers && req.headers['x-real-ip'];
  if (rip) return String(rip).trim().replace(/^::ffff:/, '');
  var ra = req && req.socket && req.socket.remoteAddress;
  return ra ? String(ra).replace(/^::ffff:/, '') : '';
}

function timingSafeEqualStr(a, b) {
  var ha = crypto.createHash('sha256').update(String(a || '')).digest();
  var hb = crypto.createHash('sha256').update(String(b || '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function extractApiKey(req) {
  var h = (req && req.headers) || {};
  var fromHeader = clean(h['x-bank-api-key'] || h['x-partner-api-key']);
  if (fromHeader) return fromHeader;
  var auth = clean(h.authorization);
  var m = auth.match(/^Bearer\s+(.+)$/i);
  if (m) return clean(m[1]);
  var body = (req && req.body) || {};
  return clean(body.api_key || body.apiKey);
}

function isPrivateOrLocalIp(ip) {
  var v = String(ip || '').replace(/^::ffff:/, '');
  if (!v) return false;
  if (v === '127.0.0.1' || v === '::1' || v === 'localhost') return true;
  if (v.indexOf('10.') === 0) return true;
  if (v.indexOf('192.168.') === 0) return true;
  if (v.indexOf('172.') === 0) {
    var n = parseInt(v.split('.')[1], 10);
    return n >= 16 && n <= 31;
  }
  return false;
}

function ipAllowed(ip, allowlist) {
  if (!allowlist || !allowlist.length) return true;
  var v = String(ip || '').replace(/^::ffff:/, '');
  if (!v) return false;
  for (var i = 0; i < allowlist.length; i++) {
    if (allowlist[i] === v) return true;
  }
  var trustLocal = allowlist.indexOf('127.0.0.1') >= 0 || allowlist.indexOf('::1') >= 0;
  if (trustLocal && isPrivateOrLocalIp(v)) return true;
  return false;
}

function validateUsername(u) {
  if (!u || typeof u !== 'string') return '账号不能为空';
  u = u.trim();
  if (u.length === 0) return '账号不能为空';
  if (u.length > 32) return '账号长度为 1～32 位';
  if (!/^[\dA-Za-z@._-]+$/.test(u)) return '账号仅支持数字、字母及 . _ - @';
  return null;
}

function verifyPasswordBySaltHash(password, saltHex, hashHex) {
  if (!saltHex || !hashHex) return false;
  try {
    var saltBuf = Buffer.from(String(saltHex), 'hex');
    var actual = crypto.scryptSync(String(password), saltBuf, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(String(hashHex), 'hex'));
  } catch (e) {
    return false;
  }
}

function ymToIndex(ym) {
  var s = clean(ym);
  var m = s.match(/^(\d{4})[-/.]?(\d{1,2})$/);
  if (!m) return NaN;
  var y = parseInt(m[1], 10);
  var mo = parseInt(m[2], 10);
  if (!isFinite(y) || !isFinite(mo) || mo < 1 || mo > 12) return NaN;
  return y * 12 + mo;
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function paydayIso(year, month) {
  var y = parseInt(year, 10);
  var m = parseInt(month, 10);
  if (!isFinite(y) || !isFinite(m) || m < 1 || m > 12) return '';
  return y + '-' + pad2(m) + '-15 09:18:00';
}

function money2(n) {
  var v = Number(n);
  if (!isFinite(v)) v = 0;
  return v.toFixed(2);
}

function parseMoneyNum(v) {
  if (v == null || v === '') return 0;
  var n = parseFloat(String(v).replace(/,/g, ''));
  return isFinite(n) ? n : 0;
}

function isBonusSubtype(sub) {
  return /全年一次性奖金/.test(String(sub || ''));
}

function isSalaryLike(rec, includeBonus) {
  var t = String((rec && rec.income_type) || '');
  var sub = String((rec && rec.income_subtype) || '');
  if (isBonusSubtype(sub)) return !!includeBonus;
  if (/工资|薪金|劳务/.test(t) || /工资|薪金|劳务/.test(sub)) return true;
  if (!t && !sub) return true;
  return /正常工资/.test(sub);
}

function pickAmount(rec) {
  var n = parseMoneyNum(rec && rec.income_this_period);
  if (!(n > 0)) n = parseMoneyNum(rec && rec.income);
  return n;
}

function dominantCompany(records) {
  var count = {};
  var amount = {};
  (records || []).forEach(function (r) {
    var co = clean(r && r.company_name);
    if (!co) return;
    count[co] = (count[co] || 0) + 1;
    amount[co] = (amount[co] || 0) + pickAmount(r);
  });
  var best = '';
  var bestAmt = -1;
  var bestN = -1;
  Object.keys(count).forEach(function (co) {
    var n = count[co];
    var amt = amount[co] || 0;
    if (amt > bestAmt || (amt === bestAmt && n > bestN)) {
      bestAmt = amt;
      bestN = n;
      best = co;
    }
  });
  return best;
}

function mapRecordsToTransactions(records, opts) {
  opts = opts || {};
  var includeBonus = !!opts.include_bonus;
  var fromIdx = opts.from_ym ? ymToIndex(opts.from_ym) : NaN;
  var toIdx = opts.to_ym ? ymToIndex(opts.to_ym) : NaN;
  if (isFinite(fromIdx) && isFinite(toIdx) && fromIdx > toIdx) {
    var tmp = fromIdx;
    fromIdx = toIdx;
    toIdx = tmp;
  }
  var txs = [];
  var incomeTotal = 0;
  var taxTotal = 0;
  (records || []).forEach(function (r) {
    if (!r) return;
    var y = parseInt(r.year, 10);
    var m = parseInt(r.month, 10);
    if (!isFinite(y) || !isFinite(m) || m < 1 || m > 12) return;
    var idx = y * 12 + m;
    if (isFinite(fromIdx) && idx < fromIdx) return;
    if (isFinite(toIdx) && idx > toIdx) return;
    if (!isSalaryLike(r, includeBonus)) return;
    var amount = pickAmount(r);
    if (!(amount > 0)) return;
    var tax = parseMoneyNum(r.tax_reported);
    incomeTotal += amount;
    taxTotal += tax;
    var company = clean(r.company_name);
    var subtype = clean(r.income_subtype) || '正常工资薪金';
    txs.push({
      id: clean(r.id),
      year: y,
      month: m,
      date: paydayIso(y, m),
      amount: money2(amount),
      direction: 'in',
      type: 1,
      counterparty_name: company,
      summary: isBonusSubtype(subtype) ? '全年一次性奖金收入' : '工资薪金',
      income_type: clean(r.income_type) || '工资薪金',
      income_subtype: subtype,
      tax_reported: money2(tax),
      company_tax_id: clean(r.company_tax_id),
      tax_period: clean(r.tax_period) || y + '-' + pad2(m),
      tax_record_id: clean(r.id)
    });
  });
  txs.sort(function (a, b) {
    if (a.year !== b.year) return a.year - b.year;
    if (a.month !== b.month) return a.month - b.month;
    return String(a.id).localeCompare(String(b.id));
  });
  return {
    employer: dominantCompany(
      txs.map(function (t) {
        return { company_name: t.counterparty_name, income: t.amount };
      })
    ),
    income_total: money2(incomeTotal),
    tax_total: money2(taxTotal),
    count: txs.length,
    transactions: txs
  };
}

async function requirePartnerAuth(req, res) {
  var configured = clean(config.BANK_PARTNER_API_KEY);
  if (!configured) {
    res.status(503).json({ code: 503, msg: '未配置银行对接密钥' });
    return false;
  }
  var ip = getClientIp(req);
  var allow = parseAllowlist(config.BANK_PARTNER_IP_ALLOWLIST);
  if (!ipAllowed(ip, allow)) {
    res.status(403).json({ code: 403, msg: '来源 IP 未授权' });
    return false;
  }
  var rate = await consumeRateLimit(
    'bank_partner',
    ip || 'unknown',
    config.BANK_PARTNER_RATE_PER_IP_MIN,
    60000
  );
  if (!rate.ok) {
    res.status(429).json({ code: 429, msg: '请求过于频繁' });
    return false;
  }
  if (!timingSafeEqualStr(extractApiKey(req), configured)) {
    res.status(401).json({ code: 401, msg: '对接密钥无效' });
    return false;
  }
  return true;
}

async function loadUserByUsername(username) {
  var pool = getPool();
  var [rows] = await pool.execute(
    'SELECT username, real_name, tax_id, salt, hash, banned, user_type FROM users WHERE username = ? LIMIT 1',
    [username]
  );
  return rows && rows[0] ? rows[0] : null;
}

async function loadSalaryRecords(userId, year) {
  var pool = getPool();
  var listCols =
    'id, year, month, income_type, income_subtype, company_name, company_tax_id, tax_authority, ' +
    'report_date, tax_period, income, tax_reported, income_this_period';
  var sql =
    'SELECT ' +
    listCols +
    ' FROM tax_records WHERE user_id = ? AND ' +
    TAX_RECORD_NOT_DELETED_SQL;
  var params = [userId];
  if (year != null && year !== '') {
    var y = parseInt(year, 10);
    if (isFinite(y) && y > 1990 && y < 2200) {
      sql += ' AND year = ?';
      params.push(y);
    }
  }
  sql += ' ORDER BY year ASC, month ASC, id ASC';
  var [rows] = await pool.execute(sql, params);
  return rows || [];
}

async function handleBankPartnerHealth(req, res) {
  try {
    if (!(await requirePartnerAuth(req, res))) return;
    res.json({ code: 200, msg: 'ok', data: { status: 'ok', service: 'bank-salary-flow' } });
  } catch (e) {
    console.error('handleBankPartnerHealth', e);
    if (!res.headersSent) res.status(500).json({ code: 500, msg: '服务异常' });
  }
}

async function handleBankSalaryFlowPost(req, res) {
  try {
    if (!(await requirePartnerAuth(req, res))) return;
    var body = req.body || {};
    var username = clean(body.username || body.phone || body.account);
    var password = body.password != null ? String(body.password) : '';
    var userErr = validateUsername(username);
    if (userErr) {
      return res.status(400).json({ code: 400, msg: userErr });
    }
    if (!password) {
      return res.status(400).json({ code: 400, msg: '请输入密码' });
    }
    var user = await loadUserByUsername(username);
    if (!user || !verifyPasswordBySaltHash(password, user.salt, user.hash)) {
      return res.status(401).json({ code: 401, msg: '账号或密码错误' });
    }
    if (user.banned === 1 || user.banned === true) {
      return res.status(403).json({ code: 403, msg: '账号已被封禁' });
    }
    var ut = user.user_type != null ? Number(user.user_type) : 0;
    if (ut === USER_TYPE_GUEST) {
      return res.status(403).json({ code: 403, msg: '游客账号不支持导入' });
    }
    var year = body.year != null && body.year !== '' ? body.year : req.query.year;
    var records = await loadSalaryRecords(user.username, year);
    var mapped = mapRecordsToTransactions(records, {
      from_ym: body.from_ym || req.query.from_ym,
      to_ym: body.to_ym || req.query.to_ym,
      include_bonus: body.include_bonus === true || body.include_bonus === 1 || body.include_bonus === '1'
    });
    res.json({
      code: 200,
      msg: 'ok',
      data: {
        user: {
          user_id: user.username,
          username: user.username,
          real_name: clean(user.real_name) || user.username,
          tax_id: clean(user.tax_id)
        },
        employer: mapped.employer,
        income_total: mapped.income_total,
        tax_total: mapped.tax_total,
        count: mapped.count,
        transactions: mapped.transactions
      }
    });
  } catch (e) {
    console.error('handleBankSalaryFlowPost', e);
    if (!res.headersSent) res.status(500).json({ code: 500, msg: '服务异常' });
  }
}

function getHandlers() {
  return {
    handleBankPartnerHealth: handleBankPartnerHealth,
    handleBankSalaryFlowPost: handleBankSalaryFlowPost
  };
}

module.exports = {
  getHandlers,
  handleBankPartnerHealth,
  handleBankSalaryFlowPost,
  requirePartnerAuth,
  clean,
  mapRecordsToTransactions,
  isSalaryLike,
  paydayIso,
  ymToIndex,
  ipAllowed,
  isPrivateOrLocalIp,
  parseAllowlist,
  timingSafeEqualStr,
  extractApiKey,
  verifyPasswordBySaltHash,
  validateUsername
};
