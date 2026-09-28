/**
 * 演示 APP 纳税/个税记录二维码载荷（非国税总局官方格式）。
 *
 * A. 本站纳税记录凭证已打印的核验 URL（najilu.js → buildCertificateVerifyUrl）：
 *    https://<origin>/najilu.html?view=verify&code=XXXXXXXXXXXXXXXX
 *    相对路径 najilu.html?view=verify&code=… 同样有效。
 *    亦接受裸 16 位查询验证码 [A-Z0-9]{16}（与凭证「查询验证码」一致）。
 *    → 打开 najilu 核验页，展示已开具纳税记录摘要。
 *
 * B. 演示导入/生成载荷 TP1.<base64url(JSON)>
 *    {
 *      v: 1,
 *      kind: 'taxrec',
 *      code?: 'XXXXXXXXXXXXXXXX',
 *      period_start?: '2025-01',
 *      period_end?: '2025-12',
 *      records: [{ year, month, income_type, company_name, income, tax_reported, income_this_period }]
 *    }
 *    → 登录后 POST /api/tax action=batch_save_records 写入个税记录，再进入纳税记录开具页以便生成凭证。
 *
 * encodeTaxQrPayload / parseTaxQrPayload 为编解码入口（单测见 tax-qr-payload.test.js）。
 */
