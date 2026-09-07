/** Admin module: 社保演示生成
 * UX：预填 → 分步表单 → 生成结果可预览/复制（参考 QR 平台与参保证明字段口径）
 */
(function (global) {
  /* 预填按税务记录带出的逐月单位编号映射（YYYY-MM → 信用代码），生成时随 month_units 上送 */
  var prefillMonthUnits = {};
  /* 「填充示例」为深圳新准备的多单位分段 / 累计月数，生成时并入 body */
  var szNewSampleExtras = null;
  /* 「填充示例」为江苏新准备的标题区间覆盖（明细行仍按分段） */
  var jsNewSampleExtras = null;
  var APP_CFG = global.SBDY_DEMO_APP || null;
  var isApp = !!(APP_CFG && APP_CFG.mode === 'app');

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fetchAdmin(url, opts) {
    if (isApp && typeof global.authFetch === 'function') {
      var u = String(url || '');
      if (u.indexOf('prefill') >= 0) {
        return global.authFetch('/api/sbdy-demo/prefill', opts);
      }
      if (u.indexOf('generate') >= 0) {
        return global.authFetch('/api/sbdy-demo/generate', opts);
      }
      if (u.indexOf('/list') >= 0 || u.indexOf('/delete') >= 0) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: function () {
            return Promise.resolve({ code: 200, data: { list: [] } });
          }
        });
      }
    }
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

  /** 去掉尾部顿号/逗号，避免「某某公司、」残留在单框 */
  function cleanCompanyName(s) {
    return String(s || '')
      .replace(/（[^）]*）/g, '')
      .replace(/\([^)]*\)/g, '')
      .replace(/[、,，;；\s]+$/g, '')
      .trim();
  }

  function splitCompanyNames(s) {
    return String(s || '')
      .split(/[、,，]/)
      .map(function (x) {
        return cleanCompanyName(x);
      })
      .filter(Boolean);
  }

  function splitCreditCodes(s) {
    return String(s || '')
      .split(/[、,，;；/|]+/)
      .map(function (x) {
        return String(x || '').trim();
      })
      .filter(Boolean);
  }

  /**
   * 多家单位写入下方分段；浙江清空上方单框，江苏可保留最近单位作为「现参保单位」。
   * 查询区间含外地月份时可强制保留单个本地分段，避免把空档月补成缴费月。
   * @returns {boolean} 是否已按多段处理
   */
  function fillMultiAsSegments(opts) {
    opts = opts || {};
    var names = Array.isArray(opts.names) ? opts.names.filter(Boolean) : [];
    var codes = Array.isArray(opts.codes) ? opts.codes.filter(Boolean) : [];
    var segsIn = Array.isArray(opts.segments) ? opts.segments : [];
    var defArea = opts.area || val('sbdyArea') || '余杭区';
    var defBase = opts.base != null ? opts.base : val('sbdyBase') || '4986';
    var ps = opts.period_start || '';
    var pe = opts.period_end || '';
    var list = [];
    if (segsIn.length >= 2 || (opts.force_single && segsIn.length === 1)) {
      list = segsIn.map(function (s) {
        return {
          company_name: cleanCompanyName(s.company_name || ''),
          credit_code: String(s.credit_code || '').trim(),
          area: s.area || defArea,
          base_amount: s.base_amount != null ? s.base_amount : defBase,
          period_start: s.period_start || ps,
          period_end: s.period_end || pe
        };
      });
    } else {
      var n = Math.max(names.length, codes.length);
      if (n < 2) return false;
      /* 拆分公司名时不知道各段真实起止月，留空让运营填写（生成前会校验），
         避免多段同起止月导致整表单位错乱 */
      var i;
      for (i = 0; i < n; i++) {
        list.push({
          company_name: names[i] || '',
          credit_code: codes[i] || '',
          area: defArea,
          base_amount: defBase,
          period_start: '',
          period_end: ''
        });
      }
    }
    if (list.length < 2 && !opts.force_single) return false;
    setField('sbdyCompany', cleanCompanyName(opts.summary_company || ''));
    setField('sbdyCredit', String(opts.summary_credit || '').trim());
    renderSegments(list);
    return true;
  }

  /** 若上方单框误填了「A、B」，自动拆到下方分段 */
  function promoteJoinedCompanyField() {
    if (!usesZjCompanySegments(currentRegion())) return false;
    var names = splitCompanyNames(val('sbdyCompany'));
    var codes = splitCreditCodes(val('sbdyCredit'));
    if (names.length < 2 && codes.length < 2) {
      /* 单家也去掉尾部顿号 */
      if (val('sbdyCompany')) setField('sbdyCompany', cleanCompanyName(val('sbdyCompany')));
      return false;
    }
    if (readSegments().length >= 2) {
      setField('sbdyCompany', '');
      setField('sbdyCredit', '');
      return true;
    }
    return fillMultiAsSegments({
      names: names,
      codes: codes,
      area: val('sbdyArea') || '余杭区',
      base: val('sbdyBase') || '4986',
      period_start: normalizeYm(val('sbdyPeriodStart')),
      period_end: normalizeYm(val('sbdyPeriodEnd'))
    });
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
    var status = document.getElementById(isApp ? 'sbdyGenStatus' : 'sbdyDemoStatus');
    if (status) {
      status.textContent = msg || '';
      status.classList.toggle('err', !!isErr);
      if (!isApp) status.style.color = isErr ? '#b91c1c' : '';
    }
  }

  function isSzStyle(region) {
    return region === 'sz' || region === 'sz_new' || region === 'gz';
  }

  function usesZjCompanySegments(region) {
    return region === 'zj' || region === 'gz' || region === 'sc' || region === 'ha';
  }

  function isJsStyle(region) {
    return region === 'js' || region === 'js_new';
  }

  /** 浙江式操作：信用代码 + 分段任职 + 四险状态「参保缴费」；河南只换权益记录单版式 */
  function isZjOpsRegion(region) {
    return region === 'zj' || region === 'sc' || region === 'ha';
  }

  function currentRegion() {
    var checked = document.querySelector('input[name="sbdyRegion"]:checked');
    if (checked) {
      var fromValue = String(checked.value || '').trim();
      if (fromValue) return fromValue;
      var idMap = {
        sbdyRegionJsNew: 'js_new',
        sbdyRegionJs: 'js',
        sbdyRegionSzNew: 'sz_new',
        sbdyRegionSz: 'sz',
        sbdyRegionGz: 'gz',
        sbdyRegionWh: 'wh',
        sbdyRegionHn: 'hn',
        sbdyRegionHa: 'ha',
        sbdyRegionBj: 'bj',
        sbdyRegionSh: 'sh',
        sbdyRegionXm: 'xm',
        sbdyRegionSc: 'sc',
        sbdyRegionZj: 'zj'
      };
      if (checked.id && idMap[checked.id]) return idMap[checked.id];
    }
    var hn = document.getElementById('sbdyRegionHn');
    var ha = document.getElementById('sbdyRegionHa');
    var sz = document.getElementById('sbdyRegionSz');
    var szNew = document.getElementById('sbdyRegionSzNew');
    var gz = document.getElementById('sbdyRegionGz');
    var wh = document.getElementById('sbdyRegionWh');
    var js = document.getElementById('sbdyRegionJs');
    var jsNew = document.getElementById('sbdyRegionJsNew');
    var bj = document.getElementById('sbdyRegionBj');
    var sh = document.getElementById('sbdyRegionSh');
    var xm = document.getElementById('sbdyRegionXm');
    var sc = document.getElementById('sbdyRegionSc');
    if (sc && sc.checked) return 'sc';
    if (xm && xm.checked) return 'xm';
    if (sh && sh.checked) return 'sh';
    if (bj && bj.checked) return 'bj';
    if (jsNew && jsNew.checked) return 'js_new';
    if (js && js.checked) return 'js';
    if (ha && ha.checked) return 'ha';
    if (hn && hn.checked) return 'hn';
    if (gz && gz.checked) return 'gz';
    if (szNew && szNew.checked) return 'sz_new';
    if (sz && sz.checked) return 'sz';
    if (wh && wh.checked) return 'wh';
    return 'zj';
  }

  function syncRegionUi() {
    var region = currentRegion();
    document.querySelectorAll('.sbdy-zj-only').forEach(function (el) {
      el.hidden = region !== 'zj' && region !== 'sc' && region !== 'ha';
    });
    document.querySelectorAll('.sbdy-zj-hn').forEach(function (el) {
      el.hidden =
        region !== 'zj' &&
        region !== 'hn' &&
        region !== 'gz' &&
        region !== 'sc' &&
        region !== 'ha';
    });
    document.querySelectorAll('.sbdy-sc-only').forEach(function (el) {
      el.hidden = region !== 'sc';
    });
    document.querySelectorAll('.sbdy-sz-only').forEach(function (el) {
      el.hidden = !isSzStyle(region);
    });
    document.querySelectorAll('.sbdy-wh-only').forEach(function (el) {
      el.hidden = region !== 'wh';
    });
    document.querySelectorAll('.sbdy-wh-hn').forEach(function (el) {
      el.hidden = region !== 'wh' && region !== 'hn' && region !== 'xm';
    });
    document.querySelectorAll('.sbdy-sz-wh-hn').forEach(function (el) {
      el.hidden = !isSzStyle(region) && region !== 'wh' && region !== 'hn' && region !== 'xm';
    });
    document.querySelectorAll('.sbdy-sz-wh').forEach(function (el) {
      el.hidden = !isSzStyle(region) && region !== 'wh';
    });
    document.querySelectorAll('.sbdy-zj-wh').forEach(function (el) {
      el.hidden = region !== 'zj' && region !== 'wh';
    });
    document.querySelectorAll('.sbdy-zj-wh-js').forEach(function (el) {
      el.hidden =
        region !== 'zj' &&
        region !== 'wh' &&
        !isJsStyle(region) &&
        region !== 'bj' &&
        region !== 'sh' &&
        region !== 'xm' &&
        region !== 'sc' &&
        region !== 'ha';
    });
    document.querySelectorAll('.sbdy-js-only').forEach(function (el) {
      el.hidden = !isJsStyle(region);
    });
    document.querySelectorAll('.sbdy-js-new-only').forEach(function (el) {
      el.hidden = region !== 'js_new';
    });
    document.querySelectorAll('.sbdy-zj-js').forEach(function (el) {
      el.hidden =
        region !== 'zj' &&
        !isJsStyle(region) &&
        region !== 'bj' &&
        region !== 'sh' &&
        region !== 'gz' &&
        region !== 'xm' &&
        region !== 'sc' &&
        region !== 'ha';
    });
    var regionDefaults = {
      zj: { area: '余杭区', base: '4986' },
      sz: { area: '深圳市', base: '4492' },
      sz_new: { area: '深圳市', base: '4492' },
      gz: { area: '广州市', base: '4492' },
      wh: { area: '武汉市', base: '4224' },
      hn: { area: '常德市鼎城区', base: '4053' },
      ha: { area: '郑州市郑东新区', base: '4200' },
      js: { area: '溧水区', base: '4494' },
      js_new: { area: '经济技术开发区', base: '12000' },
      bj: { area: '朝阳区', base: '6821' },
      sh: { area: '上海市', base: '7313' },
      xm: { area: '湖里区', base: '1800' },
      sc: { area: '成都市高新区', base: '5000' }
    };
    var defaultAreas = [];
    var defaultBases = ['6120', '4308'];
    Object.keys(regionDefaults).forEach(function (key) {
      defaultAreas.push(regionDefaults[key].area);
      defaultBases.push(regionDefaults[key].base);
    });
    var base = document.getElementById('sbdyBase');
    var area = document.getElementById('sbdyArea');
    var next = regionDefaults[region] || regionDefaults.zj;
    if (base && defaultBases.indexOf(String(base.value)) >= 0) {
      base.value = next.base;
    }
    if (area && defaultAreas.indexOf(area.value) >= 0) {
      area.value = next.area;
    }
    if (region === 'js_new') {
      var titleMonths = document.getElementById('sbdyTitleMonths');
      var titleCompact = document.getElementById('sbdyTitleCompact');
      if (titleMonths && !String(titleMonths.value || '').trim()) titleMonths.value = '441';
      if (titleCompact && !String(titleCompact.value || '').trim()) titleCompact.value = '199001-202609';
      var ps = document.getElementById('sbdyPeriodStart');
      var pe = document.getElementById('sbdyPeriodEnd');
      if (ps && !ps.value) ps.value = '2023-12';
      if (pe && !pe.value) pe.value = '2026-07';
    }
    if (region === 'wh') {
      var insure = document.getElementById('sbdyInsureType');
      if (insure && !insure.value) insure.value = '企业养老';
    }
    var med = document.getElementById('sbdyMedicalBase');
    if (isSzStyle(region) && med && !med.value) med.value = base ? base.value : '4492';
    var creditLabel = document.querySelector('label[for="sbdyCredit"]');
    if (creditLabel) {
      creditLabel.textContent = region === 'sc' ? '单位编号' : '统一社会信用代码';
    }
    var creditInput = document.getElementById('sbdyCredit');
    if (creditInput) {
      creditInput.placeholder = region === 'sc' ? '如 10010759311' : '9131…';
    }
  }

  function setBusy(busy) {
    var btn = document.getElementById(isApp ? 'btnSbdyGenerate' : 'btnSbdyDemoGenerate');
    if (btn) {
      btn.disabled = !!busy;
      btn.textContent = busy
        ? '生成中…'
        : isApp
          ? '生成参保证明 PDF'
          : '生成演示样例';
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

  function defaultDemoIdNumber(region, gender) {
    var areaCodes = {
      zj: '330106',
      sz: '440305',
      sz_new: '440305',
      gz: '440103',
      wh: '420106',
      hn: '430703',
      ha: '410105',
      js: '320102',
      js_new: '320102',
      bj: '110105',
      sh: '310115',
      xm: '350206',
      sc: '510107'
    };
    var prefix =
      (areaCodes[region] || areaCodes.zj) +
      '19900101' +
      (gender === '男' ? '001' : '002');
    var weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    var checks = '10X98765432';
    var sum = 0;
    var i;
    for (i = 0; i < 17; i++) {
      sum += Number(prefix.charAt(i)) * weights[i];
    }
    return prefix + checks.charAt(sum % 11);
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

  /** 江苏新标题：「出具证明前441个月缴费情况（199001-202609）」与明细区间分开 */
  function extractJsNewTitle(text) {
    var t = String(text || '');
    var span = 0;
    var compact = '';
    var m1 = t.match(/出具证明前\s*(\d+)\s*个?月/);
    if (m1) span = Number(m1[1]) || 0;
    var m2 = t.match(/\(?\s*(\d{6})\s*[-~—～]\s*(\d{6})\s*\)?/);
    if (m2) compact = m2[1] + '-' + m2[2];
    /* 1990-01～2026-09 含首尾共 441 个月；未写月数时按此补 */
    if (compact === '199001-202609' && !span) span = 441;
    return { span_months: span, period_compact: compact };
  }

  function stripJsNewTitleNoise(text) {
    return String(text || '')
      .replace(/出具证明前\s*\d+\s*个?月缴费情况/g, ' ')
      .replace(/\(?\s*\d{6}\s*[-~—～]\s*\d{6}\s*\)?/g, ' ');
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

    var jsNewTitle = extractJsNewTitle(text);
    var periodRaw =
      pickLabeled(text, ['时间', '缴费时间', '参保时间', '缴费区间', '期间', '起止', '缴纳月份']) || '';
    var period = parsePeriodText(periodRaw);
    if (!period) period = parsePeriodText(stripJsNewTitleNoise(text));

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
    var looksHn = !!(
      /湖南|常德|实缴明细|智慧人社|4311|4312/.test(text) ||
      (personNo && /^4312/.test(personNo)) ||
      (unitCode && /^4311/.test(unitCode))
    );
    var looksHa = !!(
      /河南|郑州|郑东|开封|洛阳|平顶山|安阳|鹤壁|新乡|焦作|濮阳|许昌|漯河|三门峡|南阳|商丘|信阳|周口|驻马店|济源|河南省社会保险个人权益记录单/.test(
        text
      )
    );
    var looksGz = !!(
      /广州市社会保险|广州社保/.test(text) ||
      (/广州/.test(text) &&
        !/深圳/.test(text) &&
        (unitCode || computerNo || /社保电脑号|社保|参保|缴费/.test(text)))
    );
    var looksSzNew = !!(
      /深圳市社会保险参保证明|历年参保年限|近两年参保缴费明细|深圳新/.test(text)
    );
    var looksSz = !!(
      !looksGz &&
      !looksSzNew &&
      (unitCode ||
        computerNo ||
        /深圳市社会保险|深圳社保|社保电脑号/.test(text))
    );
    if (looksWh && /深圳|广州/.test(text) && !/武汉|湖北/.test(text)) looksWh = false;
    if (looksHn && /武汉|湖北/.test(text) && !/湖南|常德/.test(text)) looksHn = false;
    if (looksHn && looksHa) looksHn = false;
    var looksJsNew = !!(
      /江苏新|全国社保卡服务平台|该核查内容真实|核查内容真实|江苏省社会保险权益记录单/.test(text)
    );
    var looksJs = !!(
      /江苏|权益记录单|南京|苏州|无锡|常州|徐州|南通|扬州|盐城|泰州|镇江|淮安|连云港|宿迁/.test(text)
    );
    if (looksJs && /浙江|杭州|余杭|深圳|广州|武汉|湖北|湖南|常德|北京|上海|河南|郑州/.test(text))
      looksJs = false;
    if (looksJsNew) looksJs = false;
    var looksBj = !!(
      /北京市社会保险|个人权益记录|查询流水号|查询时间段|补充资料|校验码|朝阳区社会保险|海淀区社会保险|fuwu\.rsj\.beijing/.test(
        text
      ) ||
      (/北京/.test(text) &&
        /社保|参保|缴费/.test(text) &&
        !/浙江|杭州|深圳|广州|武汉|湖北|湖南|江苏|南京|上海|河南/.test(text))
    );
    if (
      looksBj &&
      (/河南|郑州|郑东/.test(text) ||
        (/浙江|杭州|余杭|深圳|广州|武汉|湖北|湖南|江苏|上海/.test(text) && !/北京/.test(text)))
    ) {
      looksBj = false;
    }
    var looksSh = !!(
      /上海市社会保险|城镇职工基本养老保险参保情况|近60个月|随申办|一网通办|浦东|闵行|静安|徐汇|黄浦|杨浦|虹口|普陀|长宁|宝山|嘉定|松江|青浦|奉贤|金山|崇明/.test(
        text
      ) ||
      (/上海/.test(text) &&
        /社保|参保|缴费/.test(text) &&
        !/浙江|杭州|深圳|广州|武汉|湖北|湖南|江苏|南京|北京|河南/.test(text))
    );
    if (looksSh && /浙江|杭州|余杭|深圳|广州|武汉|湖北|湖南|江苏|北京|河南/.test(text) && !/上海/.test(text)) {
      looksSh = false;
    }
    var looksXm = !!(
      /厦门|基本养老个人历年缴费明细|湖里区社会保险|思明区社会保险|集美区社会保险|海沧区社会保险|同安区社会保险|翔安区社会保险|福建省社保移入/.test(
        text
      )
    );
    if (
      looksXm &&
      /浙江|杭州|深圳|广州|武汉|湖北|湖南|江苏|北京|上海|四川|成都|河南/.test(text) &&
      !/厦门/.test(text)
    ) {
      looksXm = false;
    }
    var looksSc = !!(
      /四川|成都|绵阳|德阳|南充|宜宾|泸州|达州|乐山|眉山|资阳|内江|自贡|广安|遂宁|广元|攀枝花|雅安|巴中|凉山|阿坝|甘孜|高新区|双流/.test(
        text
      )
    );
    if (
      looksSc &&
      /浙江|杭州|深圳|广州|武汉|湖北|湖南|江苏|北京|上海|厦门|河南/.test(text) &&
      !/四川|成都/.test(text)
    ) {
      looksSc = false;
    }
    var region = looksHa
      ? 'ha'
      : looksSc
      ? 'sc'
      : looksXm
      ? 'xm'
      : looksSh
      ? 'sh'
      : looksBj
        ? 'bj'
        : looksHn
          ? 'hn'
          : looksWh
            ? 'wh'
            : looksJsNew
              ? 'js_new'
              : looksJs
              ? 'js'
              : looksGz
                ? 'gz'
                : looksSzNew
                  ? 'sz_new'
                  : looksSz
                    ? 'sz'
                    : 'zj';
    var idNumberDefaulted = false;
    if (!idNumber) {
      idNumber = defaultDemoIdNumber(region, gender || '女');
      idNumberDefaulted = true;
    }
    if (!gender) gender = genderFromId(idNumber) || '女';
    var baseRaw = pickLabeled(text, ['医保基数', '医疗保险基数', '缴费基数', '基数']);
    var base = baseRaw ? Number(String(baseRaw).replace(/[^\d.]/g, '')) : NaN;
    if (!isFinite(base) || base <= 0) {
      var fromForm = Number(val('sbdyBase'));
      base =
        isFinite(fromForm) && fromForm > 0
          ? fromForm
          : isSzStyle(region)
            ? 4492
            : region === 'wh'
              ? 4224
              : region === 'hn'
                ? 4053
                : region === 'ha'
                  ? 4200
                  : region === 'js_new'
                    ? 12000
                    : region === 'js'
                  ? 4494
                  : region === 'bj'
                    ? 6821
                    : region === 'sh'
                      ? 7313
                      : region === 'xm'
                        ? 1800
                        : region === 'sc'
                          ? 5000
                          : 4986;
    }
    var injuryRaw = pickLabeled(text, ['工伤基数', '工伤保险基数']);
    var injuryBase = injuryRaw ? Number(String(injuryRaw).replace(/[^\d.]/g, '')) : NaN;
    var unempBaseRaw = pickLabeled(text, ['失业基数', '失业保险基数']);
    var unempBase = unempBaseRaw ? Number(String(unempBaseRaw).replace(/[^\d.]/g, '')) : NaN;
    var pension = Math.round(base * 0.08 * 100) / 100;
    var unemp = Math.round(base * (isSzStyle(region) ? 0.002 : 0.005) * 100) / 100;

    var active = wantsActiveStatus(text);
    var status = active
      ? isZjOpsRegion(region)
        ? '参保缴费'
        : '正常参保'
      : '暂停缴费';
    var totalMonthsRaw = pickLabeled(text, ['累计缴费月数', '累计月数', '缴费月数']);
    var totalMonths = totalMonthsRaw
      ? Number(String(totalMonthsRaw).replace(/[^\d]/g, ''))
      : NaN;

    if (!name) return { error: '模版中未识别到姓名' };
    if (
      region === 'js_new' &&
      (!period ||
        !period.start ||
        !period.end ||
        (period.start === '1990-01' && period.end === '2026-09'))
    ) {
      period = { start: '2023-12', end: '2026-07' };
    }
    if (!period || !period.start || !period.end) {
      return { error: '模版中未识别到缴费时间（如 2025.7-2026.6）' };
    }

    return {
      region: region,
      name: name,
      id_number: idNumber,
      id_number_defaulted: idNumberDefaulted,
      gender: gender || genderFromId(idNumber) || '女',
      company_name: company,
      credit_code: credit,
      unit_code: unitCode,
      computer_no: computerNo,
      person_no: personNo,
      insurance_type: insureType || (region === 'wh' ? '企业养老' : ''),
      area:
        area ||
        (region === 'gz'
          ? '广州市'
          : region === 'sz' || region === 'sz_new'
          ? '深圳市'
          : region === 'wh'
            ? '武汉市'
            : region === 'hn'
              ? '常德市鼎城区'
              : region === 'ha'
                ? '郑州市郑东新区'
                : region === 'js_new'
                  ? '经济技术开发区'
                  : region === 'js'
                ? '南京市'
                : region === 'bj'
                  ? '朝阳区'
                  : region === 'sh'
                    ? '上海市'
                    : region === 'xm'
                      ? '湖里区'
                      : region === 'sc'
                        ? '成都市高新区'
                        : '余杭区'),
      period_start: period.start,
      period_end: period.end,
      month_count: monthCountBetween(period.start, period.end),
      base_amount: base,
      medical_base: base,
      injury_base: isFinite(injuryBase) && injuryBase > 0 ? injuryBase : undefined,
      unemp_base: isFinite(unempBase) && unempBase > 0 ? unempBase : undefined,
      pension_pay: pension,
      unemployment_pay: unemp,
      total_months: isFinite(totalMonths) && totalMonths > 0 ? totalMonths : undefined,
      status: status,
      print_date: defaultPrintDateCn(),
      span_months:
        region === 'js_new' && jsNewTitle.span_months > 0 ? jsNewTitle.span_months : undefined,
      period_compact:
        region === 'js_new' && jsNewTitle.period_compact ? jsNewTitle.period_compact : undefined
    };
  }

  function applyParsedToForm(parsed) {
    prefillMonthUnits = {};
    clearSegments();
    if (parsed.region === 'sz_new') {
      var szNewRadio = document.getElementById('sbdyRegionSzNew');
      if (szNewRadio) szNewRadio.checked = true;
    } else if (parsed.region === 'sz') {
      var szRadio = document.getElementById('sbdyRegionSz');
      if (szRadio) szRadio.checked = true;
    } else if (parsed.region === 'gz') {
      var gzRadio = document.getElementById('sbdyRegionGz');
      if (gzRadio) gzRadio.checked = true;
    } else if (parsed.region === 'wh') {
      var whRadio = document.getElementById('sbdyRegionWh');
      if (whRadio) whRadio.checked = true;
    } else if (parsed.region === 'hn') {
      var hnRadio = document.getElementById('sbdyRegionHn');
      if (hnRadio) hnRadio.checked = true;
    } else if (parsed.region === 'ha') {
      var haRadio = document.getElementById('sbdyRegionHa');
      if (haRadio) haRadio.checked = true;
    } else if (parsed.region === 'js_new') {
      var jsNewRadio = document.getElementById('sbdyRegionJsNew');
      if (jsNewRadio) jsNewRadio.checked = true;
    } else if (parsed.region === 'js') {
      var jsRadio = document.getElementById('sbdyRegionJs');
      if (jsRadio) jsRadio.checked = true;
    } else if (parsed.region === 'bj') {
      var bjRadio = document.getElementById('sbdyRegionBj');
      if (bjRadio) bjRadio.checked = true;
    } else if (parsed.region === 'sh') {
      var shRadio = document.getElementById('sbdyRegionSh');
      if (shRadio) shRadio.checked = true;
    } else if (parsed.region === 'xm') {
      var xmRadio = document.getElementById('sbdyRegionXm');
      if (xmRadio) xmRadio.checked = true;
    } else if (parsed.region === 'sc') {
      var scRadio = document.getElementById('sbdyRegionSc');
      if (scRadio) scRadio.checked = true;
    } else if (parsed.region === 'zj') {
      var zjRadio = document.getElementById('sbdyRegionZj');
      if (zjRadio) zjRadio.checked = true;
    }
    syncRegionUi();
    setField('sbdyName', parsed.name);
    setField('sbdyIdNumber', parsed.id_number);
    setField('sbdyGender', parsed.gender || '女');
    setField(
      'sbdyArea',
      parsed.area ||
        (parsed.region === 'gz'
          ? '广州市'
          : parsed.region === 'sz' || parsed.region === 'sz_new'
          ? '深圳市'
          : parsed.region === 'wh'
            ? '武汉市'
            : parsed.region === 'hn'
              ? '常德市鼎城区'
              : parsed.region === 'ha'
                ? '郑州市郑东新区'
                : parsed.region === 'js_new'
                  ? '经济技术开发区'
                  : parsed.region === 'js'
                ? '南京市'
                : parsed.region === 'bj'
                  ? '朝阳区'
                  : parsed.region === 'sh'
                    ? '上海市'
                    : parsed.region === 'xm'
                      ? '湖里区'
                      : parsed.region === 'sc'
                        ? '成都市高新区'
                        : '余杭区')
    );
    setField('sbdyUnitCode', parsed.unit_code || '');
    setField('sbdyComputerNo', parsed.computer_no || '');
    setField('sbdyPersonNo', parsed.person_no || '');
    setField('sbdyInsureType', parsed.insurance_type || (parsed.region === 'wh' ? '企业养老' : ''));
    setField('sbdyPeriodStart', parsed.period_start);
    setField('sbdyPeriodEnd', parsed.period_end);
    setField('sbdyBase', parsed.base_amount);
    if (parsed.region === 'js_new') {
      if (parsed.span_months) setField('sbdyTitleMonths', parsed.span_months);
      else if (!val('sbdyTitleMonths')) setField('sbdyTitleMonths', 441);
      if (parsed.period_compact) setField('sbdyTitleCompact', parsed.period_compact);
      else if (!val('sbdyTitleCompact')) setField('sbdyTitleCompact', '199001-202609');
      jsNewSampleExtras = {
        span_months: Number(val('sbdyTitleMonths')) || 441,
        period_compact: val('sbdyTitleCompact') || '199001-202609'
      };
    }
    if (parsed.medical_base) setField('sbdyMedicalBase', parsed.medical_base);
    if (parsed.injury_base) setField('sbdyInjuryBase', parsed.injury_base);
    if (parsed.unemp_base) setField('sbdyUnempBase', parsed.unemp_base);
    if (parsed.iu_base_change_ym) setField('sbdyIuBaseChangeYm', parsed.iu_base_change_ym);
    if (parsed.injury_base_after || parsed.iu_base_after) {
      setField('sbdyIuBaseAfter', parsed.injury_base_after || parsed.iu_base_after);
    }
    setField('sbdyPensionPay', parsed.pension_pay);
    setField('sbdyUnempPay', parsed.unemployment_pay);
    setField('sbdyStatusPension', parsed.status);
    setField('sbdyStatusMedical', parsed.status);
    setField('sbdyStatusInjury', parsed.status);
    setField('sbdyStatusUnemp', parsed.status);
    setField('sbdyStatus', parsed.status || '正常参保');
    setField('sbdyPrintDate', parsed.print_date || '');
    /* 浙江多家：拆到下方分段，不写进上方单框 */
    var pasteNames = splitCompanyNames(parsed.company_name);
    var pasteCodes = splitCreditCodes(parsed.credit_code);
    if (
      usesZjCompanySegments(parsed.region) &&
      fillMultiAsSegments({
        names: pasteNames,
        codes: pasteCodes,
        area: val('sbdyArea') || '余杭区',
        base: parsed.base_amount,
        period_start: parsed.period_start,
        period_end: parsed.period_end
      })
    ) {
      /* 已写入分段 */
    } else {
      setField('sbdyCompany', pasteNames[0] || cleanCompanyName(parsed.company_name) || '');
      setField('sbdyCredit', pasteCodes[0] || String(parsed.credit_code || '').trim());
    }
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
        parsed.status +
        (parsed.id_number_defaulted ? ' · 身份证号已自动补默认值' : ''),
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

  function operatorLabel(row) {
    var admin = row && row.created_by_admin ? String(row.created_by_admin).trim() : '';
    if (admin) {
      if (/^c:/i.test(admin)) return '用户·' + admin.slice(2);
      return admin;
    }
    var user = row && row.created_by_user ? String(row.created_by_user).trim() : '';
    if (user) return '用户·' + user;
    return '—';
  }

  function renderList(list) {
    var tbody = document.getElementById('sbdyDemoListTbody');
    if (!tbody) return;
    if (!list || !list.length) {
      tbody.innerHTML = '<tr><td colspan="8">暂无记录</td></tr>';
      return;
    }
    var html = '';
    list.forEach(function (row) {
      var links = row.links || {};
      var region =
        row.region === 'gz'
          ? '广州'
          : row.region === 'sz_new'
          ? '深圳新'
          : row.region === 'sz'
          ? '深圳'
          : row.region === 'wh'
            ? '武汉'
            : row.region === 'hn'
              ? '湖南'
              : row.region === 'ha'
                ? '河南'
                : row.region === 'js_new'
                ? '江苏新'
                : row.region === 'js'
                ? '江苏'
                : row.region === 'bj'
                  ? '北京'
                  : row.region === 'sh'
                    ? '上海'
                    : row.region === 'xm'
                      ? '厦门'
                      : row.region === 'sc'
                        ? '四川'
                        : '浙江';
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
        esc(operatorLabel(row)) +
        '</td>' +
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
        (row.id
          ? (links.show_url || links.verify_url ? ' · ' : '') +
            '<button type="button" class="sbdy-demo-del" data-id="' +
            esc(row.id) +
            '" data-name="' +
            esc(row.name || '') +
            '" style="border:0;background:none;padding:0;color:#b42318;cursor:pointer;">删除</button>'
          : '') +
        '</td></tr>';
    });
    tbody.innerHTML = html;
  }

  function deleteCert(id, name) {
    var idNum = parseInt(id, 10);
    if (!idNum) {
      setStatus('缺少记录 id', true);
      return;
    }
    var label = name ? '「' + name + '」的演示样例' : '这条演示样例';
    if (!window.confirm('确认删除' + label + '？删除后样例与核验链接将失效。')) return;
    setStatus('删除中…', false);
    fetchAdmin('api/admin/sbdy-demo/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: idNum })
    })
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r).then(function (j) {
          return { http: r.status, j: j };
        });
      })
      .then(function (pack) {
        var j = pack.j;
        if (!j || j.code !== 200) {
          setStatus((j && j.msg) || '删除失败（HTTP ' + pack.http + '）', true);
          return;
        }
        setStatus('已删除', false);
        loadList();
      })
      .catch(function (e) {
        setStatus('删除失败：' + (e && e.message ? e.message : '网络错误'), true);
      });
  }

  function bindListActions() {
    var tbody = document.getElementById('sbdyDemoListTbody');
    if (!tbody || tbody.__sbdyDelBound) return;
    tbody.__sbdyDelBound = true;
    tbody.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.classList || !t.classList.contains('sbdy-demo-del')) return;
      e.preventDefault();
      deleteCert(t.getAttribute('data-id'), t.getAttribute('data-name') || '');
    });
  }

  function loadList() {
    fetchAdmin('api/admin/sbdy-demo/list?limit=30')
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r);
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
    if (isApp && typeof APP_CFG.showResult === 'function') {
      APP_CFG.showResult(d);
      return;
    }
    var result = document.getElementById('sbdyDemoResult');
    if (!result) return;
    var links = d.links || {};
    result.hidden = false;
    result.innerHTML =
      '<div class="admin-tool-result-head">' +
      '<strong>已生成演示样例</strong>' +
      '<span class="hint">' +
      ((d.payload && (d.payload.region === 'wh' || d.payload.region === 'hn'))
        ? '非正式证明'
        : '非正式证明 · 带水印') +
      '</span>' +
      '</div>' +
      '<p class="stat mb-8">' +
      ((d.payload && isSzStyle(d.payload.region)) ? '验真码：' : '授权码：') +
      '<code id="sbdyResultAuth">' +
      esc(d.auth_code || '') +
      '</code></p>' +
      '<div class="form-actions">' +
      (function () {
        var htmlUrl = '';
        if (d.payload && d.payload.region === 'sz_new' && links.show_api_url) {
          htmlUrl =
            links.show_api_url +
            (String(links.show_api_url).indexOf('?') >= 0 ? '&' : '?') +
            'format=html';
        }
        return (
          (htmlUrl
            ? '<a class="btn-page" href="' +
              esc(htmlUrl) +
              '" target="_blank" rel="noopener">打开页面预览</a>'
            : '') +
          (links.show_url
            ? '<a class="btn-primary" href="' +
              esc(links.show_url) +
              '" target="_blank" rel="noopener">' +
              (d.payload && d.payload.region === 'sz_new' ? '下载文件' : '打开 PDF 样例') +
              '</a>'
            : '')
        );
      })() +
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
    var defaultBase =
      isSzStyle(region)
        ? 4492
        : region === 'wh'
          ? 4224
          : region === 'hn'
            ? 4053
            : region === 'ha'
              ? 4200
              : region === 'js_new'
                ? 12000
                : region === 'js'
              ? 4494
              : region === 'bj'
                ? 6821
                : region === 'sh'
                  ? 7313
                  : region === 'xm'
                    ? 1800
                    : region === 'sc'
                      ? 5000
                      : 4986;
    var defaultArea =
      region === 'gz'
        ? '广州市'
        : region === 'sz' || region === 'sz_new'
        ? '深圳市'
        : region === 'wh'
          ? '武汉市'
          : region === 'hn'
            ? '常德市鼎城区'
            : region === 'ha'
              ? '郑州市郑东新区'
              : region === 'js_new'
                ? '经济技术开发区'
                : region === 'js'
              ? '溧水区'
              : region === 'bj'
                ? '朝阳区'
                : region === 'sh'
                  ? '上海市'
                  : region === 'xm'
                    ? '湖里区'
                    : region === 'sc'
                      ? '成都市高新区'
                      : '余杭区';
    var formGender =
      val('sbdyGender') || genderFromId(val('sbdyIdNumber')) || '女';
    var formIdNumber = val('sbdyIdNumber');
    if (!formIdNumber) {
      formIdNumber = defaultDemoIdNumber(region, formGender);
      setField('sbdyIdNumber', formIdNumber);
    }
    var body = {
      region: region,
      name: val('sbdyName'),
      id_number: formIdNumber,
      gender: formGender,
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
      injury_base: (function () {
        var n = Number(val('sbdyInjuryBase'));
        return isFinite(n) && n > 0 ? n : undefined;
      })(),
      unemp_base: (function () {
        var n = Number(val('sbdyUnempBase'));
        return isFinite(n) && n > 0 ? n : undefined;
      })(),
      iu_base_change_ym: (function () {
        var ym = normalizeYm(val('sbdyIuBaseChangeYm'));
        return ym || undefined;
      })(),
      injury_base_after: (function () {
        var n = Number(val('sbdyIuBaseAfter'));
        return isFinite(n) && n > 0 ? n : undefined;
      })(),
      unemp_base_after: (function () {
        var n = Number(val('sbdyIuBaseAfter'));
        return isFinite(n) && n > 0 ? n : undefined;
      })(),
      pension_pay: num('sbdyPensionPay', 398.88),
      unemployment_pay: num('sbdyUnempPay', 24.93),
      status_pension: val('sbdyStatusPension') || (isZjOpsRegion(region) ? '参保缴费' : '正常参保'),
      status_medical: val('sbdyStatusMedical') || val('sbdyStatusPension') || (isZjOpsRegion(region) ? '参保缴费' : '正常参保'),
      status_injury: val('sbdyStatusInjury') || (isZjOpsRegion(region) ? '参保缴费' : '正常参保'),
      status_unemployment: val('sbdyStatusUnemp') || (isZjOpsRegion(region) ? '参保缴费' : '正常参保'),
      print_date: val('sbdyPrintDate')
    };
    if (region === 'ha') {
      body.record_year = Number(String(body.period_end || '').slice(0, 4)) || undefined;
    }
    /* 武汉版：打印时间始终用当天，覆盖表单里可能残留的示例日期 */
    if (region === 'wh') {
      var todayCn = defaultPrintDateCn();
      body.print_date = todayCn;
      setField('sbdyPrintDate', todayCn);
    }
    /* 江苏 / 江苏新：参保状态单值；分段（多参保地）以分段为准 */
    if (isJsStyle(region)) {
      body.status = val('sbdyStatus') || '正常缴费';
      var jsSegs = readSegments();
      if (jsSegs.length) {
        body.segments = jsSegs;
        body.company_name = cleanCompanyName(body.company_name);
      } else {
        body.company_name = cleanCompanyName(body.company_name);
      }
    }
    /* 浙江/四川/河南：养老/失业个人按各段缴费基数自动算；河南只换权益记录单版式 */
    if (isZjOpsRegion(region)) {
      delete body.pension_pay;
      delete body.unemployment_pay;
      promoteJoinedCompanyField();
      body.company_name = cleanCompanyName(val('sbdyCompany'));
      body.credit_code = val('sbdyCredit');
      var segs = readSegments();
      if (segs.length) {
        var badSeg = null;
        var badMsg = '';
        var seenStart = {};
        segs.forEach(function (s) {
          if (badSeg) return;
          var label = s.company_name || s.credit_code || '未命名';
          if (!s.period_start || !s.period_end) {
            badSeg = s;
            badMsg = '分段「' + label + '」缺起止月，请补全后再生成';
            return;
          }
          if (region === 'ha' && !s.company_name && !s.credit_code) {
            badSeg = s;
            badMsg = '分段「' + label + '」请填写参保单位';
            return;
          }
          if (region !== 'ha' && !s.credit_code) {
            badSeg = s;
            badMsg =
              region === 'sc'
                ? '分段「' + label + '」缺单位编号（明细单位编号列会空白）'
                : '分段「' + label + '」缺统一社会信用代码（单位编号列会空白）';
            return;
          }
          if (seenStart[s.period_start]) {
            badSeg = s;
            badMsg =
              '分段「' + seenStart[s.period_start] + '」与「' + label +
              '」起月相同，请按实际任职时间错开';
            return;
          }
          seenStart[s.period_start] = label;
        });
        if (badSeg) {
          setStatus(badMsg, true);
          var segWrapEl = document.getElementById('sbdySegments');
          if (segWrapEl && segWrapEl.scrollIntoView) {
            segWrapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          return;
        }
        body.segments = segs;
      } else if (!body.company_name && !body.credit_code) {
        setStatus('请填写「参保单位」（多家请用下方分段任职）', true);
        var coEl = document.getElementById('sbdyCompany');
        if (coEl && coEl.scrollIntoView) coEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      } else if (prefillMonthUnits && Object.keys(prefillMonthUnits).length) {
        body.month_units = prefillMonthUnits;
      }
    }
    if (region === 'sc') {
      body.status_injury_extra = val('sbdyStatusInjuryExtra');
      var mp = val('sbdyMonthsPension');
      var mu = val('sbdyMonthsUnemp');
      var mi = val('sbdyMonthsInjury');
      if (mp) body.months_pension = Number(mp);
      if (mu) body.months_unemployment = Number(mu);
      if (mi) body.months_injury = Number(mi);
    }
    if (region === 'bj') {
      var bjSegs = readSegments();
      if (bjSegs.length) body.segments = bjSegs;
      body.print_date = val('sbdyPrintDate') || defaultPrintDateCn();
    }
    if (region === 'sh') {
      var shSegs = readSegments();
      if (shSegs.length) body.segments = shSegs;
      body.company_name = cleanCompanyName(body.company_name);
      body.print_date = val('sbdyPrintDate') || defaultPrintDateCn();
      var totalEl = document.getElementById('sbdyTotalMonths');
      if (totalEl && String(totalEl.value || '').trim()) {
        body.total_months = Number(totalEl.value);
      }
    }
    if (region === 'xm') {
      var xmSegs = readSegments();
      if (xmSegs.length) {
        body.segments = xmSegs.map(function (s) {
          return {
            company_name: s.company_name,
            unit_code: s.credit_code,
            area: s.area,
            base_amount: s.base_amount,
            period_start: s.period_start,
            period_end: s.period_end
          };
        });
      }
      body.company_name = cleanCompanyName(body.company_name);
      if (!body.person_no) body.person_no = body.id_number;
      body.print_date = val('sbdyPrintDate') || defaultPrintDateCn();
    }
    if (region === 'sz_new') {
      body.print_date = val('sbdyPrintDate') || defaultPrintDateCn();
      if (szNewSampleExtras && val('sbdyName') === '林晓薇') {
        if (szNewSampleExtras.segments) body.segments = szNewSampleExtras.segments;
        if (szNewSampleExtras.unit_map) body.unit_map = szNewSampleExtras.unit_map;
        if (szNewSampleExtras.years_months) body.years_months = szNewSampleExtras.years_months;
        if (szNewSampleExtras.doc_serial) body.doc_serial = szNewSampleExtras.doc_serial;
      }
    }
    if (region === 'js_new') {
      var titleMonths = Number(val('sbdyTitleMonths'));
      var titleCompact = val('sbdyTitleCompact');
      if (isFinite(titleMonths) && titleMonths > 0) body.span_months = Math.round(titleMonths);
      else if (jsNewSampleExtras && jsNewSampleExtras.span_months != null) {
        body.span_months = jsNewSampleExtras.span_months;
      }
      if (/^\d{6}-\d{6}$/.test(titleCompact)) body.period_compact = titleCompact;
      else if (jsNewSampleExtras && jsNewSampleExtras.period_compact) {
        body.period_compact = jsNewSampleExtras.period_compact;
      }
    }
    if (region === 'hn' && body.company_name === '湖南旭昱新能源科技有限公司') {
      body.snapshot_ym = '202604';
      body.snapshot_base = 4308;
      body.relation_extra = [
        {
          credit_code: '91430700MAD948AM6K',
          company_name: '湖南鑫鼎晟机械制造有限公司'
        }
      ];
    }
    if (!body.name) {
      setStatus('请填写上方「姓名」', true);
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
        return (window.adminParseJson||function(r){return r.json();})(r).then(function (j) {
          return { http: r.status, j: j };
        });
      })
      .then(function (pack) {
        var j = pack.j;
        if (isApp && (pack.http === 402 || (j && j.code === 402))) {
          setStatus((j && j.msg) || '当前环境仍要求开通去水印', true);
          var payCard = document.getElementById('cardSbdyPay');
          if (payCard) {
            payCard.hidden = false;
            try { payCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (eScroll) {}
          }
          return;
        }
        if (!j || j.code !== 200 || !j.data) {
          setStatus((j && j.msg) || '生成失败（HTTP ' + pack.http + '）', true);
          return;
        }
        setStatus(isApp ? '生成成功' : '已生成演示样例（非正式证明）', false);
        renderResult(j.data);
        if (!isApp) loadList();
      })
      .catch(function (e) {
        setStatus('生成失败：' + (e && e.message ? e.message : '网络错误'), true);
      })
      .then(function () {
        setBusy(false);
      });
  }

  function fillSample() {
    prefillMonthUnits = {};
    clearSegments();
    setField('sbdyInjuryBase', '');
    setField('sbdyUnempBase', '');
    setField('sbdyIuBaseChangeYm', '');
    setField('sbdyIuBaseAfter', '');
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
    if (currentRegion() === 'bj') {
      setField('sbdyName', '王佩茹');
      setField('sbdyIdNumber', '372921198202101116');
      setField('sbdyGender', '女');
      setField('sbdyCompany', '');
      setField('sbdyArea', '东城区');
      setField('sbdyBase', 6821);
      setField('sbdyPeriodStart', '1992-10');
      setField('sbdyPeriodEnd', '2024-11');
      setField('sbdyPrintDate', printDate);
      renderSegments([
        {
          company_name: '北京市西城劳务服务有限责任公司',
          area: '西城区',
          period_start: '1992-10',
          period_end: '2005-12'
        },
        {
          company_name: '海淀区人力资源公共服务中心',
          area: '海淀区',
          period_start: '2006-01',
          period_end: '2015-06'
        },
        {
          company_name: '北京众合众智管理咨询有限责任公司',
          area: '东城区',
          period_start: '2015-07',
          period_end: '2024-11'
        }
      ]);
      setStatus('已填充北京示例：王佩茹（1992-10 至 2024-11，三家单位，可再点生成）', false);
      return;
    }
    if (currentRegion() === 'sh') {
      setField('sbdyName', '陈思远');
      setField('sbdyIdNumber', '310115199003152018');
      setField('sbdyGender', '男');
      setField('sbdyCompany', '');
      setField('sbdyArea', '上海市');
      setField('sbdyBase', 7313);
      setField('sbdyPeriodStart', '2021-08');
      setField('sbdyPeriodEnd', '2026-07');
      setField('sbdyPrintDate', printDate);
      renderSegments([
        {
          company_name: '上海某某科技有限公司',
          period_start: '2021-08',
          period_end: '2024-11'
        },
        {
          company_name: '上海某某网络科技有限公司',
          period_start: '2024-12',
          period_end: '2026-05'
        }
      ]);
      setStatus('已填充上海示例：陈思远（近60个月参保情况，两家单位，可再点生成）', false);
      return;
    }
    if (currentRegion() === 'sc') {
      setField('sbdyName', '马海燕');
      setField('sbdyIdNumber', '510723199208191285');
      setField('sbdyGender', '女');
      setField('sbdyCompany', '');
      setField('sbdyArea', '成都市高新区');
      setField('sbdyBase', 5000);
      setField('sbdyPeriodStart', '2024-10');
      setField('sbdyPeriodEnd', '2026-09');
      setField('sbdyStatusPension', '参保缴费');
      setField('sbdyStatusInjury', '参保缴费');
      setField('sbdyStatusUnemp', '参保缴费');
      setField('sbdyStatusMedical', '参保缴费');
      setField('sbdyStatusInjuryExtra', '暂停缴费（中断）');
      setField('sbdyMonthsPension', 139);
      setField('sbdyMonthsUnemp', 138);
      setField('sbdyMonthsInjury', 138);
      setField('sbdyPrintDate', printDate);
      renderSegments([
        {
          company_name: '四川创智联恒科技有限公司',
          credit_code: '10010759311',
          area: '成都市高新区',
          base_amount: 13596,
          period_start: '2024-10',
          period_end: '2024-12'
        },
        {
          company_name: '四川创智联恒科技有限公司',
          credit_code: '10010759311',
          area: '成都市高新区',
          base_amount: 10026,
          period_start: '2025-01',
          period_end: '2025-04'
        },
        {
          company_name: '成都天微智能科技有限公司',
          credit_code: '250215712150',
          area: '成都市双流区',
          base_amount: 5000,
          period_start: '2025-05',
          period_end: '2026-09'
        }
      ]);
      setStatus('已填充四川示例：马海燕（对齐官方样张，两家单位，可再点生成）', false);
      return;
    }
    if (currentRegion() === 'xm') {
      setField('sbdyName', '张知宇');
      setField('sbdyIdNumber', '350425198902233512');
      setField('sbdyGender', '男');
      setField('sbdyPersonNo', '350425198902233512');
      setField('sbdyCompany', '');
      setField('sbdyArea', '湖里区');
      setField('sbdyUnitCode', '6200088588');
      setField('sbdyBase', 1800);
      setField('sbdyPeriodStart', '2024-01');
      setField('sbdyPeriodEnd', '2025-06');
      setField('sbdyPrintDate', printDate);
      renderSegments([
        {
          company_name: '厦门某某科技有限公司',
          credit_code: '5001098765',
          area: '同安区',
          base_amount: 1800,
          period_start: '2024-01',
          period_end: '2024-12'
        },
        {
          company_name: '金旸（厦门）新材料科技有限公司',
          credit_code: '5001016497',
          area: '海沧区',
          base_amount: 1700,
          period_start: '2025-01',
          period_end: '2025-06'
        }
      ]);
      setStatus('已填充厦门示例：张知宇（基本养老历年缴费明细，两家单位，可再点生成）', false);
      return;
    }
    if (currentRegion() === 'js' || currentRegion() === 'js_new') {
      var jsNewSample = currentRegion() === 'js_new';
      setField('sbdyName', jsNewSample ? '张某某' : '樊宜');
      setField('sbdyIdNumber', jsNewSample ? '320102199001011234' : '342501199307088233');
      setField('sbdyGender', '男');
      setField('sbdyStatus', '暂停缴费（中断）');
      setField('sbdyStatusPension', '暂停缴费（中断）');
      setField('sbdyStatusMedical', '暂停缴费（中断）');
      setField('sbdyStatusInjury', '暂停缴费（中断）');
      setField('sbdyStatusUnemp', '暂停缴费（中断）');
      setField(
        'sbdyCompany',
        jsNewSample ? '南京市经济技术开发区暂时中止单位' : '南京市溧水区暂时中止单位'
      );
      setField('sbdyArea', jsNewSample ? '经济技术开发区' : '溧水区');
      setField('sbdyBase', jsNewSample ? 12000 : 4879);
      /* 江苏新：明细 2023-12～2026-07；标题单独写 441 个月 / 199001-202609 */
      setField('sbdyPeriodStart', jsNewSample ? '2023-12' : '2025-08');
      setField('sbdyPeriodEnd', jsNewSample ? '2026-07' : '2026-08');
      setField('sbdyPrintDate', printDate);
      if (jsNewSample) {
        setField('sbdyTitleMonths', 441);
        setField('sbdyTitleCompact', '199001-202609');
        jsNewSampleExtras = {
          span_months: 441,
          period_compact: '199001-202609'
        };
        renderSegments([
          {
            company_name: '南京晶升装备股份有限公司',
            base_amount: 12000,
            period_start: '2023-12',
            period_end: '2026-07'
          }
        ]);
        setStatus(
          '已填充江苏新示例：张某某（明细 2023.12–2026.7，基数 12000，标题 441 个月，可再点生成）',
          false
        );
      } else {
        jsNewSampleExtras = null;
        renderSegments([
          { company_name: '南京胜德金属装备有限公司', base_amount: 4879, period_start: '2025-08', period_end: '2025-08' },
          { company_name: '南京埃希玛科技有限公司', base_amount: 4952, period_start: '2025-09', period_end: '2026-01' },
          { company_name: '南京贝奇尔机械有限公司', base_amount: 7000, period_start: '2026-03', period_end: '2026-05' },
          { company_name: '威尔特茵轮（南京）有限公司', base_amount: 6400, period_start: '2026-06', period_end: '2026-08' }
        ]);
        setStatus('已填充江苏示例：樊宜（4 家单位逐月，含断缴月，可再点生成）', false);
      }
      return;
    }
    if (currentRegion() === 'hn') {
      setField('sbdyName', '杨坤斌');
      setField('sbdyIdNumber', '430522199711297813');
      setField('sbdyGender', '男');
      setField('sbdyCompany', '湖南旭昱新能源科技有限公司');
      setField('sbdyCredit', '91430703MA4PYMX53L');
      setField('sbdyUnitCode', '43110000000000083822');
      setField('sbdyPersonNo', '43120000000103664059');
      setField('sbdyArea', '常德市鼎城区');
      setField('sbdyPeriodStart', '2024-05');
      setField('sbdyPeriodEnd', '2025-12');
      setField('sbdyBase', 4053);
      setStatus('已填充湖南示例：杨坤斌（可再点生成）', false);
      return;
    }
    if (currentRegion() === 'ha') {
      setField('sbdyName', '蒋飞龙');
      setField('sbdyIdNumber', '341281199112124710');
      setField('sbdyGender', '男');
      setField('sbdyCompany', '人力宝科技有限公司郑州分公司');
      setField('sbdyCredit', '');
      setField('sbdyArea', '郑州市郑东新区');
      setField('sbdyPeriodStart', '2026-01');
      setField('sbdyPeriodEnd', '2026-06');
      setField('sbdyBase', 4200);
      setField('sbdyStatusPension', '参保缴费');
      setField('sbdyStatusMedical', '参保缴费');
      setField('sbdyStatusInjury', '参保缴费');
      setField('sbdyStatusUnemp', '参保缴费');
      setField('sbdyPrintDate', printDate);
      setStatus('已填充河南示例：蒋飞龙（操作同浙江，可再点生成）', false);
      return;
    }
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
      setField('sbdyPrintDate', printDate);
      setStatus('已填充武汉示例：杨大富（可再点生成）', false);
      return;
    }
    if (currentRegion() === 'sz_new') {
      setField('sbdyName', '林晓薇');
      setField('sbdyIdNumber', '440305199208156018');
      setField('sbdyGender', '女');
      setField('sbdyCompany', '深圳市易满星科技有限公司');
      setField('sbdyUnitCode', '31327084');
      setField('sbdyComputerNo', '089216473');
      setField('sbdyArea', '深圳市');
      setField('sbdyPeriodStart', '2024-09');
      setField('sbdyPeriodEnd', '2026-08');
      setField('sbdyBase', 4492);
      setField('sbdyMedicalBase', 4492);
      setField('sbdyInjuryBase', '');
      setField('sbdyUnempBase', '');
      setField('sbdyIuBaseChangeYm', '');
      setField('sbdyIuBaseAfter', '');
      setField('sbdyPrintDate', '2026年09月01日');
      szNewSampleExtras = {
        doc_serial: '2026:09:01E',
        years_months: {
          pension: 113,
          medical: 115,
          maternity: 115,
          maternity_medical: 0,
          injury: 115,
          unemployment: 115
        },
        unit_map: [
          { unit_code: '33310893', unit_name: '盐城市滨海云创电子商务有限公司深圳分公司' },
          { unit_code: '32877135', unit_name: '深圳市环形时空智能科技有限公司' },
          { unit_code: '31327084', unit_name: '深圳市易满星科技有限公司' },
          { unit_code: '30828370', unit_name: '深圳一舱信息技术有限公司' }
        ],
        segments: [
          {
            company_name: '深圳一舱信息技术有限公司',
            unit_code: '30828370',
            credit_code: '30828370',
            base_amount: 3523,
            period_start: '2024-09',
            period_end: '2025-01'
          },
          {
            company_name: '深圳市易满星科技有限公司',
            unit_code: '31327084',
            credit_code: '31327084',
            base_amount: 4492,
            period_start: '2025-02',
            period_end: '2025-07'
          },
          {
            company_name: '深圳市环形时空智能科技有限公司',
            unit_code: '32877135',
            credit_code: '32877135',
            base_amount: 6733,
            period_start: '2025-08',
            period_end: '2026-01'
          },
          {
            company_name: '盐城市滨海云创电子商务有限公司深圳分公司',
            unit_code: '33310893',
            credit_code: '33310893',
            base_amount: 6727,
            period_start: '2026-02',
            period_end: '2026-08'
          }
        ]
      };
      setStatus('已填充深圳新示例：林晓薇（可再点生成）', false);
      return;
    }
    if (isSzStyle(currentRegion())) {
      var city = currentRegion() === 'gz' ? '广州' : '深圳';
      var szSamples = [
        {
          name: '林晓薇',
          id_number: '440305199208156018',
          gender: '女',
          company: city + '市南山区云启信息技术有限公司',
          unit_code: '44018826',
          computer_no: '089216473',
          base: 4492
        },
        {
          name: '周浩然',
          id_number: '440304199511083517',
          gender: '男',
          company: city + '前海星河数据科技有限公司',
          unit_code: '44019907',
          computer_no: '076543210',
          base: 5280
        }
      ];
      if (city === '深圳') {
        szSamples.unshift({
          name: '李懋',
          id_number: '440923199909181496',
          gender: '男',
          company: '深圳市本原生活科技有限公司',
          unit_code: '91440300MA5FLEK18W',
          computer_no: '909181496',
          base: 4775,
          medical: 6727,
          injury: 2500,
          unemp: 2500,
          iu_change_ym: '2025-03',
          iu_after: 2520,
          period_start: '2024-06',
          period_end: '2026-08'
        });
      }
      var sz =
        Math.random() < 0.6 ? szSamples[0] : szSamples[Math.floor(Math.random() * szSamples.length)];
      setField('sbdyName', sz.name);
      setField('sbdyIdNumber', sz.id_number);
      setField('sbdyGender', sz.gender);
      setField('sbdyCompany', sz.company);
      setField('sbdyUnitCode', sz.unit_code);
      setField('sbdyComputerNo', sz.computer_no);
      setField('sbdyArea', city + '市');
      setField('sbdyPeriodStart', sz.period_start || startY + '-' + String(startM).padStart(2, '0'));
      setField('sbdyPeriodEnd', sz.period_end || endY + '-' + String(endM).padStart(2, '0'));
      setField('sbdyBase', sz.base);
      setField('sbdyMedicalBase', sz.medical != null ? sz.medical : sz.base);
      setField('sbdyInjuryBase', sz.injury != null ? sz.injury : '');
      setField('sbdyUnempBase', sz.unemp != null ? sz.unemp : '');
      setField('sbdyIuBaseChangeYm', sz.iu_change_ym || '');
      setField('sbdyIuBaseAfter', sz.iu_after != null ? sz.iu_after : '');
      setField('sbdyPrintDate', printDate);
      setStatus('已填充' + city + '示例：' + sz.name + '（可再点生成）', false);
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
    var st = sample.name === '李晓晴' ? '暂停缴费' : '参保缴费';
    setField('sbdyStatusPension', st);
    setField('sbdyStatusMedical', st);
    setField('sbdyStatusInjury', st);
    setField('sbdyStatusUnemp', st);
    setField('sbdyPrintDate', sample.name === '李晓晴' ? '2026年06月25日' : printDate);
    setStatus('已填充示例：' + sample.name + '（可再点生成）', false);
  }

  /**
   * 从预填详情汇总单位与税号：
   * - 依据税务记录（含年月+公司+税号）按时间倒序去重，得到多家单位
   * - 传入年月区间则只取区间内单位；并返回记录的最早/最晚月用于回填缴费区间
   * - 单位→税号映射同时取自 employers.credit_code 与 tax_records.company_tax_id
   * - 浙江版只采用浙江税务机关记录，外省记录不能计入浙江社保月份
   */
  function taxAuthorityMatchesRegion(authority, region) {
    var text = String(authority || '');
    if (region === 'zj') {
      return /(浙江|杭州|宁波|温州|嘉兴|湖州|绍兴|金华|衢州|舟山|台州|丽水|义乌)/.test(text);
    }
    if (region === 'gz') {
      return /广州/.test(text);
    }
    if (region === 'sc') {
      return /(四川|成都|绵阳|德阳|南充|宜宾|泸州|达州|乐山|眉山|资阳|内江|自贡|广安|遂宁|广元|攀枝花|雅安|巴中|凉山|阿坝|甘孜)/.test(
        text
      );
    }
    if (region === 'ha') {
      return /(河南|郑州|开封|洛阳|平顶山|安阳|鹤壁|新乡|焦作|濮阳|许昌|漯河|三门峡|南阳|商丘|信阳|周口|驻马店|济源|郑东)/.test(
        text
      );
    }
    return true;
  }

  function regionTaxLabel(region) {
    if (region === 'gz') return '广州';
    if (region === 'sc') return '四川';
    if (region === 'ha') return '河南';
    return '浙江';
  }

  function areaFromTaxAuthority(authority) {
    var core = String(authority || '')
      .replace(/^.*?税务总局/, '')
      .replace(/税务局.*$/, '');
    var parts = core.match(/[^省市区县]+[省市区县]/g);
    return parts && parts.length ? parts[parts.length - 1] : '';
  }

  function isBonusLikeRecord(r) {
    var t = String((r && (r.income_subtype || r.income_type)) || '');
    return /全年一次性|年终奖|奖金|解除劳动合同|裁员补偿/.test(t);
  }

  function typicalAmount(nums) {
    var rounded = [];
    (nums || []).forEach(function (n) {
      var x = Math.round(Number(n) * 100) / 100;
      if (isFinite(x) && x > 0) rounded.push(x);
    });
    if (!rounded.length) return null;
    var counts = {};
    var best = rounded[0];
    var bestN = 0;
    rounded.forEach(function (n) {
      var k = String(n);
      counts[k] = (counts[k] || 0) + 1;
      if (counts[k] > bestN) {
        bestN = counts[k];
        best = n;
      }
    });
    return best;
  }

  /** 优先用养老个人÷8% 还原基数，否则取常规工资；跳过年终奖 */
  function inferBaseFromRecords(list) {
    var fromPension = [];
    var fromIncome = [];
    (list || []).forEach(function (r) {
      if (isBonusLikeRecord(r)) return;
      var p = Number(r.pension_insurance);
      if (isFinite(p) && p > 0) {
        fromPension.push(Math.round((p / 0.08) * 100) / 100);
      }
      var inc = Number(r.income);
      if (isFinite(inc) && inc > 0) fromIncome.push(inc);
    });
    return typicalAmount(fromPension) || typicalAmount(fromIncome);
  }

  function collectEmployerInfo(d, rangeStart, rangeEnd, region) {
    d = d || {};
    var allRecords = Array.isArray(d.tax_records) ? d.tax_records : [];
    var regionScoped = usesZjCompanySegments(region);
    var records = regionScoped
      ? allRecords.filter(function (r) {
          return taxAuthorityMatchesRegion(r && r.tax_authority, region);
        })
      : allRecords;
    var employers = Array.isArray(d.employers) ? d.employers : [];
    var startN = rangeStart ? ymToNum(rangeStart) : null;
    var endN = rangeEnd ? ymToNum(rangeEnd) : null;
    var allRangeMonths = {};
    var matchedRangeMonths = {};
    function rememberMonth(target, r) {
      var y = Number(r && r.year);
      var m = Number(r && r.month);
      if (!y || !m) return;
      var n = y * 12 + m;
      if (startN != null && n < startN) return;
      if (endN != null && n > endN) return;
      target[y + '-' + pad2(m)] = 1;
    }
    if (regionScoped) {
      allRecords.forEach(function (r) {
        rememberMonth(allRangeMonths, r);
      });
      records.forEach(function (r) {
        rememberMonth(matchedRangeMonths, r);
      });
    }
    var creditByCompany = {};
    var companyByCredit = {};
    employers.forEach(function (e) {
      var cn = e && e.company_name ? String(e.company_name).trim() : '';
      var cc = e && e.credit_code ? String(e.credit_code).trim() : '';
      if (cn && cc && !creditByCompany[cn]) creditByCompany[cn] = cc;
      if (cc && cn && !companyByCredit[cc]) companyByCredit[cc] = cn;
    });
    records.forEach(function (r) {
      var cn = r && r.company_name ? String(r.company_name).trim() : '';
      var cc = r && r.company_tax_id ? String(r.company_tax_id).trim() : '';
      if (cn && cc && !creditByCompany[cn]) creditByCompany[cn] = cc;
      if (cc && cn && !companyByCredit[cc]) companyByCredit[cc] = cn;
    });
    var recs = [];
    records.forEach(function (r) {
      var y = Number(r.year);
      var m = Number(r.month);
      if (!y || !m) return;
      recs.push({
        n: y * 12 + m,
        ym: y + '-' + pad2(m),
        company: r.company_name ? String(r.company_name).trim() : '',
        credit: r.company_tax_id ? String(r.company_tax_id).trim() : '',
        area: areaFromTaxAuthority(r.tax_authority),
        income: r.income,
        pension_insurance: r.pension_insurance,
        income_subtype: r.income_subtype,
        income_type: r.income_type
      });
    });
    recs.sort(function (a, b) {
      return b.n - a.n;
    });
    var companies = [];
    var seen = {};
    /*
     * 逐月任职单位：同月多条（含过渡月两家单位）按记录数取多数；平票取较近记录。
     * 分段身份必须同时包含公司名，不能只按信用代码分组：历史数据可能给两家公司
     * 保存了同一个代码，仍应按各自税务记录自动推导起止月。
     */
    var ymStat = {};
    var minN = null;
    var maxN = null;
    recs.forEach(function (r) {
      if (startN != null && r.n < startN) return;
      if (endN != null && r.n > endN) return;
      if (minN == null || r.n < minN) minN = r.n;
      if (maxN == null || r.n > maxN) maxN = r.n;
      if (r.company && !seen[r.company]) {
        seen[r.company] = 1;
        companies.push(r.company);
      }
      if (r.company || r.credit) {
        var unitKey = r.company + '\u0001' + r.credit + '\u0001' + r.area;
        var s =
          ymStat[r.ym] ||
          (ymStat[r.ym] = {
            counts: Object.create(null),
            units: Object.create(null),
            first: unitKey
          });
        s.units[unitKey] = { company: r.company, credit: r.credit, area: r.area };
        s.counts[unitKey] = (s.counts[unitKey] || 0) + 1;
      }
    });
    var monthUnits = {};
    var monthEmployers = {};
    Object.keys(ymStat).forEach(function (ym) {
      var s = ymStat[ym];
      var best = s.first;
      var bestN = -1;
      Object.keys(s.counts).forEach(function (key) {
        if (s.counts[key] > bestN) {
          bestN = s.counts[key];
          best = key;
        }
      });
      var picked = s.units[best] || {};
      var pickedCompany = picked.company || '';
      var pickedCredit =
        picked.credit || (pickedCompany && creditByCompany[pickedCompany]) || '';
      monthEmployers[ym] = {
        company_name:
          pickedCompany || (pickedCredit && companyByCredit[pickedCredit]) || '',
        credit_code: pickedCredit,
        area: picked.area || ''
      };
      if (pickedCredit) monthUnits[ym] = pickedCredit;
    });
    /* 分段任职：同一公司+信用代码且月份连续时合并；断月后重新起段 */
    var segYmKeys = Object.keys(monthEmployers).sort();
    var segments = [];
    segYmKeys.forEach(function (ym) {
      var picked = monthEmployers[ym] || {};
      var last = segments[segments.length - 1];
      var ymN = ymToNum(ym);
      var lastEndN = last ? ymToNum(last.period_end) : null;
      if (
        last &&
        last.company_name === picked.company_name &&
        last.credit_code === picked.credit_code &&
        last.area === picked.area &&
        ymN != null &&
        lastEndN != null &&
        ymN === lastEndN + 1
      ) {
        last.period_end = ym;
      } else {
        segments.push({
          company_name: picked.company_name || '',
          credit_code: picked.credit_code || '',
          area: picked.area || '',
          period_start: ym,
          period_end: ym
        });
      }
    });
    segments.forEach(function (seg) {
      var start = ymToNum(seg.period_start);
      var end = ymToNum(seg.period_end);
      var matched = recs.filter(function (r) {
        if (start != null && r.n < start) return false;
        if (end != null && r.n > end) return false;
        if (seg.company_name && r.company && r.company !== seg.company_name) return false;
        if (seg.credit_code && r.credit && r.credit !== seg.credit_code) return false;
        return !!(r.company || r.credit);
      });
      var inferred = inferBaseFromRecords(matched);
      if (inferred != null) seg.base_amount = inferred;
    });
    if (!companies.length && !regionScoped) {
      employers.forEach(function (e) {
        var cn = e && e.company_name ? String(e.company_name).trim() : '';
        if (cn && !seen[cn]) {
          seen[cn] = 1;
          companies.push(cn);
        }
      });
      (Array.isArray(d.companies) ? d.companies : []).forEach(function (c) {
        var cn = String(c || '').trim();
        if (cn && !seen[cn]) {
          seen[cn] = 1;
          companies.push(cn);
        }
      });
    }
    var credits = [];
    var creditSeen = {};
    companies.forEach(function (cn) {
      var cc = creditByCompany[cn];
      if (cc && !creditSeen[cc]) {
        creditSeen[cc] = 1;
        credits.push(cc);
      }
    });
    if (!credits.length && !regionScoped && Array.isArray(d.company_tax_ids)) {
      d.company_tax_ids.forEach(function (c) {
        var cc = String(c || '').trim();
        if (cc && !creditSeen[cc]) {
          creditSeen[cc] = 1;
          credits.push(cc);
        }
      });
    }
    var latestCredit = '';
    var latestCompany = '';
    var latestArea = '';
    if (maxN != null) {
      var maxYmStr = numToYm(maxN);
      var latestEmployer = monthEmployers[maxYmStr] || {};
      latestCredit = latestEmployer.credit_code || monthUnits[maxYmStr] || '';
      latestCompany =
        latestEmployer.company_name ||
        (latestCredit && companyByCredit[latestCredit]) ||
        companies[0] ||
        '';
      latestArea = latestEmployer.area || '';
    } else if (companies.length) {
      latestCompany = companies[0];
      latestCredit = creditByCompany[latestCompany] || credits[0] || '';
    }
    var latestBase = null;
    if (segments.length && segments[segments.length - 1].base_amount != null) {
      latestBase = segments[segments.length - 1].base_amount;
    }
    return {
      companies: companies,
      credits: credits,
      latestCompany: latestCompany,
      latestCredit: latestCredit,
      latestArea: latestArea,
      latestBase: latestBase,
      monthUnits: monthUnits,
      segments: segments,
      regionScoped: regionScoped,
      monthCount: Object.keys(monthEmployers).length,
      excludedMonthCount: regionScoped
        ? Object.keys(allRangeMonths).filter(function (ym) {
            return !matchedRangeMonths[ym];
          }).length
        : 0,
      minYm: minN != null ? numToYm(minN) : '',
      maxYm: maxN != null ? numToYm(maxN) : ''
    };
  }

  /* —— 分段任职编辑器（浙江版：多单位 / 多参保地） —— */
  function segmentRowHtml(seg) {
    seg = seg || {};
    if (isApp) {
      return (
        '<div class="sbdy-seg-row seg-card">' +
        '<label class="field-label">单位名称</label>' +
        '<input type="text" class="field seg-company" maxlength="128" value="' +
        esc(seg.company_name || '') +
        '" placeholder="单位名称">' +
        '<label class="field-label">统一社会信用代码</label>' +
        '<input type="text" class="field seg-credit" maxlength="40" value="' +
        esc(seg.credit_code || '') +
        '" placeholder="9133…">' +
        '<div class="grid-2">' +
        '<div><label class="field-label">参保地</label>' +
        '<input type="text" class="field seg-area" maxlength="32" value="' +
        esc(seg.area || '') +
        '" placeholder="如 余杭区"></div>' +
        '<div><label class="field-label">缴费基数</label>' +
        '<input type="number" class="field seg-base" step="0.01" value="' +
        esc(seg.base_amount != null ? seg.base_amount : '') +
        '" placeholder="基数"></div>' +
        '</div>' +
        '<div class="grid-2">' +
        '<div><label class="field-label">起月</label>' +
        '<input type="month" class="field seg-start" value="' +
        esc(seg.period_start || '') +
        '"></div>' +
        '<div><label class="field-label">止月</label>' +
        '<input type="month" class="field seg-end" value="' +
        esc(seg.period_end || '') +
        '"></div>' +
        '</div>' +
        '<button type="button" class="btn btn-secondary seg-del" style="margin-top:8px;">删除本段</button>' +
        '</div>'
      );
    }
    return (
      '<div class="sbdy-seg-row form-row flex-wrap gap-10" style="align-items:flex-end;border-top:1px dashed #e5e7eb;padding-top:8px;margin-top:8px;">' +
      '<div style="flex:2;min-width:180px;"><label>单位名称</label>' +
      '<input type="text" class="seg-company" maxlength="128" value="' +
      esc(seg.company_name || '') +
      '" placeholder="单位名称"></div>' +
      '<div style="flex:2;min-width:160px;"><label>统一社会信用代码</label>' +
      '<input type="text" class="seg-credit" maxlength="40" value="' +
      esc(seg.credit_code || '') +
      '" placeholder="9133…"></div>' +
      '<div><label>参保地</label>' +
      '<input type="text" class="seg-area" maxlength="32" value="' +
      esc(seg.area || '') +
      '" placeholder="如 余杭区"></div>' +
      '<div><label>缴费基数</label>' +
      '<input type="number" class="seg-base" step="0.01" value="' +
      esc(seg.base_amount != null ? seg.base_amount : '') +
      '" placeholder="基数"></div>' +
      '<div><label>起月</label>' +
      '<input type="month" class="seg-start" value="' +
      esc(seg.period_start || '') +
      '"></div>' +
      '<div><label>止月</label>' +
      '<input type="month" class="seg-end" value="' +
      esc(seg.period_end || '') +
      '"></div>' +
      '<div><button type="button" class="btn-page seg-del">删除</button></div>' +
      '</div>'
    );
  }

  function renderSegments(list) {
    var wrap = document.getElementById('sbdySegments');
    if (!wrap) return;
    wrap.innerHTML = (Array.isArray(list) ? list : []).map(segmentRowHtml).join('');
  }

  function addSegment(seg) {
    var wrap = document.getElementById('sbdySegments');
    if (!wrap) return;
    wrap.insertAdjacentHTML('beforeend', segmentRowHtml(seg || {}));
  }

  function clearSegments() {
    renderSegments([]);
  }

  function readSegments() {
    var wrap = document.getElementById('sbdySegments');
    if (!wrap) return [];
    var out = [];
    Array.prototype.forEach.call(wrap.querySelectorAll('.sbdy-seg-row'), function (row) {
      function q(cls) {
        var el = row.querySelector('.' + cls);
        return el ? String(el.value || '').trim() : '';
      }
      var company = q('seg-company');
      var credit = q('seg-credit');
      var start = normalizeYm(q('seg-start'));
      var end = normalizeYm(q('seg-end'));
      /* 江苏版分段可只填参保地+起止月（单位继承主单位），故有起止月即保留 */
      if (!company && !credit && !(start && end)) return;
      var baseRaw = q('seg-base');
      out.push({
        company_name: company,
        credit_code: credit,
        area: q('seg-area'),
        base_amount: baseRaw !== '' ? Number(baseRaw) : undefined,
        period_start: start,
        period_end: end
      });
    });
    return out;
  }

  function prefill() {
    var username = isApp ? '' : val('sbdyPrefillUser');
    if (!isApp && !username) {
      setStatus('请输入用户名', true);
      return;
    }
    var rangeStart = normalizeYm(val('sbdyPrefillStart'));
    var rangeEnd = normalizeYm(val('sbdyPrefillEnd'));
    if (rangeStart && rangeEnd) {
      var ra = ymToNum(rangeStart);
      var rb = ymToNum(rangeEnd);
      if (ra != null && rb != null && ra > rb) {
        var tmp = rangeStart;
        rangeStart = rangeEnd;
        rangeEnd = tmp;
      }
    }
    setStatus('加载用户数据…', false);
    var prefillUrl = isApp
      ? '/api/sbdy-demo/prefill'
      : '/api/admin/sbdy-demo/prefill?username=' + encodeURIComponent(username);
    fetchAdmin(prefillUrl)
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r).then(function (j) {
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
        var g = genderFromId(id) || val('sbdyGender') || '女';
        if (!id) id = defaultDemoIdNumber(currentRegion(), g);
        setField('sbdyName', u.real_name || '');
        setField('sbdyIdNumber', id);
        if (g) setField('sbdyGender', g);
        var info = collectEmployerInfo(d, rangeStart, rangeEnd, currentRegion());
        prefillMonthUnits = info.monthUnits || {};
        if (info.regionScoped && !info.monthCount) {
          clearSegments();
          setField('sbdyCompany', '');
          setField('sbdyCredit', '');
          setField('sbdyPeriodStart', '');
          setField('sbdyPeriodEnd', '');
          setStatus(
            '所选区间没有' +
              regionTaxLabel(currentRegion()) +
              '税务机关记录，外地记录未计入' +
              regionTaxLabel(currentRegion()) +
              '社保',
            true
          );
          return;
        }
        var segList = (info.segments || []).filter(function (s) {
          return s.credit_code || s.company_name;
        });
        var defArea = val('sbdyArea') || '余杭区';
        if (info.latestBase != null) setField('sbdyBase', info.latestBase);
        var defBase = val('sbdyBase') || '4986';
        var keepSelectedWindow = !!(rangeStart && rangeEnd);
        var forceSingleLocalSegment =
          keepSelectedWindow &&
          info.regionScoped &&
          segList.length === 1 &&
          (rangeStart !== info.minYm || rangeEnd !== info.maxYm);
        /* 多段写入下方；江苏上方保留最近单位，供「现参保单位全称」使用 */
        if (
          fillMultiAsSegments({
            segments: segList,
            names: info.companies,
            codes: info.credits,
            area: defArea,
            base: defBase,
            period_start: info.minYm || rangeStart,
            period_end: info.maxYm || rangeEnd,
            force_single: forceSingleLocalSegment,
            summary_company: isJsStyle(currentRegion()) ? info.latestCompany : '',
            summary_credit: isJsStyle(currentRegion()) ? info.latestCredit : ''
          })
        ) {
          if (isJsStyle(currentRegion()) && info.latestArea) setField('sbdyArea', info.latestArea);
        } else {
          clearSegments();
          var oneCo =
            cleanCompanyName(info.latestCompany) ||
            cleanCompanyName(info.companies[0]) ||
            '';
          var oneCr = info.latestCredit || info.credits[0] || '';
          setField('sbdyCompany', oneCo);
          setField('sbdyCredit', oneCr);
          if (info.latestArea) setField('sbdyArea', info.latestArea);
        }
        var ps = rangeStart || info.minYm;
        var pe = rangeEnd || info.maxYm;
        if (ps) setField('sbdyPeriodStart', ps);
        if (pe) setField('sbdyPeriodEnd', pe);
        var parts = [isApp ? '已按我的资料预填' : '已预填「' + username + '」'];
        if (info.companies.length) parts.push(info.companies.length + ' 家单位');
        if (info.regionScoped) {
          parts.push(regionTaxLabel(currentRegion()) + '记录 ' + info.monthCount + ' 个月');
          if (info.excludedMonthCount) {
            parts.push('已排除外地 ' + info.excludedMonthCount + ' 个月');
          }
        }
        var filledSegs = readSegments().length;
        if (filledSegs >= 1) {
          parts.push('已填入下方分段' + filledSegs + '段（可改参保地/基数）');
        } else if (ps && pe) parts.push('区间 ' + ps + '～' + pe);
        setStatus(parts.join(' · ') + '（请核对）', false);
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

  function bindMultiCompanyPromote() {
    ;['sbdyCompany', 'sbdyCredit'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el || el.__sbdyMultiBound) return;
      el.__sbdyMultiBound = true;
      el.addEventListener('blur', function () {
        if (promoteJoinedCompanyField()) {
          setStatus('已将多家单位拆到下方「分段任职」，请补全每段的信用代码与起止月', false);
        }
      });
    });
  }

  function bind() {
    fillDefaults();
    bindGenderAuto();
    bindMultiCompanyPromote();
    document.querySelectorAll('input[name="sbdyRegion"]').forEach(function (el) {
      el.addEventListener('change', function () {
        if (currentRegion() !== 'sz_new') szNewSampleExtras = null;
        if (currentRegion() !== 'js_new') jsNewSampleExtras = null;
        syncRegionUi();
        var r = currentRegion();
        var labels = {
          js_new: '江苏新',
          js: '江苏',
          zj: '浙江',
          sz: '深圳',
          sz_new: '深圳新',
          gz: '广州',
          wh: '武汉',
          hn: '湖南',
          ha: '河南',
          bj: '北京',
          sh: '上海',
          xm: '厦门',
          sc: '四川'
        };
        setStatus(
          '已切换到' + (labels[r] || r) + '版式，请点「填充示例」后再生成，避免沿用上一地区的杭州/外地单位',
          false
        );
      });
    });
    syncRegionUi();
    var fillBtn = document.getElementById('btnSbdyDemoFillSample');
    if (fillBtn) fillBtn.onclick = fillSample;
    var btn = document.getElementById(isApp ? 'btnSbdyGenerate' : 'btnSbdyDemoGenerate');
    if (btn) btn.onclick = generate;
    var refresh = document.getElementById('btnSbdyDemoRefresh');
    if (refresh) {
      refresh.onclick = function () {
        loadList();
        setStatus('列表已刷新', false);
      };
    }
    bindListActions();
    var prefillBtn = document.getElementById('sbdyPrefillBtn');
    if (prefillBtn) prefillBtn.onclick = prefill;
    var pasteFill = document.getElementById('btnSbdyPasteFill');
    if (pasteFill) pasteFill.onclick = pasteFillOnly;
    var pasteGen = document.getElementById('btnSbdyPasteGenerate');
    if (pasteGen) pasteGen.onclick = pasteAndGenerate;
    var pasteClear = document.getElementById('btnSbdyPasteClear');
    if (pasteClear) pasteClear.onclick = clearPasteTemplate;
    var addSeg = document.getElementById('btnSbdyAddSegment');
    if (addSeg) {
      addSeg.onclick = function () {
        addSegment({ area: val('sbdyArea'), base_amount: val('sbdyBase') });
      };
    }
    var segWrap = document.getElementById('sbdySegments');
    if (segWrap && !segWrap.__segBound) {
      segWrap.__segBound = true;
      segWrap.addEventListener('click', function (e) {
        var t = e.target;
        if (t && t.classList && t.classList.contains('seg-del')) {
          var row = t.closest ? t.closest('.sbdy-seg-row') : null;
          if (row && row.parentNode) row.parentNode.removeChild(row);
        }
      });
    }
  }

  function loadPage() {
    bind();
    if (!isApp) loadList();
    if (isApp && APP_CFG && APP_CFG.autoPrefill) {
      prefill();
    }
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['sbdy-demo'] = {
    ready: true,
    loadPage: loadPage,
    generate: generate,
    fillSample: fillSample,
    parsePasteTemplate: parsePasteTemplate,
    extractJsNewTitle: extractJsNewTitle,
    pasteFillOnly: pasteFillOnly,
    pasteAndGenerate: pasteAndGenerate
  };
  global.loadSbdyDemoPage = loadPage;
})(window);
