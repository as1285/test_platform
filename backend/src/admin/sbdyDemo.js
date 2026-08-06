/**
 * 社保参保证明 · 演示样例（非正式证明）
 * 版式对齐参考站 show.pdf（浏览器原生 PDF 嵌入）：A4 矢量表格 + 二维码 + 电子章。
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

const SBDY_RENDER_SCRIPT = path.join(__dirname, '../../scripts/sbdy_render_pdf.py');

/** qrUrl：二维码扫码目标（应为 PDF 样例页 show_url） */
function renderSbdyPdfBuffer(payload, authCode, qrUrl) {
  return new Promise(function (resolve, reject) {
    var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbdy-'));
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
          /* 兼容旧字段：二维码优先 qr_url */
          verify_url: qrUrl || ''
        }),
        'utf8'
      );
    } catch (e) {
      cleanup();
      return reject(e);
    }
    var py = process.env.SBDY_PYTHON || 'python3';
    var child = spawn(py, [SBDY_RENDER_SCRIPT, inJson, outPdf], {
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
  if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
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

function buildMonthRows(periodStart, periodEnd, opts) {
  opts = opts || {};
  var a = parseYm(periodStart);
  var b = parseYm(periodEnd);
  if (!a || !b) return [];
  var rows = [];
  var y = a.y;
  var m = a.m;
  var guard = 0;
  var unitCode = opts.credit_code || '';
  var area = opts.area || '';
  var baseAmt = Number(opts.base_amount) || 0;
  var pensionPay = Number(opts.pension_pay) || 0;
  var unempPay = Number(opts.unemployment_pay) || 0;
  while (guard < 48) {
    rows.push({
      year: y,
      month: String(m).padStart(2, '0'),
      unit_code: unitCode,
      area: area,
      pension_base: baseAmt,
      pension_pay: pensionPay,
      pension_status: '已到账',
      unemp_area: area,
      unemp_base: baseAmt,
      unemp_pay: unempPay,
      unemp_status: '已到账',
      remark: ''
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
  var printDate = String(b.print_date || b.printDate || '').trim() || defaultPrintDateCn();
  var statusPension = String(b.status_pension || '正常参保').trim().substring(0, 32);
  var statusMedical = String(
    b.status_medical || b.status_injury || '正常参保'
  ).trim().substring(0, 32);
  var statusInjury = String(
    b.status_injury || b.status_medical || '正常参保'
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
  var months = buildMonthRows(periodStart, periodEnd, {
    credit_code: credit,
    area: area,
    base_amount: baseAmt,
    pension_pay: pensionPay,
    unemployment_pay: unempPay
  });
  if (!months.length) {
    return { error: '缴费月份区间无效' };
  }
  return {
    name: name,
    id_number: idNumber,
    gender: gender,
    id_type: '居民身份证',
    company_name: company,
    company_display: displayUnit || company,
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
    status_medical: statusMedical,
    status_unemployment: statusUnemp,
    months: months,
    layout: 'zj_official_v2'
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
    verify_url: origin + '/sbdy_verify.html?code=' + encodeURIComponent(authCode),
    show_url: origin + '/taxmock/' + encodeURIComponent(token) + '/show.pdf',
    show_api_url: origin + '/api/public/sbdy-demo/show/' + encodeURIComponent(token)
  };
}

var ROWS_PER_PAGE_HTML = 24;

function padMonthRowsHtml(months, minRows) {
  var list = Array.isArray(months) ? months.slice() : [];
  var target = Math.max(minRows || ROWS_PER_PAGE_HTML, list.length);
  /* 向上取整到整页行数，避免半页 */
  var pageRows = ROWS_PER_PAGE_HTML;
  target = Math.ceil(target / pageRows) * pageRows;
  if (target < pageRows) target = pageRows;
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
        escHtml(r.unit_code || '') +
        '</td>' +
        '<td>' +
        escHtml(r.area || '') +
        '</td>' +
        '<td>' +
        escHtml(formatMoney(r.pension_base)) +
        '</td>' +
        '<td>' +
        escHtml(formatMoney(r.pension_pay)) +
        '</td>' +
        '<td>' +
        escHtml(r.pension_status || '已到账') +
        '</td>' +
        '<td>' +
        escHtml(r.unemp_area || r.area || '') +
        '</td>' +
        '<td>' +
        escHtml(formatMoney(r.unemp_base != null ? r.unemp_base : r.pension_base)) +
        '</td>' +
        '<td>' +
        escHtml(formatMoney(r.unemp_pay)) +
        '</td>' +
        '<td>' +
        escHtml(r.unemp_status || '已到账') +
        '</td>' +
        '<td>' +
        escHtml(r.remark || '') +
        '</td>' +
        '</tr>';
    } else {
      html +=
        '<tr class="empty">' +
        '<td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td>' +
        '<td></td><td></td><td></td><td></td><td></td>' +
        '</tr>';
    }
  }
  return html;
}

function chunkMonthRowsHtml(months, size) {
  var list = Array.isArray(months) ? months.slice() : [];
  var pageSize = size || ROWS_PER_PAGE_HTML;
  if (!list.length) {
    return [padMonthRowsHtml([], pageSize)];
  }
  var chunks = [];
  var i;
  for (i = 0; i < list.length; i += pageSize) {
    chunks.push(padMonthRowsHtml(list.slice(i, i + pageSize), pageSize));
  }
  return chunks;
}

function paymentTableHeadHtml() {
  return (
    '<tr class="dhead">' +
    '<th rowspan="2">年</th><th rowspan="2">月</th><th rowspan="2">单位编号</th>' +
    '<th colspan="4">养老保险</th><th colspan="4">失业保险</th>' +
    '<th rowspan="2">备注</th>' +
    '</tr>' +
    '<tr class="dhead">' +
    '<th>参保地</th><th>缴费基数(元)</th><th>个人缴费(元)</th><th>缴费状况</th>' +
    '<th>参保地</th><th>缴费基数(元)</th><th>个人缴费(元)</th><th>缴费状况</th>' +
    '</tr>'
  );
}

function colgroupHtml() {
  return (
    '<colgroup>' +
    '<col style="width:4.2%"><col style="width:3.8%"><col style="width:14.5%">' +
    '<col style="width:7%"><col style="width:8.5%"><col style="width:8.5%"><col style="width:7%">' +
    '<col style="width:7%"><col style="width:8.5%"><col style="width:8.5%"><col style="width:7%">' +
    '<col style="width:5.5%">' +
    '</colgroup>'
  );
}

function renderRedSealImg() {
  return (
    '<img class="seal" src="/img/sbdy_zj_seal.png" width="148" height="148" alt="" aria-hidden="true">'
  );
}

function companyDisplayOf(p) {
  if (p.company_display) return String(p.company_display);
  var company = p.company_name || '';
  var credit = p.credit_code || '';
  if (company && credit) return company + '（' + credit + '）';
  return company || credit || '';
}

function migrateMonthsForShow(payload) {
  var p = payload || {};
  var months = Array.isArray(p.months) ? p.months : [];
  if (!months.length) return months;
  var area = p.area || '';
  var credit = p.credit_code || '';
  var companyDisp = companyDisplayOf(p);
  return months.map(function (r) {
    if (r && r.unit_code != null && r.pension_pay != null && r.unemp_pay != null) {
      return r;
    }
    var base =
      r.pension_base != null
        ? r.pension_base
        : r.base != null
          ? r.base
          : r.person_base != null
            ? r.person_base
            : p.base_amount;
    var pensionPay =
      r.pension_pay != null
        ? r.pension_pay
        : r.pension != null
          ? r.pension
          : p.pension_pay;
    var unempPay =
      r.unemp_pay != null
        ? r.unemp_pay
        : r.unemployment != null
          ? r.unemployment
          : p.unemployment_pay;
    var unitCode = r.unit_code || credit;
    if (!unitCode && r.unit_name) {
      var m = String(r.unit_name).match(/[（(]([0-9A-Z]{15,20})[）)]/);
      if (m) unitCode = m[1];
    }
    return {
      year: r.year,
      month: r.month,
      unit_code: unitCode || '',
      area: r.area || area,
      pension_base: base,
      pension_pay: pensionPay,
      pension_status:
        r.pension_status ||
        (r.status === '已缴费' ? '已到账' : r.status) ||
        '已到账',
      unemp_area: r.unemp_area || r.area || area,
      unemp_base: r.unemp_base != null ? r.unemp_base : base,
      unemp_pay: unempPay,
      unemp_status:
        r.unemp_status ||
        (r.status === '已缴费' ? '已到账' : r.status) ||
        '已到账',
      remark: r.remark || '',
      unit_name: r.unit_name || companyDisp
    };
  });
}

function renderCertHtml(payload, links, opts) {
  opts = opts || {};
  var p = payload || {};
  var months = migrateMonthsForShow(p);
  var verifyUrl = (links && links.verify_url) || '';
  /* 二维码扫码直达 PDF 样例页（与纸质证明一致） */
  var qrUrl =
    (links && links.show_url) || (links && links.show_api_url) || verifyUrl || '';
  var rowChunks = chunkMonthRowsHtml(months, ROWS_PER_PAGE_HTML);
  var totalPages = rowChunks.length;
  var authCode = opts.authCode || '';
  var companyDisp = companyDisplayOf(p);
  var periodLabel = p.period_label || '';
  var monthCount = Array.isArray(months) ? months.length : 0;
  if (monthCount < 1) monthCount = 12;
  if (monthCount > 48) monthCount = 48;
  var paySecTitle =
    '出具证明前' + monthCount + '个月缴费情况（' + escHtml(periodLabel) + '）';
  var officialValidateHint =
    'https://mapi.zjzwfw.gov.cn/web/mgop/gov-open/zj/2002199511/reserved/index.html#/validate';

  function pageHeadHtml(pageIdx) {
    var pageNo = '共' + totalPages + '页，第' + pageIdx + '页';
    var qrBlock =
      pageIdx === 1
        ? '<div class="qr-ph" id="qrPh"></div>' +
          '<canvas id="qrCanvas" class="qr" width="80" height="80" style="display:none"></canvas>'
        : '<div class="qr-ph qr-cont"></div>';
    return (
      '<div class="head">' +
      '<div class="qr-box">' +
      qrBlock +
      '<div class="page-no">' +
      pageNo +
      '</div>' +
      '</div>' +
      '<h1>浙江省社会保险参保证明（个人专用）</h1>' +
      '</div>'
    );
  }

  function tailHtml() {
    return (
      '<div class="tail">' +
      '<div class="notes">' +
      '<div><span class="lab">备注：</span>1.本证明已签署经国家电子政务外网浙江省电子认证注册的机构认证的电子印章，社保经办机构不再另行签章。</div>' +
      '<div class="indent">2.本证明出具后3个月内可在“浙江政务服务网”进行网上验证，授权码：' +
      escHtml(authCode) +
      '，</div>' +
      '<div class="indent">验证平台：<a href="' +
      escHtml(verifyUrl || officialValidateHint) +
      '">' +
      escHtml(officialValidateHint) +
      '</a>。</div>' +
      '<div class="indent">3.本证明为打印时48个月内的参保情况，如需打印48个月以上的，请至人工窗口办理。</div>' +
      '<div class="indent">4.本证明妥善保管，最终解释权由参保地社保经办机构所有。</div>' +
      '</div>' +
      '<div class="print-date">打印时间：' +
      escHtml(p.print_date || defaultPrintDateCn()) +
      '</div>' +
      '<div class="seal-mark">（盖章）</div>' +
      '<div class="seal-wrap">' +
      renderRedSealImg() +
      '</div>' +
      '</div>'
    );
  }

  var pagesHtml = '';
  var pi;
  for (pi = 0; pi < totalPages; pi++) {
    var pageIdx = pi + 1;
    var isFirst = pi === 0;
    var isLast = pi === totalPages - 1;
    var secLabel = isFirst
      ? paySecTitle
      : '出具证明前' + monthCount + '个月缴费情况（续）（' + escHtml(periodLabel) + '）';
    pagesHtml +=
      '<div class="page' +
      (isLast ? '' : ' page-break') +
      '">' +
      pageHeadHtml(pageIdx) +
      '<table class="cert">' +
      colgroupHtml() +
      (isFirst
        ? '<tr class="info">' +
          '<th colspan="1">姓名</th><td colspan="1">' +
          escHtml(p.name) +
          '</td>' +
          '<th colspan="1">社会保障号</th><td colspan="2">' +
          escHtml(p.id_number) +
          '</td>' +
          '<th colspan="1">证件类型</th><td colspan="1">' +
          escHtml(p.id_type || '居民身份证') +
          '</td>' +
          '<th colspan="1">证件号码</th><td colspan="2">' +
          escHtml(p.id_number) +
          '</td>' +
          '<th colspan="1">性别</th><td colspan="1">' +
          escHtml(p.gender || '') +
          '</td>' +
          '</tr>' +
          '<tr class="sec"><th colspan="12">参加社会保险基本情况</th></tr>' +
          '<tr class="basic">' +
          '<th class="lab" colspan="3">险　　种</th>' +
          '<th colspan="3">养老保险</th><th colspan="3">工伤保险</th><th colspan="3">失业保险</th>' +
          '</tr>' +
          '<tr class="basic">' +
          '<th class="lab" colspan="3">参保状态</th>' +
          '<td colspan="3">' +
          escHtml(p.status_pension || '') +
          '</td>' +
          '<td colspan="3">' +
          escHtml(p.status_injury || p.status_medical || '') +
          '</td>' +
          '<td colspan="3">' +
          escHtml(p.status_unemployment || '') +
          '</td>' +
          '</tr>' +
          '<tr class="basic">' +
          '<th class="lab" colspan="3">参保单位</th>' +
          '<td colspan="9">' +
          escHtml(companyDisp) +
          '</td>' +
          '</tr>'
        : '') +
      '<tr class="sec"><th colspan="12">' +
      secLabel +
      '</th></tr>' +
      paymentTableHeadHtml() +
      rowChunks[pi] +
      '</table>' +
      /* 每一页底部文案与电子印章相同（与官方多页证明一致） */
      tailHtml() +
      '</div>';
  }

  /* 每页 24 行缴费明细；超出自动换页（对齐 PDF） */
  return (
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>浙江省社会保险参保证明（个人专用）</title>' +
    '<style>' +
    '*{box-sizing:border-box}' +
    'html,body{margin:0;padding:0;background:#fff}' +
    'body{font-family:SimSun,"宋体","Songti SC","Noto Serif CJK SC",serif;color:#000;' +
    '-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.page{width:210mm;max-width:100%;min-height:297mm;margin:0 auto;background:#fff;' +
    'padding:14mm 14mm 16mm;position:relative}' +
    '.page-break{page-break-after:always;break-after:page}' +
    '.head{position:relative;min-height:96px;margin:0 0 10px}' +
    'h1{margin:0;padding:26px 100px 0 0;text-align:center;font-size:24px;font-weight:700;' +
    'letter-spacing:3px;line-height:1.35}' +
    '.qr-box{position:absolute;top:0;right:0;width:90px;text-align:center}' +
    '.qr-box canvas,.qr-box img.qr{width:80px;height:80px;display:block;margin:0 auto}' +
    '.qr-ph{width:80px;height:80px;margin:0 auto}' +
    '.qr-cont{background:repeating-linear-gradient(45deg,#eee,#eee 4px,#f8f8f8 4px,#f8f8f8 8px)}' +
    '.page-no{margin-top:2px;font-size:12px;text-align:right;white-space:nowrap}' +
    'table.cert{width:100%;border-collapse:collapse;table-layout:fixed;background:#fff;font-size:11px}' +
    'table.cert th,table.cert td{border:1px solid #000;padding:4px 2px;text-align:center;' +
    'vertical-align:middle;font-weight:400;background:#fff;word-break:break-all;line-height:1.3}' +
    'table.cert tr.sec th{font-size:13px;font-weight:700;letter-spacing:2px;padding:6px 4px}' +
    'table.cert tr.info th{white-space:nowrap;font-size:12px}' +
    'table.cert tr.info td{font-size:12px}' +
    'table.cert tr.basic th.lab{white-space:nowrap;font-size:12px}' +
    'table.cert tr.basic td,table.cert tr.basic th:not(.lab){font-size:12px}' +
    'table.cert tr.dhead th{font-size:10.5px;padding:3px 1px}' +
    'table.cert td.unit{font-size:9.5px}' +
    'table.cert tr.empty td{height:17px;padding:0}' +
    '.tail{position:relative;margin-top:8px;min-height:160px}' +
    '.notes{font-size:11px;line-height:1.75;text-align:left;padding-right:150px}' +
    '.notes .lab{font-weight:700}' +
    '.notes .indent{padding-left:2.1em}' +
    '.notes a{color:#00f;text-decoration:underline;word-break:break-all}' +
    '.print-date{text-align:center;font-size:13px;margin:22px 40px 0 0;letter-spacing:1px}' +
    '.seal-mark{position:absolute;right:118px;top:48px;font-size:12px;z-index:3}' +
    '.seal-wrap{position:absolute;right:0;top:10px;width:160px;height:160px;z-index:2;pointer-events:none}' +
    '.seal{width:160px;height:160px;display:block;opacity:.92}' +
    '@media print{.page{padding:12mm;min-height:auto}.page-break{page-break-after:always}}' +
    '@media (max-width:720px){.page{padding:8px;min-height:0}.head{min-height:0}' +
    'h1{padding:6px 0 0;font-size:18px;letter-spacing:1px}' +
    '.qr-box{position:static;margin:0 auto 8px}.page-no{text-align:center}' +
    '.notes{padding-right:0}.seal-mark{position:static;text-align:right;margin-top:8px}' +
    '.seal-wrap{position:relative;right:auto;top:auto;margin:6px 0 0 auto}}' +
    '</style></head><body>' +
    pagesHtml +
    '<script src="/js/vendor/qrcode.min.js"><\/script>' +
    '<script>(function(){var u=' +
    JSON.stringify(qrUrl) +
    ';var c=document.getElementById("qrCanvas");var ph=document.getElementById("qrPh");' +
    'if(!u||typeof QRCode==="undefined"||!QRCode.toCanvas||!c){return;}' +
    'QRCode.toCanvas(c,u,{width:80,margin:1,color:{dark:"#000000",light:"#ffffff"}},function(err){' +
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
    if (payload && !payload.status_injury && payload.status_medical) {
      payload.status_injury = payload.status_medical;
    }
    if (payload && !payload.company_display) {
      payload.company_display = companyDisplayOf(payload);
    }
    if (payload) {
      payload.months = migrateMonthsForShow(payload);
    }
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
    var pdfBuf = await renderSbdyPdfBuffer(payload, row.auth_code, links.show_url);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="show.pdf"');
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Content-Length', String(pdfBuf.length));
    return res.status(200).end(pdfBuf);
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