(function (global) {
  var QUERY_CODE_RE = /^[A-Z0-9]{16}$/;
  var TP1_PREFIX = 'TP1.';

  function cleanText(v) {
    return String(v == null ? '' : v).trim();
  }

  function normalizeQueryCode(raw) {
    return cleanText(raw).replace(/\s+/g, '').toUpperCase();
  }

  function isQueryCode(raw) {
    return QUERY_CODE_RE.test(normalizeQueryCode(raw));
  }

  function b64urlEncode(str) {
    var utf8 = unescape(encodeURIComponent(String(str)));
    var b64;
    if (typeof btoa === 'function') {
      b64 = btoa(utf8);
    } else if (typeof Buffer !== 'undefined') {
      b64 = Buffer.from(String(str), 'utf8').toString('base64');
    } else {
      throw new Error('no base64 encoder');
    }
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function b64urlDecode(raw) {
    var s = String(raw || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin;
    if (typeof atob === 'function') {
      bin = atob(s);
    } else if (typeof Buffer !== 'undefined') {
      return Buffer.from(s, 'base64').toString('utf8');
    } else {
      throw new Error('no base64 decoder');
    }
    try {
      return decodeURIComponent(escape(bin));
    } catch (e1) {
      return bin;
    }
  }

  function verifyHref(code) {
    return 'najilu.html?view=verify&code=' + encodeURIComponent(code);
  }

  function verifyResult(code) {
    return {
      ok: true,
      type: 'verify',
      code: code,
      href: verifyHref(code)
    };
  }

  function pickSearch(rawUrl) {
    var s = String(rawUrl || '');
    var qAt = s.indexOf('?');
    if (qAt < 0) return '';
    var q = s.slice(qAt + 1);
    var hashAt = q.indexOf('#');
    if (hashAt >= 0) q = q.slice(0, hashAt);
    return q;
  }

  function looksLikeNajiluPath(rawUrl) {
    var path = String(rawUrl || '').split('?')[0].split('#')[0];
    return /(?:^|[/:])najilu\.html$/i.test(path) || /najilu\.html$/i.test(path);
  }

  function parseVerifyUrl(raw) {
    var s = cleanText(raw);
    if (!s) return null;
    var q = '';
    try {
      if (/^https?:\/\//i.test(s) || s.indexOf('najilu.html') >= 0) {
        if (!looksLikeNajiluPath(s) && !/najilu\.html/i.test(s)) {
          return null;
        }
        q = pickSearch(s);
      }
    } catch (e0) {
      q = '';
    }
    if (!q) return null;
    var view = '';
    var code = '';
    var parts = q.split('&');
    var i;
    for (i = 0; i < parts.length; i++) {
      var kv = parts[i].split('=');
      var key = decodeURIComponent(kv[0] || '').toLowerCase();
      var val = '';
      try {
        val = decodeURIComponent((kv.slice(1).join('=') || '').replace(/\+/g, ' '));
      } catch (e1) {
        val = kv.slice(1).join('=') || '';
      }
      if (key === 'view') view = val;
      if (key === 'code') code = normalizeQueryCode(val);
    }
    if (view === 'verify' && isQueryCode(code)) {
      return verifyResult(code);
    }
    return null;
  }

  function sanitizeRecord(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var year = parseInt(raw.year, 10);
    var month = parseInt(raw.month, 10);
    if (!year || year < 1 || year > 9999) return null;
    if (!month || month < 1 || month > 12) return null;
    var income = Number(raw.income);
    if (!isFinite(income)) income = 0;
    var tax = Number(raw.tax_reported != null ? raw.tax_reported : raw.tax);
    if (!isFinite(tax)) tax = 0;
    var periodIncome = Number(raw.income_this_period != null ? raw.income_this_period : income);
    if (!isFinite(periodIncome)) periodIncome = income;
    return {
      year: year,
      month: month,
      income_type: cleanText(raw.income_type) || '工资薪金',
      income_subtype: cleanText(raw.income_subtype) || '正常工资薪金',
      company_name: cleanText(raw.company_name) || '演示扣缴义务人',
      company_tax_id: cleanText(raw.company_tax_id),
      tax_authority: cleanText(raw.tax_authority),
      report_channel: cleanText(raw.report_channel) || '其他',
      report_date: cleanText(raw.report_date),
      tax_period: cleanText(raw.tax_period),
      income: income,
      tax_reported: tax,
      income_this_period: periodIncome
    };
  }

  function parseTp1(raw) {
    var s = cleanText(raw);
    if (s.indexOf(TP1_PREFIX) !== 0) return null;
    var jsonText;
    try {
      jsonText = b64urlDecode(s.slice(TP1_PREFIX.length));
    } catch (e0) {
      return { ok: false, reason: '演示载荷无法解码' };
    }
    var data;
    try {
      data = JSON.parse(jsonText);
    } catch (e1) {
      return { ok: false, reason: '演示载荷不是合法 JSON' };
    }
    if (!data || data.v !== 1 || data.kind !== 'taxrec') {
      return { ok: false, reason: '不支持的演示载荷版本' };
    }
    var code = data.code ? normalizeQueryCode(data.code) : '';
    if (code && !isQueryCode(code)) {
      return { ok: false, reason: '演示载荷查询验证码格式无效' };
    }
    var records = [];
    var src = Array.isArray(data.records) ? data.records : [];
    var i;
    for (i = 0; i < src.length; i++) {
      var rec = sanitizeRecord(src[i]);
      if (rec) records.push(rec);
    }
    return {
      ok: true,
      type: 'taxrec',
      code: code,
      period_start: cleanText(data.period_start),
      period_end: cleanText(data.period_end),
      records: records,
      href: code ? verifyHref(code) : 'najilu.html?from=scan'
    };
  }

  function parseTaxQrPayload(raw) {
    var s = cleanText(raw);
    if (!s) {
      return { ok: false, reason: '空二维码' };
    }
    if (isQueryCode(s)) {
      return verifyResult(normalizeQueryCode(s));
    }
    var fromUrl = parseVerifyUrl(s);
    if (fromUrl) return fromUrl;
    if (s.indexOf(TP1_PREFIX) === 0) {
      return parseTp1(s);
    }
    return { ok: false, reason: '无法识别该二维码' };
  }

  function encodeTaxQrPayload(input) {
    var src = input && typeof input === 'object' ? input : {};
    var records = [];
    var list = Array.isArray(src.records) ? src.records : [];
    var i;
    for (i = 0; i < list.length; i++) {
      var rec = sanitizeRecord(list[i]);
      if (rec) records.push(rec);
    }
    var body = {
      v: 1,
      kind: 'taxrec',
      records: records
    };
    var code = src.code ? normalizeQueryCode(src.code) : '';
    if (isQueryCode(code)) body.code = code;
    if (cleanText(src.period_start)) body.period_start = cleanText(src.period_start);
    if (cleanText(src.period_end)) body.period_end = cleanText(src.period_end);
    return TP1_PREFIX + b64urlEncode(JSON.stringify(body));
  }

  function demoTaxQrPayload() {
    return encodeTaxQrPayload({
      code: 'DEMOQRTAXREC0001',
      period_start: '2025-01',
      period_end: '2025-03',
      records: [
        {
          year: 2025,
          month: 1,
          company_name: '演示科技有限公司',
          income: 15000,
          tax_reported: 260,
          income_this_period: 15000
        },
        {
          year: 2025,
          month: 2,
          company_name: '演示科技有限公司',
          income: 15000,
          tax_reported: 260,
          income_this_period: 15000
        }
      ]
    });
  }

  global.TAX_QR_TP1_PREFIX = TP1_PREFIX;
  global.isTaxQrQueryCode = isQueryCode;
  global.parseTaxQrPayload = parseTaxQrPayload;
  global.encodeTaxQrPayload = encodeTaxQrPayload;
  global.demoTaxQrPayload = demoTaxQrPayload;
})(typeof window !== 'undefined' ? window : global);
