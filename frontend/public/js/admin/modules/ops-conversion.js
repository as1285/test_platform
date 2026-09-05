/** Admin module: 转化运营 — 未激活明细 / 转化调研 */
(function (global) {
  var page = 1;
  var lastUsers = [];
  var lastTotal = 0;
  var lastLimit = 20;
  var bound = false;

  function fetchAdmin(url, opts) {
    var fn = global.adminFetch;
    if (typeof fn !== 'function') {
      return Promise.reject(new Error('adminFetch unavailable'));
    }
    return fn(url, opts);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function currentHash() {
    return String(global.location.hash || '')
      .replace(/^#/, '')
      .trim()
      .toLowerCase();
  }

  function formatDt(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso);
      var utc = d.getTime() + d.getTimezoneOffset() * 60000;
      var nd = new Date(utc + 3600000 * 8);
      var pad = function (n) {
        return n < 10 ? '0' + n : String(n);
      };
      return (
        nd.getFullYear() +
        '-' +
        pad(nd.getMonth() + 1) +
        '-' +
        pad(nd.getDate()) +
        ' ' +
        pad(nd.getHours()) +
        ':' +
        pad(nd.getMinutes())
      );
    } catch (e0) {
      return String(iso);
    }
  }

  function formatIncome(n) {
    var v = Number(n);
    if (!isFinite(v) || v <= 0) return '—';
    if (v >= 10000) {
      return String(Math.round(v / 100) / 100) + '万';
    }
    return String(Math.round(v));
  }

  function channelLabel(ch) {
    var key = String(ch || '').trim();
    if (!key || key === '(empty)') return '未填';
    var map = {
      github: 'GitHub',
      douyin: '抖音',
      friend: '朋友介绍',
      bilibili: 'B站',
      tieba: '贴吧',
      zhihu: '知乎'
    };
    return map[key] || key;
  }

  function priceLabel(row) {
    var s = String((row && row.price_sentiment) || '').toLowerCase();
    var map = { expensive: '贵', fair: '合理', cheap: '便宜', skipped: '跳过' };
    var t = map[s] || (s ? s : '—');
    if (row && row.expected_price != null && isFinite(Number(row.expected_price))) {
      return t === '—' ? '心理价' + row.expected_price : t + ' · ' + row.expected_price;
    }
    return t;
  }

  function satLabel(key) {
    var map = { good: '满意', ok: '一般', bad: '不满意', skipped: '跳过' };
    var k = String(key || '').toLowerCase();
    return map[k] || '';
  }

  function yesNo(v) {
    return v ? '去过' : '未去';
  }

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
  }

  function queryString() {
    var qs = [
      'page=' + encodeURIComponent(String(page)),
      'limit=20',
      'days=' + encodeURIComponent(val('opsInactiveDays') || '0'),
      'segment=' + encodeURIComponent(val('opsInactiveSegment') || 'all')
    ];
    var ch = val('opsInactiveChannel');
    if (ch) qs.push('channel=' + encodeURIComponent(ch));
    var q = val('opsInactiveQ');
    if (q) qs.push('q=' + encodeURIComponent(q));
    return qs.join('&');
  }

  function jumpToUser(username) {
    var name = String(username || '').trim();
    if (!name) return;
    var usernameEl = document.getElementById('filterUsername');
    var exactEl = document.getElementById('filterExact');
    var highIncomeEl = document.getElementById('filterHighIncome');
    var d1El = document.getElementById('filterD1Return');
    var activeEl = document.getElementById('filterActive');
    if (usernameEl) usernameEl.value = name;
    if (exactEl) exactEl.checked = true;
    if (highIncomeEl) highIncomeEl.value = '';
    if (d1El) d1El.value = '';
    if (activeEl) activeEl.value = '0';
    global.location.hash = 'users';
  }

  function renderSummary(data) {
    var el = document.getElementById('opsInactiveSummary');
    if (!el) return;
    var s = (data && data.stock) || {};
    function card(seg, label, num) {
      return (
        '<button type="button" class="user-data-stat-card ops-summary-card" data-segment="' +
        esc(seg) +
        '"><div class="ud-label">' +
        esc(label) +
        '</div><div class="ud-val">' +
        esc(String(num != null ? num : 0)) +
        '</div></button>'
      );
    }
    el.innerHTML =
      card('all', '未激活', s.total) +
      card('has_tax', '有个税', s.has_tax) +
      card('no_tax', '无个税', s.no_tax) +
      card('high_income', '月入>1.5万', s.high_income) +
      card('saw_purchase', '去过开通页', s.saw_purchase) +
      card('no_consult', '没进填写页', (s.total || 0) - (s.saw_consult || 0) > 0 ? (s.total || 0) - (s.saw_consult || 0) : 0) +
      card('d1_only', '仅次日回访', s.d1_only);
  }

  function renderUsers(data) {
    var tbody = document.getElementById('opsInactiveTbody');
    var stat = document.getElementById('opsInactiveStat');
    var info = document.getElementById('opsInactivePageInfo');
    lastUsers = (data && data.users) || [];
    lastTotal = Number(data && data.total) || 0;
    lastLimit = Number(data && data.limit) || 20;
    page = Number(data && data.page) || page;
    if (stat) {
      stat.textContent = '共 ' + lastTotal + ' 人 · 第 ' + page + ' 页';
    }
    if (info) {
      var pages = Math.max(1, Math.ceil(lastTotal / lastLimit) || 1);
      info.textContent = '第 ' + page + ' / ' + pages + ' 页';
    }
    if (!tbody) return;
    if (!lastUsers.length) {
      tbody.innerHTML = '<tr><td colspan="11">这批筛选没有人</td></tr>';
      return;
    }
    tbody.innerHTML = lastUsers
      .map(function (u) {
        var tax =
          u.has_tax ? '有' : '无';
        var sat = satLabel(u.tax_fill_satisfaction);
        if (sat) tax += ' · ' + sat;
        var income = formatIncome(u.max_month_income);
        if (u.high_income) {
          income =
            '<span class="high-income-badge" title="自己填写月收入">月入' +
            esc(income) +
            '</span>';
        } else {
          income = esc(income);
        }
        return (
          '<tr>' +
          '<td class="cell-break">' +
          esc(u.username) +
          '</td>' +
          '<td class="cell-break">' +
          esc(u.real_name || '—') +
          '</td>' +
          '<td>' +
          esc(formatDt(u.created_at)) +
          '</td>' +
          '<td>' +
          esc(channelLabel(u.register_source_channel)) +
          '</td>' +
          '<td>' +
          esc(tax) +
          '</td>' +
          '<td>' +
          income +
          '</td>' +
          '<td>' +
          esc(yesNo(u.saw_consult)) +
          '</td>' +
          '<td>' +
          esc(yesNo(u.saw_purchase)) +
          '</td>' +
          '<td>' +
          esc(priceLabel(u)) +
          '</td>' +
          '<td>' +
          esc(formatDt(u.last_seen_at)) +
          '</td>' +
          '<td><button type="button" class="btn-sm btn-detail js-ops-open-user" data-u="' +
          esc(u.username) +
          '">详情</button></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function loadSummary() {
    var el = document.getElementById('opsInactiveSummary');
    if (!el) return;
    var days = val('opsInactiveDays') || '0';
    var ch = val('opsInactiveChannel');
    var url = 'api/admin/ops/inactive-summary?days=' + encodeURIComponent(days);
    if (ch) url += '&channel=' + encodeURIComponent(ch);
    fetchAdmin(url)
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r);
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          el.textContent = (j && j.msg) || '加载失败';
          return;
        }
        renderSummary(j.data);
      })
      .catch(function () {
        el.textContent = '加载失败';
      });
  }

  function loadUsers() {
    var tbody = document.getElementById('opsInactiveTbody');
    var stat = document.getElementById('opsInactiveStat');
    if (stat) stat.textContent = '加载中…';
    if (tbody) tbody.innerHTML = '<tr><td colspan="11">加载中…</td></tr>';
    fetchAdmin('api/admin/ops/inactive-users?' + queryString())
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r);
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          if (tbody) tbody.innerHTML = '<tr><td colspan="11">' + esc((j && j.msg) || '加载失败') + '</td></tr>';
          if (stat) stat.textContent = (j && j.msg) || '加载失败';
          return;
        }
        renderUsers(j.data);
      })
      .catch(function () {
        if (tbody) tbody.innerHTML = '<tr><td colspan="11">加载失败</td></tr>';
        if (stat) stat.textContent = '加载失败';
      });
  }

  function loadInactivePage() {
    loadSummary();
    loadUsers();
  }

  function exportCsv() {
    if (!lastUsers.length) return;
    var header = [
      '账号',
      '姓名',
      '注册',
      '渠道',
      '个税',
      '月入',
      '填写页',
      '开通页',
      '价格态度',
      '心理价',
      '最近活跃'
    ];
    var lines = [header.join(',')];
    lastUsers.forEach(function (u) {
      var cells = [
        u.username,
        u.real_name || '',
        formatDt(u.created_at),
        channelLabel(u.register_source_channel),
        u.has_tax ? '有' : '无',
        u.max_month_income || '',
        u.saw_consult ? '去过' : '未去',
        u.saw_purchase ? '去过' : '未去',
        u.price_sentiment || '',
        u.expected_price != null ? u.expected_price : '',
        formatDt(u.last_seen_at)
      ].map(function (v) {
        return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      });
      lines.push(cells.join(','));
    });
    var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'unactivated-users.csv';
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 800);
  }

  function bind() {
    if (bound) return;
    bound = true;
    var search = document.getElementById('btnOpsInactiveSearch');
    if (search) {
      search.addEventListener('click', function () {
        page = 1;
        loadInactivePage();
      });
    }
    ['opsInactiveSegment', 'opsInactiveDays', 'opsInactiveChannel'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', function () {
          page = 1;
          loadInactivePage();
        });
      }
    });
    var q = document.getElementById('opsInactiveQ');
    if (q) {
      q.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          page = 1;
          loadInactivePage();
        }
      });
    }
    var exp = document.getElementById('btnOpsInactiveExport');
    if (exp) exp.addEventListener('click', exportCsv);
    var prev = document.getElementById('opsInactivePrev');
    if (prev) {
      prev.addEventListener('click', function () {
        if (page <= 1) return;
        page -= 1;
        loadUsers();
      });
    }
    var next = document.getElementById('opsInactiveNext');
    if (next) {
      next.addEventListener('click', function () {
        var pages = Math.max(1, Math.ceil(lastTotal / lastLimit) || 1);
        if (page >= pages) return;
        page += 1;
        loadUsers();
      });
    }
    var sum = document.getElementById('opsInactiveSummary');
    if (sum) {
      sum.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('[data-segment]') : null;
        if (!btn) return;
        var seg = btn.getAttribute('data-segment') || 'all';
        var sel = document.getElementById('opsInactiveSegment');
        if (sel) sel.value = seg;
        page = 1;
        loadInactivePage();
      });
    }
    var tbody = document.getElementById('opsInactiveTbody');
    if (tbody) {
      tbody.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('.js-ops-open-user') : null;
        if (!btn) return;
        jumpToUser(btn.getAttribute('data-u'));
      });
    }
    var boardRefresh = document.getElementById('btnOpsBoardRefresh');
    if (boardRefresh) boardRefresh.addEventListener('click', loadBoard);
    var boardTodo = document.getElementById('opsBoardTodo');
    if (boardTodo) {
      boardTodo.addEventListener('click', function (ev) {
        var a = ev.target && ev.target.closest ? ev.target.closest('a[data-ops-seg]') : null;
        if (!a) return;
        var seg = a.getAttribute('data-ops-seg') || 'all';
        try {
          global.sessionStorage.setItem('ops_inactive_segment', seg);
        } catch (e0) {}
      });
    }
    var kpiMount = document.getElementById('opsBoardKpi');
    if (kpiMount) {
      kpiMount.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('.js-ops-gmv-detail') : null;
        if (!btn) return;
        openPayDetail();
      });
    }
    var payClose = document.getElementById('btnOpsBoardPayClose');
    if (payClose) {
      payClose.addEventListener('click', function () {
        var panel = document.getElementById('opsBoardPayDetail');
        if (panel) panel.hidden = true;
      });
    }
    var payDays = document.getElementById('opsBoardPayDays');
    if (payDays) {
      payDays.addEventListener('change', function () {
        var panel = document.getElementById('opsBoardPayDetail');
        if (panel && !panel.hidden) loadPayDetail();
      });
    }
    var payTbody = document.getElementById('opsBoardPayTbody');
    if (payTbody) {
      payTbody.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('.js-ops-open-user') : null;
        if (!btn) return;
        jumpToUser(btn.getAttribute('data-u'));
      });
    }
  }

  function openPayDetail() {
    var panel = document.getElementById('opsBoardPayDetail');
    if (panel) panel.hidden = false;
    loadPayDetail();
  }

  function loadPayDetail() {
    var tbody = document.getElementById('opsBoardPayTbody');
    var meta = document.getElementById('opsBoardPayDetailMeta');
    var daysEl = document.getElementById('opsBoardPayDays');
    var days = daysEl && daysEl.value ? daysEl.value : '1';
    if (tbody) tbody.innerHTML = '<tr><td colspan="5">加载中…</td></tr>';
    if (meta) meta.textContent = '';
    fetchAdmin('api/admin/ops/board/payments?days=' + encodeURIComponent(days))
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r);
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          if (tbody) {
            tbody.innerHTML =
              '<tr><td colspan="5">' + esc((j && j.msg) || '加载失败') + '</td></tr>';
          }
          return;
        }
        renderPayDetail(j.data);
      })
      .catch(function () {
        if (tbody) tbody.innerHTML = '<tr><td colspan="5">加载失败</td></tr>';
      });
  }

  function renderPayDetail(data) {
    var tbody = document.getElementById('opsBoardPayTbody');
    var meta = document.getElementById('opsBoardPayDetailMeta');
    if (!tbody) return;
    var list = (data && data.list) || [];
    if (meta) {
      meta.textContent =
        '共 ' +
        (data.orders != null ? data.orders : list.length) +
        ' 单 · ¥' +
        (data.gmv != null ? data.gmv : 0) +
        (data.truncated ? '（仅显示最近 500 单）' : '');
    }
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5">暂无已付订单</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .map(function (row) {
        var u = String(row.username || '');
        return (
          '<tr><td><button type="button" class="btn-rename-user js-ops-open-user" data-u="' +
          esc(u) +
          '">' +
          esc(u || '—') +
          '</button></td><td>' +
          esc(row.label || row.sku_id || '—') +
          '</td><td>¥' +
          esc(String(row.amount != null ? row.amount : 0)) +
          '</td><td>' +
          esc(formatDt(row.paid_at)) +
          '</td><td class="cell-break"><code>' +
          esc(row.out_trade_no || '—') +
          '</code></td></tr>'
        );
      })
      .join('');
  }

  function kpiCard(label, value, sub) {
    return (
      '<div class="ops-board-kpi-card"><div class="label">' +
      esc(label) +
      '</div><div class="value">' +
      esc(String(value != null ? value : 0)) +
      '</div>' +
      (sub ? '<div class="sub">' + esc(sub) + '</div>' : '') +
      '</div>'
    );
  }

  function kpiGmvCard(skuRows, payOrdersGmv, taxEditGmv, totalGmv) {
    function yen(v) {
      return '¥' + (v != null ? v : 0);
    }
    var rows = Array.isArray(skuRows) ? skuRows.slice() : [];
    if (!rows.length) {
      rows = [
        { label: '付费了单', orders: 0, gmv: payOrdersGmv },
        { label: '修改个税', orders: 0, gmv: taxEditGmv }
      ];
    }
    var sumFromRows = 0;
    for (var i = 0; i < rows.length; i++) {
      sumFromRows += Number(rows[i].gmv) || 0;
    }
    sumFromRows = Math.round(sumFromRows * 100) / 100;
    var fromApi = Number(totalGmv);
    /* 有 SKU 拆分时以拆分合计为准，避免 pay_gmv 为 0/缺失时总额空白 */
    var total =
      rows.length && sumFromRows > 0
        ? sumFromRows
        : isFinite(fromApi) && fromApi > 0
          ? Math.round(fromApi * 100) / 100
          : sumFromRows;
    var items = rows
      .map(function (r) {
        var label = r.label || r.sku_id || '其他';
        var orders = Number(r.orders) || 0;
        var k = orders > 0 ? label + ' · ' + orders + '单' : label;
        return (
          '<div class="ops-board-kpi-split-item"><span class="k">' +
          esc(k) +
          '</span><span class="v">' +
          esc(yen(r.gmv)) +
          '</span></div>'
        );
      })
      .join('');
    return (
      '<div class="ops-board-kpi-card ops-board-kpi-gmv">' +
      '<div class="label ops-board-kpi-gmv-head"><span>今日 GMV</span>' +
      '<button type="button" class="btn-page btn-sm js-ops-gmv-detail">详情</button>' +
      '</div>' +
      '<div class="value ops-board-kpi-gmv-total" title="今日付费总额">' +
      esc(yen(total)) +
      '</div>' +
      '<div class="ops-board-kpi-split">' +
      items +
      '</div></div>'
    );
  }

  function todoCard(segOrHref, label, num, hint, isAd) {
    if (isAd) {
      return (
        '<a href="#ops-ad-analytics/data"><div class="todo-label">' +
        esc(label) +
        '</div><div class="todo-num">' +
        esc(String(num != null ? num : 0)) +
        '</div><div class="todo-hint">' +
        esc(hint || '') +
        '</div></a>'
      );
    }
    return (
      '<a href="#ops-inactive" data-ops-seg="' +
      esc(segOrHref) +
      '"><div class="todo-label">' +
      esc(label) +
      '</div><div class="todo-num">' +
      esc(String(num != null ? num : 0)) +
      '</div><div class="todo-hint">' +
      esc(hint || '') +
      '</div></a>'
    );
  }

  function researchChip(label, value) {
    return (
      '<div class="chip"><div class="k">' +
      esc(label) +
      '</div><div class="v">' +
      esc(String(value != null ? value : 0)) +
      '</div></div>'
    );
  }

  function renderBoard(data) {
    var today = (data && data.today) || {};
    var stock = (data && data.stock) || {};
    var funnel = ((data && data.research) || {}).funnel || {};
    var kpi = document.getElementById('opsBoardKpi');
    if (kpi) {
      var payOrdersGmv =
        today.pay_orders_gmv != null
          ? today.pay_orders_gmv
          : Math.max(
              0,
              Math.round(
                ((Number(today.pay_gmv) || 0) - (Number(today.tax_edit_gmv) || 0)) * 100
              ) / 100
            );
      kpi.innerHTML =
        kpiCard('今日注册', today.register, '按注册IP去重') +
        kpiCard('今日激活', today.activate) +
        kpiCard('今日付费单', today.pay_orders) +
        kpiGmvCard(today.gmv_by_sku, payOrdersGmv, today.tax_edit_gmv, today.pay_gmv);
    }
    var todo = document.getElementById('opsBoardTodo');
    if (todo) {
      todo.innerHTML =
        todoCard('d1_only', '仅次日回访', stock.d1_only, '未激活 · 优先群发') +
        todoCard('high_income', '月入>1.5万', stock.high_income, '未激活高意向') +
        todoCard('purchase_no_pay', '看过开通未付', stock.purchase_no_pay, '临门一脚') +
        todoCard('', '退税合格', stock.refund_eligible, '含已开通', true);
    }
    var research = document.getElementById('opsBoardResearch');
    if (research) {
      research.innerHTML =
        researchChip('注册', funnel.registered) +
        researchChip('已激活', funnel.activated) +
        researchChip('激活率', (funnel.activate_pct != null ? funnel.activate_pct : 0) + '%') +
        researchChip('未激活有税', funnel.unact_has_tax) +
        researchChip('未激活无税', funnel.unact_no_tax) +
        researchChip('看过开通', funnel.unact_saw_pay) +
        researchChip('高收入未开', funnel.unact_high_income) +
        researchChip('打开填写未交', funnel.opened_fill_no_submit);
    }
  }

  function loadBoard() {
    var kpi = document.getElementById('opsBoardKpi');
    var todo = document.getElementById('opsBoardTodo');
    var research = document.getElementById('opsBoardResearch');
    if (kpi) kpi.textContent = '加载中…';
    if (todo) todo.innerHTML = '';
    if (research) research.textContent = '加载中…';
    fetchAdmin('api/admin/ops/board?days=7')
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r);
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          if (kpi) kpi.textContent = (j && j.msg) || '加载失败';
          if (research) research.textContent = (j && j.msg) || '加载失败';
          return;
        }
        renderBoard(j.data);
      })
      .catch(function () {
        if (kpi) kpi.textContent = '加载失败';
        if (research) research.textContent = '加载失败';
      });
  }

  function loadPage() {
    bind();
    var hash = currentHash();
    if (
      hash === 'ops-research' ||
      hash === 'ops-lift' ||
      hash === 'analytics-conversion' ||
      hash === 'analytics'
    ) {
      try {
        global.location.replace('#ops-board');
      } catch (e0) {
        global.location.hash = 'ops-board';
      }
      return;
    }
    if (hash === 'ops-board') {
      loadBoard();
      return;
    }
    if (hash === 'ops-inactive') {
      page = 1;
      try {
        var seg = global.sessionStorage.getItem('ops_inactive_segment');
        if (seg) {
          var sel = document.getElementById('opsInactiveSegment');
          if (sel) sel.value = seg;
          global.sessionStorage.removeItem('ops_inactive_segment');
        }
      } catch (eSeg) {}
      loadInactivePage();
    }
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['ops-conversion'] = {
    ready: true,
    loadPage: loadPage
  };
})(window);
