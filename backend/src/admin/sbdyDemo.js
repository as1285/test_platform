/**
 * 社保参保证明 · 演示样例（非正式证明）
 * - 管理端生成 / 列表
 * - 公开核验与展示页（自有域名，不做政务仿冒核验）
 */
const crypto = require('crypto');
const { getPool } = require('../shared/db');

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function randDigits(n) {
  var out = '';
  while (out.length < n) {
    out += String(crypto.randomInt(0, 1e9)).padStart(9, '0');
  }
  return out.slice(0, n);
}

function randToken(n) {
  return crypto.randomBytes(Math.ceil(n / 2)).toString('hex').slice(0, n);
}

function parseYm(ym) {
  var m = String(ym || '').trim().match(/^(\d{4})[-/]?(\d{1,2})$/);
  if (!m) return null;
  var y = Number(m[1]);
  var mo = Number(m[2]);
  if (!y || mo < 1 || mo > 12) return null;
  return { y: y, m: mo };
}

function formatYmCn(y, m) {
  return y + '年' + String(m).padStart(2, '0') + '月';
}

function buildMonthRows(periodStart, periodEnd, baseAmt, pensionPay, unempPay, area, creditCode) {
  var a = parseYm(periodStart);
  var b = parseYm(periodEnd);
  if (!a || !b) return [];
  var rows = [];
  var y = a.y;
  var m = a.m;
  var guard = 0;
  while (guard < 48) {
    rows.push({
      year: y,
      month: String(m).padStart(2, '0'),
      unit_code: creditCode || '',
      area: area || '',
      base: Number(baseAmt) || 0,
      pension: Number(pensionPay) || 0,
      unemployment: Number(unempPay) || 0,
      status: '已到账'
    });
    if (y === b.y && m === b.m) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    guard += 1;
  }
  return rows;
}

function normalizePayload(body) {
  var b = body && typeof body === 'object' ? body : {};
  var name = String(b.name || '').trim().substring(0, 64);
  var idNumber = String(b.id_number || b.idNumber || '').trim().substring(0, 32);
  var gender = String(b.gender || '').trim().substring(0, 8) || '女';
  var company = String(b.company_name || b.company || '').trim().substring(0, 128);
  var credit = String(b.credit_code || b.creditCode || '').trim().substring(0, 32);
  var area = String(b.area || '余杭区').trim().substring(0, 32);
  var periodStart = String(b.period_start || b.periodStart || '').trim();
  var periodEnd = String(b.period_end || b.periodEnd || '').trim();
  var baseAmt = Number(b.base_amount != null ? b.base_amount : b.baseAmount);
  var pensionPay = Number(b.pension_pay != null ? b.pension_pay : b.pensionPay);
  var unempPay = Number(b.unemployment_pay != null ? b.unemployment_pay : b.unemploymentPay);
  if (!isFinite(baseAmt)) baseAmt = 4986;
  if (!isFinite(pensionPay)) pensionPay = Math.round(baseAmt * 0.08 * 100) / 100;
  if (!isFinite(unempPay)) unempPay = Math.round(baseAmt * 0.005 * 100) / 100;
  var printDate = String(b.print_date || b.printDate || '').trim();
  if (!printDate) {
    var now = new Date();
    var bj = new Date(now.getTime() + 8 * 3600 * 1000);
    printDate =
      bj.getUTCFullYear() +
      '年' +
      String(bj.getUTCMonth() + 1).padStart(2, '0') +
      '月' +
      String(bj.getUTCDate()).padStart(2, '0') +
      '日';
  }
  var statusPension = String(b.status_pension || '暂停缴费').trim().substring(0, 32);
  var statusInjury = String(b.status_injury || '暂停缴费').trim().substring(0, 32);
  var statusUnemp = String(b.status_unemployment || '暂停缴费').trim().substring(0, 32);
  if (!name || !idNumber) {
    return { error: '姓名与证件号码必填' };
  }
  if (!parseYm(periodStart) || !parseYm(periodEnd)) {
    return { error: '缴费起止月份格式应为 YYYY-MM' };
  }
  var a0 = parseYm(periodStart);
  var b0 = parseYm(periodEnd);
  if (a0.y > b0.y || (a0.y === b0.y && a0.m > b0.m)) {
    var tmp = periodStart;
    periodStart = periodEnd;
    periodEnd = tmp;
  }
  var months = buildMonthRows(periodStart, periodEnd, baseAmt, pensionPay, unempPay, area, credit);
  if (!months.length) {
    return { error: '缴费月份区间无效' };
  }
  return {
    name: name,
    id_number: idNumber,
    gender: gender,
    id_type: '居民身份证',
    company_name: company,
    credit_code: credit,
    area: area,
    period_start: periodStart,
    period_end: periodEnd,
    period_label:
      formatYmCn(parseYm(periodStart).y, parseYm(periodStart).m) +
      '-' +
      formatYmCn(parseYm(periodEnd).y, parseYm(periodEnd).m),
    base_amount: baseAmt,
    pension_pay: pensionPay,
    unemployment_pay: unempPay,
    print_date: printDate,
    status_pension: statusPension,
    status_injury: statusInjury,
    status_unemployment: statusUnemp,
    months: months
  };
}

