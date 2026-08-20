/** Admin module: 社保演示生成
 * UX：预填 → 分步表单 → 生成结果可预览/复制（参考 QR 平台与参保证明字段口径）
 */
(function (global) {
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fetchAdmin(url, opts) {
    var fn = global.adminFetch;
    if (typeof fn !== 'function') {
      return Promise.reject(new Error('adminFetch unavailable'));
    }
    return fn(url, opts);
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function num(id, fallback) {
    var n = Number(val(id));
    return isFinite(n) ? n : fallback;
  }

  function setField(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = value == null ? '' : String(value);
  }

  /** 兼容 type=month 与手填「2026年01月」 */
  function normalizeYm(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    var m = s.match(/^(\d{4})-(\d{1,2})$/);
    if (m) return m[1] + '-' + String(Number(m[2])).padStart(2, '0');
    m = s.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月?$/);
    if (m) return m[1] + '-' + String(Number(m[2])).padStart(2, '0');
    m = s.match(/^(\d{4})[\/.](\d{1,2})$/);
    if (m) return m[1] + '-' + String(Number(m[2])).padStart(2, '0');
    return s;
  }

  function setStatus(msg, isErr) {
    var status = document.getElementById('sbdyDemoStatus');
    if (status) {
      status.textContent = msg || '';
      status.style.color = isErr ? '#b91c1c' : '';
    }
  }

  function currentRegion() {
    var sz = document.getElementById('sbdyRegionSz');
    var wh = document.getElementById('sbdyRegionWh');
    if (sz && sz.checked) return 'sz';
    if (wh && wh.checked) return 'wh';
    return 'zj';
  }

  function syncRegionUi() {
    var region = currentRegion();
    document.querySelectorAll('.sbdy-zj-only').forEach(function (el) {
      el.hidden = region !== 'zj';
    });
    document.querySelectorAll('.sbdy-sz-only').forEach(function (el) {
      el.hidden = region !== 'sz';
    });
    document.querySelectorAll('.sbdy-wh-only').forEach(function (el) {
      el.hidden = region !== 'wh';
    });
    document.querySelectorAll('.sbdy-sz-wh').forEach(function (el) {
      el.hidden = region !== 'sz' && region !== 'wh';
    });
    document.querySelectorAll('.sbdy-zj-wh').forEach(function (el) {
      el.hidden = region !== 'zj' && region !== 'wh';
    });
    var base = document.getElementById('sbdyBase');
    var area = document.getElementById('sbdyArea');
    if (region === 'sz') {
      if (base && (String(base.value) === '4986' || String(base.value) === '6120' || String(base.value) === '4224')) {
        base.value = '4492';
      }
      if (area && (area.value === '余杭区' || area.value === '武汉市')) area.value = '深圳市';
    } else if (region === 'wh') {
      if (base && (String(base.value) === '4986' || String(base.value) === '4492' || String(base.value) === '6120')) {
        base.value = '4224';
      }
      if (area && (area.value === '余杭区' || area.value === '深圳市')) area.value = '武汉市';
      var insure = document.getElementById('sbdyInsureType');
      if (insure && !insure.value) insure.value = '企业养老';
    } else {
      if (base && (String(base.value) === '4492' || String(base.value) === '6120' || String(base.value) === '4224')) {
        base.value = '4986';
      }
      if (area && (area.value === '深圳市' || area.value === '武汉市')) area.value = '余杭区';
    }
    var med = document.getElementById('sbdyMedicalBase');
    if (region === 'sz' && med && !med.value) med.value = base ? base.value : '4492';
  }

  function setBusy(busy) {
    var btn = document.getElementById('btnSbdyDemoGenerate');
    if (btn) {
      btn.disabled = !!busy;
      btn.textContent = busy ? '生成中…' : '生成演示样例';
    }
    var pasteGen = document.getElementById('btnSbdyPasteGenerate');
    if (pasteGen) pasteGen.disabled = !!busy;
  }

  function genderFromId(id) {
    var s = String(id || '').trim();
    if (s.length === 18 && /^\d{17}[\dXx]$/.test(s)) {
      return Number(s.charAt(16)) % 2 === 0 ? '女' : '男';
    }
    if (s.length === 15 && /^\d{15}$/.test(s)) {
      return Number(s.charAt(14)) % 2 === 0 ? '女' : '男';
    }
    return '';
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function ymToNum(ym) {
    var m = String(ym || '').match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    return Number(m[1]) * 12 + Number(m[2]);
  }

  function numToYm(n) {
    var y = Math.floor((n - 1) / 12);
    var mo = ((n - 1) % 12) + 1;
    return y + '-' + pad2(mo);
  }

  function monthCountBetween(startYm, endYm) {
    var a = ymToNum(startYm);
    var b = ymToNum(endYm);
    if (a == null || b == null || b < a) return 0;
    return b - a + 1;
  }

  function shiftStartForCount(endYm, count) {
    var end = ymToNum(endYm);
    var n = Math.max(1, Math.min(48, Number(count) || 12));
    if (end == null) return '';
    return numToYm(end - n + 1);
  }

  function expandYear(y) {
    var n = Number(y);
    if (!isFinite(n)) return null;
    if (n < 100) n += 2000;
    if (n < 1990 || n > 2100) return null;
    return n;
  }

  function parseOneYm(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    var m = s.match(/^(\d{2,4})\s*[.\-\/年]\s*(\d{1,2})\s*月?$/);
    if (m) {
      var y = expandYear(m[1]);
      var mo = Number(m[2]);
      if (y && mo >= 1 && mo <= 12) return y + '-' + pad2(mo);
    }
    return normalizeYm(s);
  }

  function parsePeriodText(raw) {
    var s = String(raw || '').trim();
    if (!s) return null;
    s = s.replace(/\s+/g, '');
    var m = s.match(
      /(\d{2,4})[.\-\/年]?(\d{1,2})月?(?:到|至|-|~|—|～)(\d{2,4})[.\-\/年]?(\d{1,2})月?/
    );
    if (!m) return null;
    var y1 = expandYear(m[1]);
    var mo1 = Number(m[2]);
    var y2 = expandYear(m[3]);
    var mo2 = Number(m[4]);
    if (!y1 || !y2 || mo1 < 1 || mo1 > 12 || mo2 < 1 || mo2 > 12) return null;
    return {
      start: y1 + '-' + pad2(mo1),
      end: y2 + '-' + pad2(mo2)
    };
  }

  function pickLabeled(text, labels) {
    var lines = String(text || '').split(/\r?\n/);
    var i;
    for (i = 0; i < lines.length; i++) {
      var line = String(lines[i] || '').trim();
      if (!line) continue;
      var j;
      for (j = 0; j < labels.length; j++) {
        var lab = labels[j];
        var re = new RegExp('^(?:' + lab + ')\\s*[:：]?\\s*(.*)$', 'i');
        var m = line.match(re);
        if (m) {
          var v = String(m[1] || '').trim();
          if (v) return v;
        }
      }
    }
    return '';
  }

  function extractIdNumber(text) {
    var labeled = pickLabeled(text, ['身份证号', '证件号码', '身份证', '证件号']);
    var m = String(labeled || text || '').match(/\b(\d{17}[\dXx]|\d{15})\b/);
    return m ? m[1].toUpperCase() : '';
  }

  function extractCreditCode(text) {
    var labeled = pickLabeled(text, [
      '税号',
      '统一社会信用代码',
      '信用代码',
      '社会信用代码',
      '组织机构代码'
    ]);
    var src = labeled || text || '';
    var m = String(src).match(/\b([0-9A-Z]{15,20})\b/i);
    if (m && !/^\d{15}$/.test(m[1]) && !/^\d{17}[\dXx]$/i.test(m[1])) {
      return m[1].toUpperCase();
    }
    if (labeled) {
      m = String(labeled).match(/([0-9A-Za-z]{15,20})/);
      return m ? m[1].toUpperCase() : labeled;
    }
    return '';
  }

  function extractMonthCount(text) {
    var labeled = pickLabeled(text, ['参保数', '缴费月数', '月数', '参保月数']);
    var src = labeled || '';
    var m = String(src).match(/(\d{1,2})\s*个?月?/);
    if (m) return Number(m[1]);
    m = String(text || '').match(/参保数\s*[:：]?\s*(\d{1,2})\s*个?月/);
    if (m) return Number(m[1]);
    return 0;
  }

  function wantsActiveStatus(text) {
    var s = String(text || '');
    if (/不要停保|别停保|正常参保|参保缴费|正常缴费|在保/.test(s)) return true;
    if (/暂停缴费|已停保|停保(?!不要)|中断缴费/.test(s)) return false;
    return true;
  }

  function defaultPrintDateCn() {
    var bj = new Date(Date.now() + 8 * 3600 * 1000);
    return (
      bj.getUTCFullYear() +
      '年' +
      pad2(bj.getUTCMonth() + 1) +
      '月' +
      pad2(bj.getUTCDate()) +
      '日'
    );
  }

  /**
   * 解析粘贴模版 → 表单字段对象
   * 支持刚才运营常用的「姓名/身份证/时间/参保数/区域/公司/税号」文本块
   */
  function parsePasteTemplate(raw) {
    var text = String(raw || '').trim();
    if (!text) return { error: '请先粘贴模版文本' };

    var name = pickLabeled(text, ['姓名', '名字', '参保人']);
    var idNumber = extractIdNumber(text);
    var gender =
      pickLabeled(text, ['性别']) ||
      genderFromId(idNumber) ||
      '';
    if (gender && !/[男女]/.test(gender)) {
      gender = /女/.test(gender) ? '女' : /男/.test(gender) ? '男' : genderFromId(idNumber);
    } else if (gender) {
      gender = /女/.test(gender) ? '女' : '男';
    }

    var company = pickLabeled(text, ['公司名称', '参保单位', '单位名称', '单位', '公司']);
    var credit = extractCreditCode(text);
    var area = pickLabeled(text, ['区域', '参保地', '地区', '区县']);
    if (area) area = area.replace(/[。.;；]+$/, '');

    var periodRaw =
      pickLabeled(text, ['时间', '缴费时间', '参保时间', '缴费区间', '期间', '起止']) || '';
    var period = parsePeriodText(periodRaw);
    if (!period) period = parsePeriodText(text);

    var monthCnt = extractMonthCount(text);
    if (period && monthCnt > 0) {
      var actual = monthCountBetween(period.start, period.end);
      if (actual !== monthCnt) {
        /* 以止月为准，按参保数回推起月（运营常见：写 8-6 但要 12 个月） */
        period.start = shiftStartForCount(period.end, monthCnt);
      }
    } else if (!period && monthCnt > 0) {
      var endFallback = normalizeYm(val('sbdyPeriodEnd')) || parseOneYm(periodRaw);
      if (!endFallback) {
        var bj = new Date(Date.now() + 8 * 3600 * 1000);
        var ey = bj.getUTCFullYear();
        var em = bj.getUTCMonth(); /* 0-11 → 上月更贴近「已出账」 */
        if (em === 0) {
          ey -= 1;
          em = 12;
        }
        endFallback = ey + '-' + pad2(em);
      }
      period = {
        start: shiftStartForCount(endFallback, monthCnt),
        end: endFallback
      };
    }

    var unitCode = pickLabeled(text, ['单位编号', '社保单位编号']);
    var computerNo = pickLabeled(text, ['社保电脑号', '电脑号']);
    var personNo = pickLabeled(text, ['个人编号', '社保个人编号']);
    var insureType = pickLabeled(text, ['参保险种', '险种']);
    var looksWh = !!(
      personNo ||
      /武汉|湖北|企业养老|湖北省社会保险|个人编号/.test(text)
    );
    var looksSz = !!(
      unitCode ||
      computerNo ||
      /深圳市社会保险|深圳社保|社保电脑号/.test(text)
    );
    if (looksWh && /深圳/.test(text) && !/武汉|湖北/.test(text)) looksWh = false;
    var region = looksWh ? 'wh' : looksSz ? 'sz' : 'zj';
    var baseRaw = pickLabeled(text, ['医保基数', '医疗保险基数', '缴费基数', '基数']);
    var base = baseRaw ? Number(String(baseRaw).replace(/[^\d.]/g, '')) : NaN;
    if (!isFinite(base) || base <= 0) {
      var fromForm = Number(val('sbdyBase'));
      base = isFinite(fromForm) && fromForm > 0 ? fromForm : region === 'sz' ? 4492 : region === 'wh' ? 4224 : 4986;
    }
    var pension = Math.round(base * 0.08 * 100) / 100;
    var unemp = Math.round(base * (region === 'sz' ? 0.002 : 0.005) * 100) / 100;

    var active = wantsActiveStatus(text);
    var status = active ? '正常参保' : '暂停缴费';

    if (!name) return { error: '模版中未识别到姓名' };
    if (!idNumber) return { error: '模版中未识别到身份证号' };
    if (!period || !period.start || !period.end) {
      return { error: '模版中未识别到缴费时间（如 2025.7-2026.6）' };
    }

    return {
      region: region,
      name: name,
      id_number: idNumber,
      gender: gender || genderFromId(idNumber) || '女',
      company_name: company,
      credit_code: credit,
      unit_code: unitCode,
      computer_no: computerNo,
      person_no: personNo,
      insurance_type: insureType || (region === 'wh' ? '企业养老' : ''),
      area: area || (region === 'sz' ? '深圳市' : region === 'wh' ? '武汉市' : '余杭区'),
      period_start: period.start,
      period_end: period.end,
      month_count: monthCountBetween(period.start, period.end),
      base_amount: base,
      medical_base: base,
      pension_pay: pension,
      unemployment_pay: unemp,
      status: status,
      print_date: defaultPrintDateCn()
    };
  }

  function applyParsedToForm(parsed) {
    if (parsed.region === 'sz') {
      var szRadio = document.getElementById('sbdyRegionSz');
      if (szRadio) szRadio.checked = true;
    } else if (parsed.region === 'wh') {
      var whRadio = document.getElementById('sbdyRegionWh');
      if (whRadio) whRadio.checked = true;
    } else if (parsed.region === 'zj') {
      var zjRadio = document.getElementById('sbdyRegionZj');
      if (zjRadio) zjRadio.checked = true;
    }
    syncRegionUi();
    setField('sbdyName', parsed.name);
    setField('sbdyIdNumber', parsed.id_number);
    setField('sbdyGender', parsed.gender || '女');
    setField('sbdyCompany', parsed.company_name || '');
    setField('sbdyCredit', parsed.credit_code || '');
    setField(
      'sbdyArea',
      parsed.area ||
        (parsed.region === 'sz' ? '深圳市' : parsed.region === 'wh' ? '武汉市' : '余杭区')
    );
    setField('sbdyUnitCode', parsed.unit_code || '');
    setField('sbdyComputerNo', parsed.computer_no || '');
    setField('sbdyPersonNo', parsed.person_no || '');
    setField('sbdyInsureType', parsed.insurance_type || (parsed.region === 'wh' ? '企业养老' : ''));
    setField('sbdyPeriodStart', parsed.period_start);
    setField('sbdyPeriodEnd', parsed.period_end);
    setField('sbdyBase', parsed.base_amount);
    if (parsed.medical_base) setField('sbdyMedicalBase', parsed.medical_base);
    setField('sbdyPensionPay', parsed.pension_pay);
    setField('sbdyUnempPay', parsed.unemployment_pay);
    setField('sbdyStatusPension', parsed.status);
    setField('sbdyStatusMedical', parsed.status);
    setField('sbdyStatusInjury', parsed.status);
    setField('sbdyStatusUnemp', parsed.status);
    setField('sbdyPrintDate', parsed.print_date || '');
  }

  function pasteFillOnly() {
    var ta = document.getElementById('sbdyPasteTemplate');
    var parsed = parsePasteTemplate(ta ? ta.value : '');
    if (parsed.error) {
      setStatus(parsed.error, true);
      return null;
    }
    applyParsedToForm(parsed);
    setStatus(
      '已解析：' +
        parsed.name +
        ' · ' +
        parsed.period_start +
        '～' +
        parsed.period_end +
        '（' +
        parsed.month_count +
        '个月）· ' +
        parsed.status,
      false
    );
    return parsed;
  }

  function pasteAndGenerate() {
    var parsed = pasteFillOnly();
    if (!parsed) return;
    generate();
  }

  function clearPasteTemplate() {
    var el = document.getElementById('sbdyPasteTemplate');
    if (el) el.value = '';
    setStatus('模版已清空', false);
  }

  function copyText(text) {
    var t = String(text || '');
    if (!t) return Promise.reject(new Error('empty'));
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(t);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        resolve();
      } catch (e) {
        reject(e);
      } finally {
        ta.remove();
      }
    });
  }

  /** DB created_at 按 UTC 存，列表展示北京时间（+8） */
  function formatBjTime(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return '—';
    s = s.replace('T', ' ').replace(/\.\d+Z?$/, '').replace(/Z$/, '');
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
    if (!m) return s.slice(0, 19);
    var utcMs = Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6])
    );
    var bj = new Date(utcMs + 8 * 3600 * 1000);
    function p2(n) {
      return String(n).padStart(2, '0');
    }
    return (
      bj.getUTCFullYear() +
      '-' +
      p2(bj.getUTCMonth() + 1) +
      '-' +
      p2(bj.getUTCDate()) +
      ' ' +
      p2(bj.getUTCHours()) +
      ':' +
      p2(bj.getUTCMinutes()) +
      ':' +
      p2(bj.getUTCSeconds())
    );
  }

  function fillDefaults() {
    var now = new Date();
    var endY = now.getFullYear();
    var endM = now.getMonth();
    if (endM === 0) {
      endY -= 1;
      endM = 12;
    }
    var startY = endY;
    var startM = endM - 11;
    while (startM <= 0) {
      startM += 12;
      startY -= 1;
    }
    var ps = document.getElementById('sbdyPeriodStart');
    var pe = document.getElementById('sbdyPeriodEnd');
    if (ps && !ps.value) {
      ps.value = startY + '-' + String(startM).padStart(2, '0');
    }
    if (pe && !pe.value) {
      pe.value = endY + '-' + String(endM).padStart(2, '0');
    }
  }

  function renderList(list) {
    var tbody = document.getElementById('sbdyDemoListTbody');
    if (!tbody) return;
    if (!list || !list.length) {
      tbody.innerHTML = '<tr><td colspan="7">暂无记录</td></tr>';
      return;
    }
    var html = '';
    list.forEach(function (row) {
      var links = row.links || {};
      var region = row.region === 'sz' ? '深圳' : row.region === 'wh' ? '武汉' : '浙江';
      html +=
        '<tr>' +
        '<td>' +
        esc(formatBjTime(row.created_at)) +
        '</td>' +
        '<td>' +
        esc(region) +
        '</td>' +
        '<td>' +
        esc(row.name || '—') +
        '</td>' +
        '<td class="cell-break"><code>' +
        esc(row.id_number || '—') +
        '</code></td>' +
        '<td class="cell-break">' +
        esc(row.company_name || '—') +
        '</td>' +
        '<td class="cell-break"><code>' +
        esc(row.auth_code || '') +
        '</code></td>' +
        '<td class="cell-break">' +
        (links.show_url
          ? '<a href="' + esc(links.show_url) + '" target="_blank" rel="noopener">样例</a> · '
          : '') +
        (links.verify_url
          ? '<a href="' + esc(links.verify_url) + '" target="_blank" rel="noopener">核验</a>'
          : '') +
        '</td></tr>';
    });
    tbody.innerHTML = html;
  }

  function loadList() {
    fetchAdmin('api/admin/sbdy-demo/list?limit=30')
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (j && j.code === 200 && j.data) {
          renderList(j.data.list || []);
        } else {
          renderList([]);
          setStatus((j && j.msg) || '列表加载失败', true);
        }
      })
      .catch(function (e) {
        renderList([]);
        setStatus('列表加载失败：' + (e && e.message ? e.message : '网络错误'), true);
      });
  }

  function renderResult(d) {
    var result = document.getElementById('sbdyDemoResult');
    if (!result) return;
    var links = d.links || {};
    result.hidden = false;
    result.innerHTML =
      '<div class="admin-tool-result-head">' +
      '<strong>已生成演示样例</strong>' +
      '<span class="hint">' +
      ((d.payload && d.payload.region === 'wh') ? '非正式证明' : '非正式证明 · 带水印') +
      '</span>' +
      '</div>' +
      '<p class="stat mb-8">' +
      ((d.payload && d.payload.region === 'sz') ? '验真码：' : '授权码：') +
      '<code id="sbdyResultAuth">' +
      esc(d.auth_code || '') +
      '</code></p>' +
      '<div class="form-actions">' +
      (links.show_url
        ? '<a class="btn-primary" href="' +
          esc(links.show_url) +
          '" target="_blank" rel="noopener">打开 PDF 样例</a>'
        : '') +
      (links.verify_url
        ? '<a class="btn-page" href="' +
          esc(links.verify_url) +
          '" target="_blank" rel="noopener">打开核验页</a>'
        : '') +
      '<button type="button" class="btn-page" id="sbdyCopyAuth">复制授权码</button>' +
      (links.show_url
        ? '<button type="button" class="btn-page" id="sbdyCopyShow" data-url="' +
          esc(links.show_url) +
          '">复制样例链接</button>'
        : '') +
      (links.verify_url
        ? '<button type="button" class="btn-page" id="sbdyCopyVerify" data-url="' +
          esc(links.verify_url) +
          '">复制核验链接</button>'
        : '') +
      '</div>';
    var copyAuth = document.getElementById('sbdyCopyAuth');
    if (copyAuth) {
      copyAuth.onclick = function () {
        copyText(d.auth_code || '')
          .then(function () {
            setStatus('授权码已复制', false);
          })
          .catch(function () {
            setStatus('复制失败', true);
          });
      };
    }
    ;['sbdyCopyShow', 'sbdyCopyVerify'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (!btn) return;
      btn.onclick = function () {
        copyText(btn.getAttribute('data-url') || '')
          .then(function () {
            setStatus('链接已复制', false);
          })
          .catch(function () {
            setStatus('复制失败', true);
          });
      };
    });
  }

  function generate() {
    var region = currentRegion();
    var defaultBase = region === 'sz' ? 4492 : region === 'wh' ? 4224 : 4986;
    var defaultArea = region === 'sz' ? '深圳市' : region === 'wh' ? '武汉市' : '余杭区';
    var body = {
      region: region,
      name: val('sbdyName'),
      id_number: val('sbdyIdNumber'),
      gender: val('sbdyGender') || genderFromId(val('sbdyIdNumber')) || '女',
      company_name: val('sbdyCompany'),
      credit_code: val('sbdyCredit'),
      area: val('sbdyArea') || defaultArea,
      unit_code: val('sbdyUnitCode'),
      computer_no: val('sbdyComputerNo'),
      person_no: val('sbdyPersonNo'),
      insurance_type: val('sbdyInsureType') || (region === 'wh' ? '企业养老' : ''),
      period_start: normalizeYm(val('sbdyPeriodStart')),
      period_end: normalizeYm(val('sbdyPeriodEnd')),
      base_amount: num('sbdyBase', defaultBase),
      pension_base: num('sbdyBase', 4492),
      medical_base: num('sbdyMedicalBase', num('sbdyBase', 4492)),
      pension_pay: num('sbdyPensionPay', 398.88),
      unemployment_pay: num('sbdyUnempPay', 24.93),
      status_pension: val('sbdyStatusPension') || '正常参保',
      status_medical: val('sbdyStatusMedical') || val('sbdyStatusPension') || '正常参保',
      status_injury: val('sbdyStatusInjury') || '正常参保',
      status_unemployment: val('sbdyStatusUnemp') || '正常参保',
      print_date: val('sbdyPrintDate')
    };
    if (!body.name || !body.id_number) {
      setStatus('请填写上方「姓名」与「证件号码」', true);
      var nameEl = document.getElementById('sbdyName');
      if (nameEl && nameEl.scrollIntoView) nameEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!body.period_start || !body.period_end) {
      setStatus('请选择缴费起止月份', true);
      return;
    }
    setBusy(true);
    setStatus('生成中…', false);
    var result = document.getElementById('sbdyDemoResult');
    if (result) {
      result.hidden = true;
      result.innerHTML = '';
    }
    fetchAdmin('api/admin/sbdy-demo/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { http: r.status, j: j };
        });
      })
      .then(function (pack) {
        var j = pack.j;
        if (!j || j.code !== 200 || !j.data) {
          setStatus((j && j.msg) || '生成失败（HTTP ' + pack.http + '）', true);
          return;
        }
        setStatus('已生成演示样例（非正式证明）', false);
        renderResult(j.data);
        loadList();
      })
      .catch(function (e) {
        setStatus('生成失败：' + (e && e.message ? e.message : '网络错误'), true);
      })
      .then(function () {
        setBusy(false);
      });
  }

  function fillSample() {
    var now = new Date();
    var bj = new Date(now.getTime() + 8 * 3600 * 1000);
    var endY = bj.getUTCFullYear();
    var endM = bj.getUTCMonth() + 1;
    endM -= 1;
    if (endM <= 0) {
      endM += 12;
      endY -= 1;
    }
    var startY = endY;
    var startM = endM - 11;
    while (startM <= 0) {
      startM += 12;
      startY -= 1;
    }
    var printDate =
      bj.getUTCFullYear() +
      '年' +
      String(bj.getUTCMonth() + 1).padStart(2, '0') +
      '月' +
      String(bj.getUTCDate()).padStart(2, '0') +
      '日';
    if (currentRegion() === 'wh') {
      setField('sbdyName', '杨大富');
      setField('sbdyIdNumber', '420881196305166819');
      setField('sbdyGender', '男');
      setField('sbdyCompany', '武汉美艺印刷包装有限公司');
      setField('sbdyUnitCode', '100702889');
      setField('sbdyPersonNo', '10055751664');
      setField('sbdyInsureType', '企业工伤');
      setField('sbdyArea', '武汉市');
      setField('sbdyPeriodStart', '2022-08');
      setField('sbdyPeriodEnd', '2024-09');
      setField('sbdyBase', 4224);
      setField('sbdyPrintDate', '2025年02月19日');
      setStatus('已填充武汉示例：杨大富（可再点生成）', false);
      return;
    }
    if (currentRegion() === 'sz') {
      var szSamples = [
        {
          name: '林晓薇',
          id_number: '440305199208156018',
          gender: '女',
          company: '深圳市南山区云启信息技术有限公司',
          unit_code: '44018826',
          computer_no: '089216473',
          base: 4492
        },
        {
          name: '周浩然',
          id_number: '440304199511083517',
          gender: '男',
          company: '深圳前海星河数据科技有限公司',
          unit_code: '44019907',
          computer_no: '076543210',
          base: 5280
        }
      ];
      var sz =
        Math.random() < 0.6 ? szSamples[0] : szSamples[Math.floor(Math.random() * szSamples.length)];
      setField('sbdyName', sz.name);
      setField('sbdyIdNumber', sz.id_number);
      setField('sbdyGender', sz.gender);
      setField('sbdyCompany', sz.company);
      setField('sbdyUnitCode', sz.unit_code);
      setField('sbdyComputerNo', sz.computer_no);
      setField('sbdyArea', '深圳市');
      setField('sbdyPeriodStart', startY + '-' + String(startM).padStart(2, '0'));
      setField('sbdyPeriodEnd', endY + '-' + String(endM).padStart(2, '0'));
      setField('sbdyBase', sz.base);
      setField('sbdyMedicalBase', sz.base);
      setField('sbdyPrintDate', printDate);
      setStatus('已填充深圳示例：' + sz.name + '（可再点生成）', false);
      return;
    }
    var samples = [
      {
        name: '李晓晴',
        id_number: '371323199904156523',
        gender: '女',
        company: '杭州百伦思宠物用品有限公司',
        credit: '91310113630842640E',
        area: '余杭区',
        base: 4986,
        pension: 398.88,
        unemp: 24.93
      },
      {
        name: '王思远',
        id_number: '330106199508123456',
        gender: '男',
        company: '杭州云启信息技术有限公司',
        credit: '91330108MA2H12345X',
        area: '西湖区',
        base: 6520,
        pension: 521.6,
        unemp: 32.6
      },
      {
        name: '陈佳怡',
        id_number: '330102199211088765',
        gender: '女',
        company: '浙江启航贸易有限公司',
        credit: '91330000MA27ABCD1Y',
        area: '拱墅区',
        base: 5800,
        pension: 464,
        unemp: 29
      }
    ];
    var sample =
      Math.random() < 0.55 ? samples[0] : samples[Math.floor(Math.random() * samples.length)];
    if (sample.name === '李晓晴') {
      startY = 2025;
      startM = 6;
      endY = 2026;
      endM = 5;
    }
    setField('sbdyName', sample.name);
    setField('sbdyIdNumber', sample.id_number);
    setField('sbdyGender', sample.gender);
    setField('sbdyCompany', sample.company);
    setField('sbdyCredit', sample.credit);
    setField('sbdyArea', sample.area);
    setField('sbdyPeriodStart', startY + '-' + String(startM).padStart(2, '0'));
    setField('sbdyPeriodEnd', endY + '-' + String(endM).padStart(2, '0'));
    setField('sbdyBase', sample.base);
    setField('sbdyPensionPay', sample.pension);
    setField('sbdyUnempPay', sample.unemp);
    var st = sample.name === '李晓晴' ? '暂停缴费' : '正常参保';
    setField('sbdyStatusPension', st);
    setField('sbdyStatusMedical', st);
    setField('sbdyStatusInjury', st);
    setField('sbdyStatusUnemp', st);
    setField('sbdyPrintDate', sample.name === '李晓晴' ? '2026年06月25日' : printDate);
    setStatus('已填充示例：' + sample.name + '（可再点生成）', false);
  }

  function prefill() {
    var username = val('sbdyPrefillUser');
    if (!username) {
      setStatus('请输入用户名', true);
      return;
    }
    setStatus('加载用户数据…', false);
    fetchAdmin('/api/admin/sbdy-demo/prefill?username=' + encodeURIComponent(username))
      .then(function (r) {
        return r.json().then(function (j) {
          return { http: r.status, j: j };
        });
      })
      .then(function (pack) {
        var j = pack.j;
        if (!j || j.code !== 200 || !j.data) {
          setStatus((j && j.msg) || '用户数据加载失败（HTTP ' + pack.http + '）', true);
          return;
        }
        var d = j.data;
        var u = d.user || {};
        var id = u.user_tax_id || u.id_card || u.tax_id || '';
        setField('sbdyName', u.real_name || '');
        setField('sbdyIdNumber', id);
        var g = genderFromId(id);
        if (g) setField('sbdyGender', g);
        var employers = d.employers || [];
        var companies = d.companies || [];
        var company = '';
        if (employers.length) company = employers[0].company_name || '';
        if (!company && companies.length) company = companies[0];
        if (company) setField('sbdyCompany', company);
        setStatus('已预填「' + username + '」（请核对单位与缴费月份）', false);
      })
      .catch(function (e) {
        var msg = e && e.message ? e.message : '网络错误';
        if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) {
          msg = '网络请求被拦截或中断（可关闭广告拦截后重试）';
        }
        setStatus('预填失败：' + msg, true);
      });
  }

  function bindGenderAuto() {
    var idEl = document.getElementById('sbdyIdNumber');
    if (!idEl || idEl.__sbdyGenderBound) return;
    idEl.__sbdyGenderBound = true;
    idEl.addEventListener('blur', function () {
      var g = genderFromId(idEl.value);
      if (g) setField('sbdyGender', g);
    });
  }

  function bind() {
    fillDefaults();
    bindGenderAuto();
    document.querySelectorAll('input[name="sbdyRegion"]').forEach(function (el) {
      el.addEventListener('change', syncRegionUi);
    });
    syncRegionUi();
    var fillBtn = document.getElementById('btnSbdyDemoFillSample');
    if (fillBtn) fillBtn.onclick = fillSample;
    var btn = document.getElementById('btnSbdyDemoGenerate');
    if (btn) btn.onclick = generate;
    var refresh = document.getElementById('btnSbdyDemoRefresh');
    if (refresh) {
      refresh.onclick = function () {
        loadList();
        setStatus('列表已刷新', false);
      };
    }
    var prefillBtn = document.getElementById('sbdyPrefillBtn');
    if (prefillBtn) prefillBtn.onclick = prefill;
    var pasteFill = document.getElementById('btnSbdyPasteFill');
    if (pasteFill) pasteFill.onclick = pasteFillOnly;
    var pasteGen = document.getElementById('btnSbdyPasteGenerate');
    if (pasteGen) pasteGen.onclick = pasteAndGenerate;
    var pasteClear = document.getElementById('btnSbdyPasteClear');
    if (pasteClear) pasteClear.onclick = clearPasteTemplate;
  }

  function loadPage() {
    bind();
    loadList();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['sbdy-demo'] = {
    ready: true,
    loadPage: loadPage,
    generate: generate,
    fillSample: fillSample,
    parsePasteTemplate: parsePasteTemplate,
    pasteFillOnly: pasteFillOnly,
    pasteAndGenerate: pasteAndGenerate
  };
  global.loadSbdyDemoPage = loadPage;
  global.sbdyDemoGenerate = generate;
  global.sbdyDemoFillSample = fillSample;
  global.sbdyDemoPasteGenerate = pasteAndGenerate;
})(window);
