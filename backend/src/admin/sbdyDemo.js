/**
 * 社保参保证明 · 演示样例（非正式证明）
 * 版式对齐「浙江省社会保险参保证明（个人专用）」常见排版。
 * - 管理端生成 / 列表
 * - 公开核验与展示页（自有域名核验，非正式政务核验）
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

function formatMoney(n) {
  var x = Number(n);
  if (!isFinite(x)) return '0.00';
  return x.toFixed(2);
}

function bjNowParts() {
  var now = new Date();
  var bj = new Date(now.getTime() + 8 * 3600 * 1000);
  return {
    y: bj.getUTCFullYear(),
    m: bj.getUTCMonth() + 1,
    d: bj.getUTCDate()
  };
}

function defaultPrintDateCn() {
  var p = bjNowParts();
  return p.y + '年' + String(p.m).padStart(2, '0') + '月' + String(p.d).padStart(2, '0') + '日';
}

function defaultQueryDate() {
  var p = bjNowParts();
  return p.y + '-' + String(p.m).padStart(2, '0') + '-' + String(p.d).padStart(2, '0');
}

function buildMonthRows(periodStart, periodEnd, company, baseAmt, unitPay, personPay) {
  var a = parseYm(periodStart);
  var b = parseYm(periodEnd);
  if (!a || !b) return [];
  var rows = [];
  var y = a.y;
  var m = a.m;
  var guard = 0;
  var unitName = company || '';
  while (guard < 48) {
    rows.push({
      year: y,
      month: String(m).padStart(2, '0'),
      unit_name: unitName,
      unit_base: Number(baseAmt) || 0,
      unit_amount: Number(unitPay) || 0,
      person_base: Number(baseAmt) || 0,
      person_amount: Number(personPay) || 0,
      status: '已缴费'
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
  var unitPay = Number(b.unit_pay != null ? b.unit_pay : b.unitPay);
  if (!isFinite(baseAmt)) baseAmt = 4986;
  if (!isFinite(pensionPay)) pensionPay = Math.round(baseAmt * 0.08 * 100) / 100;
  if (!isFinite(unempPay)) unempPay = Math.round(baseAmt * 0.005 * 100) / 100;
  if (!isFinite(unitPay)) unitPay = Math.round(baseAmt * 0.16 * 100) / 100;
  var personPay = Math.round((pensionPay + unempPay) * 100) / 100;
  var printDate = String(b.print_date || b.printDate || '').trim() || defaultPrintDateCn();
  var queryDate = String(b.query_date || b.queryDate || '').trim() || defaultQueryDate();
  var personId = String(b.person_id || b.personId || '').trim().substring(0, 32) || randDigits(10);
  var statusPension = String(b.status_pension || '正常参保').trim().substring(0, 32);
  var statusMedical = String(
    b.status_medical || b.status_injury || '正常参保'
  ).trim().substring(0, 32);
  var statusUnemp = String(b.status_unemployment || '正常参保').trim().substring(0, 32);
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
  var displayUnit = company;
  if (credit) {
    displayUnit = company ? company + '（' + credit + '）' : credit;
  }
  var months = buildMonthRows(periodStart, periodEnd, displayUnit || company, baseAmt, unitPay, personPay);
  if (!months.length) {
    return { error: '缴费月份区间无效' };
  }
  return {
    name: name,
    id_number: idNumber,
    gender: gender,
    id_type: '居民身份证',
    person_id: personId,
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
    unit_pay: unitPay,
    person_pay: personPay,
    print_date: printDate,
    query_date: queryDate,
    status_pension: statusPension,
    status_medical: statusMedical,
    status_injury: statusMedical,
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

function padMonthRowsHtml(months, minRows) {
  var list = Array.isArray(months) ? months.slice() : [];
  var target = Math.max(minRows || 18, list.length);
  var html = '';
  var i;
  for (i = 0; i < target; i++) {
    var r = list[i];
    if (r) {
      html +=
        '<tr>' +
        '<td>' +
        escHtml(r.year) +
        '</td>' +
        '<td>' +
        escHtml(r.month) +
        '</td>' +
        '<td class="unit">' +
        escHtml(r.unit_name || '') +
        '</td>' +
        '<td>' +
        escHtml(formatMoney(r.unit_base)) +
        '</td>' +
        '<td>' +
        escHtml(formatMoney(r.unit_amount)) +
        '</td>' +
        '<td>' +
        escHtml(formatMoney(r.person_base)) +
        '</td>' +
        '<td>' +
        escHtml(formatMoney(r.person_amount)) +
        '</td>' +
        '<td>' +
        escHtml(r.status || '已缴费') +
        '</td>' +
        '</tr>';
    } else {
      html +=
        '<tr class="empty">' +
        '<td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>' +
        '</tr>';
    }
  }
  return html;
}

function renderRedSealSvg() {
  return (
    '<svg class="seal" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<circle cx="100" cy="100" r="92" fill="none" stroke="#c41e3a" stroke-width="4"/>' +
    '<circle cx="100" cy="100" r="84" fill="none" stroke="#c41e3a" stroke-width="1.5"/>' +
    '<polygon points="100,58 108,82 134,82 113,98 121,122 100,108 79,122 87,98 66,82 92,82" fill="#c41e3a"/>' +
    '<defs>' +
    '<path id="sealArc" d="M100,100 m-68,0 a68,68 0 1,1 136,0 a68,68 0 1,1 -136,0"/>' +
    '</defs>' +
    '<text fill="#c41e3a" font-size="15" font-family="SimSun,Songti SC,serif" letter-spacing="2">' +
    '<textPath href="#sealArc" startOffset="0%">浙江省社会保险事业管理中心电子印章</textPath>' +
    '</text>' +
    '<text x="100" y="152" text-anchor="middle" fill="#c41e3a" font-size="13" font-family="SimSun,Songti SC,serif">专用章</text>' +
    '</svg>'
  );
}

function renderCertHtml(payload, links, opts) {
  opts = opts || {};
  var p = payload || {};
  var months = Array.isArray(p.months) ? p.months : [];
  var verifyUrl = (links && links.verify_url) || '';
  var queryDate = p.query_date || defaultQueryDate();
  var rowsHtml = padMonthRowsHtml(months, 18);
  var authCode = opts.authCode || '';

  return (
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>浙江省社会保险参保证明（个人专用）</title>' +
    '<style>' +
    '*{box-sizing:border-box}' +
    'body{margin:0;background:#e8e8e8;font-family:SimSun,"Songti SC","Noto Serif SC",serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.banner{background:#b45309;color:#fff;text-align:center;padding:7px 10px;font:13px/1.4 system-ui,sans-serif}' +
    '.page{max-width:794px;margin:12px auto;background:#fff;padding:22px 26px 18px;position:relative;box-shadow:0 1px 10px rgba(0,0,0,.12)}' +
    '.head{position:relative;min-height:118px;padding-right:128px;margin-bottom:8px}' +
    'h1{text-align:center;font-size:22px;font-weight:700;margin:18px 0 0;letter-spacing:1px;line-height:1.35}' +
    '.qr-box{position:absolute;top:0;right:0;width:112px;text-align:center}' +
    '.qr-box canvas,.qr-box img{width:104px;height:104px;display:block;margin:0 auto;border:1px solid #222}' +
    '.qr-ph{width:104px;height:104px;border:1px solid #222;margin:0 auto;display:flex;align-items:center;justify-content:center;font:12px/1.3 sans-serif;color:#666}' +
    '.query-date{margin-top:6px;font-size:12px;text-align:center;white-space:nowrap}' +
    'table.info{width:100%;border-collapse:collapse;font-size:13px;margin-top:6px}' +
    'table.info th,table.info td{border:1px solid #111;padding:6px 8px;text-align:left;font-weight:400}' +
    'table.info th{width:18%;background:#fff;text-align:center;white-space:nowrap}' +
    'table.info td{width:32%}' +
    'table.status{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}' +
    'table.status th,table.status td{border:1px solid #111;padding:6px 4px;text-align:center;font-weight:400}' +
    'table.detail{width:100%;border-collapse:collapse;font-size:11px;margin-top:10px;table-layout:fixed}' +
    'table.detail th,table.detail td{border:1px solid #111;padding:3px 2px;text-align:center;font-weight:400;word-break:break-all}' +
    'table.detail th{font-size:11px;line-height:1.25}' +
    'table.detail td.unit{font-size:10px;text-align:left;padding-left:4px}' +
    'table.detail tr.empty td{height:18px}' +
    '.col-y{width:7%}.col-m{width:6%}.col-u{width:28%}.col-n{width:11%}.col-s{width:9%}' +
    '.notes{margin-top:12px;font-size:11px;line-height:1.65;color:#111;padding-right:150px;min-height:120px}' +
    '.notes b{font-weight:700}' +
    '.seal-wrap{position:absolute;right:28px;bottom:52px;width:148px;height:148px;opacity:.92;pointer-events:none}' +
    '.seal{width:148px;height:148px;display:block}' +
    '.print-date{text-align:center;font-size:12px;margin-top:8px}' +
    '@media print{body{background:#fff}.banner{display:none}.page{box-shadow:none;margin:0;max-width:none}}' +
    '@media (max-width:640px){.page{margin:0;padding:12px 8px 16px}.head{padding-right:0;min-height:0}' +
    '.qr-box{position:static;margin:0 auto 8px;width:112px}h1{font-size:18px;margin-top:4px}' +
    '.notes{padding-right:0}.seal-wrap{position:relative;right:auto;bottom:auto;margin:8px auto 0}}' +
    '</style></head><body>' +
    '<div class="banner">演示样例 · 非正式社保证明 · 仅供产品演示，不能用于任何正式用途</div>' +
    '<div class="page">' +
    '<div class="head">' +
    '<div class="qr-box">' +
    '<div class="qr-ph" id="qrPh">二维码</div>' +
    '<canvas id="qrCanvas" width="104" height="104" style="display:none"></canvas>' +
    '<div class="query-date">查询日期<br>' +
    escHtml(queryDate) +
    '</div></div>' +
    '<h1>浙江省社会保险参保证明<br>（个人专用）</h1>' +
    '</div>' +
    '<table class="info">' +
    '<tr><th>姓名</th><td>' +
    escHtml(p.name) +
    '</td><th>社会保障号码</th><td>' +
    escHtml(p.id_number) +
    '</td></tr>' +
    '<tr><th>人员ID</th><td>' +
    escHtml(p.person_id || '') +
    '</td><th>证件号码</th><td>' +
    escHtml(p.id_number) +
    '</td></tr>' +
    '<tr><th>性别</th><td>' +
    escHtml(p.gender || '') +
    '</td><th>证件类型</th><td>' +
    escHtml(p.id_type || '居民身份证') +
    '</td></tr>' +
    '</table>' +
    '<table class="status">' +
    '<tr><th>险种</th><th>养老保险</th><th>医疗保险</th><th>失业保险</th></tr>' +
    '<tr><th>参保状态</th><td>' +
    escHtml(p.status_pension || '') +
    '</td><td>' +
    escHtml(p.status_medical || p.status_injury || '') +
    '</td><td>' +
    escHtml(p.status_unemployment || '') +
    '</td></tr>' +
    '</table>' +
    '<table class="detail">' +
    '<colgroup>' +
    '<col class="col-y"><col class="col-m"><col class="col-u">' +
    '<col class="col-n"><col class="col-n"><col class="col-n"><col class="col-n"><col class="col-s">' +
    '</colgroup>' +
    '<thead>' +
    '<tr>' +
    '<th rowspan="2">年</th><th rowspan="2">月</th><th rowspan="2">单位名称</th>' +
    '<th colspan="2">单位缴纳</th><th colspan="2">个人缴纳</th>' +
    '<th rowspan="2">状态</th>' +
    '</tr>' +
    '<tr><th>缴费基数</th><th>金额</th><th>缴费基数</th><th>金额</th></tr>' +
    '</thead><tbody>' +
    rowsHtml +
    '</tbody></table>' +
    '<div class="notes">' +
    '<b>备注：</b><br>' +
    '1. 本证明内容以社会保险经办信息系统记录为准；本页为<strong>演示样例</strong>，非正式证明，不具备法律效力。<br>' +
    '2. 可通过页面右上角二维码或授权码在本站演示核验页核验（非浙江政务服务网）。授权码：' +
    escHtml(authCode) +
    '。<br>' +
    '3. 核验地址：' +
    escHtml(verifyUrl) +
    '。<br>' +
    '4. 请勿将本样例用于贷款、入职、签证等任何正式场景。' +
    '</div>' +
    '<div class="seal-wrap">' +
    renderRedSealSvg() +
    '</div>' +
    '<div class="print-date">打印日期：' +
    escHtml(p.print_date || defaultPrintDateCn()) +
    '</div>' +
    '</div>' +
    '<script src="/js/vendor/qrcode.min.js"><\/script>' +
    '<script>(function(){var u=' +
    JSON.stringify(verifyUrl) +
    ';var c=document.getElementById("qrCanvas");var ph=document.getElementById("qrPh");' +
    'if(!u||typeof QRCode==="undefined"||!QRCode.toCanvas||!c){return;}' +
    'QRCode.toCanvas(c,u,{width:104,margin:1,color:{dark:"#000000",light:"#ffffff"}},function(err){' +
    'if(err){return;}c.style.display="block";if(ph)ph.style.display="none";});})();<\/script>' +
    '</body></html>'
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
    /* 旧样例字段兼容：补全新版明细列 */
    if (payload && Array.isArray(payload.months) && payload.months.length) {
      var companyDisp = payload.company_name || '';
      if (payload.credit_code) {
        companyDisp = companyDisp
          ? companyDisp + '（' + payload.credit_code + '）'
          : payload.credit_code;
      }
      payload.months = payload.months.map(function (r) {
        if (r.unit_name != null && r.unit_amount != null && r.person_amount != null) return r;
        var base = r.base != null ? r.base : payload.base_amount;
        var personAmt =
          r.pension != null || r.unemployment != null
            ? Number(r.pension || 0) + Number(r.unemployment || 0)
            : payload.person_pay != null
              ? payload.person_pay
              : payload.pension_pay;
        var unitAmt =
          payload.unit_pay != null
            ? payload.unit_pay
            : Math.round(Number(base || 0) * 0.16 * 100) / 100;
        return {
          year: r.year,
          month: r.month,
          unit_name: r.unit_name || companyDisp,
          unit_base: r.unit_base != null ? r.unit_base : base,
          unit_amount: r.unit_amount != null ? r.unit_amount : unitAmt,
          person_base: r.person_base != null ? r.person_base : base,
          person_amount: r.person_amount != null ? r.person_amount : personAmt,
          status: r.status === '已到账' ? '已缴费' : r.status || '已缴费'
        };
      });
    }
    if (payload && !payload.status_medical && payload.status_injury) {
      payload.status_medical = payload.status_injury;
    }
    if (payload && !payload.person_id) {
      payload.person_id = randDigits(10);
    }
    if (payload && !payload.query_date) {
      payload.query_date = defaultQueryDate();
    }
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
