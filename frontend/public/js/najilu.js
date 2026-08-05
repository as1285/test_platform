(function () {
  var STORAGE_PREFIX = 'tax_issue_records:';

  function pad2(n) {
    n = Number(n) || 0;
    return n < 10 ? '0' + n : String(n);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var SVG_ICON_PREVIEW =
    '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M10 3.8C5.9 3.8 2.2 6.7 1 10c1.2 3.3 4.9 6.2 9 6.2s7.8-2.9 9-6.2c-1.2-3.3-4.9-6.2-9-6.2z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>' +
    '<circle cx="10" cy="10" r="2.6" stroke="currentColor" stroke-width="1.35"/></svg>';

  var SVG_ICON_SAVE =
    '<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M15.2 2.5H6.2a2 2 0 00-2 2v13a2 2 0 002 2h9.8a2 2 0 002-2V7.1l-4.8-4.6z" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round"/>' +
    '<path d="M13.2 2.5v5.2H6.8V2.5" stroke="currentColor" stroke-width="1.35"/>' +
    '<rect x="7" y="11.2" width="6" height="5.3" rx="0.4" stroke="currentColor" stroke-width="1.35"/></svg>';

  function renderApplicationActionBtn(action, id, label, iconSvg) {
    return (
      '<button type="button" class="application-action" data-action="' +
      esc(action) +
      '" data-id="' +
      esc(id) +
      '">' +
      '<span class="application-action-icon">' +
      iconSvg +
      '</span><span class="application-action-text">' +
      esc(label) +
      '</span></button>'
    );
  }

  function getParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name) || '';
    } catch (e) {
      return '';
    }
  }

  function todayYm() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }

  function yearFirstYm() {
    var d = new Date();
    return d.getFullYear() + '-01';
  }

  function ymParts(ym) {
    var p = String(ym || '').split('-');
    return { y: parseInt(p[0], 10) || 1900, m: parseInt(p[1], 10) || 1 };
  }

  function buildYm(y, m) {
    return String(y) + '-' + pad2(m);
  }

  function isAndroidWebView() {
    var ua = navigator.userAgent || '';
    return /Android/i.test(ua) && (/;\s*wv\)/i.test(ua) || /Version\/4\.0/i.test(ua));
  }

  /** Cordova / Android WebView 上 type=month 的 showPicker 常失败，用自定义面板 */
  function shouldUseCustomMonthPicker() {
    var ua = navigator.userAgent || '';
    if (/TaxPlatformCordovaApp\//i.test(ua)) return true;
    if (isAndroidWebView()) return true;
    return false;
  }

  var monthPickerOverlay = null;
  var monthPickerYearSel = null;
  var monthPickerMonthSel = null;
  var monthPickerTargetInput = null;
  var monthPickerOnConfirm = null;
  var monthPickerOverlayBound = false;

  function ensureMonthPickerOverlay() {
    if (monthPickerOverlay) return;
    monthPickerOverlay = document.getElementById('monthPickerOverlay');
    monthPickerYearSel = document.getElementById('monthPickerYear');
    monthPickerMonthSel = document.getElementById('monthPickerMonth');
    if (!monthPickerOverlay || !monthPickerYearSel || !monthPickerMonthSel) return;
    if (monthPickerOverlayBound) return;
    monthPickerOverlayBound = true;

    function closeMonthPicker() {
      monthPickerOverlay.classList.remove('is-open');
      monthPickerOverlay.setAttribute('aria-hidden', 'true');
      monthPickerTargetInput = null;
      monthPickerOnConfirm = null;
    }

    document.getElementById('monthPickerCancel').addEventListener('click', closeMonthPicker);
    monthPickerOverlay.addEventListener('click', function (e) {
      if (e.target === monthPickerOverlay) closeMonthPicker();
    });
    document.getElementById('monthPickerOk').addEventListener('click', function () {
      if (!monthPickerTargetInput) {
        closeMonthPicker();
        return;
      }
      var y = parseInt(monthPickerYearSel.value, 10);
      var m = parseInt(monthPickerMonthSel.value, 10);
      if (!y || !m) {
        closeMonthPicker();
        return;
      }
      monthPickerTargetInput.value = buildYm(y, m);
      monthPickerTargetInput.dispatchEvent(new Event('change', { bubbles: true }));
      var cb = monthPickerOnConfirm;
      closeMonthPicker();
      if (typeof cb === 'function') cb();
    });
  }

  function fillMonthPickerSelects(inp) {
    var minP = ymParts(inp.min || '1900-01');
    var maxP = ymParts(inp.max || todayYm());
    var cur = ymParts(inp.value || todayYm());
    var y;
    monthPickerYearSel.innerHTML = '';
    for (y = minP.y; y <= maxP.y; y++) {
      var optY = document.createElement('option');
      optY.value = String(y);
      optY.textContent = y + '年';
      if (y === cur.y) optY.selected = true;
      monthPickerYearSel.appendChild(optY);
    }
    function refreshMonths() {
      var selY = parseInt(monthPickerYearSel.value, 10) || cur.y;
      var mStart = selY === minP.y ? minP.m : 1;
      var mEnd = selY === maxP.y ? maxP.m : 12;
      var prevM = parseInt(monthPickerMonthSel.value, 10) || cur.m;
      monthPickerMonthSel.innerHTML = '';
      var m;
      for (m = mStart; m <= mEnd; m++) {
        var optM = document.createElement('option');
        optM.value = String(m);
        optM.textContent = m + '月';
        monthPickerMonthSel.appendChild(optM);
      }
      var pick = prevM;
      if (pick < mStart) pick = mStart;
      if (pick > mEnd) pick = mEnd;
      monthPickerMonthSel.value = String(pick);
    }
    monthPickerYearSel.onchange = refreshMonths;
    refreshMonths();
  }

  function openCustomMonthPicker(inp, onAfter) {
    ensureMonthPickerOverlay();
    if (!monthPickerOverlay || !monthPickerYearSel || !monthPickerMonthSel) return;
    monthPickerTargetInput = inp;
    monthPickerOnConfirm = onAfter;
    fillMonthPickerSelects(inp);
    monthPickerOverlay.classList.add('is-open');
    monthPickerOverlay.setAttribute('aria-hidden', 'false');
  }

  function openMonthPickerForInput(inp, onAfter) {
    if (shouldUseCustomMonthPicker()) {
      openCustomMonthPicker(inp, onAfter);
      return;
    }
    inp.focus({ preventScroll: true });
    if (typeof inp.showPicker === 'function') {
      try {
        var ret = inp.showPicker();
        if (ret && typeof ret.then === 'function') {
          ret.catch(function () {
            openCustomMonthPicker(inp, onAfter);
          });
        }
        return;
      } catch (err) {
        openCustomMonthPicker(inp, onAfter);
        return;
      }
    }
    try {
      inp.click();
    } catch (e2) {
      openCustomMonthPicker(inp, onAfter);
    }
  }

  function bindMonthPickerRows(clampOrderFn) {
    document.querySelectorAll('.info-row-month-picker').forEach(function (row) {
      var inp = row.querySelector('.month-picker-native');
      if (!inp) return;
      var touchOpened = false;

      function afterPick() {
        var startInp = document.getElementById('rangeStartInput');
        var endInp = document.getElementById('rangeEndInput');
        var startLab = document.getElementById('rangeStartLabel');
        var endLab = document.getElementById('rangeEndLabel');
        if (inp === startInp && startLab) startLab.textContent = startInp.value;
        if (inp === endInp && endLab) endLab.textContent = endInp.value;
        if (typeof clampOrderFn === 'function') clampOrderFn();
        if (startLab && startInp) startLab.textContent = startInp.value;
        if (endLab && endInp) endLab.textContent = endInp.value;
      }

      function onRowActivate(e) {
        if (e.target.closest && e.target.closest('.mp-help-btn')) return;
        if (e.type === 'click' && touchOpened) return;
        if (e.type === 'touchend') {
          e.preventDefault();
          touchOpened = true;
          setTimeout(function () {
            touchOpened = false;
          }, 450);
        }
        openMonthPickerForInput(inp, afterPick);
      }

      row.addEventListener('click', onRowActivate);
      row.addEventListener('touchend', onRowActivate, { passive: false });

      var lab = row.querySelector('.month-picker-hit');
      if (lab) {
        lab.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          openMonthPickerForInput(inp, afterPick);
        });
      }
    });
  }

  function fmtDateTime(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' +
      pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }

  function compactDate(d) {
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
  }

  function issueDateFromApp(app) {
    var s = String((app && app.apply_time) || '').trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + pad2(m[2]) + pad2(m[3]);
    return app && app.apply_date_compact ? String(app.apply_date_compact) : compactDate(new Date());
  }

  function ymCn(ym) {
    var p = String(ym || '').split('-');
    return (p[0] || '') + '年' + (p[1] || '') + '月';
  }

  function getUserKey() {
    try {
      return localStorage.getItem('user_id') || localStorage.getItem('userName') || 'current';
    } catch (e) {
      return 'current';
    }
  }

  function storageKey() {
    return STORAGE_PREFIX + getUserKey();
  }

  function loadApplications() {
    try {
      var raw = localStorage.getItem(storageKey()) || '[]';
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveApplications(arr) {
    try {
      localStorage.setItem(storageKey(), JSON.stringify(arr.slice(0, 30)));
    } catch (e) {}
  }

  function pushIssueToServer(app) {
    if (typeof window.authFetch !== 'function' || !app) return Promise.resolve(null);
    var body = {
      action: 'log_issue_application',
      application: {
        id: String(app.id || '').substring(0, 128),
        apply_time: String(app.apply_time || '').substring(0, 64),
        period_start: String(app.period_start || '').substring(0, 16),
        period_end: String(app.period_end || '').substring(0, 16),
        record_no: String(app.record_no || '').substring(0, 32),
        scope: String(app.scope != null ? app.scope : '全国').substring(0, 64),
        status: String(app.status != null ? app.status : '制作成功').substring(0, 64),
        query_code: String(app.query_code || '').substring(0, 32)
      }
    };
    return window
      .authFetch('api/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function (r) {
        return r.json();
      })
      .catch(function () {
        return null;
      });
  }

  function fetchIssueApplicationsFromServer() {
    if (typeof window.authFetch !== 'function') return Promise.resolve([]);
    return window
      .authFetch('api/tax?action=list_issue_applications')
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (j && j.code === 200 && j.data && Array.isArray(j.data.applications)) {
          return j.data.applications;
        }
        return [];
      })
      .catch(function () {
        return [];
      });
  }

  /** 合并服务端开具记录到本地（保留本地已有 records 快照） */
  function mergeServerApplications(localApps, serverApps) {
    var byId = {};
    (Array.isArray(localApps) ? localApps : []).forEach(function (app) {
      if (app && app.id) byId[String(app.id)] = app;
    });
    (Array.isArray(serverApps) ? serverApps : []).forEach(function (s) {
      if (!s || !s.id) return;
      var id = String(s.id);
      var prev = byId[id];
      byId[id] = Object.assign({}, prev || {}, {
        id: id,
        apply_time: s.apply_time || (prev && prev.apply_time) || '',
        period_start: s.period_start || (prev && prev.period_start) || '',
        period_end: s.period_end || (prev && prev.period_end) || '',
        record_no: s.record_no || (prev && prev.record_no) || '',
        scope: s.scope || (prev && prev.scope) || '全国',
        status: s.status || (prev && prev.status) || '制作成功',
        query_code: s.query_code || (prev && prev.query_code) || '',
        qr_image_url: s.qr_image_url || (prev && prev.qr_image_url) || '',
        qr_block_image_url: s.qr_block_image_url || (prev && prev.qr_block_image_url) || '',
        user: (prev && prev.user) || undefined,
        records: (prev && prev.records) || undefined
      });
    });
    return Object.keys(byId)
      .map(function (k) {
        return byId[k];
      })
      .sort(function (a, b) {
        return String(b.apply_time || '') < String(a.apply_time || '') ? -1 : 1;
      })
      .slice(0, 30);
  }

  function maskId(id) {
    id = String(id || '');
    if (!id) return '--';
    if (id.length <= 2) return id.charAt(0) + '*';
    return id.charAt(0) + new Array(Math.max(2, id.length - 1)).join('*') + id.charAt(id.length - 1);
  }

  function getLocalUser() {
    var out = {};
    try {
      out.real_name = localStorage.getItem('real_name') || localStorage.getItem('userName') || '';
      out.tax_id = localStorage.getItem('tax_id') || '';
      out.user_id = localStorage.getItem('user_id') || '';
    } catch (e) {}
    return out;
  }

  function cleanText(v) {
    return String(v == null ? '' : v).trim();
  }

  function isDefaultTaxId(v) {
    var t = cleanText(v);
    return (
      !t ||
      t === '620000000000000000' ||
      t === '所有信息点击我要咨询修改' ||
      t === '注册默认： 所有信息点击我要咨询修改'
    );
  }

  function cacheUserInfo(user) {
    try {
      var name = cleanText(user && user.real_name);
      var taxId = cleanText(user && user.tax_id);
      if (name) localStorage.setItem('real_name', name);
      if (taxId && !isDefaultTaxId(taxId)) localStorage.setItem('tax_id', taxId);
    } catch (e) {}
  }

  function mergeUserInfo(local, remote) {
    local = local || {};
    remote = remote || {};
    var merged = Object.assign({}, local, remote);
    var localName = cleanText(local.real_name);
    var remoteName = cleanText(remote.real_name);
    var userId = cleanText(remote.user_id) || cleanText(local.user_id) || getUserKey();
    if (localName && (!remoteName || remoteName === userId)) {
      merged.real_name = localName;
    } else {
      merged.real_name = remoteName || localName;
    }

    var localTaxId = cleanText(local.tax_id);
    var remoteTaxId = cleanText(remote.tax_id);
    if (localTaxId && (!remoteTaxId || isDefaultTaxId(remoteTaxId))) {
      merged.tax_id = localTaxId;
    } else {
      merged.tax_id = isDefaultTaxId(remoteTaxId) ? '' : (remoteTaxId || localTaxId);
    }
    return merged;
  }

  function fetchUserInfo() {
    var local = getLocalUser();
    if (typeof window.authFetch !== 'function') return Promise.resolve(local);
    return window
      .authFetch('api/user?action=info')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.code === 200 && j.data) {
          var merged = mergeUserInfo(local, j.data);
          cacheUserInfo(merged);
          return merged;
        }
        return local;
      })
      .catch(function () {
        return local;
      });
  }

  function fetchTaxRecords() {
    if (typeof window.authFetch !== 'function') {
      return Promise.reject(new Error('登录状态异常，请刷新页面后重试'));
    }
    return window.authFetch('api/tax?action=records')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.code === 200 && j.data && Array.isArray(j.data.records)) return j.data.records;
        throw new Error(j.msg || '纳税记录加载失败');
      });
  }

  function recordYm(r) {
    var y = parseInt(r.year, 10);
    var m = parseInt(r.month, 10);
    if (!y || !m) return '';
    return y + '-' + pad2(m);
  }

  function inRange(r, start, end) {
    var ym = recordYm(r);
    return ym && ym >= start && ym <= end;
  }

  function recordsInPeriod(records, start, end) {
    if (!Array.isArray(records)) return [];
    return normalizeRecords(records.filter(function (r) { return inRange(r, start, end); }));
  }

  function periodText(start, end) {
    return start + '至' + end;
  }

  function periodCn(start, end) {
    return ymCn(start) + '至' + ymCn(end);
  }

  function displayTaxPeriodFromRecord(r) {
    var tp = cleanText(r && r.tax_period);
    if (tp) {
      var m = tp.match(/^(\d{4})[-/.](\d{1,2})/);
      if (m) return m[1] + '.' + pad2(m[2]);
      return tp.replace(/-/g, '.');
    }
    var ym = recordYm(r);
    return ym ? ym.replace('-', '.') : '';
  }

  function money(v) {
    var n = Number(String(v == null ? '' : v).replace(/,/g, ''));
    if (isNaN(n)) n = 0;
    return n.toFixed(2);
  }

  /** 个税记录「申报日期」录入值 → 凭证表 YYYY.MM.DD */
  function formatReportDateForCert(raw) {
    if (raw == null || raw === '') return '';
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      return raw.getFullYear() + '.' + pad2(raw.getMonth() + 1) + '.' + pad2(raw.getDate());
    }
    var s = String(raw).trim();
    if (!s) return '';
    var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return iso[1] + '.' + pad2(iso[2]) + '.' + pad2(iso[3]);
    var slash = s.match(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})/);
    if (slash) return slash[1] + '.' + pad2(slash[2]) + '.' + pad2(slash[3]);
    return s.replace(/-/g, '.').replace(/\//g, '.');
  }

  function displayReportDateFromRecord(r) {
    var d = formatReportDateForCert(r && r.report_date);
    if (d) return d;
    var ym = recordYm(r);
    if (!ym) return '';
    return ym.replace('-', '.') + '.03';
  }

  /** 入(退)库日期：有录入则同申报日期，否则回退 */
  function displayInboundDateFromRecord(r) {
    return displayReportDateFromRecord(r);
  }

  function formatDateCn(raw, fallbackYm) {
    var s = String(raw || '').trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return m[1] + '年' + pad2(m[2]) + '月' + pad2(m[3]) + '日';
    if (fallbackYm) {
      var p = String(fallbackYm).split('-');
      return (p[0] || '') + '年' + pad2(p[1] || '1') + '月01日';
    }
    return '';
  }

  /** 凭证表「所得项目」：库内多为「工资薪金」，展示需带「所得」 */
  function displayIncomeTypeForCert(r) {
    var s = cleanText(r && r.income_type) || '工资薪金';
    if (s.endsWith('所得')) return s;
    return s + '所得';
  }

  function rowRemark(r) {
    var raw = cleanText(r.remark || r.remarks || r.remark_text);
    if (!raw) return '原始申报';
    raw = raw.replace(/[\r\n\u2028\u2029\u0085]+/g, '');
    raw = raw.replace(/\s+/g, '');
    if (raw === '原申报') return '原始申报';
    return raw;
  }

  /** 章面机关名：官方样式为「国家税务总局××市税务局」，开发区/区局归到所属市 */
  function authorityToCityStampText(raw) {
    var v = cleanText(raw);
    if (!v || /^[\dA-Z]{15,20}$/.test(v)) return '';

    // 已是「××市」：国家税务总局武汉市东湖… / 深圳市南山区…
    var city =
      (v.match(/国家税务总局\s*([\u4e00-\u9fa5]{2,6}?市)/) || [])[1] ||
      (v.match(/国家税务局\s*([\u4e00-\u9fa5]{2,6}?市)/) || [])[1] ||
      '';

    // 无「市」字的开发区/高新区等：武汉东湖新技术开发区 → 武汉市
    if (!city) {
      var zone =
        v.match(
          /国家税务总局\s*([\u4e00-\u9fa5]{2,3})(?:东湖|高新|经济技术|经济|技术|产业|保税|旅游|化学工业)?(?:开发区|高新技术产业开发区|新技术开发区|工业园区|新区)/
        ) || [];
      if (zone[1]) city = zone[1] + '市';
    }

    // 仍无市：尝试「××区税务局」前的地级地名（不含「市」的表述）
    if (!city) {
      var dist = (v.match(/国家税务总局\s*([\u4e00-\u9fa5]{2,3})(?:[\u4e00-\u9fa5]{0,6}?)区税务局/) || [])[1];
      // 排除「市辖区」等；常见如「黄岛区」不好推断，仅在明确地级前缀时使用
      if (dist && /^(武汉|广州|深圳|成都|杭州|南京|西安|郑州|长沙|青岛|大连|厦门|苏州|宁波|济南|沈阳|哈尔滨|长春|福州|合肥|南昌|昆明|贵阳|南宁|海口|石家庄|太原|呼和浩特|乌鲁木齐|兰州|西宁|银川|拉萨)$/.test(dist)) {
        city = dist + '市';
      }
    }

    if (city) {
      city = city.replace(/.*(重庆|上海|北京|天津)市$/, '$1市');
      if (!/市$/.test(city)) city = city + '市';
      return '国家税务总局' + city + '税务局';
    }

    // 县局保留县级，避免落到错误默认市
    var county = (v.match(/国家税务总局\s*([\u4e00-\u9fa5]{2,8}?县)/) || [])[1];
    if (county) return '国家税务总局' + county + '税务局';

    // 已是完整机关名则原样用于盖章，与表格入库税务机关一致
    if (/^国家税务总局.+税务局$/.test(v)) return v;

    if (v.indexOf('深圳') >= 0) return '国家税务总局深圳市税务局';
    return '';
  }

  function stampAuthority(rows) {
    rows = Array.isArray(rows) ? rows : [];
    var firstRaw = '';
    for (var i = 0; i < rows.length; i++) {
      var raw = cleanText(rows[i] && rows[i].tax_authority);
      if (!raw || /^[\dA-Z]{15,20}$/.test(raw)) continue;
      if (!firstRaw) firstRaw = raw;
      var t = authorityToCityStampText(raw);
      if (t) return t;
    }
    if (firstRaw && /税务局/.test(firstRaw)) return firstRaw;
    return '国家税务总局深圳市税务局';
  }

  function queryCode(app) {
    var existing = cleanText(app && app.query_code).replace(/\s+/g, '').toUpperCase();
    if (/^[A-Z0-9]{16}$/.test(existing)) return existing;
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var seed = cleanText((app && app.id) || '') + cleanText((app && app.record_no) || '') + issueDateFromApp(app);
    var h = 2166136261;
    for (var i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    var out = '';
    for (var j = 0; j < 16; j++) {
      h ^= h << 13;
      h ^= h >>> 17;
      h ^= h << 5;
      h >>>= 0;
      out += chars.charAt(h % chars.length);
    }
    return out;
  }

  function queryCodeLine(code, offset, count) {
    var parts = [];
    for (var i = 0; i < count; i++) {
      parts.push(code.slice(offset + i * 4, offset + i * 4 + 4));
    }
    return parts.join(' ');
  }

  function rmbUpper(amount) {
    var n = Math.round((Number(amount) || 0) * 100);
    if (n === 0) return '零元整';
    var fraction = ['角', '分'];
    var digit = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
    var unit = [
      ['元', '万', '亿'],
      ['', '拾', '佰', '仟']
    ];
    var head = Math.floor(n / 100);
    var tail = n % 100;
    var s = '';
    for (var i = 0; i < fraction.length; i++) {
      var d = Math.floor(tail / (i === 0 ? 10 : 1)) % 10;
      s += d ? digit[d] + fraction[i] : '';
    }
    if (s && tail % 10 === 0) s += '整';
    s = s || '整';
    var integer = '';
    var unitPos = 0;
    var needZero = false;
    while (head > 0) {
      var section = head % 10000;
      if (needZero && section > 0 && section < 1000) integer = digit[0] + integer;
      var sectionText = '';
      var sectionZero = true;
      for (var p = 0; p < 4; p++) {
        var num = section % 10;
        if (num === 0) {
          if (!sectionZero) sectionZero = true;
        } else {
          if (sectionZero && sectionText) sectionText = digit[0] + sectionText;
          sectionZero = false;
          sectionText = digit[num] + unit[1][p] + sectionText;
        }
        section = Math.floor(section / 10);
      }
      if (sectionText) integer = sectionText + unit[0][unitPos] + integer;
      needZero = head % 10000 < 1000 && head % 10000 > 0;
      head = Math.floor(head / 10000);
      unitPos++;
    }
    return integer.replace(/零+/g, '零').replace(/零元/, '元') + s;
  }

  function normalizeRecords(records) {
    return records.slice().sort(function (a, b) {
      var ay = recordYm(a);
      var by = recordYm(b);
      if (ay !== by) return ay < by ? -1 : 1;
      return String(a.id || '') < String(b.id || '') ? -1 : 1;
    });
  }

  function findApplication(id) {
    var apps = loadApplications();
    for (var i = 0; i < apps.length; i++) {
      if (String(apps[i].id) === String(id)) return apps[i];
    }
    return null;
  }

  function deleteApplication(id) {
    var apps = loadApplications();
    var next = apps.filter(function (app) {
      return String(app.id) !== String(id);
    });
    if (next.length === apps.length) {
      return false;
    }
    saveApplications(next);
    return true;
  }

  var APP_LONG_PRESS_MS = 550;
  var appLongPressTimer = null;
  var appLongPressTriggered = false;

  function clearApplicationLongPress() {
    if (appLongPressTimer) {
      clearTimeout(appLongPressTimer);
      appLongPressTimer = null;
    }
    document.querySelectorAll('.application-card.is-longpress').forEach(function (el) {
      el.classList.remove('is-longpress');
    });
  }

  function confirmDeleteApplication(id) {
    var app = findApplication(id);
    if (!app) {
      alert('申请记录不存在');
      return;
    }
    var period = periodText(app.period_start, app.period_end);
    if (!confirm('确定删除这条申请记录？\n税款所属期：' + period)) {
      return;
    }
    if (!deleteApplication(id)) {
      alert('删除失败');
      return;
    }
    renderApplicationsPage();
  }

  function startApplicationLongPress(cardEl, id) {
    clearApplicationLongPress();
    appLongPressTriggered = false;
    if (cardEl) {
      cardEl.classList.add('is-longpress');
    }
    appLongPressTimer = setTimeout(function () {
      appLongPressTriggered = true;
      clearApplicationLongPress();
      confirmDeleteApplication(id);
    }, APP_LONG_PRESS_MS);
  }

  function renderBackBtn(backHref) {
    var href =
      backHref === 'back' || backHref === ':back' || backHref == null || backHref === ''
        ? 'javascript:history.back()'
        : esc(backHref);
    return (
      '<a href="' +
      href +
      '" class="back-btn"><img src="/jt.png" class="back-icon" alt=""><span>返回</span></a>'
    );
  }

  function renderHeader(title, backHref, rightHtml) {
    return (
      '<div class="header">' +
      renderBackBtn(backHref === undefined ? 'najilu.html' : backHref) +
      '<span class="header-title">' +
      esc(title) +
      '</span>' +
      (rightHtml || '') +
      '</div>'
    );
  }

  function renderPreviewDetailHeader() {
    return (
      '<div class="header header--detail">' +
      '<a href="javascript:history.back()" class="back-btn" aria-hidden="true" tabindex="-1"><img src="/jt.png" class="back-icon" alt=""><span>返回</span></a>' +
      '<span class="header-title">纳税记录详情</span>' +
      '<a href="javascript:history.back()" class="header-close-btn">关闭</a>' +
      '</div>'
    );
  }

  function renderApplicationsPage() {
    document.title = '纳税记录申请记录';
    var apps = loadApplications();
    function paint(list) {
      var html =
        '<div class="record-page">' +
        renderHeader('纳税记录申请记录', 'back') +
        '<div class="record-tips">' +
        '<div>温馨提示：</div>' +
        '<div>1.仅支持查询最近30天（含30天）内开具的纳税记录，如有需要，请重新开具；</div>' +
        '<div>2.若您对纳税记录的内容有疑问，请<a href="#" style="color:#1677ff;text-decoration:none;">点此帮助</a>；</div>' +
        '<div>3.长按记录可删除。</div>' +
        '</div><div class="application-list">';

      if (!list.length) {
        html += '<div class="empty-records">暂无申请记录</div>';
      } else {
        list.forEach(function (app) {
          html +=
            '<div class="application-card" data-id="' +
            esc(app.id) +
            '">' +
            '<div class="application-line"><span class="application-label">申请时间：</span><span class="application-time">' +
            esc(app.apply_time) +
            '</span></div>' +
            '<div class="application-line"><span class="application-label">税款所属期：</span><span class="application-value">' +
            esc(periodText(app.period_start, app.period_end)) +
            '</span><span class="application-status">' +
            esc(app.status || '制作成功') +
            '</span></div>' +
            '<div class="application-line"><span class="application-label">开具范围：</span><span class="application-value">' +
            esc(app.scope || '全国') +
            '</span></div>' +
            '<div class="application-actions">' +
            renderApplicationActionBtn('preview', app.id, '预览', SVG_ICON_PREVIEW) +
            renderApplicationActionBtn('save', app.id, '保存', SVG_ICON_SAVE) +
            '</div></div>';
        });
      }
      html += '</div></div>';
      document.body.innerHTML = html;
      bindApplicationListEvents();
    }

    paint(apps);
    fetchIssueApplicationsFromServer().then(function (serverApps) {
      if (!serverApps || !serverApps.length) return;
      var merged = mergeServerApplications(loadApplications(), serverApps);
      saveApplications(merged);
      paint(merged);
    });
  }

  function bindApplicationListEvents() {
    var list = document.querySelector('.application-list');
    if (!list || list.getAttribute('data-events-bound') === '1') {
      return;
    }
    list.setAttribute('data-events-bound', '1');

    list.addEventListener('click', function (e) {
      if (appLongPressTriggered) {
        appLongPressTriggered = false;
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      var btn = e.target.closest ? e.target.closest('.application-action') : null;
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var app = findApplication(id);
      if (!app) {
        alert('申请记录不存在');
        return;
      }
      if (btn.getAttribute('data-action') === 'preview') {
        window.location.href = 'najilu.html?view=preview&id=' + encodeURIComponent(id);
      } else {
        saveCertificate(app);
      }
    });

    function onPressStart(ev) {
      if (ev.target.closest && ev.target.closest('.application-action')) {
        return;
      }
      var card = ev.target.closest ? ev.target.closest('.application-card') : null;
      if (!card) {
        return;
      }
      var id = card.getAttribute('data-id');
      if (id) {
        startApplicationLongPress(card, id);
      }
    }

    list.addEventListener('touchstart', onPressStart, { passive: true });
    list.addEventListener('mousedown', onPressStart);
    list.addEventListener('touchend', clearApplicationLongPress);
    list.addEventListener('touchcancel', clearApplicationLongPress);
    list.addEventListener('touchmove', clearApplicationLongPress);
    list.addEventListener('mouseup', clearApplicationLongPress);
    list.addEventListener('mouseleave', clearApplicationLongPress);
  }

  function generateRecord(start, end, user, records) {
    var filtered = recordsInPeriod(records, start, end);
    if (!filtered.length) {
      throw new Error('所选期间暂无纳税明细，无法生成纳税记录');
    }
    var now = new Date();
    var id = 'issue_' + now.getTime();
    var recordNo = String(Math.floor(10000000 + Math.random() * 90000000));
    return {
      id: id,
      apply_time: fmtDateTime(now),
      apply_date_compact: compactDate(now),
      record_no: recordNo,
      period_start: start,
      period_end: end,
      scope: '全国',
      status: '制作成功',
      user: {
        real_name: user.real_name || getUserKey(),
        tax_id: isDefaultTaxId(user.tax_id) ? '' : (user.tax_id || '')
      },
      records: filtered,
      query_code: queryCode({ id: id, record_no: recordNo, apply_date_compact: compactDate(now) })
    };
  }

  function initForm() {
    var rangeStartInput = document.getElementById('rangeStartInput');
    var rangeEndInput = document.getElementById('rangeEndInput');
    var rangeStartLabel = document.getElementById('rangeStartLabel');
    var rangeEndLabel = document.getElementById('rangeEndLabel');
    var ymMax = todayYm();
    var ymDefaultStart = yearFirstYm();
    var ymDefaultEnd = ymMax;
    var btn = document.getElementById('generateBtn');

    fetchUserInfo().then(function (user) {
      var idEl = document.querySelector('.info-card .info-row:nth-child(2) .info-value');
      if (idEl) {
        idEl.textContent = maskId(user.tax_id);
        idEl.classList.remove('placeholder');
      }
    });

    if (rangeStartInput && rangeEndInput) {
      rangeStartInput.max = ymMax;
      rangeEndInput.max = ymMax;
      rangeStartInput.value = ymDefaultStart;
      rangeEndInput.value = ymDefaultEnd;
      if (rangeStartInput.value > rangeEndInput.value) rangeEndInput.value = rangeStartInput.value;
      rangeStartLabel.textContent = rangeStartInput.value;
      rangeEndLabel.textContent = rangeEndInput.value;

      function clampOrder() {
        if (rangeStartInput.value && rangeEndInput.value && rangeStartInput.value > rangeEndInput.value) {
          rangeEndInput.value = rangeStartInput.value;
          rangeEndLabel.textContent = rangeEndInput.value;
        }
        rangeEndInput.min = rangeStartInput.value || '1900-01';
        rangeStartInput.max = rangeEndInput.value || ymMax;
        if (rangeStartInput.max > ymMax) rangeStartInput.max = ymMax;
        if (rangeEndInput.max !== ymMax) rangeEndInput.max = ymMax;
      }

      rangeStartInput.addEventListener('change', function () {
        rangeStartLabel.textContent = rangeStartInput.value;
        clampOrder();
        rangeEndLabel.textContent = rangeEndInput.value;
      });
      rangeEndInput.addEventListener('change', function () {
        rangeEndLabel.textContent = rangeEndInput.value;
        clampOrder();
        rangeStartLabel.textContent = rangeStartInput.value;
      });
      bindMonthPickerRows(clampOrder);
      document.querySelectorAll('.info-row-month-picker .mp-help-btn').forEach(function (el) {
        el.addEventListener('click', function (e) {
          e.stopPropagation();
          e.preventDefault();
          alert('请选择申请开具纳税记录的起止年月（含起止月）。最早可选 1900 年 1 月，最晚不超过当前月。');
        });
      });
      clampOrder();
    }

    initSlider();

    function resetGenerateBtn() {
      var verified = document.getElementById('sliderHandle');
      var ok = verified && verified.classList.contains('verified');
      btn.disabled = !ok;
      btn.textContent = '生成纳税记录';
    }

    /* bfcache / 异常中断返回：按钮可能仍停在「正在生成…」且禁用，需复位 */
    window.addEventListener('pageshow', function () {
      btn.removeAttribute('data-generating');
      resetGenerateBtn();
    });
    resetGenerateBtn();

    btn.addEventListener('click', function () {
      if (btn.disabled) return;
      if (btn.getAttribute('data-generating') === '1') return;
      btn.setAttribute('data-generating', '1');
      btn.disabled = true;
      btn.textContent = '正在生成...';
      var navigated = false;
      var safetyTimer = setTimeout(function () {
        if (!navigated) {
          btn.removeAttribute('data-generating');
          resetGenerateBtn();
          alert('生成超时，请检查网络后重试；若已开具成功请点「查看申请记录」');
        }
      }, 20000);
      Promise.all([fetchUserInfo(), fetchTaxRecords()])
        .then(function (ret) {
          var app = generateRecord(rangeStartInput.value, rangeEndInput.value, ret[0], ret[1]);
          var apps = loadApplications();
          apps.unshift(app);
          saveApplications(apps);
          return pushIssueToServer(app).then(function () {
            return app;
          });
        })
        .then(function () {
          navigated = true;
          clearTimeout(safetyTimer);
          window.location.replace('najilu.html?view=records');
        })
        .catch(function (err) {
          clearTimeout(safetyTimer);
          btn.removeAttribute('data-generating');
          alert(err && err.message ? err.message : '生成失败');
          resetGenerateBtn();
        });
    });

    document.getElementById('viewRecordsLink').addEventListener('click', function (e) {
      e.preventDefault();
      window.location.href = 'najilu.html?view=records';
    });
  }

  function initSlider() {
    var lane = document.getElementById('sliderLane');
    var handle = document.getElementById('sliderHandle');
    var hint = document.getElementById('sliderHint');
    var btn = document.getElementById('generateBtn');
    var maxX = 0;
    var startLeft = 0;
    var startClientX = 0;
    var dragging = false;

    function layout() {
      maxX = Math.max(0, lane.offsetWidth - handle.offsetWidth);
    }
    function setHandle(x) {
      x = Math.max(0, Math.min(x, maxX));
      handle.style.left = x + 'px';
    }
    function resetSlider() {
      handle.style.left = '0px';
      handle.classList.remove('verified');
      hint.textContent = '请按住滑块，拖动到最右边';
      hint.style.color = '#c0c0c0';
      btn.disabled = true;
    }
    function onPointerDown(e) {
      if (handle.classList.contains('verified')) return;
      dragging = true;
      layout();
      startLeft = handle.offsetLeft;
      startClientX = e.clientX != null ? e.clientX : e.touches[0].clientX;
      e.preventDefault();
    }
    function onPointerMove(e) {
      if (!dragging) return;
      var cx = e.clientX != null ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : 0);
      setHandle(startLeft + cx - startClientX);
      e.preventDefault();
    }
    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      layout();
      if (handle.offsetLeft >= maxX - 2) {
        handle.classList.add('verified');
        hint.textContent = '验证通过';
        hint.style.color = '#52c41a';
        btn.disabled = false;
      } else {
        resetSlider();
      }
    }

    handle.addEventListener('mousedown', onPointerDown);
    handle.addEventListener('touchstart', onPointerDown, { passive: false });
    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchend', onPointerUp);
    document.addEventListener('touchcancel', onPointerUp);
    window.addEventListener('resize', function () {
      if (!handle.classList.contains('verified')) {
        layout();
        setHandle(handle.offsetLeft);
      }
    });
    layout();
  }

  function drawText(ctx, text, x, y, opt) {
    opt = opt || {};
    ctx.save();
    ctx.fillStyle = opt.color || '#222';
    ctx.font = (opt.weight ? opt.weight + ' ' : '') + (opt.size || 28) + 'px ' + (opt.font || 'serif');
    ctx.textAlign = opt.align || 'left';
    ctx.textBaseline = opt.baseline || 'alphabetic';
    var px = Math.round(x);
    var py = Math.round(y);
    ctx.fillText(String(text == null ? '' : text), px, py);
    ctx.restore();
  }

  /** 左上角「(YYYY)MMDD 记录 编号」：编号为红色 */
  function formatCertRecordIdDate(compactDate) {
    var s = String(compactDate || '').replace(/\D/g, '');
    if (s.length >= 8) {
      return '(' + s.slice(0, 4) + ')' + s.slice(4, 8);
    }
    return String(compactDate || '');
  }

  function drawRecordIdLine(ctx, compactDate, recordNo, x, y, opt) {
    opt = opt || {};
    var sz = opt.size || 16;
    var font = opt.font || CERT_TITLE_FONT;
    var prefix = formatCertRecordIdDate(compactDate) + ' 记录 ';
    var no = String(recordNo || '');
    var suffix = ')';
    drawText(ctx, prefix, x, y, { size: sz, color: '#555', font: font });
    ctx.save();
    ctx.font = sz + 'px ' + font;
    ctx.textAlign = 'left';
    var pw = ctx.measureText(prefix).width;
    ctx.restore();
    drawText(ctx, no, x + pw, y, { size: sz, color: '#c62828', font: font });
    ctx.save();
    ctx.font = sz + 'px ' + font;
    ctx.textAlign = 'left';
    var nw = ctx.measureText(no).width;
    ctx.restore();
    drawText(ctx, suffix, x + pw + nw, y, { size: sz, color: '#555', font: font });
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, opt) {
    text = String(text || '');
    var line = '';
    var lines = [];
    for (var i = 0; i < text.length; i++) {
      var test = line + text.charAt(i);
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = text.charAt(i);
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    lines.slice(0, opt && opt.maxLines ? opt.maxLines : 3).forEach(function (ln, idx) {
      drawText(ctx, ln, x, y + idx * lineHeight, opt);
    });
  }

  function drawQr(ctx, x, y, size, seed) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#111';
    var cells = 37;
    var c = size / cells;
    function finder(cx, cy) {
      ctx.fillRect(x + cx * c, y + cy * c, c * 7, c * 7);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + (cx + 1) * c, y + (cy + 1) * c, c * 5, c * 5);
      ctx.fillStyle = '#111';
      ctx.fillRect(x + (cx + 2) * c, y + (cy + 2) * c, c * 3, c * 3);
    }
    finder(1, 1); finder(cells - 8, 1); finder(1, cells - 8);
    var n = 0;
    for (var i = 0; i < String(seed).length; i++) n += String(seed).charCodeAt(i) * (i + 3);
    for (var yy = 0; yy < cells; yy++) {
      for (var xx = 0; xx < cells; xx++) {
        if ((xx < 8 && yy < 8) || (xx >= cells - 8 && yy < 8) || (xx < 8 && yy >= cells - 8)) continue;
        if (((xx * 13 + yy * 7 + n) % 5) < 2 || ((xx * 3 + yy * 11 + n) % 7) < 2) {
          ctx.fillRect(x + xx * c, y + yy * c, c, c);
        }
      }
    }
    ctx.restore();
  }

  /** 右上角二维码：清晰绘制，保证手机可扫 */
  function drawSharpQr(ctx, x, y, size, qrImg, seed) {
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, size, size);
    ctx.imageSmoothingEnabled = false;
    if (qrImg && qrImg.complete && qrImg.naturalWidth) {
      ctx.drawImage(qrImg, x, y, size, size);
    } else {
      drawQr(ctx, x, y, size, seed);
    }
    ctx.restore();
  }

  /** 管理后台整块替换：二维码 +「查询验证码」+ 验证码文字 */
  function drawQrVerifyBlock(ctx, x, y, width, blockImg) {
    if (!blockImg || !blockImg.complete || !blockImg.naturalWidth) return false;
    var nw = blockImg.naturalWidth;
    var nh = blockImg.naturalHeight;
    var h = Math.max(1, Math.round((width * nh) / nw));
    ctx.save();
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, width, h);
    ctx.imageSmoothingEnabled = true;
    if (typeof ctx.imageSmoothingQuality === 'string') {
      ctx.imageSmoothingQuality = 'high';
    }
    ctx.drawImage(blockImg, x, y, width, h);
    ctx.restore();
    return true;
  }

  function loadImageUrl(src) {
    return new Promise(function (resolve) {
      var url = cleanText(src);
      if (!url) {
        resolve(null);
        return;
      }
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = url;
    });
  }

  function resolveCertAssetUrl(raw) {
    var s = cleanText(raw);
    if (!s) return '';
    if (/^https?:\/\//i.test(s) || s.indexOf('data:') === 0) return s;
    if (s.charAt(0) === '/') return s;
    return '/' + s.replace(/^\/+/, '');
  }

  function certificatePublicOrigin() {
    if (typeof window.sitePublicOrigin === 'function') {
      var fromCfg = String(window.sitePublicOrigin() || '').replace(/\/+$/, '');
      if (fromCfg) {
        return fromCfg;
      }
    }
    try {
      var origin = String(window.location.origin || '');
      if (origin) {
        return origin;
      }
    } catch (e0) {}
    return '';
  }

  function buildCertificateVerifyUrl(app) {
    var code = queryCode(app);
    try {
      var u = new URL('najilu.html', certificatePublicOrigin() + '/');
      u.searchParams.set('view', 'verify');
      u.searchParams.set('code', code);
      if (app && app.id) {
        u.searchParams.set('id', String(app.id));
      }
      if (app && app.record_no) {
        u.searchParams.set('record', String(app.record_no));
      }
      return u.href;
    } catch (e1) {
      return (
        certificatePublicOrigin() +
        '/najilu.html?view=verify&code=' +
        encodeURIComponent(code) +
        (app && app.id ? '&id=' + encodeURIComponent(String(app.id)) : '') +
        (app && app.record_no ? '&record=' + encodeURIComponent(String(app.record_no)) : '')
      );
    }
  }

  var TAX_RECORD_HEADER_SRC = '/tax_record_header.png';
  /** 纳税记录页眉楷体（纳税人信息等正文） */
  var CERT_TITLE_FONT = 'KaiTi, STKaiti, "AR PL UKai CN", 楷体, serif';
  /** 页眉整图在画布上的显示宽度（原图约 305px 宽，避免大幅放大导致模糊） */
  var CERT_HEADER_DISPLAY_W = 580;
  /** 导出倍率：2x 像素密度，提升文字/表格/公章清晰度 */
  var CERT_RENDER_SCALE = 2;

  function loadTaxRecordHeader() {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        resolve(null);
      };
      img.src = TAX_RECORD_HEADER_SRC;
    });
  }

  function taxRecordHeaderDisplayHeight(headerImg, targetW) {
    if (!headerImg || !headerImg.naturalWidth) return 0;
    var w = targetW || headerImg.naturalWidth;
    return headerImg.naturalHeight * (w / headerImg.naturalWidth);
  }

  /** 绘制页眉整图（国徽+标题），返回实际占用高度；失败返回 0 */
  function drawTaxRecordHeader(ctx, headerImg, centerX, topY, targetW) {
    if (!headerImg || !headerImg.complete || !headerImg.naturalWidth) return 0;
    var maxW = headerImg.naturalWidth * CERT_RENDER_SCALE;
    var w = Math.min(targetW || headerImg.naturalWidth, maxW);
    var h = taxRecordHeaderDisplayHeight(headerImg, w);
    if (!h) return 0;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    if (typeof ctx.imageSmoothingQuality === 'string') {
      ctx.imageSmoothingQuality = 'high';
    }
    ctx.drawImage(headerImg, centerX - w / 2, topY, w, h);
    ctx.restore();
    return h;
  }

  function drawCertificateTitleFallback(ctx, centerX, certTitleFont) {
    drawText(ctx, '◉', centerX, 72, { size: 40, color: '#b92828', align: 'center' });
    drawText(ctx, '中华人民共和国', centerX, 138, { size: 26, align: 'center', font: certTitleFont });
    drawText(ctx, '个人所得税纳税记录', centerX, 166, { size: 30, align: 'center', font: certTitleFont });
    drawText(ctx, '（原《税收完税证明》）', centerX, 188, { size: 16, align: 'center', font: certTitleFont });
    return 188;
  }

  /** 单页最多显示纳税明细条数（按月份计，超过则分页） */
  var CERT_MAX_ROWS_PER_PAGE = 16;
  /** 每页表格固定行位（数据不足也占满，版式与满页一致） */
  var CERT_TABLE_BODY_SLOTS = 16;
  var CERT_TABLE_HEADER_H = 44;
  var CERT_TABLE_TOTAL_ROW_H = 40;
  var CERT_TABLE_ROW_H = 56;
  var CERT_FOOTER_BLOCK_H = 292;
  var CERT_BODY_FONT = 'SimSun, STSong, serif';
  /** 导出倍率：2x 画布提升文字、表格线与公章锐度（逻辑坐标不变） */
  var CERT_RENDER_SCALE = 2;

  function createCertCanvas(logicalWidth, logicalHeight) {
    var scale = CERT_RENDER_SCALE;
    var canvas = document.createElement('canvas');
    canvas.width = Math.round(logicalWidth * scale);
    canvas.height = Math.round(logicalHeight * scale);
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.imageSmoothingEnabled = true;
    if (typeof ctx.imageSmoothingQuality === 'string') {
      ctx.imageSmoothingQuality = 'high';
    }
    return { canvas: canvas, ctx: ctx };
  }

  function chunkRecords(records, pageSize) {
    pageSize = pageSize || CERT_MAX_ROWS_PER_PAGE;
    if (!records.length) return [[]];
    var pages = [];
    for (var i = 0; i < records.length; i += pageSize) {
      pages.push(records.slice(i, i + pageSize));
    }
    return pages;
  }

  /** C 端：已激活用户导出/预览图带公章；未激活不加章。管理端可显式传 showStamp 覆盖。 */
  function shouldShowClientStamp() {
    try {
      return localStorage.getItem('account_active') === '1';
    } catch (e) {
      return false;
    }
  }

  function renderCertificateDataUrl(app, options) {
    options = options || {};
    var showStamp = Object.prototype.hasOwnProperty.call(options, 'showStamp')
      ? options.showStamp === true
      : shouldShowClientStamp();
    if (options.query_code) {
      app = Object.assign({}, app, { query_code: options.query_code });
    }
    var verifyCode = queryCode(app);
    var verifyUrl = buildCertificateVerifyUrl(app);
    var qrBlockUrl = resolveCertAssetUrl(
      options.qr_block_image_url || options.qrBlockImageUrl || (app && app.qr_block_image_url) || ''
    );
    var qrOnlyUrl = resolveCertAssetUrl(
      options.qr_image_url || options.qrImageUrl || (app && app.qr_image_url) || ''
    );

    function paintCertificatePage(pageRows, pageNum, pageCount, allRows, qrImg, headerImg, qrBlockImg) {
      var isLastPage = pageNum === pageCount;
      var rows = pageRows;
      var width = 1240;
      var rowH = CERT_TABLE_ROW_H;
      var certTitleFont = CERT_BODY_FONT;
      var certHeaderTop = 8;
      var headerBlockH = taxRecordHeaderDisplayHeight(headerImg, CERT_HEADER_DISPLAY_W);
      var certInfoY0 = headerBlockH
        ? certHeaderTop + headerBlockH + 12
        : 218;
      var certInfoLine = 40;
      var x0 = 72;
      var y0 = certInfoY0 + certInfoLine * 2 + 28;
      var tableW = width - x0 * 2;
      var tableBodySlots = CERT_TABLE_BODY_SLOTS;
      var tableBodyH = tableBodySlots * rowH;
      var tableFootH = isLastPage ? CERT_TABLE_TOTAL_ROW_H : 0;
      var tableTotalH = CERT_TABLE_HEADER_H + tableBodyH + tableFootH;
      var footY = y0 + CERT_TABLE_HEADER_H + tableBodyH;
      var explainY = y0 + tableTotalH + 48;
      var height = explainY + CERT_FOOTER_BLOCK_H;
      var dataRowsOnPage = rows.length;
      var renderScale = CERT_RENDER_SCALE;
      var canvas = document.createElement('canvas');
      canvas.width = Math.round(width * renderScale);
      canvas.height = Math.round(height * renderScale);
      var ctx = canvas.getContext('2d');
      ctx.scale(renderScale, renderScale);
      ctx.imageSmoothingEnabled = true;
      if (typeof ctx.imageSmoothingQuality === 'string') {
        ctx.imageSmoothingQuality = 'high';
      }
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = '#d6d6d6';
      ctx.lineWidth = 1;

      drawRecordIdLine(ctx, app.apply_date_compact, app.record_no, x0, 82, {
        size: 16,
        font: certTitleFont
      });
      if (!drawTaxRecordHeader(ctx, headerImg, width / 2, certHeaderTop, CERT_HEADER_DISPLAY_W)) {
        drawCertificateTitleFallback(ctx, width / 2, certTitleFont);
      }
      var usedBlock = drawQrVerifyBlock(ctx, width - 257, 42, 185, qrBlockImg);
      if (!usedBlock) {
        drawSharpQr(ctx, width - 257, 42, 185, qrImg, app.id + verifyCode);
        drawText(ctx, '查询验证码', width - 164, 248, { size: 22, align: 'center', color: '#555' });
        drawText(ctx, queryCodeLine(verifyCode, 0, 3), width - 164, 288, {
          size: 26,
          align: 'center',
          color: '#222',
          font: 'sans-serif'
        });
        drawText(ctx, queryCodeLine(verifyCode, 12, 1), width - 164, 328, {
          size: 26,
          align: 'center',
          color: '#222',
          font: 'sans-serif'
        });
      }

      var name = app.user && app.user.real_name ? app.user.real_name : '';
      var rawTaxId = app.user && app.user.tax_id ? app.user.tax_id : '';
      var taxId = isDefaultTaxId(rawTaxId) ? '' : rawTaxId;
      drawText(ctx, '记录期间： ' + periodCn(app.period_start, app.period_end), x0, certInfoY0, {
        size: 20,
        font: certTitleFont
      });
      drawText(ctx, '纳税人名称： ' + name, x0, certInfoY0 + certInfoLine, { size: 20, font: certTitleFont });
      drawText(ctx, '身份证件类型： 居民身份证', x0, certInfoY0 + certInfoLine * 2, {
        size: 20,
        font: certTitleFont
      });
      drawText(ctx, '纳税人识别号： ' + taxId, 632, certInfoY0 + certInfoLine, { size: 20, font: certTitleFont });
      drawText(ctx, '身份证件号码： ' + taxId, 632, certInfoY0 + certInfoLine * 2, {
        size: 20,
        font: certTitleFont
      });
      drawText(ctx, '金额单位：元', width - x0 - 8, certInfoY0 + certInfoLine * 2 + 2, {
        size: 16,
        color: '#555',
        font: certTitleFont,
        align: 'right'
      });

      var cols = [145, 145, 145, 170, 150, 220, 85];
      var heads = ['申报日期', '实缴(退)金额', '入(退)库日期', '所得项目', '税款所属期', '入库税务机关', '备注'];
      var xx = x0;
      heads.forEach(function (h, i) {
        drawText(ctx, h, xx + cols[i] / 2, y0 + 28, { size: 16, align: 'center', color: '#333' });
        xx += cols[i];
      });

      var remarkColW = cols[6];
      var remarkColX = x0;
      for (var ci = 0; ci < 6; ci++) remarkColX += cols[ci];
      var remarks = rows.map(rowRemark);
      var mergedRemark = null;
      if (remarks.length > 0) {
        var remarkFirst = remarks[0];
        var remarksAllSame = true;
        for (var ri = 1; ri < remarks.length; ri++) {
          if (remarks[ri] !== remarkFirst) {
            remarksAllSame = false;
            break;
          }
        }
        if (remarksAllSame) mergedRemark = remarkFirst;
      }

      function drawRemarkCell(remark, cellX, cellY) {
        var cellPad = 8;
        var maxW = Math.max(24, remarkColW - cellPad);
        var sz = 16;
        remark = String(remark == null ? '' : remark);
        ctx.save();
        ctx.font = sz + 'px serif';
        while (sz > 10 && ctx.measureText(remark).width > maxW) {
          sz -= 1;
          ctx.font = sz + 'px serif';
        }
        ctx.restore();
        drawText(ctx, remark, cellX + remarkColW / 2, cellY, { size: sz, align: 'center', color: '#333' });
      }

      rows.forEach(function (r, idx) {
        var y = y0 + 44 + idx * rowH;
        var vals = [
          displayReportDateFromRecord(r),
          money(r.tax_reported),
          displayInboundDateFromRecord(r),
          displayIncomeTypeForCert(r),
          displayTaxPeriodFromRecord(r),
          r.tax_authority || '',
          rowRemark(r)
        ];
        var cx = x0;
        vals.forEach(function (v, i) {
          if (i === 5) {
            ctx.font = '16px serif';
            wrapText(ctx, v, cx + 10, y + 25, cols[i] - 18, 22, { size: 16, color: '#333', maxLines: 2 });
          } else if (i === 6) {
            if (mergedRemark == null) {
              drawRemarkCell(v, cx, y + 42);
            }
          } else {
            drawText(ctx, v, cx + cols[i] / 2, y + 42, { size: 16, align: 'center', color: '#333' });
          }
          cx += cols[i];
        });
      });

      if (mergedRemark != null && dataRowsOnPage > 0) {
        var dataBodyMidY = y0 + CERT_TABLE_HEADER_H + (dataRowsOnPage * rowH) / 2 + 10;
        drawRemarkCell(mergedRemark, remarkColX, dataBodyMidY);
      }

      ctx.strokeRect(x0, y0, tableW, tableTotalH);
      if (isLastPage) {
        var total = allRows.reduce(function (sum, r) {
          return sum + Number(r.tax_reported || 0);
        }, 0);
        drawText(ctx, '金额合计', x0 + cols[0] / 2, footY + 26, { size: 16, align: 'center' });
        drawText(ctx, rmbUpper(total), x0 + cols[0] + 28, footY + 26, { size: 16 });
      }

      ctx.beginPath();
      ctx.moveTo(x0, explainY - 28);
      ctx.lineTo(width - x0, explainY - 28);
      ctx.stroke();
      drawText(ctx, '说明：', 90, explainY, { size: 18, color: '#555' });
      drawText(ctx, '1.本记录涉及纳税人敏感信息，请妥善保存。', 90, explainY + 42, { size: 16, color: '#999' });
      drawText(ctx, '2.您可以通过以下方式对本记录进行验证：', 90, explainY + 76, { size: 16, color: '#999' });
      drawText(ctx, '（1）通过手机App扫描右上角二维码进行验证；', 112, explainY + 110, { size: 16, color: '#999' });
      drawText(ctx, '（2）通过自然人电子税务局输入右上角查询验证码进行验证；', 112, explainY + 144, { size: 16, color: '#999' });
      drawText(ctx, '3.不同打印设备造成的色差不影响使用效力。', 90, explainY + 178, { size: 16, color: '#999' });
      drawText(ctx, '本凭证不作为纳税人记账、抵扣凭证', 90, explainY + 232, { size: 20, color: '#555' });
      drawText(ctx, '开具机关（盖章）', width - 430, explainY + 138, { size: 20, color: '#555' });
      drawText(ctx, '开具时间： ' + formatDateCn(app.apply_time, app.period_end), width - 430, explainY + 212, { size: 20, color: '#555' });
      drawText(ctx, '当前第' + pageNum + '页，共' + pageCount + '页', width - 230, explainY + 268, {
        size: 18,
        color: '#555'
      });
      if (showStamp) {
        /* 压住「盖章」，底缘贴近开具时间，对齐官方电子章 */
        drawStamp(ctx, width - 238, explainY + 122, stampAuthority(allRows));
      }
      return canvas.toDataURL('image/png');
    }

    function paintAllPages(qrImg, headerImg, qrBlockImg) {
      var allRows = normalizeRecords(app.records || []);
      var pageChunks = chunkRecords(allRows, CERT_MAX_ROWS_PER_PAGE);
      return pageChunks.map(function (pageRows, idx) {
        return paintCertificatePage(
          pageRows,
          idx + 1,
          pageChunks.length,
          allRows,
          qrImg,
          headerImg,
          qrBlockImg
        );
      });
    }

    return loadTaxRecordHeader().then(function (headerImg) {
      function finishWithQr(qrImg, qrBlockImg) {
        var urls = paintAllPages(qrImg, headerImg, qrBlockImg);
        return urls.length === 1 ? urls[0] : urls;
      }

      if (qrBlockUrl) {
        return loadImageUrl(qrBlockUrl).then(function (blockImg) {
          return finishWithQr(null, blockImg);
        });
      }

      if (qrOnlyUrl) {
        return loadImageUrl(qrOnlyUrl).then(function (customQr) {
          return finishWithQr(customQr, null);
        });
      }

      if (typeof QRCode === 'undefined' || typeof QRCode.toDataURL !== 'function') {
        return finishWithQr(null, null);
      }
      return new Promise(function (resolve) {
        QRCode.toDataURL(
          verifyUrl,
          {
            width: 185 * CERT_RENDER_SCALE,
            margin: 1,
            errorCorrectionLevel: 'H',
            color: { dark: '#000000', light: '#ffffff' }
          },
          function (err, dataUrl) {
            if (err || !dataUrl) {
              resolve(finishWithQr(null, null));
              return;
            }
            var img = new Image();
            img.onload = function () {
              resolve(finishWithQr(img, null));
            };
            img.onerror = function () {
              resolve(finishWithQr(null, null));
            };
            img.src = dataUrl;
          }
        );
      });
    });
  }

  function certificateImageHtml(urlOrUrls, imgClass, altBase) {
    var urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
    imgClass = imgClass || 'preview-img';
    altBase = altBase || '纳税记录';
    return urls
      .map(function (u, i) {
        var alt = urls.length > 1 ? altBase + '第' + (i + 1) + '页' : altBase;
        var gap = i < urls.length - 1 ? ' style="margin-bottom:12px"' : '';
        return '<img src="' + u + '" class="' + imgClass + '" alt="' + esc(alt) + '"' + gap + '>';
      })
      .join('');
  }

  /** 横排文字，可加大字间距（章内「业务专用章」） */
  function drawSpacedText(ctx, text, cx, y, opt) {
    opt = opt || {};
    text = String(text == null ? '' : text);
    if (!text) return;
    var gap = opt.letterGap != null ? opt.letterGap : 5;
    var chars = text.split('');
    ctx.save();
    ctx.fillStyle = opt.color || '#222';
    ctx.strokeStyle = opt.color || '#222';
    ctx.lineWidth = opt.strokeWidth != null ? opt.strokeWidth : 0;
    ctx.font =
      (opt.weight ? opt.weight + ' ' : '') +
      (opt.size || 16) +
      'px ' +
      (opt.font || 'serif');
    ctx.textBaseline = opt.baseline || 'alphabetic';
    var widths = chars.map(function (ch) {
      return ctx.measureText(ch).width;
    });
    var totalW = widths.reduce(function (s, w) {
      return s + w;
    }, 0);
    if (chars.length > 1) {
      totalW += gap * (chars.length - 1);
    }
    var x = cx - totalW / 2;
    chars.forEach(function (ch, idx) {
      ctx.textAlign = 'left';
      ctx.fillText(ch, x, y);
      if (ctx.lineWidth > 0) {
        ctx.strokeText(ch, x, y);
      }
      x += widths[idx] + (idx < chars.length - 1 ? gap : 0);
    });
    ctx.restore();
  }

  /** 沿圆弧按字宽 + 额外间距排字（公章上弧机关名） */
  function drawArcText(ctx, text, cx, cy, radius, startAngle, endAngle, opt) {
    text = String(text || '');
    if (!text) return;
    opt = opt || {};
    var color = opt.color || '#c01820';
    var strokeW = opt.strokeWidth != null ? opt.strokeWidth : 0.55;
    var chars = text.split('');
    var mid = (startAngle + endAngle) / 2;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = strokeW;
    ctx.font =
      (opt.weight ? opt.weight + ' ' : '') +
      (opt.size || 16) +
      'px ' +
      (opt.font || 'SimSun, STSong, serif');
    var widths = chars.map(function (ch) {
      return ctx.measureText(ch).width;
    });

    function paintAtAngle(angle, ch) {
      ctx.save();
      ctx.translate(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.rotate(angle + Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ch, 0, 0);
      if (strokeW > 0) {
        ctx.strokeText(ch, 0, 0);
      }
      ctx.restore();
    }

    if (opt.arcLetterGap != null && chars.length > 1) {
      var gapPx = Number(opt.arcLetterGap) || 0;
      var maxSpan = opt.maxSpanRad != null ? opt.maxSpanRad : Math.PI * 1.05;
      var totalW = widths.reduce(function (s, w) {
        return s + w;
      }, 0);
      totalW += gapPx * (chars.length - 1);
      var totalAngle = totalW / radius;
      if (totalAngle > maxSpan && gapPx > 1) {
        gapPx = Math.max(1, ((maxSpan * radius - widths.reduce(function (s, w) {
          return s + w;
        }, 0)) / (chars.length - 1)));
        totalW = widths.reduce(function (s2, w2) {
          return s2 + w2;
        }, 0) + gapPx * (chars.length - 1);
        totalAngle = totalW / radius;
      }
      var angle = mid - totalAngle / 2;
      chars.forEach(function (ch, idx) {
        var half = widths[idx] / 2 / radius;
        angle += half;
        paintAtAngle(angle, ch);
        angle += half;
        if (idx < chars.length - 1) {
          angle += gapPx / radius;
        }
      });
      ctx.restore();
      return;
    }

    var span = endAngle - startAngle;
    chars.forEach(function (ch, idx) {
      var t = chars.length === 1 ? 0.5 : idx / (chars.length - 1);
      paintAtAngle(startAngle + span * t, ch);
    });
    ctx.restore();
  }

  /** 纳税记录右下角章（标准单圈：细红圆框、上弧机关名、正中「业务专用章」） */
  function drawStamp(ctx, cx, cy, authority) {
    var name =
      authorityToCityStampText(authority) ||
      cleanText(authority) ||
      '国家税务总局深圳市税务局';
    var stampRed = '#e53935';
    var radius = 90;
    var font = 'STSong, SimSun, "Songti SC", "Noto Serif CJK SC", serif';
    ctx.save();
    ctx.globalAlpha = 0.92;
    if (ctx.globalCompositeOperation) {
      try {
        ctx.globalCompositeOperation = 'multiply';
      } catch (e) {}
    }

    ctx.strokeStyle = stampRed;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();

    var arcR = radius - 15;
    var arcSize = name.length > 14 ? 15.5 : name.length >= 13 ? 16.5 : 17.5;
    var arcGap = name.length > 14 ? 2.4 : name.length >= 13 ? 2.0 : 2.4;
    drawArcText(ctx, name, cx, cy, arcR, Math.PI * 1.12, Math.PI * 1.88, {
      size: arcSize,
      weight: 'bold',
      color: stampRed,
      strokeWidth: 0.5,
      font: font,
      arcLetterGap: arcGap,
      maxSpanRad: Math.PI * 0.92
    });

    drawSpacedText(ctx, '业务专用章', cx, cy + 8, {
      size: 18,
      weight: 'bold',
      color: stampRed,
      letterGap: 5,
      strokeWidth: 0.4,
      font: font,
      baseline: 'middle'
    });
    ctx.restore();
  }

  function replaceApplicationSnapshot(app) {
    var apps = loadApplications();
    for (var i = 0; i < apps.length; i++) {
      if (String(apps[i].id) === String(app.id)) {
        apps[i] = app;
        saveApplications(apps);
        pushIssueToServer(app);
        return;
      }
    }
  }

  function applicationWithCurrentData(app) {
    return Promise.all([fetchUserInfo(), fetchTaxRecords()]).then(function (ret) {
      var user = mergeUserInfo(app.user || {}, ret[0] || {});
      var rows = recordsInPeriod(ret[1], app.period_start, app.period_end);
      if (!rows.length) {
        throw new Error('当前APP数据中所选期间暂无纳税明细，无法生成图片');
      }
      var freshApp = Object.assign({}, app, {
        user: {
          real_name: user.real_name || getUserKey(),
          tax_id: isDefaultTaxId(user.tax_id) ? '' : (user.tax_id || '')
        },
        records: rows
      });
      replaceApplicationSnapshot(freshApp);
      return freshApp;
    });
  }

  function renderPreviewPage(id) {
    var app = findApplication(id);
    document.title = '纳税记录详情';
    if (!app) {
      document.body.innerHTML =
        renderPreviewDetailHeader() + '<div class="empty-records">申请记录不存在</div>';
      return;
    }
    document.body.innerHTML =
      '<div class="preview-page">' +
      renderPreviewDetailHeader() +
      '<div class="preview-wrap"><div class="empty-records" id="previewLoading">正在生成预览...</div><img id="certificatePreview" class="preview-img" alt="纳税记录" style="display:none;"></div>' +
      '</div>';
    applicationWithCurrentData(app)
      .then(function (freshApp) {
        return renderCertificateDataUrl(freshApp).then(function (url) {
          return { url: url, app: freshApp };
        });
      })
      .then(function (ret) {
        var wrap = document.querySelector('.preview-wrap');
        var loading = document.getElementById('previewLoading');
        if (loading) loading.style.display = 'none';
        if (wrap) {
          var urls = Array.isArray(ret.url) ? ret.url : [ret.url];
          wrap.innerHTML = certificateImageHtml(urls[0], 'preview-img', '纳税记录');
        }
      })
      .catch(function (err) {
        var loading = document.getElementById('previewLoading');
        if (loading) loading.textContent = err && err.message ? err.message : '生成预览失败';
      });
  }

  function renderVerifyPage() {
    document.title = '纳税记录验证';
    var code = cleanText(getParam('code')).replace(/\s+/g, '').toUpperCase();
    var record = cleanText(getParam('record'));
    var lineCode = '';
    if (/^[A-Z0-9]{16}$/.test(code)) {
      lineCode = queryCodeLine(code, 0, 3) + ' ' + queryCodeLine(code, 12, 1);
    } else {
      lineCode = code;
    }

    document.body.innerHTML =
      '<div class="verify-page">' +
      renderHeader('纳税记录验证', 'najilu.html') +
      '<div class="verify-body" id="verifyMount"><div class="empty-records">正在查询…</div></div></div>';

    if (!/^[A-Z0-9]{16}$/.test(code)) {
      document.getElementById('verifyMount').innerHTML =
        '<div class="verify-card"><p>查询验证码格式无效。</p>' +
        '<p class="verify-hint">请重新扫描纳税记录上的二维码或核对手动输入的验证码。</p></div>';
      return;
    }

    var qs = 'action=verify_issue&code=' + encodeURIComponent(code);
    if (record) {
      qs += '&record=' + encodeURIComponent(record);
    }
    fetch('api/tax?' + qs)
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        var mount = document.getElementById('verifyMount');
        if (!mount) {
          return;
        }
        var d = j && j.data ? j.data : {};
        if (j.code !== 200 || !d.found) {
          mount.innerHTML =
            '<div class="verify-card">' +
            '<p class="verify-title-bad">未查询到记录</p>' +
            '<p class="verify-desc">未在平台找到与验证码 <strong>' +
            esc(lineCode) +
            '</strong> 匹配的纳税记录开具信息。</p>' +
            '<p class="verify-hint">若记录为近期开具，请确认已联网同步；仅本地保存而未同步的记录无法通过扫码验证。</p>' +
            '</div>';
          return;
        }
        var period = periodText(d.period_start, d.period_end);
        mount.innerHTML =
          '<div class="verify-card">' +
          '<p class="verify-title-ok">验证通过</p>' +
          '<p class="verify-desc">您扫描的二维码对应以下在本平台归档的纳税记录开具信息（摘要）：</p>' +
          '<div class="verify-row"><span class="verify-label">查询验证码</span><span>' +
          esc(lineCode) +
          '</span></div>' +
          '<div class="verify-row"><span class="verify-label">凭证号码</span><span>' +
          esc(d.record_no || '') +
          '</span></div>' +
          '<div class="verify-row"><span class="verify-label">记录期间</span><span>' +
          esc(period) +
          '</span></div>' +
          '<div class="verify-row"><span class="verify-label">申请时间</span><span>' +
          esc(d.apply_time || '') +
          '</span></div>' +
          '<div class="verify-row"><span class="verify-label">开具范围</span><span>' +
          esc(d.scope || '') +
          '</span></div>' +
          '<div class="verify-row"><span class="verify-label">状态</span><span>' +
          esc(d.status || '') +
          '</span></div>' +
          '<p class="verify-footnote">说明：本页已省略纳税人身份信息等敏感字段；完整凭证请以申请人设备中下载的电子版为准。</p>' +
          '</div>';
      })
      .catch(function () {
        var mount = document.getElementById('verifyMount');
        if (mount) {
          mount.innerHTML =
            '<div class="verify-card"><p>网络错误，无法完成验证。</p><p class="verify-hint">请稍后重试。</p></div>';
        }
      });
  }

  function dataUrlToBlob(dataUrl) {
    return fetch(dataUrl).then(function (r) {
      return r.blob();
    });
  }

  function certificateFileName(app, pageInfo) {
    var suffix = '';
    if (pageInfo && pageInfo.total > 1) {
      suffix = '_第' + pageInfo.index + '页共' + pageInfo.total + '页';
    }
    return '纳税记录_' + app.period_start + '_' + app.period_end + suffix + '.png';
  }

  /** iOS / App 内 WebView：a[download] 常会整页跳到系统 PNG 预览且无返回 */
  function needsInAppSaveViewer() {
    try {
      if (typeof window.isCordovaTaxAppShell === 'function' && window.isCordovaTaxAppShell()) {
        return true;
      }
    } catch (e0) {}
    var ua = navigator.userAgent || '';
    return /iPhone|iPad|iPod/i.test(ua);
  }

  function downloadUrl(url, app, pageInfo) {
    var filename = certificateFileName(app, pageInfo);
    function triggerBlobDownload(blob) {
      var objUrl = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = objUrl;
      a.download = filename;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function () {
        try {
          URL.revokeObjectURL(objUrl);
        } catch (e1) {}
      }, 2500);
    }
    if (String(url).indexOf('data:') === 0) {
      dataUrlToBlob(url)
        .then(triggerBlobDownload)
        .catch(function () {
          /* 兜底：仍可能在部分浏览器跳转，优先走应用内保存页 */
          var a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        });
      return;
    }
    triggerBlobDownload(url);
  }

  function shareCertificateImages(urls, app) {
    if (!urls || !urls.length) {
      alert('暂无可保存的图片');
      return Promise.resolve();
    }
    if (!navigator.share) {
      alert('请长按上方图片，选择「存储到相册」或「存储图像」。');
      return Promise.resolve();
    }
    return Promise.all(
      urls.map(function (u, i) {
        return dataUrlToBlob(u).then(function (blob) {
          return new File([blob], certificateFileName(app, { index: i + 1, total: urls.length }), {
            type: 'image/png'
          });
        });
      })
    )
      .then(function (files) {
        if (navigator.canShare && !navigator.canShare({ files: files })) {
          throw new Error('share_unsupported');
        }
        return navigator.share({
          files: files,
          title: '纳税记录'
        });
      })
      .catch(function (err) {
        if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
          return;
        }
        alert('请长按上方图片，选择「存储到相册」或「存储图像」。');
      });
  }

  function renderSaveResultPage(urls, app) {
    document.title = '保存纳税记录';
    document.body.innerHTML =
      '<div class="save-result-page">' +
      renderHeader('保存纳税记录', 'najilu.html?view=records') +
      '<div class="preview-wrap">' +
      certificateImageHtml(urls, 'preview-img', '纳税记录') +
      '</div>' +
      '<div class="save-result-actions">' +
      '<p class="save-result-tip">可点击下方按钮分享并存储到相册；也可长按图片保存。点左上角「返回」回到申请记录。</p>' +
      '<button type="button" class="save-result-btn" id="btnShareCertificate">分享 / 存储到相册</button>' +
      '</div></div>';
    var btn = document.getElementById('btnShareCertificate');
    if (btn) {
      btn.onclick = function () {
        shareCertificateImages(urls, app);
      };
    }
  }

  function saveCertificate(app) {
    applicationWithCurrentData(app)
      .then(function (freshApp) {
        return renderCertificateDataUrl(freshApp).then(function (urlOrUrls) {
          var urls = Array.isArray(urlOrUrls) ? urlOrUrls : [urlOrUrls];
          /* App / iOS：不走 data: 链接触发整页跳转，改为应用内保存页（带返回） */
          if (needsInAppSaveViewer()) {
            renderSaveResultPage(urls, freshApp);
            return;
          }
          urls.forEach(function (u, i) {
            downloadUrl(u, freshApp, { index: i + 1, total: urls.length });
          });
        });
      })
      .catch(function (err) {
        alert(err && err.message ? err.message : '保存失败');
      });
  }

  /** 管理后台用户数据：按 C 端最近一次开具申请（期间 + 记录号 + 查询码）组装凭证 */
  function buildAppFromAdminDetail(data) {
    data = data || {};
    var user = data.user || {};
    var issue = data.latest_issue_application || null;
    if (!issue || !issue.period_start || !issue.period_end) {
      throw new Error('暂无 C 端纳税记录开具记录，无法按用户端版本预览凭证');
    }
    var periodStart = String(issue.period_start);
    var periodEnd = String(issue.period_end);
    var allRecords = normalizeRecords(
      (data.tax_records || []).map(function (r) {
        return {
          year: r.year,
          month: r.month,
          company_name: r.company_name,
          company_tax_id: r.company_tax_id,
          tax_authority: r.tax_authority,
          report_date: r.report_date,
          income: r.income,
          tax_reported: r.tax_reported,
          tax_period: r.tax_period,
          income_type: displayIncomeTypeForCert(r),
          remark: r.remark
        };
      })
    );
    var records = recordsInPeriod(allRecords, periodStart, periodEnd);
    if (!records.length) {
      throw new Error(
        'C 端最近开具期间（' + periodStart + ' 至 ' + periodEnd + '）内暂无个税明细'
      );
    }
    var applyTime = issue.apply_time ? String(issue.apply_time) : fmtDateTime(new Date());
    return {
      id: issue.id ? String(issue.id) : 'admin_' + String(user.username || 'user'),
      record_no: issue.record_no ? String(issue.record_no) : '',
      query_code: issue.query_code ? String(issue.query_code) : '',
      qr_image_url: issue.qr_image_url ? String(issue.qr_image_url) : '',
      qr_block_image_url: issue.qr_block_image_url ? String(issue.qr_block_image_url) : '',
      apply_time: applyTime,
      apply_date_compact: compactDate(new Date(applyTime.replace(/-/g, '/') || Date.now())),
      period_start: periodStart,
      period_end: periodEnd,
      scope: issue.scope ? String(issue.scope) : '全国',
      status: issue.status ? String(issue.status) : '制作成功',
      user: {
        real_name: user.real_name || user.username || '',
        tax_id: user.user_tax_id || user.tax_id || ''
      },
      records: records
    };
  }

  function isNajiluPage() {
    var p = String(window.location.pathname || '');
    return /(?:^|\/)najilu\.html$/i.test(p);
  }

  window.TaxIssueCertificate = {
    renderDataUrl: renderCertificateDataUrl,
    buildAppFromAdminDetail: buildAppFromAdminDetail
  };

  if (isNajiluPage()) {
    var view = getParam('view');
    if (view === 'records') {
      renderApplicationsPage();
    } else if (view === 'preview') {
      renderPreviewPage(getParam('id'));
    } else if (view === 'verify') {
      renderVerifyPage();
    } else {
      initForm();
    }
  }
})();
