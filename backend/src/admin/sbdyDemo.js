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
const { PUBLIC_SITE_URL, SBDY_PUBLIC_ORIGIN } = require('../shared/config');

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

function defaultQueryDate() {
  var p = bjNowParts();
  return p.y + '-' + String(p.m).padStart(2, '0') + '-' + String(p.d).padStart(2, '0');
}

function ymKey(y, m) {
  return y * 100 + m;
}

function compareYm(a, b) {
  return ymKey(a.y, a.m) - ymKey(b.y, b.m);
}

/** 按年取缴费基数：优先 year_bases[年]，否则用默认基数（每年可不同） */
function baseForYear(year, defaultBase, yearBases) {
  var yb = yearBases && typeof yearBases === 'object' ? yearBases : null;
  if (yb) {
    var key = String(year);
    if (yb[key] != null && isFinite(Number(yb[key]))) {
      return Number(yb[key]);
    }
    if (yb[year] != null && isFinite(Number(yb[year]))) {
      return Number(yb[year]);
    }
  }
  return Number(defaultBase) || 0;
}

function parseYearBases(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  var out = {};
  var keys = Object.keys(raw);
  var i;
  for (i = 0; i < keys.length; i++) {
    var k = String(keys[i]).trim();
    if (!/^\d{4}$/.test(k)) continue;
    var n = Number(raw[keys[i]]);
    if (!isFinite(n) || n < 0) continue;
    out[k] = n;
  }
  return Object.keys(out).length ? out : null;
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
  var unitCode = opts.credit_code || opts.unit_code || '';
  var area = opts.area || '';
  var defaultBase = Number(opts.base_amount) || 0;
  var yearBases = opts.year_bases || null;
  var fixedPension = Number(opts.pension_pay);
  var fixedUnemp = Number(opts.unemployment_pay);
  if (!isFinite(fixedPension)) fixedPension = Math.round(defaultBase * 0.08 * 100) / 100;
  if (!isFinite(fixedUnemp)) fixedUnemp = Math.round(defaultBase * 0.005 * 100) / 100;
  /* 有按年基数时，按默认基数反推比例，使各年缴费随基数变化 */
  var pensionRatio = defaultBase > 0 ? fixedPension / defaultBase : 0.08;
  var unempRatio = defaultBase > 0 ? fixedUnemp / defaultBase : 0.005;
  while (guard < 48) {
    var baseAmt = baseForYear(y, defaultBase, yearBases);
    var pensionPay = yearBases
      ? Math.round(baseAmt * pensionRatio * 100) / 100
      : fixedPension;
    var unempPay = yearBases
      ? Math.round(baseAmt * unempRatio * 100) / 100
      : fixedUnemp;
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
      remark: '',
      company_name: opts.company_name || '',
      credit_code: opts.credit_code || ''
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

/** 去掉单位名称末尾已带的（信用代码），避免展示时拼成两份 */
function stripTrailingCreditFromCompany(company) {
  var s = String(company || '').trim();
  if (!s) return '';
  return s
    .replace(/[（(]\s*[0-9A-Za-z]{15,20}\s*[）)]\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractCreditFromCompany(company) {
  var s = String(company || '').trim();
  var m = s.match(/[（(]\s*([0-9A-Za-z]{15,20})\s*[）)]\s*$/);
  return m ? m[1] : '';
}

function formatCompanyDisplay(company, credit) {
  var embedded = extractCreditFromCompany(company);
  company = stripTrailingCreditFromCompany(company);
  credit = String(credit || '').trim() || embedded;
  if (company && credit) return company + '（' + credit + '）';
  return company || credit || '';
}

function normalizePeriod(raw, defaults) {
  defaults = defaults || {};
  var s = raw && typeof raw === 'object' ? raw : {};
  var periodStart = String(s.period_start || s.periodStart || '').trim();
  var periodEnd = String(s.period_end || s.periodEnd || '').trim();
  var a0 = parseYm(periodStart);
  var b0 = parseYm(periodEnd);
  if (!a0 || !b0) {
    return { error: '缴费起止月份格式应为 YYYY-MM' };
  }
  if (compareYm(a0, b0) > 0) {
    var tmp = periodStart;
    periodStart = periodEnd;
    periodEnd = tmp;
  }
  var baseAmt = Number(s.base_amount != null ? s.base_amount : s.baseAmount);
  if (!isFinite(baseAmt)) baseAmt = Number(defaults.base_amount);
  if (!isFinite(baseAmt)) baseAmt = 4986;
  var pensionPay = Number(s.pension_pay != null ? s.pension_pay : s.pensionPay);
  var unempPay = Number(s.unemployment_pay != null ? s.unemployment_pay : s.unemploymentPay);
  if (!isFinite(pensionPay)) {
    pensionPay = Math.round(baseAmt * 0.08 * 100) / 100;
  }
  if (!isFinite(unempPay)) {
    unempPay = Math.round(baseAmt * 0.005 * 100) / 100;
  }
  return {
    period_start: periodStart,
    period_end: periodEnd,
    base_amount: baseAmt,
    pension_pay: pensionPay,
    unemployment_pay: unempPay
  };
}

function normalizeSegment(raw, defaults) {
  defaults = defaults || {};
  var s = raw && typeof raw === 'object' ? raw : {};
  var company = String(s.company_name || s.company || defaults.company_name || '')
    .trim()
    .substring(0, 128);
  var credit = String(s.credit_code || s.creditCode || defaults.credit_code || '')
    .trim()
    .substring(0, 32);
  if (!credit) {
    credit = extractCreditFromCompany(company);
  }
  company = stripTrailingCreditFromCompany(company).substring(0, 128);
  var area = String(s.area || defaults.area || '余杭区')
    .trim()
    .substring(0, 32);

  /* 同公司可挂多段缴费基数区间；兼容旧版单段字段 */
  var periodsIn = Array.isArray(s.periods) ? s.periods : null;
  var periods = [];
  if (periodsIn && periodsIn.length) {
    var pi;
    for (pi = 0; pi < periodsIn.length; pi++) {
      var per = normalizePeriod(periodsIn[pi], defaults);
      if (per.error) {
        return { error: '缴费区间' + (pi + 1) + '：' + per.error };
      }
      periods.push(per);
    }
  } else if (s.period_start || s.periodStart || s.period_end || s.periodEnd) {
    var singlePer = normalizePeriod(
      {
        period_start: s.period_start || s.periodStart,
        period_end: s.period_end || s.periodEnd,
        base_amount: s.base_amount != null ? s.base_amount : s.baseAmount,
        pension_pay: s.pension_pay != null ? s.pension_pay : s.pensionPay,
        unemployment_pay:
          s.unemployment_pay != null ? s.unemployment_pay : s.unemploymentPay
      },
      defaults
    );
    if (singlePer.error) return singlePer;
    /* 兼容旧 year_bases：拆成按年区间不便，仍交给 buildMonthRows */
    singlePer.year_bases = parseYearBases(s.year_bases || s.yearBases);
    periods.push(singlePer);
  } else {
    return { error: '请至少填写一段缴费起止月份与基数' };
  }

  periods.sort(function (x, y) {
    return compareYm(parseYm(x.period_end), parseYm(y.period_end));
  });
  var lastPer = periods[periods.length - 1];
  var firstPer = periods[0];
  return {
    company_name: company,
    credit_code: credit,
    company_display: formatCompanyDisplay(company, credit),
    area: area,
    periods: periods,
    period_start: firstPer.period_start,
    period_end: lastPer.period_end,
    base_amount: lastPer.base_amount,
    pension_pay: lastPer.pension_pay,
    unemployment_pay: lastPer.unemployment_pay,
    year_bases: lastPer.year_bases || null
  };
}

function normalizePayload(body) {
  var b = body && typeof body === 'object' ? body : {};
  var name = String(b.name || '').trim().substring(0, 64);
  var idNumber = String(b.id_number || b.idNumber || '').trim().substring(0, 32);
  var gender = String(b.gender || '').trim().substring(0, 8) || '女';
  var printDate = String(b.print_date || b.printDate || '').trim() || defaultPrintDateCn();
  var statusPension = String(b.status_pension || '正常参保').trim().substring(0, 32);
  var statusInjury = String(
    b.status_injury || b.status_medical || '正常参保'
  ).trim().substring(0, 32);
  var statusUnemp = String(b.status_unemployment || '正常参保').trim().substring(0, 32);
  if (!name || !idNumber) {
    return { error: '姓名与证件号码必填' };
  }

  var flatDefaults = {
    company_name: String(b.company_name || b.company || '').trim().substring(0, 128),
    credit_code: String(b.credit_code || b.creditCode || '').trim().substring(0, 32),
    area: String(b.area || '余杭区').trim().substring(0, 32),
    base_amount: Number(b.base_amount != null ? b.base_amount : b.baseAmount),
    pension_pay: Number(b.pension_pay != null ? b.pension_pay : b.pensionPay),
    unemployment_pay: Number(
      b.unemployment_pay != null ? b.unemployment_pay : b.unemploymentPay
    )
  };
  if (!isFinite(flatDefaults.base_amount)) flatDefaults.base_amount = 4986;
  if (!isFinite(flatDefaults.pension_pay)) {
    flatDefaults.pension_pay = Math.round(flatDefaults.base_amount * 0.08 * 100) / 100;
  }
  if (!isFinite(flatDefaults.unemployment_pay)) {
    flatDefaults.unemployment_pay = Math.round(flatDefaults.base_amount * 0.005 * 100) / 100;
  }

  var segmentsIn = Array.isArray(b.segments) ? b.segments : [];
  var segments = [];
  var si;
  if (segmentsIn.length) {
    for (si = 0; si < segmentsIn.length; si++) {
      var seg = normalizeSegment(segmentsIn[si], flatDefaults);
      if (seg.error) {
        return { error: '第' + (si + 1) + '段经历：' + seg.error };
      }
      if (!seg.company_name && !seg.credit_code) {
        return { error: '第' + (si + 1) + '段经历：参保单位必填' };
      }
      segments.push(seg);
    }
  } else {
    var single = normalizeSegment(
      {
        company_name: flatDefaults.company_name,
        credit_code: flatDefaults.credit_code,
        area: flatDefaults.area,
        period_start: b.period_start || b.periodStart,
        period_end: b.period_end || b.periodEnd,
        base_amount: flatDefaults.base_amount,
        pension_pay: flatDefaults.pension_pay,
        unemployment_pay: flatDefaults.unemployment_pay,
        year_bases: b.year_bases || b.yearBases,
        periods: b.periods
      },
      flatDefaults
    );
    if (single.error) return { error: single.error };
    segments.push(single);
  }

  segments.sort(function (x, y) {
    return compareYm(parseYm(x.period_end), parseYm(y.period_end));
  });

  /* 基本情况「参保单位」仅展示最近一段经历（按止月最晚） */
  var latest = segments[segments.length - 1];
  var monthsMap = {};
  var months = [];
  for (si = 0; si < segments.length; si++) {
    var sg = segments[si];
    var periods = Array.isArray(sg.periods) && sg.periods.length
      ? sg.periods
      : [
          {
            period_start: sg.period_start,
            period_end: sg.period_end,
            base_amount: sg.base_amount,
            pension_pay: sg.pension_pay,
            unemployment_pay: sg.unemployment_pay,
            year_bases: sg.year_bases
          }
        ];
    var pi;
    for (pi = 0; pi < periods.length; pi++) {
      var per = periods[pi];
      var part = buildMonthRows(per.period_start, per.period_end, {
        credit_code: sg.credit_code,
        unit_code: sg.credit_code,
        area: sg.area,
        base_amount: per.base_amount,
        pension_pay: per.pension_pay,
        unemployment_pay: per.unemployment_pay,
        year_bases: per.year_bases || null,
        company_name: sg.company_name
      });
      var mi;
      for (mi = 0; mi < part.length; mi++) {
        var row = part[mi];
        var key = ymKey(Number(row.year), Number(row.month));
        monthsMap[key] = row;
      }
    }
  }
  Object.keys(monthsMap)
    .map(Number)
    .sort(function (a, b) {
      return a - b;
    })
    .forEach(function (k) {
      months.push(monthsMap[k]);
    });
  if (months.length > 48) {
    months = months.slice(months.length - 48);
  }
  if (!months.length) {
    return { error: '缴费月份区间无效' };
  }

  var overallStart = months[0];
  var overallEnd = months[months.length - 1];
  var periodStart =
    overallStart.year + '-' + String(overallStart.month).padStart(2, '0');
  var periodEnd = overallEnd.year + '-' + String(overallEnd.month).padStart(2, '0');

  return {
    name: name,
    id_number: idNumber,
    gender: gender,
    id_type: '居民身份证',
    company_name: latest.company_name,
    company_display: latest.company_display || formatCompanyDisplay(latest.company_name, latest.credit_code),
    credit_code: latest.credit_code,
    area: latest.area,
    period_start: periodStart,
    period_end: periodEnd,
    period_label:
      formatYmCn(Number(overallStart.year), Number(overallStart.month)) +
      '-' +
      formatYmCn(Number(overallEnd.year), Number(overallEnd.month)),
    base_amount: latest.base_amount,
    pension_pay: latest.pension_pay,
    unemployment_pay: latest.unemployment_pay,
    print_date: printDate,
    status_pension: statusPension,
    status_injury: statusInjury,
    status_medical: statusInjury,
    status_unemployment: statusUnemp,
    segments: segments,
    months: months,
    layout: 'zj_official_v2'
  };
}

function publicOriginFromReq(req) {
  /* 社保专用域名优先：仅改链接文案/二维码，不改主站 PUBLIC_SITE_URL */
  var sbdyOnly = String(SBDY_PUBLIC_ORIGIN || '').replace(/\/+$/, '');
  if (sbdyOnly) {
    return sbdyOnly;
  }
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
          '<tr class="sec sec-plain"><th colspan="12">参加社会保险基本情况</th></tr>' +
          '<tr class="basic">' +
          '<th class="lab" colspan="3">险　　种</th>' +
          '<th class="ins" colspan="3">养老保险</th><th class="ins" colspan="3">工伤保险</th><th class="ins" colspan="3">失业保险</th>' +
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
    'table.cert tr.sec-plain th{font-weight:400}' +
    'table.cert tr.info th{white-space:nowrap;font-size:12px}' +
    'table.cert tr.info td{font-size:12px}' +
    'table.cert tr.basic th.lab{white-space:nowrap;font-size:12px}' +
    'table.cert tr.basic th.ins{font-weight:400;font-size:12px}' +
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
