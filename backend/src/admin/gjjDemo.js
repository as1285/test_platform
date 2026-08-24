/**
 * 住房公积金个人年度对账单 · 演示样例（非正式对账单）
 * 版式对齐杭州住房公积金管理中心「一般住房公积金个人年度对账单（自助打印）」样张：
 * A4 竖版 + 六列明细表 + 二维码 + 电子章。
 * - 管理端生成 / 列表
 * - 公开核验与展示（/show、/show.pdf → application/pdf）
 */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { getPool } = require('../shared/db');
const { PUBLIC_SITE_URL } = require('../shared/config');

const GJJ_HZ_RENDER_SCRIPT = path.join(__dirname, '../../scripts/gjj_hz_render_pdf.py');

/** qrUrl：二维码扫码目标（应为 PDF 样例页 show_url） */
function renderGjjPdfBuffer(payload, authCode, qrUrl) {
  return new Promise(function (resolve, reject) {
    var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gjj-'));
    var inJson = path.join(tmpDir, 'in.json');
    var outPdf = path.join(tmpDir, 'out.pdf');
    var cleaned = false;
    function cleanup() {
      if (cleaned) return;
      cleaned = true;
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {}
    }
    try {
      fs.writeFileSync(
        inJson,
        JSON.stringify({
          payload: payload || {},
          auth_code: authCode || '',
          qr_url: qrUrl || '',
          verify_url: qrUrl || ''
        }),
        'utf8'
      );
    } catch (e) {
      cleanup();
      return reject(e);
    }
    var py = process.env.SBDY_PYTHON || process.env.GJJ_PYTHON || 'python3';
    var child = spawn(py, [GJJ_HZ_RENDER_SCRIPT, inJson, outPdf], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    var err = '';
    var settled = false;
    child.stderr.on('data', function (d) {
      err += String(d || '');
    });
    var timer = setTimeout(function () {
      try {
        child.kill('SIGKILL');
      } catch (e) {}
    }, 45000);
    child.on('error', function (e) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      reject(e);
    });
    child.on('close', function (code) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        if (code !== 0 || !fs.existsSync(outPdf)) {
          throw new Error((err || 'pdf render failed').trim() + ' (code=' + code + ')');
        }
        resolve(fs.readFileSync(outPdf));
      } catch (e) {
        reject(e);
      } finally {
        cleanup();
      }
    });
  });
}

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

function pad2(n) {
  return String(n).padStart(2, '0');
}

function digitsFrom(s, n) {
  var d = String(s || '').replace(/\D/g, '');
  if (d.length >= n) return d.slice(-n);
  return (d + randDigits(n)).slice(0, n);
}

