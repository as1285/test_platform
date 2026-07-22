/** Admin module: 社保演示生成 */
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
      html +=
        '<tr>' +
        '<td>' +
        esc(row.created_at ? String(row.created_at).replace('T', ' ').slice(0, 19) : '—') +
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
        '<td>' +
        esc(row.created_by_admin || '—') +
        '</td>' +
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
    var body = {
      name: val('sbdyName'),
      id_number: val('sbdyIdNumber'),
      gender: val('sbdyGender') || '女',
      company_name: val('sbdyCompany'),
      credit_code: val('sbdyCredit'),
      area: val('sbdyArea') || '余杭区',
      period_start: normalizeYm(val('sbdyPeriodStart')),
      period_end: normalizeYm(val('sbdyPeriodEnd')),
      base_amount: num('sbdyBase', 4986),
      pension_pay: num('sbdyPensionPay', 398.88),
      unemployment_pay: num('sbdyUnempPay', 24.93),
      status_pension: val('sbdyStatusPension') || '暂停缴费',
      status_injury: val('sbdyStatusInjury') || '暂停缴费',
      status_unemployment: val('sbdyStatusUnemp') || '暂停缴费',
      print_date: val('sbdyPrintDate')
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
    if (!body.period_start || !body.period_end) {
      setStatus('请选择缴费起止月份', true);
      try {
        alert('请选择缴费起止月份');
      } catch (e1) {}
      return;
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

  function fillSample() {
    var now = new Date();
    var bj = new Date(now.getTime() + 8 * 3600 * 1000);
    var endY = bj.getUTCFullYear();
    var endM = bj.getUTCMonth() + 1; // 1-12, use previous month as end of 12m window
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
    var sample = samples[Math.floor(Math.random() * samples.length)];
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
    setField('sbdyStatusPension', '暂停缴费');
    setField('sbdyStatusInjury', '暂停缴费');
    setField('sbdyStatusUnemp', '暂停缴费');
    setField('sbdyPrintDate', printDate);
    setStatus('已填充示例：' + sample.name + '（可再点生成）', false);
  }

  function bind() {
    fillDefaults();
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
