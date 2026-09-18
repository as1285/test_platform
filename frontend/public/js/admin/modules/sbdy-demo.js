/** Admin module: 社保演示生成（多段经历 + 同公司多缴费基数） */
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

  function getPageKey() {
    return String(location.hash || '').replace(/^#/, '').trim().toLowerCase();
  }

  function isSichuanPage() {
    return getPageKey() === 'sbdy-sichuan';
  }

  function getCertType() {
    if (isSichuanPage()) return 'sichuan';
    var el = document.getElementById('sbdyCertType');
    var v = el ? String(el.value || '').trim() : val('sbdyCertType');
    if (v === 'linian') return 'linian';
    return 'personal';
  }

  function isLinianMode() {
    return getCertType() === 'linian';
  }

  function isSichuanMode() {
    return getCertType() === 'sichuan';
  }

  function syncCertTypeUi() {
    var linian = isLinianMode();
    var sichuan = isSichuanMode();
    var injury = document.getElementById('sbdyStatusInjuryWrap');
    var unemp = document.getElementById('sbdyStatusUnempWrap');
    var cum = document.getElementById('sbdyCumulativeWrap');
    var extra = document.getElementById('sbdyStatusInjuryExtraWrap');
    var mp = document.getElementById('sbdyMonthsPensionWrap');
    var mu = document.getElementById('sbdyMonthsUnempWrap');
    var mi = document.getElementById('sbdyMonthsInjuryWrap');
    var lab = document.getElementById('sbdyStatusPensionLabel');
    var hint = document.getElementById('sbdySegHint');
    if (injury) injury.style.display = linian ? 'none' : '';
    if (unemp) unemp.style.display = linian ? 'none' : '';
    if (cum) cum.style.display = linian ? '' : 'none';
    if (extra) extra.style.display = sichuan ? '' : 'none';
    if (mp) mp.style.display = sichuan ? '' : 'none';
    if (mu) mu.style.display = sichuan ? '' : 'none';
    if (mi) mi.style.display = sichuan ? '' : 'none';
    if (lab) {
      lab.textContent = linian ? '参保状态' : sichuan ? '当前缴费状态(养老)' : '养老保险状态';
    }
    if (hint) {
      if (linian) {
        hint.innerHTML =
          '历年证明按<strong>参保经历 + 缴费区间</strong>汇总为「年度缴费清单」（跨年自动拆行）。养老/失业个人缴费字段仅个人专用证明使用。';
      } else if (sichuan) {
        hint.innerHTML =
          '四川证明为<strong>横向 A4</strong>：按参保经历生成缴费明细（含单位/个人缴纳）。单位编号填「统一社会信用代码」栏；可填工伤额外状态行模拟双行工伤。';
      } else {
        hint.innerHTML =
          '可添加<strong>多段参保经历</strong>（换单位）；每段经历下可再添加<strong>多个缴费基数区间</strong>（同公司基数变化）。基本情况表「参保单位」只显示最近一段公司。标题「出具证明前N个月」按<strong>证明区间</strong>取 12 或 48；窗口止于打印月的上一自然月（当月社保通常未到账），与实际缴费行数无关。';
      }
    }
    document.querySelectorAll('.sbdy-pay-fields').forEach(function (el) {
      el.style.display = linian ? 'none' : '';
    });
    var typeWrap = document.getElementById('sbdyCertTypeWrap');
    if (typeWrap) typeWrap.style.display = sichuan ? 'none' : '';
    var winWrap = document.getElementById('sbdyWindowMonthsWrap');
    if (winWrap) winWrap.style.display = linian || sichuan ? 'none' : '';
  }

  function mountFormForPage() {
    var host = document.getElementById('sbdyDemoFormHost');
    var hz = document.getElementById('sbdyHzFormSlot');
    var sc = document.getElementById('sbdyScFormSlot');
    var target = isSichuanPage() ? sc : hz;
    if (!host || !target) return;
    if (host.parentNode !== target) {
      target.appendChild(host);
    }
    host.hidden = false;
    var typeSel = document.getElementById('sbdyCertType');
    if (typeSel) {
      if (isSichuanPage()) {
        if (!typeSel.querySelector('option[value="sichuan"]')) {
          var opt = document.createElement('option');
          opt.value = 'sichuan';
          opt.textContent = '四川 · 个人参保证明';
          typeSel.appendChild(opt);
        }
        typeSel.value = 'sichuan';
      } else {
        var scOpt = typeSel.querySelector('option[value="sichuan"]');
        if (scOpt) scOpt.parentNode.removeChild(scOpt);
        if (typeSel.value === 'sichuan' || !typeSel.value) typeSel.value = 'personal';
      }
    }
  }

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

  function defaultPeriodRange() {
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
    return {
      start: startY + '-' + String(startM).padStart(2, '0'),
      end: endY + '-' + String(endM).padStart(2, '0')
    };
  }

  function fieldOf(root, cls) {
    var el = root.querySelector('.' + cls);
    return el ? String(el.value || '').trim() : '';
  }

  function numOf(root, cls, fallback) {
    var n = Number(fieldOf(root, cls));
    return isFinite(n) ? n : fallback;
  }

  function renumberExperiences() {
    var wrap = document.getElementById('sbdySegments');
    if (!wrap) return;
    var rows = wrap.querySelectorAll('.sbdy-seg');
    rows.forEach(function (row, idx) {
      var title = row.querySelector('.sbdy-seg-title');
      if (title) title.textContent = '参保经历 ' + (idx + 1);
      var rm = row.querySelector('.sbdy-seg-remove');
      if (rm) rm.style.display = rows.length > 1 ? '' : 'none';
      renumberPeriods(row);
    });
  }

  function renumberPeriods(segEl) {
    var list = segEl.querySelectorAll('.sbdy-period');
    list.forEach(function (row, idx) {
      var title = row.querySelector('.sbdy-period-title');
      if (title) title.textContent = '缴费基数 ' + (idx + 1);
      var rm = row.querySelector('.sbdy-period-remove');
      if (rm) rm.style.display = list.length > 1 ? '' : 'none';
    });
  }

  function addPeriod(segEl, data) {
    var host = segEl.querySelector('.sbdy-periods');
    if (!host) return;
    data = data || {};
    var range = defaultPeriodRange();
    var start = data.period_start || range.start;
    var end = data.period_end || range.end;
    var base = data.base_amount != null ? data.base_amount : 4986;
    var pension =
      data.pension_pay != null ? data.pension_pay : Math.round(Number(base) * 0.08 * 100) / 100;
    var unemp =
      data.unemployment_pay != null
        ? data.unemployment_pay
        : Math.round(Number(base) * 0.005 * 100) / 100;
    var div = document.createElement('div');
    div.className = 'sbdy-period';
    div.innerHTML =
      '<div class="sbdy-period-head">' +
      '<span class="sbdy-period-title">缴费基数</span>' +
      '<button type="button" class="btn-page sbdy-period-remove">删除</button>' +
      '</div>' +
      '<div class="form-row flex-wrap gap-10">' +
      '<div><label>缴费起月</label>' +
      '<input type="month" class="sbdy-per-start" value="' +
      esc(start) +
      '"></div>' +
      '<div><label>缴费止月</label>' +
      '<input type="month" class="sbdy-per-end" value="' +
      esc(end) +
      '"></div>' +
      '<div><label>缴费基数（元）</label>' +
      '<input type="number" class="sbdy-per-base" step="0.01" value="' +
      esc(base) +
      '"></div>' +
      '<div class="sbdy-pay-fields"' +
      (isLinianMode() ? ' style="display:none"' : '') +
      '><label>养老个人缴费</label>' +
      '<input type="number" class="sbdy-per-pension" step="0.01" value="' +
      esc(pension) +
      '"></div>' +
      '<div class="sbdy-pay-fields"' +
      (isLinianMode() ? ' style="display:none"' : '') +
      '><label>失业个人缴费</label>' +
      '<input type="number" class="sbdy-per-unemp" step="0.01" value="' +
      esc(unemp) +
      '"></div>' +
      '</div>';
    var rm = div.querySelector('.sbdy-period-remove');
    if (rm) {
      rm.onclick = function () {
        var periods = segEl.querySelectorAll('.sbdy-period');
        if (periods.length <= 1) return;
        div.remove();
        renumberPeriods(segEl);
      };
    }
    var baseInput = div.querySelector('.sbdy-per-base');
    var pensionInput = div.querySelector('.sbdy-per-pension');
    var unempInput = div.querySelector('.sbdy-per-unemp');
    if (baseInput && pensionInput && unempInput) {
      baseInput.addEventListener('change', function () {
        var b = Number(baseInput.value);
        if (!isFinite(b) || b < 0) return;
        if (!pensionInput.dataset.manual) {
          pensionInput.value = String(Math.round(b * 0.08 * 100) / 100);
        }
        if (!unempInput.dataset.manual) {
          unempInput.value = String(Math.round(b * 0.005 * 100) / 100);
        }
      });
      pensionInput.addEventListener('input', function () {
        pensionInput.dataset.manual = '1';
      });
      unempInput.addEventListener('input', function () {
        unempInput.dataset.manual = '1';
      });
    }
    host.appendChild(div);
    renumberPeriods(segEl);
  }

  function addExperience(data) {
    var wrap = document.getElementById('sbdySegments');
    if (!wrap) return;
    data = data || {};
    var div = document.createElement('div');
    div.className = 'sbdy-seg';
    div.innerHTML =
      '<div class="sbdy-seg-head">' +
      '<span class="sbdy-seg-title">参保经历</span>' +
      '<button type="button" class="btn-page sbdy-seg-remove">删除本经历</button>' +
      '</div>' +
      '<div class="form-row flex-wrap gap-10 sbdy-seg-company-row">' +
      '<div style="flex:1;min-width:200px;"><label>参保单位</label>' +
      '<input type="text" class="sbdy-seg-company" maxlength="128" placeholder="单位名称" value="' +
      esc(data.company_name || '') +
      '"></div>' +
      '<div><label>统一社会信用代码</label>' +
      '<input type="text" class="sbdy-seg-credit" maxlength="32" placeholder="9131…" value="' +
      esc(data.credit_code || '') +
      '"></div>' +
      '<div><label>参保地</label>' +
      '<input type="text" class="sbdy-seg-area" maxlength="32" value="' +
      esc(data.area || (isSichuanMode() ? '成都市高新区' : isLinianMode() ? '杭州市本级' : '余杭区')) +
      '"></div>' +
      '</div>' +
      '<div class="sbdy-periods"></div>' +
      '<div class="form-actions sbdy-period-actions">' +
      '<button type="button" class="btn-page sbdy-add-period">＋ 添加缴费基数</button>' +
      '</div>';
    var rm = div.querySelector('.sbdy-seg-remove');
    if (rm) {
      rm.onclick = function () {
        var wrapEl = document.getElementById('sbdySegments');
        if (!wrapEl || wrapEl.querySelectorAll('.sbdy-seg').length <= 1) return;
        div.remove();
        renumberExperiences();
      };
    }
    var addPerBtn = div.querySelector('.sbdy-add-period');
    if (addPerBtn) {
      addPerBtn.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        addPeriod(div, {});
      };
    }
    wrap.appendChild(div);
    var periods = Array.isArray(data.periods) && data.periods.length
      ? data.periods
      : data.period_start || data.base_amount != null
        ? [
            {
              period_start: data.period_start,
              period_end: data.period_end,
              base_amount: data.base_amount,
              pension_pay: data.pension_pay,
              unemployment_pay: data.unemployment_pay
            }
          ]
        : [{}];
    periods.forEach(function (p) {
      addPeriod(div, p);
    });
    renumberExperiences();
  }

  function ensureOneExperience() {
    var wrap = document.getElementById('sbdySegments');
    if (!wrap) return;
    if (!wrap.querySelector('.sbdy-seg')) {
      addExperience({});
    }
  }

  function collectSegments() {
    var wrap = document.getElementById('sbdySegments');
    if (!wrap) return [];
    var list = [];
    wrap.querySelectorAll('.sbdy-seg').forEach(function (seg) {
      var periods = [];
      seg.querySelectorAll('.sbdy-period').forEach(function (per) {
        var base = numOf(per, 'sbdy-per-base', 4986);
        periods.push({
          period_start: normalizeYm(fieldOf(per, 'sbdy-per-start')),
          period_end: normalizeYm(fieldOf(per, 'sbdy-per-end')),
          base_amount: base,
          pension_pay: numOf(per, 'sbdy-per-pension', Math.round(base * 0.08 * 100) / 100),
          unemployment_pay: numOf(per, 'sbdy-per-unemp', Math.round(base * 0.005 * 100) / 100)
        });
      });
      list.push({
        company_name: fieldOf(seg, 'sbdy-seg-company'),
        credit_code: fieldOf(seg, 'sbdy-seg-credit'),
        area: fieldOf(seg, 'sbdy-seg-area') || (isSichuanMode() ? '成都市高新区' : isLinianMode() ? '杭州市本级' : '余杭区'),
        periods: periods
      });
    });
    return list;
  }

  function renderList(list) {
    var tbody = document.getElementById('sbdyDemoListTbody');
    if (!tbody) return;
    if (!list || !list.length) {
      tbody.innerHTML = '<tr><td colspan="6">暂无记录</td></tr>';
      return;
    }
    var html = '';
    list.forEach(function (row) {
      var links = row.links || {};
      html +=
        '<tr>' +
        '<td>' +
        esc(formatBjTime(row.created_at)) +
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

  function generate() {
    var result = document.getElementById('sbdyDemoResult');
    /* 文本框有模板且上方姓名/证件号为空时，生成前自动「从模板填充」 */
    var tplBox = document.getElementById('sbdyInfoTplText');
    var tplText = tplBox ? String(tplBox.value || '').trim() : '';
    if (tplText && (!val('sbdyName') || !val('sbdyIdNumber'))) {
      var applied = applyInfoTemplate(tplText);
      if (!applied) return;
    }
    var segments = collectSegments();
    var body = {
      cert_type: getCertType(),
      name: val('sbdyName'),
      id_number: val('sbdyIdNumber'),
      gender: val('sbdyGender') || '女',
      status_pension:
        val('sbdyStatusPension') ||
        (isLinianMode() ? '暂停缴费' : isSichuanMode() ? '参保缴费' : '正常参保'),
      status_medical: val('sbdyStatusInjury') || (isSichuanMode() ? '参保缴费' : '正常参保'),
      status_injury: val('sbdyStatusInjury') || (isSichuanMode() ? '参保缴费' : '正常参保'),
      status_unemployment: val('sbdyStatusUnemp') || (isSichuanMode() ? '参保缴费' : '正常参保'),
      print_date: val('sbdyPrintDate'),
      segments: segments
    };
    if (!isLinianMode() && !isSichuanMode()) {
      var winRaw = val('sbdyWindowMonths');
      body.window_months = Number(winRaw) === 12 ? 12 : 48;
    }
    if (isLinianMode()) {
      var cum = val('sbdyCumulative');
      if (cum) body.cumulative_text = cum;
    }
    if (isSichuanMode()) {
      var extra = val('sbdyStatusInjuryExtra');
      if (extra) body.status_injury_extra = extra;
      if (val('sbdyMonthsPension')) body.months_pension = Number(val('sbdyMonthsPension'));
      if (val('sbdyMonthsUnemp')) body.months_unemployment = Number(val('sbdyMonthsUnemp'));
      if (val('sbdyMonthsInjury')) body.months_injury = Number(val('sbdyMonthsInjury'));
    }
    if (!body.name || !body.id_number) {
      var tip = tplText
        ? '模板里缺少「姓名」或「身份证号」，请补全后再点生成'
        : '请填写上方「姓名」与「证件号码」，或粘贴模板后点「从模板填充」';
      setStatus(tip, true);
      try {
        alert(tip);
      } catch (e0) {}
      var focusEl = document.getElementById(tplText ? 'sbdyInfoTplText' : 'sbdyName');
      if (focusEl && focusEl.scrollIntoView) focusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!segments.length) {
      setStatus('请至少填写一段参保经历', true);
      return;
    }
    var si;
    for (si = 0; si < segments.length; si++) {
      var sg = segments[si];
      if (!sg.company_name && !sg.credit_code) {
        setStatus('第' + (si + 1) + '段经历：请填写参保单位', true);
        return;
      }
      if (!sg.periods || !sg.periods.length) {
        setStatus('第' + (si + 1) + '段经历：请至少添加一个缴费基数区间', true);
        return;
      }
      var pi;
      for (pi = 0; pi < sg.periods.length; pi++) {
        var per = sg.periods[pi];
        if (!per.period_start || !per.period_end) {
          setStatus(
            '第' + (si + 1) + '段经历 / 缴费基数' + (pi + 1) + '：请选择起止月份',
            true
          );
          return;
        }
      }
    }
    setStatus('生成中…', false);
    if (result) result.innerHTML = '';
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
          var msg = (j && j.msg) || '生成失败（HTTP ' + pack.http + '）';
          setStatus(msg, true);
          try {
            alert(msg);
          } catch (e2) {}
          return;
        }
        var d = j.data;
        var links = d.links || {};
        setStatus('已生成演示样例（非正式证明）', false);
        if (result) {
          result.innerHTML =
            '<p class="stat">授权码：<code>' +
            esc(d.auth_code) +
            '</code></p>' +
            '<p class="hint">样例页：<a href="' +
            esc(links.show_url || '') +
            '" target="_blank" rel="noopener">' +
            esc(links.show_url || '') +
            '</a></p>' +
            '<p class="hint">核验页：<a href="' +
            esc(links.verify_url || '') +
            '" target="_blank" rel="noopener">' +
            esc(links.verify_url || '') +
            '</a></p>' +
            '<p class="hint" style="color:#b45309;">页面带「演示样例」水印；扫码仅核验本站演示记录。</p>';
        }
        loadList();
      })
      .catch(function (e) {
        var msg = '生成失败：' + (e && e.message ? e.message : '网络错误');
        setStatus(msg, true);
        try {
          alert(msg);
        } catch (e3) {}
      });
  }

  function setField(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.value = value == null ? '' : String(value);
  }

  function resetExperiences(list) {
    var wrap = document.getElementById('sbdySegments');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (!list || !list.length) {
      addExperience({});
      return;
    }
    list.forEach(function (seg) {
      addExperience(seg);
    });
  }

  /** 空白社保信息模板（与运营粘贴格式一致） */
  function blankInfoTemplate() {
    var range = defaultPeriodRange();
    var startParts = String(range.start).split('-');
    var endParts = String(range.end).split('-');
    var timeStr =
      startParts[0] +
      '.' +
      String(Number(startParts[1])) +
      '-' +
      endParts[0] +
      '.' +
      String(Number(endParts[1]));
    return [
      '姓名:',
      '身份证号:',
      '社保号:',
      '性别:女',
      '时间:' + timeStr,
      '参保数:12个月',
      '区域:' + (isSichuanPage() ? '成都市高新区' : '滨江区'),
      '公司名称：',
      '税号：'
    ].join('\n');
  }

  function pickTplField(text, keys) {
    var lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var i;
    for (i = 0; i < lines.length; i++) {
      var line = String(lines[i] || '').trim();
      if (!line) continue;
      var ki;
      for (ki = 0; ki < keys.length; ki++) {
        var key = keys[ki];
        if (line.indexOf(key) !== 0) continue;
        var rest = line.slice(key.length);
        rest = rest.replace(/^[\s:：]+/, '').trim();
        return rest;
      }
    }
    return '';
  }

  function parseTimeRange(raw) {
    var s = String(raw || '').trim();
    if (!s) return null;
    var m = s.match(
      /^(\d{4})\s*[./年]\s*(\d{1,2})\s*(?:月)?\s*[-~～至到]\s*(\d{4})\s*[./年]\s*(\d{1,2})\s*(?:月)?$/
    );
    if (!m) {
      m = s.match(/^(\d{4})-(\d{1,2})\s*[-~～至到]\s*(\d{4})-(\d{1,2})$/);
    }
    if (!m) return null;
    return {
      start: m[1] + '-' + String(Number(m[2])).padStart(2, '0'),
      end: m[3] + '-' + String(Number(m[4])).padStart(2, '0')
    };
  }

  function monthsBetweenInclusive(startYm, endYm) {
    var a = String(startYm || '').match(/^(\d{4})-(\d{2})$/);
    var b = String(endYm || '').match(/^(\d{4})-(\d{2})$/);
    if (!a || !b) return 0;
    return (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2])) + 1;
  }

  function formatTimeDot(startYm, endYm) {
    var a = String(startYm || '').match(/^(\d{4})-(\d{1,2})$/);
    var b = String(endYm || '').match(/^(\d{4})-(\d{1,2})$/);
    if (!a || !b) return '';
    return (
      a[1] +
      '.' +
      String(Number(a[2])) +
      '-' +
      b[1] +
      '.' +
      String(Number(b[2]))
    );
  }

  function buildInfoTemplateFromForm() {
    var segs = collectSegments();
    var seg = segs[0] || {};
    var per = (seg.periods && seg.periods[0]) || {};
    var start = per.period_start || '';
    var end = per.period_end || '';
    var months = monthsBetweenInclusive(start, end);
    var idNo = val('sbdyIdNumber');
    return [
      '姓名:' + val('sbdyName'),
      '身份证号:' + idNo,
      '社保号:',
      '性别:' + (val('sbdyGender') || '女'),
      '时间:' + (formatTimeDot(start, end) || ''),
      '参保数:' + (months > 0 ? months + '个月' : ''),
      '区域:' + (seg.area || ''),
      '公司名称：' + (seg.company_name || ''),
      '税号：' + (seg.credit_code || '')
    ].join('\n');
  }

  function parseInfoTemplate(text) {
    var raw = String(text || '').trim();
    if (!raw) return { error: '请先粘贴社保信息模板' };
    var name = pickTplField(raw, ['姓名']);
    var idNumber = pickTplField(raw, ['身份证号', '证件号码', '证件号']);
    var socialNo = pickTplField(raw, ['社保号', '社会保障号']);
    var gender = pickTplField(raw, ['性别']);
    var timeRaw = pickTplField(raw, ['时间', '缴费时间', '参保时间']);
    var monthsRaw = pickTplField(raw, ['参保数', '参保月数', '缴费月数']);
    var area = pickTplField(raw, ['区域', '参保地', '地区']);
    var company = pickTplField(raw, ['公司名称', '参保单位', '单位名称', '单位']);
    var credit = pickTplField(raw, ['税号', '统一社会信用代码', '信用代码']);
    if (!idNumber && socialNo) idNumber = socialNo;
    /* 兼容「身份证号」后无冒号、或整段粘贴时证件号单独成行 */
    if (!idNumber) {
      var idLine = String(raw).match(/(?:身份证号|证件号码|证件号)\s*[:：]?\s*([0-9Xx]{15,18})/);
      if (idLine) idNumber = idLine[1];
    }
    if (!idNumber) {
      var bareId = String(raw).match(/(?:^|\n)\s*([0-9]{17}[0-9Xx])\s*(?:\n|$)/);
      if (bareId) idNumber = bareId[1];
    }
    if (!name) {
      var nameLine = String(raw).match(/(?:姓名)\s*[:：]?\s*([^\s\n:：]{1,32})/);
      if (nameLine) name = nameLine[1].trim();
    }
    if (!name && !idNumber && !company) {
      return { error: '未识别到姓名/身份证号/公司名称，请检查模板格式' };
    }
    if (!name || !idNumber) {
      return {
        error:
          '模板缺少' +
          (!name ? '「姓名」' : '') +
          (!name && !idNumber ? '和' : '') +
          (!idNumber ? '「身份证号」' : '') +
          '，请按「姓名:xxx」与「身份证号:xxx」补全'
      };
    }
    var range = parseTimeRange(timeRaw);
    if (!range) {
      var def = defaultPeriodRange();
      range = { start: def.start, end: def.end };
    }
    var monthsHint = 0;
    var mm = String(monthsRaw || '').match(/(\d{1,3})/);
    if (mm) monthsHint = Number(mm[1]);
    var actualMonths = monthsBetweenInclusive(range.start, range.end);
    if (monthsHint > 0 && actualMonths > 0 && monthsHint !== actualMonths) {
      /* 以时间区间为准，仅提示 */
    }
    var base = 4986;
    return {
      name: name,
      id_number: idNumber,
      gender: gender === '男' || gender === '女' ? gender : gender || '女',
      area: area || (isSichuanPage() ? '成都市高新区' : '滨江区'),
      company_name: company,
      credit_code: credit,
      period_start: range.start,
      period_end: range.end,
      months: actualMonths || monthsHint || 12,
      base_amount: base,
      pension_pay: Math.round(base * 0.08 * 100) / 100,
      unemployment_pay: Math.round(base * 0.005 * 100) / 100
    };
  }

  function applyInfoTemplate(text) {
    var parsed = parseInfoTemplate(text);
    if (parsed.error) {
      setStatus(parsed.error, true);
      return false;
    }
    var now = new Date();
    var bj = new Date(now.getTime() + 8 * 3600 * 1000);
    var printDate =
      bj.getUTCFullYear() +
      '年' +
      String(bj.getUTCMonth() + 1).padStart(2, '0') +
      '月' +
      String(bj.getUTCDate()).padStart(2, '0') +
      '日';
    /* 模板填充：演示默认正常参保、连续缴费，不停保 */
    var defaultStatus = isSichuanPage() ? '参保缴费' : '正常参保';
    setField('sbdyName', parsed.name);
    setField('sbdyIdNumber', parsed.id_number);
    setField('sbdyGender', parsed.gender || '女');
    setField('sbdyStatusPension', defaultStatus);
    setField('sbdyStatusInjury', defaultStatus);
    setField('sbdyStatusUnemp', defaultStatus);
    setField('sbdyPrintDate', printDate);
    resetExperiences([
      {
        company_name: parsed.company_name,
        credit_code: parsed.credit_code,
        area: parsed.area || (isSichuanPage() ? '成都市高新区' : '滨江区'),
        periods: [
          {
            period_start: parsed.period_start,
            period_end: parsed.period_end,
            base_amount: parsed.base_amount,
            pension_pay: parsed.pension_pay,
            unemployment_pay: parsed.unemployment_pay
          }
        ]
      }
    ]);
    setStatus(
      '已从模板填充：' +
        (parsed.name || '（无姓名）') +
        '，' +
        parsed.period_start +
        '～' +
        parsed.period_end +
        '（' +
        parsed.months +
        '个月，正常参保/不停保）',
      false
    );
    return true;
  }

  function copyText(text) {
    var t = String(text || '');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(t);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = t;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) resolve();
        else reject(new Error('copy failed'));
      } catch (e) {
        reject(e);
      }
    });
  }

  function copyBlankTemplate() {
    var tpl = blankInfoTemplate();
    var box = document.getElementById('sbdyInfoTplText');
    if (box) box.value = tpl;
    copyText(tpl)
      .then(function () {
        setStatus('已复制空白社保信息模板', false);
      })
      .catch(function () {
        setStatus('已填入空白模板（剪贴板不可用，请手动复制文本框内容）', false);
      });
  }

  function copyFormTemplate() {
    var tpl = buildInfoTemplateFromForm();
    var box = document.getElementById('sbdyInfoTplText');
    if (box) box.value = tpl;
    copyText(tpl)
      .then(function () {
        setStatus('已从当前表单复制社保信息', false);
      })
      .catch(function () {
        setStatus('已填入表单信息（剪贴板不可用，请手动复制文本框内容）', false);
      });
  }

  function applyTemplateFromBox() {
    var box = document.getElementById('sbdyInfoTplText');
    var text = box ? String(box.value || '') : '';
    var ok = applyInfoTemplate(text);
    if (ok) {
      try {
        alert(
          '已写入表单：' +
            val('sbdyName') +
            ' / ' +
            val('sbdyIdNumber') +
            '\n请确认上方姓名、证件号已填好，再点「生成演示样例」'
        );
      } catch (e1) {}
      var nameEl = document.getElementById('sbdyName');
      if (nameEl && nameEl.scrollIntoView) {
        nameEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      try {
        var st = document.getElementById('sbdyDemoStatus');
        alert((st && st.textContent) || '模板解析失败，请检查姓名与身份证号格式');
      } catch (e2) {}
    }
    return ok;
  }

  function fillSample() {
    var now = new Date();
    var bj = new Date(now.getTime() + 8 * 3600 * 1000);
    var printDate =
      bj.getUTCFullYear() +
      '年' +
      String(bj.getUTCMonth() + 1).padStart(2, '0') +
      '月' +
      String(bj.getUTCDate()).padStart(2, '0') +
      '日';

    if (isSichuanMode()) {
      var scSample = {
        name: '马海燕',
        id_number: '510723199208191285',
        gender: '女',
        status: '参保缴费',
        status_injury_extra: '暂停缴费（中断）',
        months_pension: 139,
        months_unemployment: 138,
        months_injury: 138,
        print_date: printDate,
        segments: [
          {
            company_name: '四川创智联恒科技有限公司',
            credit_code: '10010759311',
            area: '成都市高新区',
            periods: [
              {
                period_start: '2024-10',
                period_end: '2024-12',
                base_amount: 13596,
                pension_pay: 1087.68,
                unemployment_pay: 54.38
              },
              {
                period_start: '2025-01',
                period_end: '2025-04',
                base_amount: 10026,
                pension_pay: 802.08,
                unemployment_pay: 40.1
              }
            ]
          },
          {
            company_name: '成都天微智能科技有限公司',
            credit_code: '250215712150',
            area: '成都市双流区',
            periods: [
              {
                period_start: '2025-05',
                period_end: '2026-09',
                base_amount: 5000,
                pension_pay: 400,
                unemployment_pay: 20
              }
            ]
          }
        ]
      };
      setField('sbdyName', scSample.name);
      setField('sbdyIdNumber', scSample.id_number);
      setField('sbdyGender', scSample.gender);
      setField('sbdyStatusPension', scSample.status);
      setField('sbdyStatusInjury', scSample.status);
      setField('sbdyStatusUnemp', scSample.status);
      setField('sbdyStatusInjuryExtra', scSample.status_injury_extra);
      setField('sbdyMonthsPension', scSample.months_pension);
      setField('sbdyMonthsUnemp', scSample.months_unemployment);
      setField('sbdyMonthsInjury', scSample.months_injury);
      setField('sbdyPrintDate', scSample.print_date);
      resetExperiences(scSample.segments);
      syncCertTypeUi();
      var scBox = document.getElementById('sbdyInfoTplText');
      if (scBox) scBox.value = buildInfoTemplateFromForm();
      setStatus('已填充四川示例：' + scSample.name + '（对齐官方样张，可再点生成）', false);
      return;
    }

    if (isLinianMode()) {
      var linianSample = {
        name: '李宛奕',
        id_number: '610124199105036327',
        gender: '女',
        status: '暂停缴费',
        cumulative: '4年3月',
        print_date: printDate,
        segments: [
          {
            company_name: '杭州才享人力资源有限公司',
            credit_code: '',
            area: '杭州市本级',
            periods: [
              { period_start: '2020-01', period_end: '2020-12', base_amount: 4000 },
              { period_start: '2021-01', period_end: '2021-07', base_amount: 4000 }
            ]
          },
          {
            company_name: '浙江才享企业服务有限公司杭州分公司',
            credit_code: '',
            area: '杭州市本级',
            periods: [{ period_start: '2021-08', period_end: '2021-09', base_amount: 3321.6 }]
          },
          {
            company_name: '杭州般意科技有限公司',
            credit_code: '',
            area: '杭州市本级',
            periods: [
              { period_start: '2023-05', period_end: '2023-12', base_amount: 8000 },
              { period_start: '2024-01', period_end: '2024-04', base_amount: 8000 }
            ]
          },
          {
            company_name: '杭州虎头虎脑科技有限公司',
            credit_code: '',
            area: '杭州市本级',
            periods: [
              { period_start: '2024-05', period_end: '2024-12', base_amount: 8000 },
              { period_start: '2025-01', period_end: '2025-09', base_amount: 8000 }
            ]
          },
          {
            company_name: '杭州乔泽生物科技有限公司',
            credit_code: '',
            area: '杭州市本级',
            periods: [{ period_start: '2026-05', period_end: '2026-05', base_amount: 4986 }]
          }
        ]
      };
      setField('sbdyName', linianSample.name);
      setField('sbdyIdNumber', linianSample.id_number);
      setField('sbdyGender', linianSample.gender);
      setField('sbdyStatusPension', linianSample.status);
      setField('sbdyCumulative', linianSample.cumulative);
      setField('sbdyPrintDate', linianSample.print_date);
      resetExperiences(linianSample.segments);
      syncCertTypeUi();
      var lnBox = document.getElementById('sbdyInfoTplText');
      if (lnBox) lnBox.value = buildInfoTemplateFromForm();
      setStatus('已填充历年示例：' + linianSample.name + '（对齐官方样张，可再点生成）', false);
      return;
    }

    var samples = [
      {
        name: '耿冯',
        id_number: '370921199912203616',
        gender: '男',
        status: '暂停缴费',
        print_date: '2026年04月28日',
        segments: [
          {
            company_name: '杭州智控网络有限公司',
            credit_code: '3011000010108876',
            area: '滨江区',
            periods: [
              {
                period_start: '2023-05',
                period_end: '2023-12',
                base_amount: 4462,
                pension_pay: 356.96,
                unemployment_pay: 22.31
              },
              {
                period_start: '2024-01',
                period_end: '2024-12',
                base_amount: 4996.34,
                pension_pay: 399.71,
                unemployment_pay: 24.98
              },
              {
                period_start: '2025-01',
                period_end: '2025-02',
                base_amount: 5167.5,
                pension_pay: 413.4,
                unemployment_pay: 25.84
              }
            ]
          },
          {
            company_name: '杭州智控网络有限公司',
            credit_code: '3011000010145742',
            area: '滨江区',
            periods: [
              {
                period_start: '2025-03',
                period_end: '2025-11',
                base_amount: 5167.5,
                pension_pay: 413.4,
                unemployment_pay: 25.84
              }
            ]
          },
          {
            company_name: '杭州智控网络有限公司',
            credit_code: '3011000106164173',
            area: '钱塘区',
            periods: [
              {
                period_start: '2025-12',
                period_end: '2026-04',
                base_amount: 5000,
                pension_pay: 400,
                unemployment_pay: 25
              }
            ]
          }
        ]
      },
      {
        name: '李晓晴',
        id_number: '371323199904156523',
        gender: '女',
        status: '正常参保',
        print_date: '2026年07月28日',
        segments: [
          {
            company_name: '杭州百伦思宠物用品有限公司',
            credit_code: '91310113630842640E',
            area: '余杭区',
            periods: [
              {
                period_start: '2025-07',
                period_end: '2025-12',
                base_amount: 4986,
                pension_pay: 398.88,
                unemployment_pay: 24.93
              },
              {
                period_start: '2026-01',
                period_end: '2026-06',
                base_amount: 4986,
                pension_pay: 398.88,
                unemployment_pay: 24.93
              }
            ]
          }
        ]
      },
      {
        name: '王思远',
        id_number: '330106199508123456',
        gender: '男',
        status: '正常参保',
        print_date: printDate,
        segments: [
          {
            company_name: '杭州云启信息技术有限公司',
            credit_code: '91330108MA2H12345X',
            area: '西湖区',
            periods: [
              {
                period_start: '2024-08',
                period_end: '2025-03',
                base_amount: 6200,
                pension_pay: 496,
                unemployment_pay: 31
              }
            ]
          },
          {
            company_name: '浙江星河网络科技有限公司',
            credit_code: '91330110MA2K98765B',
            area: '余杭区',
            periods: [
              {
                period_start: '2025-04',
                period_end: '2025-12',
                base_amount: 6520,
                pension_pay: 521.6,
                unemployment_pay: 32.6
              },
              {
                period_start: '2026-01',
                period_end: '2026-06',
                base_amount: 6800,
                pension_pay: 544,
                unemployment_pay: 34
              }
            ]
          }
        ]
      },
      {
        name: '陈佳怡',
        id_number: '330102199211088765',
        gender: '女',
        status: '正常参保',
        print_date: printDate,
        segments: [
          {
            company_name: '浙江启航贸易有限公司',
            credit_code: '91330000MA27ABCD1Y',
            area: '拱墅区',
            periods: [
              {
                period_start: '2025-07',
                period_end: '2025-12',
                base_amount: 5600,
                pension_pay: 448,
                unemployment_pay: 28
              },
              {
                period_start: '2026-01',
                period_end: '2026-06',
                base_amount: 5800,
                pension_pay: 464,
                unemployment_pay: 29
              }
            ]
          }
        ]
      }
    ];
    var sample =
      Math.random() < 0.5
        ? samples[0]
        : samples[Math.floor(Math.random() * samples.length)];
    setField('sbdyName', sample.name);
    setField('sbdyIdNumber', sample.id_number);
    setField('sbdyGender', sample.gender);
    setField('sbdyStatusPension', sample.status);
    setField('sbdyStatusInjury', sample.status);
    setField('sbdyStatusUnemp', sample.status);
    setField('sbdyPrintDate', sample.print_date);
    resetExperiences(sample.segments);
    var tipParts = [];
    tipParts.push(sample.segments.length + ' 段经历');
    var baseCount = 0;
    sample.segments.forEach(function (s) {
      baseCount += (s.periods && s.periods.length) || 0;
    });
    tipParts.push(baseCount + ' 个基数区间');
    var hzBox = document.getElementById('sbdyInfoTplText');
    if (hzBox) hzBox.value = buildInfoTemplateFromForm();
    setStatus('已填充示例：' + sample.name + '（' + tipParts.join('，') + '，可再点生成）', false);
  }

  function bind() {
    mountFormForPage();
    ensureOneExperience();
    syncCertTypeUi();
    var typeSel = document.getElementById('sbdyCertType');
    if (typeSel) {
      typeSel.onchange = function () {
        if (isSichuanPage()) {
          typeSel.value = 'sichuan';
        }
        syncCertTypeUi();
        /* 杭州页内个人专用 / 历年切换时立刻换成对应示例 */
        fillSample();
      };
    }
    var addBtn = document.getElementById('btnSbdyAddSegment');
    if (addBtn) {
      addBtn.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        addExperience({});
      };
    }
    var fillBtn = document.getElementById('btnSbdyDemoFillSample');
    if (fillBtn) {
      fillBtn.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        fillSample();
      };
    }
    var copyBlankBtn = document.getElementById('btnSbdyCopyBlankTpl');
    if (copyBlankBtn) {
      copyBlankBtn.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        copyBlankTemplate();
      };
    }
    var copyFormBtn = document.getElementById('btnSbdyCopyFormTpl');
    if (copyFormBtn) {
      copyFormBtn.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        copyFormTemplate();
      };
    }
    var applyTplBtn = document.getElementById('btnSbdyApplyTpl');
    if (applyTplBtn) {
      applyTplBtn.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        applyTemplateFromBox();
      };
    }
    var btn = document.getElementById('btnSbdyDemoGenerate');
    if (btn) {
      btn.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        generate();
      };
    }
    var refresh = document.getElementById('btnSbdyDemoRefresh');
    if (refresh) {
      refresh.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        loadList();
      };
    }
  }

  var lastRegionPage = '';

  function loadPage() {
    bind();
    var region = isSichuanPage() ? 'sichuan' : 'hangzhou';
    if (lastRegionPage !== region) {
      lastRegionPage = region;
      fillSample();
    }
    loadList();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['sbdy-demo'] = {
    ready: true,
    loadPage: loadPage,
    generate: generate,
    fillSample: fillSample,
    copyBlankTemplate: copyBlankTemplate,
    copyFormTemplate: copyFormTemplate,
    applyInfoTemplate: applyInfoTemplate
  };
  global.loadSbdyDemoPage = loadPage;
  global.sbdyDemoGenerate = generate;
  global.sbdyDemoFillSample = fillSample;
  global.sbdyDemoCopyBlankTpl = copyBlankTemplate;
  global.sbdyDemoCopyFormTpl = copyFormTemplate;
  global.sbdyDemoApplyTpl = applyTemplateFromBox;
  global.sbdyDemoAddExperience = function () {
    addExperience({});
  };
})(window);
