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
      '<div><label>养老个人缴费</label>' +
      '<input type="number" class="sbdy-per-pension" step="0.01" value="' +
      esc(pension) +
      '"></div>' +
      '<div><label>失业个人缴费</label>' +
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
      esc(data.area || '余杭区') +
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
        area: fieldOf(seg, 'sbdy-seg-area') || '余杭区',
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
    resetExperiences(sample.segments);
    var tipParts = [];
    tipParts.push(sample.segments.length + ' 段经历');
    var baseCount = 0;
    sample.segments.forEach(function (s) {
      baseCount += (s.periods && s.periods.length) || 0;
    });
    tipParts.push(baseCount + ' 个基数区间');
    setStatus('已填充示例：' + sample.name + '（' + tipParts.join('，') + '，可再点生成）', false);
  }

  function bind() {
    ensureOneExperience();
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
  global.sbdyDemoAddExperience = function () {
    addExperience({});
  };
})(window);