function round2(n) {
  var x = Number(n);
  if (!isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function formatMoney(n) {
  var x = Number(n);
  if (!isFinite(x)) return '';
  return x.toFixed(2);
}

function parseYm(ym) {
  var m = String(ym || '').trim().match(/^(\d{4})[-/]?(\d{1,2})$/);
  if (!m) return null;
  var y = Number(m[1]);
  var mo = Number(m[2]);
  if (!y || mo < 1 || mo > 12) return null;
  return { y: y, m: mo };
}

function bjNowParts() {
  var now = new Date();
  var bj = new Date(now.getTime() + 8 * 3600 * 1000);
  return { y: bj.getUTCFullYear(), m: bj.getUTCMonth() + 1, d: bj.getUTCDate() };
}

function bjYmd8() {
  var p = bjNowParts();
  return String(p.y) + pad2(p.m) + pad2(p.d);
}

/** 归一化 YYYYMMDD（接受 2026-08-24 / 2026/08/24 / 20260824） */
function normYmd8(raw, fallback) {
  var s = String(raw || '').replace(/\D/g, '');
  if (s.length === 8) return s;
  return fallback || '';
}

function minusOneYear(ymd8) {
  var m = String(ymd8 || '').match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return '';
  return String(Number(m[1]) - 1) + m[2] + m[3];
}

/** 构建明细行：期初 → 逐月汇缴 → 可选跨机构转移；服务端统一重算余额 */
function buildRows(opts) {
  opts = opts || {};
  var opening = round2(opts.opening_balance);
  var monthly = round2(opts.monthly_deposit);
  var depositDay = pad2(Math.max(1, Math.min(28, Number(opts.deposit_day) || 23)));
  var rows = [];
  var seq = 1;
  var bal = opening;
  rows.push({
    seq: seq++,
    date: '',
    summary: '期初',
    increase: null,
    decrease: null,
    balance: bal
  });
  var a = parseYm(opts.period_start);
  var b = parseYm(opts.period_end);
  if (a && b) {
    var y = a.y;
    var m = a.m;
    var guard = 0;
    while (guard < 60) {
      bal = round2(bal + monthly);
      rows.push({
        seq: seq++,
        date: String(y) + pad2(m) + depositDay,
        summary: '汇缴' + String(y) + pad2(m),
        increase: monthly,
        decrease: null,
        balance: bal
      });
      if (y === b.y && m === b.m) break;
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      guard += 1;
    }
  }
  var transfer = round2(opts.transfer_amount);
  if (transfer > 0) {
    bal = round2(bal + transfer);
    rows.push({
      seq: seq++,
      date: normYmd8(opts.transfer_date, opts.statement_end || bjYmd8()),
      summary: String(opts.transfer_summary || '跨机构个人账户余额转移').substring(0, 40),
      increase: transfer,
      decrease: null,
      balance: bal
    });
  }
  return rows;
}

/** 归一化外部传入的明细行（手工/粘贴），服务端重算余额 */
function normalizeRows(rawRows, opening) {
  var out = [];
  var bal = round2(opening);
  var seq = 1;
  (Array.isArray(rawRows) ? rawRows : []).forEach(function (r) {
    if (!r || typeof r !== 'object') return;
    var summary = String(r.summary || '').trim().substring(0, 40);
    var isOpening = /^期初/.test(summary) || (out.length === 0 && !summary);
    var inc = Number(r.increase);
    var dec = Number(r.decrease);
    inc = isFinite(inc) && inc > 0 ? round2(inc) : null;
    dec = isFinite(dec) && dec > 0 ? round2(dec) : null;
    if (isOpening) {
      out.push({
        seq: seq++,
        date: normYmd8(r.date, ''),
        summary: summary || '期初',
        increase: null,
        decrease: null,
        balance: bal
      });
      return;
    }
    bal = round2(bal + (inc || 0) - (dec || 0));
    out.push({
      seq: seq++,
      date: normYmd8(r.date, ''),
      summary: summary,
      increase: inc,
      decrease: dec,
      balance: bal
    });
  });
  return out;
}

function normalizePayload(body) {
  var b = body && typeof body === 'object' ? body : {};
  var name = String(b.name || '').trim().substring(0, 64);
  var idNumber = String(b.id_number || b.idNumber || '').trim().substring(0, 32);
  if (!name || !idNumber) {
    return { error: '姓名与证件号码必填' };
  }
  var customerNo = String(b.customer_no || b.customerNo || '').replace(/\D/g, '');
  if (!customerNo || customerNo.length < 10) {
    customerNo = ('3301' + digitsFrom(idNumber, 11)).slice(0, 15);
  }
  customerNo = customerNo.substring(0, 20);
  var fundAccount = String(b.fund_account || b.fundAccount || '').replace(/\D/g, '');
  if (!fundAccount || fundAccount.length < 10) {
    fundAccount = ('1011' + digitsFrom(customerNo || idNumber, 12)).slice(0, 16);
  }
  fundAccount = fundAccount.substring(0, 24);
  var depositUnit = String(b.deposit_unit || b.depositUnit || b.company_name || '')
    .trim()
    .substring(0, 128);
  var depositStatus = String(b.deposit_status || b.depositStatus || '正常')
    .trim()
    .substring(0, 16) || '正常';
  var monthlyDeposit = Number(b.monthly_deposit != null ? b.monthly_deposit : b.monthlyDeposit);
  if (!isFinite(monthlyDeposit) || monthlyDeposit < 0) monthlyDeposit = 638;
  var openingBalance = Number(b.opening_balance != null ? b.opening_balance : b.openingBalance);
  if (!isFinite(openingBalance) || openingBalance < 0) openingBalance = 0;
  var depositDay = Number(b.deposit_day != null ? b.deposit_day : b.depositDay) || 23;

  var printDate = normYmd8(b.print_date || b.printDate, bjYmd8());
  var statementEnd = normYmd8(b.statement_end || b.statementEnd, printDate);
  var statementStart = normYmd8(b.statement_start || b.statementStart, minusOneYear(statementEnd));

  var periodStart = String(b.period_start || b.periodStart || '').trim();
  var periodEnd = String(b.period_end || b.periodEnd || '').trim();
  var pa = parseYm(periodStart);
  var pb = parseYm(periodEnd);
  if (pa && pb && (pa.y > pb.y || (pa.y === pb.y && pa.m > pb.m))) {
    var tmp = periodStart;
    periodStart = periodEnd;
    periodEnd = tmp;
  }

  var transferAmount = Number(b.transfer_amount != null ? b.transfer_amount : b.transferAmount);
  if (!isFinite(transferAmount) || transferAmount < 0) transferAmount = 0;

  var rows;
  if (Array.isArray(b.rows) && b.rows.length) {
    rows = normalizeRows(b.rows, openingBalance);
  } else {
    rows = buildRows({
      opening_balance: openingBalance,
      monthly_deposit: monthlyDeposit,
      deposit_day: depositDay,
      period_start: periodStart,
      period_end: periodEnd,
      transfer_amount: transferAmount,
      transfer_date: normYmd8(b.transfer_date || b.transferDate, statementEnd),
      transfer_summary: b.transfer_summary || b.transferSummary,
      statement_end: statementEnd
    });
  }
  if (!rows.length) {
    return { error: '至少需要一条明细（请填写汇缴月份或明细行）' };
  }
  var lastBalance = rows.length ? Number(rows[rows.length - 1].balance) : 0;

  return {
    region: 'hz',
    layout: 'hz_official_v1',
    name: name,
    id_number: idNumber,
    customer_no: customerNo,
    fund_account: fundAccount,
    deposit_unit: depositUnit,
    deposit_status: depositStatus,
    monthly_deposit: monthlyDeposit,
    opening_balance: openingBalance,
    period_start: periodStart,
    period_end: periodEnd,
    statement_start: statementStart,
    statement_end: statementEnd,
    print_date: printDate,
    page_no: '1',
    page_total: '1',
    balance: round2(lastBalance),
    rows: rows
  };
}

function publicOriginFromReq(req) {
  var configured = String(PUBLIC_SITE_URL || '').replace(/\/+$/, '');
  var xfProto = req.headers && (req.headers['x-forwarded-proto'] || req.headers['x-forwarded-protocol']);
  var proto = String(xfProto || req.protocol || 'https').split(',')[0].trim() || 'https';
  var host = (req.headers && (req.headers['x-forwarded-host'] || req.headers.host)) || '';
  host = String(host).split(',')[0].trim();
  if (/localhost|127\.0\.0\.1|:\d+$/i.test(host) || /^\d+\.\d+\.\d+\.\d+/.test(host)) {
    return configured || proto + '://' + host;
  }
  if (host) {
    return proto + '://' + host;
  }
  return configured || 'http://127.0.0.1';
}

function buildLinks(req, authCode, token) {
  var origin = publicOriginFromReq(req);
  return {
    verify_url: origin + '/gjj_verify.html?code=' + encodeURIComponent(authCode),
    show_url: origin + '/gjjmock/' + encodeURIComponent(token) + '/show.pdf',
    show_api_url: origin + '/api/public/gjj-demo/show/' + encodeURIComponent(token)
  };
}

function fmtYmd8Cn(ymd8) {
  var m = String(ymd8 || '').match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!m) return String(ymd8 || '');
  return m[1] + '-' + m[2] + '-' + m[3];
}

function renderCertHtml(payload, links, opts) {
  opts = opts || {};
  var p = payload || {};
  var rows = Array.isArray(p.rows) ? p.rows : [];
  var qrUrl = (links && links.show_url) || (links && links.show_api_url) || '';
  var rowsHtml = '';
  rows.forEach(function (r) {
    rowsHtml +=
      '<tr>' +
      '<td>' + escHtml(r.seq) + '</td>' +
      '<td>' + escHtml(r.date || '') + '</td>' +
      '<td class="summary">' + escHtml(r.summary || '') + '</td>' +
      '<td class="num">' + escHtml(formatMoney(r.increase)) + '</td>' +
      '<td class="num">' + escHtml(formatMoney(r.decrease)) + '</td>' +
      '<td class="num">' + escHtml(formatMoney(r.balance)) + '</td>' +
      '</tr>';
  });
  return (
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,nofollow">' +
    '<title>杭州住房公积金个人年度对账单（自助打印）</title>' +
    '<style>' +
    '*{box-sizing:border-box}' +
    'html,body{margin:0;padding:0;background:#fff}' +
    'body{font-family:SimSun,"宋体","Songti SC","Noto Serif CJK SC",serif;color:#000;' +
    '-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.page{width:210mm;max-width:100%;min-height:297mm;margin:0 auto;background:#fff;' +
    'padding:12mm 14mm;position:relative}' +
    '.qr{position:absolute;left:16mm;top:9mm;width:74px;text-align:center}' +
    '.qr canvas,.qr img{width:70px;height:70px;display:block}' +
    '.seal{position:absolute;right:14mm;top:11mm;width:132px;height:132px;z-index:3;pointer-events:none;opacity:.94}' +
    'h1{margin:20mm 0 0;text-align:center;font-size:17px;font-weight:700;line-height:1.4}' +
    '.sub{text-align:center;font-size:12px;margin:4px 0 0}' +
    '.info{margin:16px 2mm 0;font-size:12.5px;line-height:2.0;position:relative;z-index:1}' +
    '.info .col{display:inline-block;vertical-align:top}' +
    '.info .col-l{width:48%}' +
    '.info .col-r{width:50%}' +
    '.info .row-line{display:block}' +
    'table.grid{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:12px;font-size:12.5px}' +
    'table.grid th,table.grid td{border:1px solid #000;padding:5px 4px;text-align:center;vertical-align:middle}' +
    'table.grid th{font-weight:700}' +
    'table.grid col.c-seq{width:9%}table.grid col.c-date{width:19%}table.grid col.c-sum{width:34%}' +
    'table.grid col.c-in{width:12%}table.grid col.c-de{width:12%}table.grid col.c-bal{width:14%}' +
    '.foot{margin:16px 2mm 0;font-size:12.5px;line-height:2.0}' +
    '.foot .col-l{display:inline-block;width:48%;vertical-align:top}' +
    '.foot .col-r{display:inline-block;width:50%;vertical-align:top}' +
    '.demo-tag{position:absolute;left:0;bottom:6mm;width:100%;text-align:center;color:#b91c1c;font-size:11px}' +
    '@media (max-width:720px){.page{padding:8px;min-height:0}h1{margin-top:64px;font-size:14px}' +
    '.seal{width:104px;height:104px;right:6px;top:40px}.qr{left:6px;top:6px}}' +
    '</style></head><body><div class="page">' +
    '<div class="qr"><div id="qrPh"></div><canvas id="qrCanvas" width="70" height="70" style="display:none"></canvas></div>' +
    '<img class="seal" src="/img/gjj_hz_seal.png" alt="">' +
    '<h1>杭州住房公积金管理中心一般住房公积金个人年度对账单(自助打印)</h1>' +
    '<div class="sub">对账日期：' +
    escHtml(p.statement_start || '') +
    '-' +
    escHtml(p.statement_end || '') +
    '</div>' +
    '<div class="info">' +
    '<span class="col col-l">' +
    '<span class="row-line">姓名：' + escHtml(p.name || '') + '</span>' +
    '<span class="row-line">个人客户号：' + escHtml(p.customer_no || '') + '</span>' +
    '</span>' +
    '<span class="col col-r">' +
    '<span class="row-line">身份证号码：' + escHtml(p.id_number || '') + '</span>' +
    '<span class="row-line">资金账号：' + escHtml(p.fund_account || '') + '</span>' +
    '<span class="row-line">第' + escHtml(p.page_no || '1') + '页/共' + escHtml(p.page_total || '1') + '页　单位：元</span>' +
    '</span>' +
    '</div>' +
    '<table class="grid"><colgroup>' +
    '<col class="c-seq"><col class="c-date"><col class="c-sum"><col class="c-in"><col class="c-de"><col class="c-bal">' +
    '</colgroup><thead><tr>' +
    '<th>序号</th><th>记账日期</th><th>摘要</th><th>增加</th><th>减少</th><th>余额</th>' +
    '</tr></thead><tbody>' +
    rowsHtml +
    '</tbody></table>' +
    '<div class="foot">' +
    '<span class="col-l">' +
    '<span class="row-line">当前缴存状态：' + escHtml(p.deposit_status || '正常') + '</span><br>' +
    '<span class="row-line">当前缴存单位：' + escHtml(p.deposit_unit || '') + '</span>' +
    '</span>' +
    '<span class="col-r">' +
    '<span class="row-line">打印日期：' + escHtml(p.print_date || '') + '</span><br>' +
    '<span class="row-line">当前月缴存额：' + escHtml(formatMoney(p.monthly_deposit)) + '</span>' +
    '</span>' +
    '</div>' +
    '<div class="demo-tag">演示样例 · 非正式对账单</div>' +
    '<script src="/js/vendor/qrcode.min.js"><\/script>' +
    '<script>(function(){var u=' +
    JSON.stringify(qrUrl) +
    ';var c=document.getElementById("qrCanvas");var ph=document.getElementById("qrPh");' +
    'if(!u||typeof QRCode==="undefined"||!QRCode.toCanvas||!c){return;}' +
    'QRCode.toCanvas(c,u,{width:70,margin:1},function(err){if(!err){c.style.display="block";if(ph)ph.style.display="none";}});})();<\/script>' +
    '</div></body></html>'
  );
}

async function handleAdminGjjDemoGenerate(req, res) {
  try {
    var normalized = normalizePayload(req.body);
    if (normalized.error) {
      return res.status(400).json({ code: 400, msg: normalized.error });
    }
    var authCode = randDigits(20);
    var token = 'GJJ' + randToken(24);
    var pool = getPool();
    await pool.execute(
      `INSERT INTO gjj_demo_certs (auth_code, token, payload_json, created_by_admin)
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
        demo_notice: '演示样例 · 非正式对账单'
      }
    });
  } catch (e) {
    console.error('[gjj-demo] generate', e);
    return res.status(500).json({ code: 500, msg: '生成失败' });
  }
}

async function handleAdminGjjDemoList(req, res) {
  try {
    var limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const [rows] = await getPool().execute(
      `SELECT id, auth_code, token, payload_json, created_by_admin, created_at
       FROM gjj_demo_certs ORDER BY id DESC LIMIT ${limit}`
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
        deposit_unit: payload && payload.deposit_unit ? payload.deposit_unit : '',
        balance: payload && payload.balance != null ? payload.balance : '',
        created_by_admin: r.created_by_admin,
        created_at: r.created_at,
        links: links
      };
    });
    return res.json({ code: 200, data: { list: list } });
  } catch (e) {
    console.error('[gjj-demo] list', e);
    return res.status(500).json({ code: 500, msg: '加载失败' });
  }
}

async function loadCertByAuthOrToken(code, token) {
  if (token) {
    const [rows] = await getPool().execute(
      'SELECT auth_code, token, payload_json, created_at FROM gjj_demo_certs WHERE token = ? LIMIT 1',
      [String(token)]
    );
    return rows && rows[0] ? rows[0] : null;
  }
  if (code) {
    const [rows] = await getPool().execute(
      'SELECT auth_code, token, payload_json, created_at FROM gjj_demo_certs WHERE auth_code = ? LIMIT 1',
      [String(code)]
    );
    if (rows && rows[0]) return rows[0];
    var compact = String(code).replace(/\s+/g, '');
    if (compact && compact !== String(code)) {
      const [rows2] = await getPool().execute(
        "SELECT auth_code, token, payload_json, created_at FROM gjj_demo_certs WHERE REPLACE(auth_code, ' ', '') = ? LIMIT 1",
        [compact]
      );
      return rows2 && rows2[0] ? rows2[0] : null;
    }
    return null;
  }
  return null;
}

async function handlePublicGjjDemoVerify(req, res) {
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
        notice: '演示样例核验通过（非正式住房公积金对账单）',
        auth_code: row.auth_code,
        name: payload.name || '',
        id_number_mask: payload.id_number
          ? String(payload.id_number).replace(/^(.{4}).+(.{4})$/, '$1****$2')
          : '',
        deposit_unit: payload.deposit_unit || '',
        statement_label:
          (payload.statement_start || '') + '-' + (payload.statement_end || ''),
        balance: payload.balance != null ? Number(payload.balance).toFixed(2) : '',
        print_date: payload.print_date || '',
        created_at: row.created_at,
        show_url: links.show_url
      }
    });
  } catch (e) {
    console.error('[gjj-demo] verify', e);
    return res.status(500).json({ code: 500, msg: '核验失败' });
  }
}

async function handlePublicGjjDemoShow(req, res) {
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
    var wantHtml =
      String(req.query.format || '').toLowerCase() === 'html' ||
      String(req.query.view || '').toLowerCase() === 'html';
    if (wantHtml) {
      var html = renderCertHtml(payload, links, { authCode: row.auth_code });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      return res.status(200).send(html);
    }
    var pdfBuf = await renderGjjPdfBuffer(payload, row.auth_code, links.show_url);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="show.pdf"');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Content-Length', String(pdfBuf.length));
    return res.status(200).end(pdfBuf);
  } catch (e) {
    console.error('[gjj-demo] show', e);
    return res.status(500).send('error');
  }
}

function getHandlers() {
  return {
    handleAdminGjjDemoGenerate: handleAdminGjjDemoGenerate,
    handleAdminGjjDemoList: handleAdminGjjDemoList,
    handlePublicGjjDemoVerify: handlePublicGjjDemoVerify,
    handlePublicGjjDemoShow: handlePublicGjjDemoShow
  };
}

module.exports = {
  getHandlers: getHandlers,
  renderCertHtml: renderCertHtml,
  normalizePayload: normalizePayload
};