function publicOriginFromReq(req) {
  var xfProto = req.headers && (req.headers['x-forwarded-proto'] || req.headers['x-forwarded-protocol']);
  var proto = String(xfProto || req.protocol || 'https').split(',')[0].trim() || 'https';
  var host =
    (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || 'geshui.vip';
  host = String(host).split(',')[0].trim();
  if (/localhost|127\.0\.0\.1|:\d+$/i.test(host) || /^\d+\.\d+\.\d+\.\d+/.test(host)) {
    return 'https://geshui.vip';
  }
  return proto + '://' + host;
}

function buildLinks(req, authCode, token) {
  var origin = publicOriginFromReq(req);
  return {
    verify_url: origin + '/sbdy_verify.html?code=' + encodeURIComponent(authCode),
    show_url: origin + '/taxmock/' + encodeURIComponent(token) + '/show',
    show_api_url: origin + '/api/public/sbdy-demo/show/' + encodeURIComponent(token)
  };
}

function renderCertHtml(payload, links, opts) {
  opts = opts || {};
  var p = payload || {};
  var months = Array.isArray(p.months) ? p.months : [];
  var rowsHtml = months
    .map(function (r) {
      return (
        '<tr>' +
        '<td>' +
        escHtml(r.year) +
        '</td><td>' +
        escHtml(r.month) +
        '</td><td>' +
        escHtml(r.unit_code) +
        '</td><td>' +
        escHtml(r.area) +
        '</td><td>' +
        escHtml(r.base) +
        '</td><td>' +
        escHtml(r.pension) +
        '</td><td>' +
        escHtml(r.status) +
        '</td><td>' +
        escHtml(r.area) +
        '</td><td>' +
        escHtml(r.base) +
        '</td><td>' +
        escHtml(r.unemployment) +
        '</td><td>' +
        escHtml(r.status) +
        '</td></tr>'
      );
    })
    .join('');
  var verifyUrl = (links && links.verify_url) || '';
  var qrImg = opts.qrDataUrl
    ? '<img class="qr" src="' + escHtml(opts.qrDataUrl) + '" alt="核验二维码">'
    : '<div class="qr-ph">扫码核验</div>';
  return (
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>社会保险参保证明（演示样例）</title>' +
    '<style>' +
    'body{margin:0;background:#f3f4f6;font-family:SimSun,"Songti SC",serif;color:#111}' +
    '.banner{background:#b45309;color:#fff;text-align:center;padding:8px 12px;font:14px/1.4 sans-serif}' +
    '.sheet{max-width:920px;margin:16px auto;background:#fff;padding:28px 32px 40px;position:relative;box-shadow:0 1px 8px rgba(0,0,0,.08)}' +
    '.wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:.08;font:700 64px/1 sans-serif;transform:rotate(-18deg);color:#b45309}' +
    'h1{text-align:center;font-size:22px;margin:8px 0 4px;font-weight:700}' +
    '.sub{text-align:center;font-size:13px;color:#444;margin-bottom:14px}' +
    '.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 18px;font-size:13px;margin-bottom:12px}' +
    '.sec{font-size:14px;font-weight:700;margin:14px 0 8px}' +
    'table{width:100%;border-collapse:collapse;font-size:11px}' +
    'th,td{border:1px solid #333;padding:4px 3px;text-align:center}' +
    'th{background:#f8fafc}' +
    '.notes{font-size:12px;line-height:1.7;margin-top:14px;color:#222}' +
    '.foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:18px;gap:16px}' +
    '.qr{width:96px;height:96px;border:1px solid #ddd;background:#fff}' +
    '.qr-ph{width:96px;height:96px;border:1px dashed #aaa;display:flex;align-items:center;justify-content:center;font:12px sans-serif;color:#888}' +
    '.stamp{font-size:13px;text-align:right}' +
    '@media print{body{background:#fff}.banner{display:none}.sheet{box-shadow:none;margin:0;max-width:none}}' +
    '</style></head><body>' +
    '<div class="banner">演示样例 · 非正式社保证明 · 仅供产品演示，不能用于任何正式用途</div>' +
    '<div class="sheet"><div class="wm">演示样例</div>' +
    '<h1>社会保险参保证明（个人专用）</h1>' +
    '<div class="sub">共1页，第1页 · 演示版</div>' +
    '<div class="meta">' +
    '<div>姓名：' +
    escHtml(p.name) +
    '</div><div>社会保障号：' +
    escHtml(p.id_number) +
    '</div>' +
    '<div>证件类型：' +
    escHtml(p.id_type || '居民身份证') +
    '</div><div>证件号码：' +
    escHtml(p.id_number) +
    '</div>' +
    '<div>性别：' +
    escHtml(p.gender) +
    '</div><div>参保单位：' +
    escHtml(p.company_name || '—') +
    (p.credit_code ? '（' + escHtml(p.credit_code) + '）' : '') +
    '</div></div>' +
    '<div class="sec">参加社会保险基本情况</div>' +
    '<table><thead><tr><th>险种</th><th>养老保险</th><th>工伤保险</th><th>失业保险</th></tr></thead>' +
    '<tbody><tr><td>参保状态</td><td>' +
    escHtml(p.status_pension) +
    '</td><td>' +
    escHtml(p.status_injury) +
    '</td><td>' +
    escHtml(p.status_unemployment) +
    '</td></tr></tbody></table>' +
    '<div class="sec">出具证明前缴费情况（' +
    escHtml(p.period_label || '') +
    '）</div>' +
    '<table><thead><tr>' +
    '<th>年</th><th>月</th><th>单位编号</th><th>参保地</th><th>养老基数</th><th>个人缴费</th><th>状况</th>' +
    '<th>参保地</th><th>失业基数</th><th>个人缴费</th><th>状况</th>' +
    '</tr></thead><tbody>' +
    rowsHtml +
    '</tbody></table>' +
    '<div class="notes">' +
    '备注：1. 本页为<strong>演示样例</strong>，非正式社会保险参保证明，不具备法律效力。<br>' +
    '2. 可在本站演示核验页扫码/输入授权码核验（非政务服务网）。授权码：' +
    escHtml(opts.authCode || '') +
    '。<br>' +
    '3. 核验地址：' +
    escHtml(verifyUrl) +
    '。<br>' +
    '4. 请勿将本样例用于贷款、入职、签证等任何正式场景。' +
    '</div>' +
    '<div class="foot"><div>' +
    qrImg +
    '<div style="font-size:11px;margin-top:4px;text-align:center;">演示核验</div></div>' +
    '<div class="stamp">（演示章）<br>打印时间：' +
    escHtml(p.print_date) +
    '</div></div>' +
    '</div></body></html>'
  );
}

async function handleAdminSbdyDemoGenerate(req, res) {
  try {
    var normalized = normalizePayload(req.body);
    if (normalized.error) {
      return res.status(400).json({ code: 400, msg: normalized.error });
    }
    var authCode = randDigits(20);
    var token = 'SBDY' + randToken(24);
    var pool = getPool();
    await pool.execute(
      `INSERT INTO sbdy_demo_certs (auth_code, token, payload_json, created_by_admin)
       VALUES (?, ?, ?, ?)`,
      [
        authCode,
        token,
        JSON.stringify(normalized),
        req.admin && req.admin.username ? String(req.admin.username) : null
      ]
    );
    var links = buildLinks(req, authCode, token);
    return res.json({
      code: 200,
      data: {
        auth_code: authCode,
        token: token,
        links: links,
        payload: normalized,
        demo_notice: '演示样例 · 非正式证明'
      }
    });
  } catch (e) {
    console.error('[sbdy-demo] generate', e);
    return res.status(500).json({ code: 500, msg: '生成失败' });
  }
}

async function handleAdminSbdyDemoList(req, res) {
  try {
    var limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const [rows] = await getPool().execute(
      `SELECT id, auth_code, token, payload_json, created_by_admin, created_at
       FROM sbdy_demo_certs ORDER BY id DESC LIMIT ${limit}`
    );
    var list = (rows || []).map(function (r) {
      var payload = null;
      try {
        payload = JSON.parse(r.payload_json);
      } catch (e) {}
      var links = buildLinks(req, r.auth_code, r.token);
      return {
        id: r.id,
        auth_code: r.auth_code,
        token: r.token,
        name: payload && payload.name ? payload.name : '',
        id_number: payload && payload.id_number ? payload.id_number : '',
        company_name: payload && payload.company_name ? payload.company_name : '',
        created_by_admin: r.created_by_admin,
        created_at: r.created_at,
        links: links
      };
    });
    return res.json({ code: 200, data: { list: list } });
  } catch (e) {
    console.error('[sbdy-demo] list', e);
    return res.status(500).json({ code: 500, msg: '加载失败' });
  }
}

async function loadCertByAuthOrToken(code, token) {
  if (token) {
    const [rows] = await getPool().execute(
      'SELECT auth_code, token, payload_json, created_at FROM sbdy_demo_certs WHERE token = ? LIMIT 1',
      [String(token)]
    );
    return rows && rows[0] ? rows[0] : null;
  }
  if (code) {
    const [rows] = await getPool().execute(
      'SELECT auth_code, token, payload_json, created_at FROM sbdy_demo_certs WHERE auth_code = ? LIMIT 1',
      [String(code)]
    );
    return rows && rows[0] ? rows[0] : null;
  }
  return null;
}

async function handlePublicSbdyDemoVerify(req, res) {
  try {
    var code = String(req.query.code || req.query.auth_code || '').trim();
    if (!code) {
      return res.status(400).json({ code: 400, msg: '缺少授权码' });
    }
    var row = await loadCertByAuthOrToken(code, '');
    if (!row) {
      return res.json({ code: 404, msg: '未找到该演示样例', data: { found: false } });
    }
    var payload = {};
    try {
      payload = JSON.parse(row.payload_json);
    } catch (e) {}
    var links = buildLinks(req, row.auth_code, row.token);
    return res.json({
      code: 200,
      data: {
        found: true,
        demo: true,
        notice: '演示样例核验通过（非正式社保证明）',
        auth_code: row.auth_code,
        name: payload.name || '',
        id_number_mask: payload.id_number
          ? String(payload.id_number).replace(/^(.{4}).+(.{4})$/, '$1****$2')
          : '',
        company_name: payload.company_name || '',
        period_label: payload.period_label || '',
        print_date: payload.print_date || '',
        created_at: row.created_at,
        show_url: links.show_url
      }
    });
  } catch (e) {
    console.error('[sbdy-demo] verify', e);
    return res.status(500).json({ code: 500, msg: '核验失败' });
  }
}

async function handlePublicSbdyDemoShow(req, res) {
  try {
    var token = String(req.params.token || '').trim();
    if (!token) {
      return res.status(400).send('missing token');
    }
    var row = await loadCertByAuthOrToken('', token);
    if (!row) {
      return res.status(404).send('not found');
    }
    var payload = {};
    try {
      payload = JSON.parse(row.payload_json);
    } catch (e) {}
    var links = buildLinks(req, row.auth_code, row.token);
    var html = renderCertHtml(payload, links, { authCode: row.auth_code });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    return res.status(200).send(html);
  } catch (e) {
    console.error('[sbdy-demo] show', e);
    return res.status(500).send('error');
  }
}

function getHandlers() {
  return {
    handleAdminSbdyDemoGenerate: handleAdminSbdyDemoGenerate,
    handleAdminSbdyDemoList: handleAdminSbdyDemoList,
    handlePublicSbdyDemoVerify: handlePublicSbdyDemoVerify,
    handlePublicSbdyDemoShow: handlePublicSbdyDemoShow
  };
}

module.exports = {
  getHandlers: getHandlers,
  renderCertHtml: renderCertHtml,
  normalizePayload: normalizePayload
};
