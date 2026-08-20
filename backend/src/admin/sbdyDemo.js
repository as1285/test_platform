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
const SBDY_SZ_RENDER_SCRIPT = path.join(__dirname, '../../scripts/sbdy_sz_render_pdf.py');
const SBDY_WH_RENDER_SCRIPT = path.join(__dirname, '../../scripts/sbdy_wh_render_pdf.py');
const WH_VERIFY_URL = 'http://59.175.218.201:8005/template/dzsbzmyz.html';

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
    var region = String((payload && payload.region) || '').toLowerCase();
    var script = SBDY_RENDER_SCRIPT;
    if (region === 'wh' || region === 'wuhan' || region === 'hubei' || region === 'hb') {
      script = SBDY_WH_RENDER_SCRIPT;
    } else if (region === 'sz' || region === 'shenzhen') {
      script = SBDY_SZ_RENDER_SCRIPT;
    }
    var child = spawn(py, [script, inJson, outPdf], {
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

function randAlnum(n) {
  var chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  var out = '';
  while (out.length < n) {
    out += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return out;
}

function bjStamp12() {
  var now = new Date();
  var bj = new Date(now.getTime() + 8 * 3600 * 1000);
  return (
    String(bj.getUTCFullYear()) +
    pad2(bj.getUTCMonth() + 1) +
    pad2(bj.getUTCDate()) +
    pad2(bj.getUTCHours()) +
    pad2(bj.getUTCMinutes())
  );
}

function formatWhAuthCode(stamp) {
  var s = String(stamp || bjStamp12()).replace(/\D/g, '');
  if (s.length < 12) s = (s + bjStamp12()).slice(0, 12);
  return (
    s.slice(0, 4) +
    ' ' +
    s.slice(4, 8) +
    ' ' +
    s.slice(8, 12) +
    ' ' +
    randAlnum(4) +
    ' ' +
    randAlnum(4)
  );
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

function round2(n) {
  var x = Number(n);
  if (!isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function isSzRegion(body) {
  var r = String((body && (body.region || body.layout)) || '').toLowerCase();
  return r === 'sz' || r === 'shenzhen' || r === 'sz_official_v1';
}

function isWhRegion(body) {
  var r = String((body && (body.region || body.layout)) || '').toLowerCase();
  return (
    r === 'wh' ||
    r === 'wuhan' ||
    r === 'hubei' ||
    r === 'hb' ||
    r === 'wh_official_v1'
  );
}

function digitsFrom(s, n) {
  var d = String(s || '').replace(/\D/g, '');
  if (d.length >= n) return d.slice(-n);
  return (d + randDigits(n)).slice(0, n);
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

function buildSzMonthRows(periodStart, periodEnd, opts) {
  opts = opts || {};
  var a = parseYm(periodStart);
  var b = parseYm(periodEnd);
  if (!a || !b) return [];
  var pensionBase = Number(opts.pension_base) || 0;
  var medicalBase = Number(opts.medical_base) > 0 ? Number(opts.medical_base) : pensionBase;
  var injuryBase = Number(opts.injury_base) > 0 ? Number(opts.injury_base) : Math.max(3000, pensionBase);
  var unempBase = Number(opts.unemp_base) > 0 ? Number(opts.unemp_base) : injuryBase;
  var unitCode = opts.unit_code || '';
  var unitName = opts.company_name || '';
  var rows = [];
  var y = a.y;
  var m = a.m;
  var guard = 0;
  while (guard < 60) {
    rows.push({
      year: y,
      month: String(m).padStart(2, '0'),
      unit_code: unitCode,
      unit_name: unitName,
      pension_base: pensionBase,
      pension_unit: round2(pensionBase * 0.16),
      pension_person: round2(pensionBase * 0.08),
      medical_type: '1',
      medical_base: medicalBase,
      medical_unit: round2(medicalBase * 0.05),
      medical_person: round2(medicalBase * 0.02),
      maternity_type: '1',
      maternity_base: medicalBase,
      maternity_unit: round2(medicalBase * 0.005),
      injury_base: injuryBase,
      injury_unit: round2(injuryBase * 0.002),
      unemp_base: unempBase,
      unemp_unit: round2(unempBase * 0.008),
      unemp_person: round2(unempBase * 0.002)
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

function normalizeSzPayload(body) {
  var b = body && typeof body === 'object' ? body : {};
  var name = String(b.name || '').trim().substring(0, 64);
  var idNumber = String(b.id_number || b.idNumber || '').trim().substring(0, 32);
  var company = String(b.company_name || b.company || '').trim().substring(0, 128);
  var unitCode = String(b.unit_code || b.unitCode || '').replace(/\D/g, '').substring(0, 12);
  if (!unitCode) unitCode = digitsFrom(b.credit_code || b.creditCode || idNumber, 8);
  var computerNo = String(b.computer_no || b.computerNo || '').replace(/\D/g, '').substring(0, 12);
  if (!computerNo) computerNo = digitsFrom(idNumber, 9);
  var periodStart = String(b.period_start || b.periodStart || '').trim();
  var periodEnd = String(b.period_end || b.periodEnd || '').trim();
  var pensionBase = Number(b.pension_base != null ? b.pension_base : b.base_amount != null ? b.base_amount : b.baseAmount);
  var medicalBase = Number(b.medical_base != null ? b.medical_base : b.medicalBase);
  if (!isFinite(pensionBase) || pensionBase <= 0) pensionBase = 4492;
  if (!isFinite(medicalBase) || medicalBase <= 0) medicalBase = pensionBase;
  var printDate = String(b.print_date || b.printDate || '').trim() || defaultPrintDateCn();
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
  var months = buildSzMonthRows(periodStart, periodEnd, {
    pension_base: pensionBase,
    medical_base: medicalBase,
    unit_code: unitCode,
    company_name: company
  });
  if (!months.length) {
    return { error: '缴费月份区间无效' };
  }
  var unitMap = normalizeSzUnitMapInput(b.unit_map || b.unitMap, unitCode, company);
  return {
    region: 'sz',
    layout: 'sz_official_v1',
    name: name,
    id_number: idNumber,
    computer_no: computerNo,
    company_name: company,
    unit_code: unitCode,
    unit_map: unitMap,
    period_start: periodStart,
    period_end: periodEnd,
    period_label:
      formatYmCn(parseYm(periodStart).y, parseYm(periodStart).m) +
      '-' +
      formatYmCn(parseYm(periodEnd).y, parseYm(periodEnd).m),
    pension_base: pensionBase,
    medical_base: medicalBase,
    base_amount: pensionBase,
    print_date: printDate,
    months: months
  };
}

function buildWhMonthRows(periodStart, periodEnd, opts) {
  opts = opts || {};
  var a = parseYm(periodStart);
  var b = parseYm(periodEnd);
  if (!a || !b) return [];
  var unitName = opts.company_name || '';
  var baseAmt = Number(opts.base_amount) || 0;
  var status = String(opts.status || '正常');
  var rows = [];
  var y = a.y;
  var m = a.m;
  var guard = 0;
  while (guard < 60) {
    rows.push({
      year: y,
      month: String(m).padStart(2, '0'),
      ym: String(y) + String(m).padStart(2, '0'),
      unit_name: unitName,
      base: baseAmt,
      pension_base: baseAmt,
      status: status
    });
    if (y === b.y && m === b.m) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    guard += 1;
  }
  if (rows.length > 60) rows = rows.slice(-60);
  return rows;
}

function normalizeWhPayload(body) {
  var b = body && typeof body === 'object' ? body : {};
  var name = String(b.name || '').trim().substring(0, 64);
  var idNumber = String(b.id_number || b.idNumber || '').trim().substring(0, 32);
  var gender = String(b.gender || '').trim().substring(0, 8);
  if (!gender) {
    var id = String(idNumber);
    if (id.length === 18 && /^\d{17}[\dXx]$/.test(id)) {
      gender = Number(id.charAt(16)) % 2 === 0 ? '女' : '男';
    } else if (id.length === 15 && /^\d{15}$/.test(id)) {
      gender = Number(id.charAt(14)) % 2 === 0 ? '女' : '男';
    } else {
      gender = '男';
    }
  }
  var company = String(b.company_name || b.company || '').trim().substring(0, 128);
  var area = String(b.area || '武汉市').trim().substring(0, 32) || '武汉市';
  var unitCode = String(b.unit_code || b.unitCode || '').replace(/\D/g, '').substring(0, 12);
  if (!unitCode) unitCode = digitsFrom(b.credit_code || b.creditCode || idNumber, 9);
  var personNo = String(b.person_no || b.personNo || '').replace(/\D/g, '').substring(0, 12);
  if (!personNo) personNo = ('1' + digitsFrom(idNumber, 10)).substring(0, 11);
  var insure = String(b.insurance_type || b.insuranceType || '企业养老').trim().substring(0, 32) || '企业养老';
  var periodStart = String(b.period_start || b.periodStart || '').trim();
  var periodEnd = String(b.period_end || b.periodEnd || '').trim();
  var baseAmt = Number(b.base_amount != null ? b.base_amount : b.baseAmount);
  if (!isFinite(baseAmt) || baseAmt <= 0) baseAmt = 6120;
  var printDate = String(b.print_date || b.printDate || '').trim() || defaultPrintDateCn();
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
  var months = buildWhMonthRows(periodStart, periodEnd, {
    company_name: company,
    base_amount: baseAmt
  });
  if (!months.length) {
    return { error: '缴费月份区间无效' };
  }
  var localCount = Number(b.local_month_count != null ? b.local_month_count : b.localMonthCount);
  if (!isFinite(localCount) || localCount <= 0) localCount = months.length;
  var stamp = bjStamp12();
  return {
    region: 'wh',
    layout: 'wh_official_v1',
    name: name,
    id_number: idNumber,
    gender: gender,
    person_no: personNo,
    company_name: company,
    unit_code: unitCode,
    area: area,
    insurance_type: insure,
    local_month_count: localCount,
    period_start: periodStart,
    period_end: periodEnd,
    period_label:
      formatYmCn(parseYm(periodStart).y, parseYm(periodStart).m) +
      '-' +
      formatYmCn(parseYm(periodEnd).y, parseYm(periodEnd).m),
    base_amount: baseAmt,
    print_date: printDate,
    watermark_id: stamp + '-' + randDigits(10),
    months: months
  };
}

function normalizePayload(body) {
  if (isWhRegion(body)) {
    return normalizeWhPayload(body);
  }
  if (isSzRegion(body)) {
    return normalizeSzPayload(body);
  }
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
    region: 'zj',
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

function normalizeSzUnitMapInput(raw, fallbackCode, fallbackName) {
  var out = [];
  var seen = {};
  function add(code, name) {
    code = String(code || '').trim();
    if (!code || seen[code]) return;
    seen[code] = 1;
    out.push({
      unit_code: code,
      unit_name: String(name || '').trim()
    });
  }
  if (Array.isArray(raw)) {
    raw.forEach(function (item) {
      if (!item || typeof item !== 'object') return;
      add(item.unit_code || item.unitCode, item.unit_name || item.unitName);
    });
  }
  add(fallbackCode, fallbackName);
  return out;
}

/** 备注第 6 项：按官方清单做无框双列对照（非表格线） */
function resolveSzUnitMap(p) {
  p = p || {};
  var months = Array.isArray(p.months) ? p.months : [];
  var seen = {};
  var out = [];
  function add(code, name) {
    code = String(code || '').trim();
    if (!code || seen[code]) return;
    seen[code] = 1;
    out.push({
      unit_code: code,
      unit_name: String(name || '').trim()
    });
  }
  if (Array.isArray(p.unit_map)) {
    p.unit_map.forEach(function (item) {
      if (item) add(item.unit_code, item.unit_name);
    });
  }
  months.forEach(function (r) {
    if (r) add(r.unit_code, r.unit_name || p.company_name);
  });
  add(p.unit_code, p.company_name);
  if (!out.length) {
    out.push({ unit_code: '', unit_name: p.company_name || '' });
  }
  return out;
}

function renderSzCertHtml(payload, links, opts) {
  opts = opts || {};
  var p = payload || {};
  var months = Array.isArray(p.months) ? p.months : [];
  var qrUrl = (links && links.show_url) || (links && links.show_api_url) || '';
  var authCode = opts.authCode || '';
  var mapping = resolveSzUnitMap(p);
  var tot = {
    pension_unit: 0,
    pension_person: 0,
    medical_unit: 0,
    medical_person: 0,
    maternity_unit: 0,
    injury_unit: 0,
    unemp_unit: 0,
    unemp_person: 0
  };
  var rowsHtml = '';
  months.forEach(function (r) {
    if (!r) return;
    tot.pension_unit += Number(r.pension_unit) || 0;
    tot.pension_person += Number(r.pension_person) || 0;
    tot.medical_unit += Number(r.medical_unit) || 0;
    tot.medical_person += Number(r.medical_person) || 0;
    tot.maternity_unit += Number(r.maternity_unit) || 0;
    tot.injury_unit += Number(r.injury_unit) || 0;
    tot.unemp_unit += Number(r.unemp_unit) || 0;
    tot.unemp_person += Number(r.unemp_person) || 0;
    rowsHtml +=
      '<tr>' +
      '<td>' + escHtml(r.year) + '</td><td>' + escHtml(r.month) + '</td>' +
      '<td>' + escHtml(r.unit_code || '') + '</td>' +
      '<td>' + escHtml(formatMoney(r.pension_base)) + '</td>' +
      '<td>' + escHtml(formatMoney(r.pension_unit)) + '</td>' +
      '<td>' + escHtml(formatMoney(r.pension_person)) + '</td>' +
      '<td>' + escHtml(r.medical_type || '1') + '</td>' +
      '<td>' + escHtml(formatMoney(r.medical_base)) + '</td>' +
      '<td>' + escHtml(formatMoney(r.medical_unit)) + '</td>' +
      '<td>' + escHtml(formatMoney(r.medical_person)) + '</td>' +
      '<td>' + escHtml(r.maternity_type || '1') + '</td>' +
      '<td>' + escHtml(formatMoney(r.maternity_base)) + '</td>' +
      '<td>' + escHtml(formatMoney(r.maternity_unit)) + '</td>' +
      '<td>' + escHtml(formatMoney(r.injury_base)) + '</td>' +
      '<td>' + escHtml(formatMoney(r.injury_unit)) + '</td>' +
      '<td>' + escHtml(formatMoney(r.unemp_base)) + '</td>' +
      '<td>' + escHtml(formatMoney(r.unemp_unit)) + '</td>' +
      '<td>' + escHtml(formatMoney(r.unemp_person)) + '</td>' +
      '</tr>';
  });
  var mapHtml =
    '<div class="unit-map-row unit-map-head"><span>单位编号</span><span>单位名称</span></div>';
  mapping.forEach(function (item) {
    mapHtml +=
      '<div class="unit-map-row"><span>' +
      escHtml(item.unit_code || '') +
      '</span><span>' +
      escHtml(item.unit_name || '') +
      '</span></div>';
  });
  return (
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
    '<title>深圳市社会保险历年参保缴费明细表（个人）</title>' +
    '<style>' +
    'body{margin:0;background:#fff;font-family:SimSun,"宋体",serif;color:#000;font-size:12px}' +
    '.page{width:210mm;max-width:100%;margin:0 auto;padding:10px 12px 28px;position:relative}' +
    'h1{text-align:center;font-size:18px;margin:58px 96px 12px 72px;letter-spacing:1px}' +
    '.qr{position:absolute;left:10px;top:6px;width:58px;text-align:center;font-size:10px;line-height:1.2;z-index:2}' +
    '.qr canvas{display:block;width:52px;height:52px;margin:0 auto 4px}' +
    '.qr .qr-cap{display:block;margin-top:2px;white-space:nowrap}' +
    '.seal-top{position:absolute;right:8px;top:4px;width:86px;z-index:1}' +
    '.info{font-size:12px;margin:0 8px 10px;line-height:1.8}' +
    'table.grid{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10px}' +
    'table.grid th,table.grid td{border:1px solid #000;padding:2px 1px;text-align:center;vertical-align:middle}' +
    'table.grid col.c-year{width:4.7%}table.grid col.c-mon{width:2.3%}table.grid col.c-unit{width:7.1%}' +
    'table.grid col.c-pbase{width:5.9%}table.grid col.c-pay{width:7.1%}table.grid col.c-type{width:4.7%}' +
    'table.grid col.c-mbase{width:4.7%}table.grid col.c-sbase{width:4.7%}table.grid col.c-spay{width:5.9%}' +
    'table.grid col.c-ibase{width:4.7%}table.grid col.c-ipay{width:5.9%}table.grid col.c-ubase{width:4.7%}' +
    'table.grid col.c-upay{width:5.9%}' +
    '.notes{font-size:11px;line-height:1.7;margin-top:10px}' +
    '.unit-map{margin:2px 0 0 16px;font-size:11px;line-height:1.55}' +
    '.unit-map-row{display:flex;align-items:flex-start}' +
    '.unit-map-row>span:first-child{width:118px;flex-shrink:0}' +
    '.unit-map-row>span:last-child{flex:1;min-width:0}' +
    '.bureau{text-align:center;margin-top:18px}' +
    '.seal-bot{position:absolute;right:24px;bottom:10px;width:110px}' +
    '</style></head><body><div class="page">' +
    '<div class="qr"><div id="qrPh"></div><canvas id="qrCanvas" width="52" height="52" style="display:none"></canvas><div class="qr-cap">好差评二维码</div></div>' +
    '<img class="seal-top" src="/img/sbdy_sz_seal.png" alt="">' +
    '<h1>深圳市社会保险历年参保缴费明细表（个人）</h1>' +
    '<div class="info">姓名：' +
    escHtml(p.name || '') +
    '　　社保电脑号：' +
    escHtml(p.computer_no || '') +
    '　　身份证号码：' +
    escHtml(p.id_number || '') +
    '　　页码：1<br>最近参保单位名称：' +
    escHtml(p.company_name || '') +
    '　　单位编号：' +
    escHtml(p.unit_code || '') +
    '　　计算单位：元</div>' +
    '<table class="grid"><colgroup>' +
    '<col class="c-year"><col class="c-mon"><col class="c-unit">' +
    '<col class="c-pbase"><col class="c-pay"><col class="c-pay">' +
    '<col class="c-type"><col class="c-mbase"><col class="c-pay"><col class="c-pay">' +
    '<col class="c-type"><col class="c-sbase"><col class="c-spay">' +
    '<col class="c-ibase"><col class="c-ipay">' +
    '<col class="c-ubase"><col class="c-upay"><col class="c-upay">' +
    '</colgroup><thead>' +
    '<tr><th rowspan="2">缴费年</th><th rowspan="2">月</th><th rowspan="2">单位编号</th>' +
    '<th colspan="3">养老保险</th><th colspan="4">医疗保险</th><th colspan="3">生育</th>' +
    '<th colspan="2">工伤保险</th><th colspan="3">失业保险</th></tr>' +
    '<tr><th>基数</th><th>单位交</th><th>个人交</th><th>险种</th><th>基数</th><th>单位交</th><th>个人交</th>' +
    '<th>险种</th><th>基数</th><th>单位交</th><th>基数</th><th>单位交</th>' +
    '<th>基数</th><th>单位交</th><th>个人交</th></tr></thead><tbody>' +
    rowsHtml +
    '<tr><td colspan="3">合计</td><td></td><td>' +
    escHtml(formatMoney(tot.pension_unit)) +
    '</td><td>' +
    escHtml(formatMoney(tot.pension_person)) +
    '</td><td></td><td></td><td>' +
    escHtml(formatMoney(tot.medical_unit)) +
    '</td><td>' +
    escHtml(formatMoney(tot.medical_person)) +
    '</td><td></td><td></td><td>' +
    escHtml(formatMoney(tot.maternity_unit)) +
    '</td><td></td><td>' +
    escHtml(formatMoney(tot.injury_unit)) +
    '</td><td></td><td>' +
    escHtml(formatMoney(tot.unemp_unit)) +
    '</td><td>' +
    escHtml(formatMoney(tot.unemp_person)) +
    '</td></tr></tbody></table>' +
    '<div class="notes">备注：<br>1.本证明可作为参保人在本单位参加社会保险的证明。向相关部门提供，查验部门可通过登录网址：https://sipub.sz.gov.cn/vp/，输入下列验真码（' +
    escHtml(authCode) +
    '）核查，验真码有效期三个月。<br>' +
    '2.生育保险中的险种“1”为生育保险，“2”为生育医疗。<br>' +
    '3.医疗险种中的险种“1”为基本医疗保险一档，“2”为基本医疗保险二档，“4”为基本医疗保险三档，“5”为居民医疗保险医保，“6”为统筹医疗保险。<br>' +
    '4.上述“缴费明细”表中带“*”标识为补缴，空行为断缴。<br>' +
    '5.居民养老保险、居民（含少儿/学生）医疗保险不在本清单。<br>' +
    '6.单位编号对应的单位名称：' +
    '<div class="unit-map">' +
    mapHtml +
    '</div></div>' +
    '<div class="bureau">深圳市社会保险基金管理局<br>打印日期：' +
    escHtml(p.print_date || defaultPrintDateCn()) +
    '</div>' +
    '<img class="seal-bot" src="/img/sbdy_sz_seal.png" alt="">' +
    '</div>' +
    '<script src="/js/vendor/qrcode.min.js"><\/script>' +
    '<script>(function(){var u=' +
    JSON.stringify(qrUrl) +
    ';var c=document.getElementById("qrCanvas");var ph=document.getElementById("qrPh");' +
    'if(!u||typeof QRCode==="undefined"||!QRCode.toCanvas||!c){return;}' +
    'QRCode.toCanvas(c,u,{width:52,margin:1},function(err){if(!err){c.style.display="block";if(ph)ph.style.display="none";}});})();<\/script>' +
    '</body></html>'
  );
}

function renderWhCertHtml(payload, links, opts) {
  opts = opts || {};
  var p = payload || {};
  var months = Array.isArray(p.months) ? p.months.slice() : [];
  months.sort(function (a, b) {
    var ka = Number((a && a.ym) || String((a && a.year) || '0') + String((a && a.month) || '00'));
    var kb = Number((b && b.ym) || String((b && b.year) || '0') + String((b && b.month) || '00'));
    return kb - ka;
  });
  if (months.length > 12) months = months.slice(0, 12);
  var leftN = Math.ceil(months.length / 2);
  var left = months.slice(0, leftN);
  var right = months.slice(leftN);
  var authCode = opts.authCode || '';
  function cell(r) {
    if (!r) {
      return '<div></div><div></div><div></div>';
    }
    var ym = r.ym || String(r.year || '') + String(r.month || '').padStart(2, '0');
    return (
      '<div>' +
      escHtml(ym) +
      '</div><div>' +
      escHtml(formatMoney(r.base != null ? r.base : r.pension_base)) +
      '</div><div>' +
      escHtml(r.status || '正常') +
      '</div>'
    );
  }
  var rowsHtml = '';
  var i;
  for (i = 0; i < 18; i++) {
    rowsHtml += cell(left[i]) + cell(right[i]);
  }
  var localN =
    p.local_month_count != null && p.local_month_count !== ''
      ? p.local_month_count
      : months.length;
  return (
    '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>湖北省社会保险参保证明（个人专用）</title>' +
    '<style>' +
    '*{box-sizing:border-box}' +
    'html,body{margin:0;padding:0;background:#fff}' +
    'body{font-family:SimSun,"宋体","Songti SC","Noto Serif CJK SC",serif;color:#000;' +
    '-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.page{width:210mm;max-width:100%;min-height:297mm;margin:0 auto;background:#fff;' +
    'padding:7.4pt 12.1mm 18mm;position:relative;overflow:hidden}' +
    'h1{margin:0 0 1.2mm;text-align:center;font-size:21pt;font-weight:400;letter-spacing:1px;line-height:1.15}' +
    '.g{display:grid;border-left:0.75pt solid #000;border-top:0.75pt solid #000;font-size:7.5pt}' +
    '.g>div{border-right:0.75pt solid #000;border-bottom:0.75pt solid #000;display:flex;align-items:center;' +
    'justify-content:center;text-align:center;padding:1px 2px;word-break:break-all;line-height:1.25}' +
    '.info1{grid-template-columns:43.9pt 49.3pt 43.9pt 43.9pt 87.7pt 49.3pt 137.1pt 93.2pt}' +
    '.info1>div{min-height:15pt}' +
    '.info2{grid-template-columns:43.9pt 137.1pt 87.7pt 49.3pt 137.1pt 93.2pt}' +
    '.info2>div{min-height:15pt}' +
    '.unit{grid-template-columns:93.2pt 87.7pt 87.7pt 279.6pt}' +
    '.unit>div{min-height:15pt}' +
    '.dual{grid-template-columns:66.9pt 120pt 81.8pt 68.2pt 120pt 91.4pt}' +
    '.dual>div{min-height:32.25pt}' +
    '.dual.dhead>div{min-height:15pt}' +
    '.sec{border:0.75pt solid #000;border-top:0;height:19.5pt;display:flex;align-items:center;justify-content:center;' +
    'font-size:13.5pt;letter-spacing:2px}' +
    '.notes{margin-top:2pt;font-size:7.5pt;line-height:8.25pt;position:relative;z-index:2}' +
    '.notes .lab{display:inline-block;width:20pt}' +
    '.print-date{text-align:center;font-size:7.5pt;margin-top:22pt}' +
    '.page-no{text-align:center;font-size:7.5pt;margin-top:8pt}' +
    '.seal{position:absolute;left:151.7mm;top:221.2mm;width:40mm;height:40.5mm;z-index:3;pointer-events:none}' +
    '.body{position:relative;z-index:1}' +
    '@media print{.page{padding:7.4pt 12mm 12mm}}' +
    '</style></head><body>' +
    '<div class="page">' +
    '<div class="body">' +
    '<h1>湖北省社会保险参保证明（个人专用）</h1>' +
    '<div class="g info1">' +
    '<div>姓名</div><div>' +
    escHtml(p.name) +
    '</div><div>性别</div><div>' +
    escHtml(p.gender || '') +
    '</div><div>个人编号</div><div>' +
    escHtml(p.person_no || '') +
    '</div><div>社会保障号</div><div>' +
    escHtml(p.id_number || '') +
    '</div></div>' +
    '<div class="g info2">' +
    '<div>参保缴费地</div><div>' +
    escHtml(p.area || '武汉市') +
    '</div><div>本地缴费月数</div><div>' +
    escHtml(localN) +
    '</div><div>参保险种</div><div>' +
    escHtml(p.insurance_type || '企业养老') +
    '</div></div>' +
    '<div class="sec">缴费地最末所在单位</div>' +
    '<div class="g unit">' +
    '<div>单位编号</div><div>' +
    escHtml(p.unit_code || '') +
    '</div><div>单位名称</div><div>' +
    escHtml(p.company_name || '') +
    '</div></div>' +
    '<div class="sec">近12个月参保缴费情况</div>' +
    '<div class="g dual dhead">' +
    '<div>记录月份</div><div>缴费基数(元)</div><div>缴费类型</div>' +
    '<div>记录月份</div><div>缴费基数(元)</div><div>缴费类型</div>' +
    '</div>' +
    '<div class="g dual">' +
    rowsHtml +
    '</div>' +
    '<div class="notes"><span class="lab">备注：</span><br>' +
    '1、社会保障号:中国公民的“社会保障号”为身份证号;外国公民的“社会保障号”为护照号或居留证号。<br>' +
    '2、本证明由参保人自行保管，因遗失或泄露造成的不良后果，由参保人负责。<br>' +
    '3、本地缴费月数是指：参保缴费地实际缴费月数与转入缴费月数之和。<br>' +
    '4、本参保证明出具后3个月内可在“湖北省社保证明验证平台”进行验证。<br>' +
    '验证平台：<a href="' +
    WH_VERIFY_URL +
    '">' +
    WH_VERIFY_URL +
    '</a><br>' +
    '授权码：' +
    escHtml(authCode) +
    '</div>' +
    '<div class="print-date">打印时间： ' +
    escHtml(p.print_date || defaultPrintDateCn()) +
    '</div>' +
    '<div class="page-no">第1页/共1页</div>' +
    '</div>' +
    '<img class="seal" src="/img/sbdy_wh_seal.png" alt="">' +
    '</div></body></html>'
  );
}

function renderCertHtml(payload, links, opts) {
  opts = opts || {};
  var p = payload || {};
  if (p.region === 'wh' || p.layout === 'wh_official_v1') {
    return renderWhCertHtml(p, links, opts);
  }
  if (p.region === 'sz' || p.layout === 'sz_official_v1') {
    return renderSzCertHtml(p, links, opts);
  }
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
    var authCode;
    if (normalized.region === 'sz') {
      authCode = randToken(16);
    } else if (normalized.region === 'wh') {
      var stamp = bjStamp12();
      authCode = formatWhAuthCode(stamp);
      normalized.watermark_id = stamp + '-' + randDigits(10);
    } else {
      authCode = randDigits(20);
    }
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
        region:
          payload && payload.region === 'sz'
            ? 'sz'
            : payload && payload.region === 'wh'
              ? 'wh'
              : 'zj',
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
    if (rows && rows[0]) return rows[0];
    var compact = String(code).replace(/\s+/g, '');
    if (compact && compact !== String(code)) {
      const [rows2] = await getPool().execute(
        "SELECT auth_code, token, payload_json, created_at FROM sbdy_demo_certs WHERE REPLACE(auth_code, ' ', '') = ? LIMIT 1",
        [compact]
      );
      return rows2 && rows2[0] ? rows2[0] : null;
    }
    return null;
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
    if (
      payload &&
      payload.region !== 'sz' &&
      payload.region !== 'wh' &&
      payload.layout !== 'sz_official_v1' &&
      payload.layout !== 'wh_official_v1'
    ) {
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
