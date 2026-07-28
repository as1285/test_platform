/** Admin module: 社保演示生成（支持多段参保 / 按年基数） */
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

  function parseYearBasesText(raw) {
    var s = String(raw || '').trim();
    if (!s) return null;
    var out = {};
    var parts = s.split(/[,，;；\s]+/);
    var i;
    for (i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (!p) continue;
      var m = p.match(/^(\d{4})\s*[:=\s]\s*(\d+(?:\.\d+)?)$/);
      if (!m) m = p.match(/^(\d{4})[年\/\-](\d+(?:\.\d+)?)$/);
      if (!m) continue;
      out[m[1]] = Number(m[2]);
    }
    return Object.keys(out).length ? out : null;
  }

  function formatYearBasesText(obj) {
    if (!obj || typeof obj !== 'object') return '';
    return Object.keys(obj)
      .sort()
      .map(function (y) {
        return y + '=' + obj[y];
      })
      .join(', ');
  }

  function segmentField(row, cls) {
    var el = row.querySelector('.' + cls);
    return el ? String(el.value || '').trim() : '';
  }

  function segmentNum(row, cls, fallback) {
    var n = Number(segmentField(row, cls));
    return isFinite(n) ? n : fallback;
  }

  function collectSegments() {
    var wrap = document.getElementById('sbdySegments');
    if (!wrap) return [];
    var rows = wrap.querySelectorAll('.sbdy-seg');
    var list = [];
    rows.forEach(function (row) {
      var company = segmentField(row, 'sbdy-seg-company');
      var credit = segmentField(row, 'sbdy-seg-credit');
      var area = segmentField(row, 'sbdy-seg-area') || '余杭区';
      var periodStart = normalizeYm(segmentField(row, 'sbdy-seg-start'));
      var periodEnd = normalizeYm(segmentField(row, 'sbdy-seg-end'));
      var base = segmentNum(row, 'sbdy-seg-base', 4986);
      var pension = segmentNum(row, 'sbdy-seg-pension', Math.round(base * 0.08 * 100) / 100);
      var unemp = segmentNum(row, 'sbdy-seg-unemp', Math.round(base * 0.005 * 100) / 100);
      var yearBases = parseYearBasesText(segmentField(row, 'sbdy-seg-year-bases'));
      var item = {
        company_name: company,
        credit_code: credit,
        area: area,
        period_start: periodStart,
        period_end: periodEnd,
        base_amount: base,
        pension_pay: pension,
        unemployment_pay: unemp
      };
      if (yearBases) item.year_bases = yearBases;
      list.push(item);
    });
    return list;
  }

  function renumberSegments() {
    var wrap = document.getElementById('sbdySegments');
    if (!wrap) return;
    var rows = wrap.querySelectorAll('.sbdy-seg');
    rows.forEach(function (row, idx) {
      var title = row.querySelector('.sbdy-seg-title');
      if (title) title.textContent = '参保段 ' + (idx + 1);
      var rm = row.querySelector('.sbdy-seg-remove');
      if (rm) rm.style.display = rows.length > 1 ? '' : 'none';
    });
  }

  function addSegment(data) {
    var wrap = document.getElementById('sbdySegments');
    if (!wrap) return;
    data = data || {};
    var range = defaultPeriodRange();
    var start = data.period_start || range.start;
    var end = data.period_end || range.end;
    var base = data.base_amount != null ? data.base_amount : 4986;
    var pension = data.pension_pay != null ? data.pension_pay : Math.round(Number(base) * 0.08 * 100) / 100;
    var unemp =
      data.unemployment_pay != null
        ? data.unemployment_pay
        : Math.round(Number(base) * 0.005 * 100) / 100;
    var div = document.createElement('div');
    div.className = 'sbdy-seg';
    div.innerHTML =
      '<div class="sbdy-seg-head">' +
      '<span class="sbdy-seg-title">参保段</span>' +
      '<button type="button" class="btn-page sbdy-seg-remove">删除本段</button>' +
      '</div>' +
      '<div class="form-row flex-wrap gap-10">' +
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
      esc(data.area || '余杭区') +
      '"></div>' +
      '</div>' +
      '<div class="form-row flex-wrap gap-10" style="margin-top:8px;">' +
      '<div><label>缴费起月</label>' +
      '<input type="month" class="sbdy-seg-start" value="' +
      esc(start) +
      '"></div>' +
      '<div><label>缴费止月</label>' +
      '<input type="month" class="sbdy-seg-end" value="' +
      esc(end) +
      '"></div>' +
      '<div><label>缴费基数（元）</label>' +
      '<input type="number" class="sbdy-seg-base" step="0.01" value="' +
      esc(base) +
      '"></div>' +
      '<div><label>养老个人缴费</label>' +
      '<input type="number" class="sbdy-seg-pension" step="0.01" value="' +
      esc(pension) +
      '"></div>' +
      '<div><label>失业个人缴费</label>' +
      '<input type="number" class="sbdy-seg-unemp" step="0.01" value="' +
      esc(unemp) +
      '"></div>' +
      '</div>' +
      '<div class="sbdy-year-bases">' +
      '<label>按年基数（可选，每年可不同）</label>' +
      '<input type="text" class="sbdy-seg-year-bases" placeholder="如 2025=4462, 2026=4986；留空则整段用上方基数" value="' +
      esc(formatYearBasesText(data.year_bases)) +
      '">' +
      '</div>';
    var rm = div.querySelector('.sbdy-seg-remove');
    if (rm) {
      rm.onclick = function () {
        var wrapEl = document.getElementById('sbdySegments');
        if (!wrapEl || wrapEl.querySelectorAll('.sbdy-seg').length <= 1) return;
        div.remove();
        renumberSegments();
      };
    }
    wrap.appendChild(div);
    renumberSegments();
  }

  function ensureOneSegment() {
    var wrap = document.getElementById('sbdySegments');
    if (!wrap) return;
    if (!wrap.querySelector('.sbdy-seg')) {
      addSegment({});
    }
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
    var segments = collectSegments();
    var body = {
      name: val('sbdyName'),
      id_number: val('sbdyIdNumber'),
      gender: val('sbdyGender') || '女',
      status_pension: val('sbdyStatusPension') || '正常参保',
      status_medical: val('sbdyStatusInjury') || '正常参保',
      status_injury: val('sbdyStatusInjury') || '正常参保',
      status_unemployment: val('sbdyStatusUnemp') || '正常参保',
      print_date: val('sbdyPrintDate'),
      segments: segments
    };
    if (!body.name || !body.id_number) {
      setStatus('请填写上方「姓名」与「证件号码」', true);
      try {
        alert('请填写姓名与证件号码（在表单最上方）');
      } catch (e0) {}
      var nameEl = document.getElementById('sbdyName');
      if (nameEl && nameEl.scrollIntoView) nameEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    if (!segments.length) {
      setStatus('请至少填写一段参保信息', true);
      return;
    }
    var si;
    for (si = 0; si < segments.length; si++) {
      var sg = segments[si];
      if (!sg.period_start || !sg.period_end) {
        setStatus('第' + (si + 1) + '段：请选择缴费起止月份', true);
        return;
      }
      if (!sg.company_name && !sg.credit_code) {
        setStatus('第' + (si + 1) + '段：请填写参保单位', true);
        return;
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

  function resetSegments(list) {
    var wrap = document.getElementById('sbdySegments');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (!list || !list.length) {
      addSegment({});
      return;
    }
    list.forEach(function (seg) {
      addSegment(seg);
    });
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
    var samples = [
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
            period_start: '2025-07',
            period_end: '2026-06',
            base_amount: 4986,
            pension_pay: 398.88,
            unemployment_pay: 24.93,
            year_bases: { '2025': 4986, '2026': 4986 }
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
            period_start: '2024-08',
            period_end: '2025-03',
            base_amount: 6200,
            pension_pay: 496,
            unemployment_pay: 31
          },
          {
            company_name: '浙江星河网络科技有限公司',
            credit_code: '91330110MA2K98765B',
            area: '余杭区',
            period_start: '2025-04',
            period_end: '2026-06',
            base_amount: 6800,
            pension_pay: 544,
            unemployment_pay: 34,
            year_bases: { '2025': 6520, '2026': 6800 }
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
            period_start: '2025-07',
            period_end: '2026-06',
            base_amount: 5800,
            pension_pay: 464,
            unemployment_pay: 29,
            year_bases: { '2025': 5600, '2026': 5800 }
          }
        ]
      }
    ];
    var sample =
      Math.random() < 0.55
        ? samples[0]
        : samples[Math.floor(Math.random() * samples.length)];
    setField('sbdyName', sample.name);
    setField('sbdyIdNumber', sample.id_number);
    setField('sbdyGender', sample.gender);
    setField('sbdyStatusPension', sample.status);
    setField('sbdyStatusInjury', sample.status);
    setField('sbdyStatusUnemp', sample.status);
    setField('sbdyPrintDate', sample.print_date);
    resetSegments(sample.segments);
    var hint =
      sample.segments.length > 1
        ? '（' + sample.segments.length + ' 段，基本情况显示最近公司）'
        : '';
    setStatus('已填充示例：' + sample.name + hint + '（可再点生成）', false);
  }

  function bind() {
    ensureOneSegment();
    var addBtn = document.getElementById('btnSbdyAddSegment');
    if (addBtn) {
      addBtn.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        addSegment({});
      };
    }
    var fillBtn = document.getElementById('btnSbdyDemoFillSample');
    if (fillBtn) {
      fillBtn.onclick = function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        fillSample();
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

  function loadPage() {
    bind();
    loadList();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['sbdy-demo'] = {
    ready: true,
    loadPage: loadPage,
    generate: generate,
    fillSample: fillSample
  };
  global.loadSbdyDemoPage = loadPage;
  global.sbdyDemoGenerate = generate;
  global.sbdyDemoFillSample = fillSample;
})(window);
