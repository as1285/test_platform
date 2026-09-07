/** Admin module: ABC 渠道转化看板 + 用户名单 */
(function (global) {
  var userPage = 1;
  var lastUsers = [];
  var lastTotal = 0;
  var lastLimit = 20;
  var bound = false;
  var payOpen = false;
  var chartInst = null;

  function fetchAdmin(url, opts) {
    var fn = global.adminFetch;
    if (typeof fn !== 'function') {
      return Promise.reject(new Error('adminFetch unavailable'));
    }
    return fn(url, opts);
  }

  function parseAdminJson(r) {
    var fn = global.adminParseJson;
    if (typeof fn === 'function') return fn(r);
    return r.json();
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

  function periodVal(id, fallback) {
    var el = document.getElementById(id);
    if (global.AdminAnalyticsPeriod && typeof AdminAnalyticsPeriod.getValue === 'function') {
      return AdminAnalyticsPeriod.getValue(el);
    }
    return el ? String(el.value || fallback || '7') : fallback || '7';
  }

  function jumpToUser(username) {
    var name = String(username || '').trim();
    if (!name) return;
    if (typeof global.jumpToRegisteredUser === 'function') {
      global.jumpToRegisteredUser(name);
      return;
    }
    global.location.hash = 'users';
  }

  function yen(v) {
    return '¥' + (v != null ? v : 0);
  }

  function visHint(vis) {
    if (!vis || vis.sees_new_abc) return '';
    if (vis.viewer === 'full') {
      return '<p class="hint abc-ops-vis-hint">当前账号看不到截止后新注册的 abc 用户，仅历史 abc 进入转化/名单。</p>';
    }
    return '<p class="hint abc-ops-vis-hint">当前账号看不到 abc 渠道用户，下载页统计仍可用。</p>';
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

  function kpiGmvCard(skuRows, totalGmv) {
    var rows = Array.isArray(skuRows) ? skuRows.slice() : [];
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
      '<button type="button" class="btn-page btn-sm js-abc-gmv-detail">详情</button>' +
      '</div>' +
      '<div class="value ops-board-kpi-gmv-total">' +
      esc(yen(totalGmv || 0)) +
      '</div>' +
      '<div class="ops-board-kpi-split">' +
      (items || '<div class="ops-board-kpi-split-item"><span class="k">暂无</span><span class="v">¥0</span></div>') +
      '</div></div>'
    );
  }

  function funnelStep(label, value, rate, hint) {
    return (
      '<div class="abc-ops-funnel-step">' +
      '<div class="abc-ops-funnel-label">' +
      esc(label) +
      '</div>' +
      '<div class="abc-ops-funnel-value">' +
      esc(String(value != null ? value : 0)) +
      '</div>' +
      (rate
        ? '<div class="abc-ops-funnel-rate">' + esc(rate) + '</div>'
        : '<div class="abc-ops-funnel-rate abc-ops-funnel-rate-empty">—</div>') +
      (hint ? '<div class="abc-ops-funnel-hint">' + esc(hint) + '</div>' : '') +
      '</div>'
    );
  }

  function funnelArrow() {
    return '<div class="abc-ops-funnel-arrow" aria-hidden="true">→</div>';
  }

  function destroyChart() {
    if (chartInst && typeof chartInst.destroy === 'function') {
      try {
        chartInst.destroy();
      } catch (e0) {}
    }
    chartInst = null;
  }

  function renderChart(daily) {
    destroyChart();
    var canvas = document.getElementById('abcOpsDailyChart');
    if (!canvas || typeof global.Chart !== 'function' || !daily.length) return;
    chartInst = new global.Chart(canvas, {
      type: 'line',
      data: {
        labels: daily.map(function (r) {
          return r.date;
        }),
        datasets: [
          {
            label: '浏览 UV',
            data: daily.map(function (r) {
              return r.view_uv || 0;
            }),
            borderColor: '#94a3b8',
            backgroundColor: 'rgba(148,163,184,0.12)',
            tension: 0.25,
            fill: false
          },
          {
            label: '下载 UV',
            data: daily.map(function (r) {
              return r.download_uv || 0;
            }),
            borderColor: '#0d9488',
            backgroundColor: 'rgba(13,148,136,0.12)',
            tension: 0.25,
            fill: false
          },
          {
            label: '注册',
            data: daily.map(function (r) {
              return r.registered || 0;
            }),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37,99,235,0.12)',
            tension: 0.25,
            fill: false
          },
          {
            label: '开通',
            data: daily.map(function (r) {
              return r.activated || 0;
            }),
            borderColor: '#7c3aed',
            backgroundColor: 'rgba(124,58,237,0.12)',
            tension: 0.25,
            fill: false
          },
          {
            label: '付费单',
            data: daily.map(function (r) {
              return r.pay_orders || 0;
            }),
            borderColor: '#d97706',
            backgroundColor: 'rgba(217,119,6,0.12)',
            tension: 0.25,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });
  }

  function renderOverview(data) {
    var todayEl = document.getElementById('abcOpsTodayKpi');
    var funnelEl = document.getElementById('abcOpsFunnel');
    var ratesEl = document.getElementById('abcOpsRates');
    var stockEl = document.getElementById('abcOpsStock');
    var hintEl = document.getElementById('abcOpsPeriodHint');
    var visEl = document.getElementById('abcOpsVisHint');
    var today = (data && data.today) || {};
    var funnel = (data && data.funnel) || {};
    var rates = (data && data.rates) || {};
    var stock = (data && data.stock) || {};
    if (visEl) visEl.innerHTML = visHint(data && data.visibility);
    if (hintEl) {
      hintEl.textContent = data && data.period_label ? '统计区间：' + data.period_label : '';
    }
    if (todayEl) {
      todayEl.innerHTML =
        kpiCard('今日注册', today.register, 'abc 账号') +
        kpiCard('今日开通', today.activate, '激活码核销') +
        kpiCard('今日付费单', today.pay_orders, 'abc 账号已付') +
        kpiGmvCard(today.gmv_by_sku, today.pay_gmv);
    }
    if (funnelEl) {
      funnelEl.innerHTML =
        funnelStep('浏览 UV', funnel.view_uv, null, '下载页') +
        funnelArrow() +
        funnelStep('下载 UV', funnel.download_uv, rates.download_of_view, '占浏览') +
        funnelArrow() +
        funnelStep('注册', funnel.registered, rates.register_of_download, '占下载') +
        funnelArrow() +
        funnelStep('看支付页', funnel.saw_purchase, rates.purchase_of_register, '占注册') +
        funnelArrow() +
        funnelStep('开通', funnel.activated, rates.activate_of_register, '占注册') +
        funnelArrow() +
        funnelStep('付费用户', funnel.paid_users, rates.pay_of_register, '占注册');
    }
    if (ratesEl) {
      ratesEl.innerHTML =
        '<div class="abc-ops-rate-card"><div class="k">浏览→下载</div><div class="v">' +
        esc(rates.download_of_view || '—') +
        '</div></div>' +
        '<div class="abc-ops-rate-card"><div class="k">下载→注册</div><div class="v">' +
        esc(rates.register_of_download || '—') +
        '</div></div>' +
        '<div class="abc-ops-rate-card"><div class="k">注册→开通</div><div class="v">' +
        esc(rates.activate_of_register || '—') +
        '</div></div>' +
        '<div class="abc-ops-rate-card"><div class="k">注册→付费</div><div class="v">' +
        esc(rates.pay_of_register || '—') +
        '</div></div>' +
        '<div class="abc-ops-rate-card"><div class="k">区间 GMV</div><div class="v">' +
        esc(yen(funnel.pay_gmv || 0)) +
        '</div><div class="s">' +
        esc(String(funnel.pay_orders || 0)) +
        ' 单</div></div>' +
        '<div class="abc-ops-rate-card"><div class="k">区间填税</div><div class="v">' +
        esc(String(funnel.has_tax || 0)) +
        '</div></div>';
    }
    if (stockEl) {
      stockEl.innerHTML =
        kpiCard('未开通库存', stock.inactive, '当前仍未开通') +
        kpiCard('未开通有税', stock.has_tax) +
        kpiCard('看过支付页', stock.saw_purchase) +
        kpiCard('近 7 日未开', stock.in_7d);
    }
    var daily = Array.isArray(data && data.daily) ? data.daily : [];
    var empty = document.getElementById('abcOpsChartEmpty');
    if (empty) empty.hidden = daily.length > 0;
    renderChart(daily);
  }

  function loadOverview() {
    var todayEl = document.getElementById('abcOpsTodayKpi');
    var funnelEl = document.getElementById('abcOpsFunnel');
    if (todayEl) todayEl.textContent = '加载中…';
    if (funnelEl) funnelEl.textContent = '加载中…';
    var days = periodVal('abcOpsDays', '7');
    fetchAdmin('api/admin/ops/abc/overview?days=' + encodeURIComponent(days))
      .then(parseAdminJson)
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          if (todayEl) todayEl.textContent = (j && j.msg) || '加载失败';
          if (funnelEl) funnelEl.textContent = (j && j.msg) || '加载失败';
          return;
        }
        renderOverview(j.data);
        if (payOpen) loadPayments();
      })
      .catch(function () {
        if (todayEl) todayEl.textContent = '加载失败';
        if (funnelEl) funnelEl.textContent = '加载失败';
      });
  }

  function renderPayDetail(data) {
    var tbody = document.getElementById('abcOpsPayTbody');
    var meta = document.getElementById('abcOpsPayDetailMeta');
    if (!tbody) return;
    var list = (data && data.list) || [];
    if (meta) {
      meta.textContent =
        '共 ' +
        (data.orders != null ? data.orders : list.length) +
        ' 单 · ' +
        yen(data.gmv != null ? data.gmv : 0) +
        (data.truncated ? '（仅显示最近 500 单）' : '');
    }
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="5">暂无 abc 已付订单</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .map(function (row) {
        var u = String(row.username || '');
        return (
          '<tr><td><button type="button" class="admin-user-jump js-abc-open-user" data-u="' +
          esc(u) +
          '">' +
          esc(u || '—') +
          '</button></td><td>' +
          esc(row.label || row.sku_id || '—') +
          '</td><td>' +
          esc(yen(row.amount)) +
          '</td><td>' +
          esc(formatDt(row.paid_at)) +
          '</td><td class="cell-break"><code>' +
          esc(row.out_trade_no || '—') +
          '</code></td></tr>'
        );
      })
      .join('');
  }

  function loadPayments() {
    var wrap = document.getElementById('abcOpsPayDetail');
    var tbody = document.getElementById('abcOpsPayTbody');
    if (!wrap || !tbody) return;
    wrap.hidden = false;
    payOpen = true;
    tbody.innerHTML = '<tr><td colspan="5">加载中…</td></tr>';
    var daysEl = document.getElementById('abcOpsPayDays');
    var days = daysEl ? String(daysEl.value || '1') : '1';
    fetchAdmin('api/admin/ops/abc/payments?days=' + encodeURIComponent(days))
      .then(parseAdminJson)
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          tbody.innerHTML =
            '<tr><td colspan="5">' + esc((j && j.msg) || '加载失败') + '</td></tr>';
          return;
        }
        renderPayDetail(j.data);
      })
      .catch(function () {
        tbody.innerHTML = '<tr><td colspan="5">加载失败</td></tr>';
      });
  }

  function closePayments() {
    var wrap = document.getElementById('abcOpsPayDetail');
    if (wrap) wrap.hidden = true;
    payOpen = false;
  }

  function renderUsers(data) {
    var tbody = document.getElementById('abcOpsUserTbody');
    var stat = document.getElementById('abcOpsUserStat');
    var info = document.getElementById('abcOpsUserPageInfo');
    var visEl = document.getElementById('abcOpsUserVisHint');
    if (visEl) visEl.innerHTML = visHint(data && data.visibility);
    lastUsers = (data && data.items) || [];
    lastTotal = (data && data.total) || 0;
    lastLimit = (data && data.limit) || 20;
    if (stat) stat.textContent = '共 ' + lastTotal + ' 人';
    if (info) info.textContent = '第 ' + userPage + ' 页';
    if (!tbody) return;
    if (!lastUsers.length) {
      tbody.innerHTML = '<tr><td colspan="9">暂无 abc 渠道用户</td></tr>';
      return;
    }
    tbody.innerHTML = lastUsers
      .map(function (row) {
        var u = String(row.username || '');
        return (
          '<tr><td><button type="button" class="admin-user-jump js-abc-open-user" data-u="' +
          esc(u) +
          '">' +
          esc(u || '—') +
          '</button></td><td>' +
          esc(row.real_name || '—') +
          '</td><td>' +
          esc(row.register_source_label || '—') +
          '</td><td>' +
          esc(formatDt(row.created_at)) +
          '</td><td>' +
          (row.account_active ? '已开通' : '未开通') +
          '</td><td>' +
          (row.saw_purchase ? '去过' : '未去') +
          '</td><td>' +
          (row.has_tax ? '有' : '无') +
          '</td><td>' +
          (row.paid ? yen(row.gmv) : '—') +
          '</td><td>' +
          esc(row.city || '—') +
          '</td></tr>'
        );
      })
      .join('');
  }

  function loadUsers() {
    var tbody = document.getElementById('abcOpsUserTbody');
    var stat = document.getElementById('abcOpsUserStat');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9">加载中…</td></tr>';
    if (stat) stat.textContent = '加载中…';
    var daysEl = document.getElementById('abcOpsUserDays');
    var activeEl = document.getElementById('abcOpsUserActive');
    var qEl = document.getElementById('abcOpsUserQ');
    var qs = [
      'page=' + encodeURIComponent(String(userPage)),
      'limit=20',
      'days=' + encodeURIComponent(daysEl ? String(daysEl.value || '7') : '7')
    ];
    var active = activeEl ? String(activeEl.value || '') : '';
    if (active) qs.push('active=' + encodeURIComponent(active));
    var q = qEl ? String(qEl.value || '').trim() : '';
    if (q) qs.push('q=' + encodeURIComponent(q));
    fetchAdmin('api/admin/ops/abc/users?' + qs.join('&'))
      .then(parseAdminJson)
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          if (tbody) {
            tbody.innerHTML =
              '<tr><td colspan="9">' + esc((j && j.msg) || '加载失败') + '</td></tr>';
          }
          if (stat) stat.textContent = (j && j.msg) || '加载失败';
          return;
        }
        renderUsers(j.data);
      })
      .catch(function () {
        if (tbody) tbody.innerHTML = '<tr><td colspan="9">加载失败</td></tr>';
        if (stat) stat.textContent = '加载失败';
      });
  }

  function bind() {
    if (bound) return;
    bound = true;
    var root = document.body;
    if (!root) return;
    root.addEventListener('click', function (e) {
      var t = e.target && e.target.closest ? e.target.closest('button, a') : null;
      if (!t) return;
      if (t.id === 'btnAbcOpsRefresh') {
        loadOverview();
        return;
      }
      if (t.id === 'btnAbcOpsPayClose') {
        closePayments();
        return;
      }
      if (t.classList.contains('js-abc-gmv-detail')) {
        loadPayments();
        return;
      }
      if (t.id === 'btnAbcOpsUserSearch') {
        userPage = 1;
        loadUsers();
        return;
      }
      if (t.id === 'abcOpsUserPrev') {
        if (userPage > 1) {
          userPage -= 1;
          loadUsers();
        }
        return;
      }
      if (t.id === 'abcOpsUserNext') {
        if (userPage * lastLimit < lastTotal) {
          userPage += 1;
          loadUsers();
        }
        return;
      }
      if (t.classList.contains('js-abc-open-user')) {
        jumpToUser(t.getAttribute('data-u'));
      }
    });
    var payDays = document.getElementById('abcOpsPayDays');
    if (payDays) {
      payDays.addEventListener('change', function () {
        if (payOpen) loadPayments();
      });
    }
    var days = document.getElementById('abcOpsDays');
    if (days) {
      days.addEventListener('change', function () {
        loadOverview();
      });
    }
  }

  function loadPage() {
    bind();
    var hash = currentHash();
    if (hash === 'insights-growth/abc' || hash === 'abc-install-stats') {
      if (typeof global.loadAbcInstallStats === 'function') {
        global.loadAbcInstallStats();
      }
      return;
    }
    if (hash === 'abc-ops/users' || hash === 'abc-users') {
      userPage = 1;
      loadUsers();
      return;
    }
    if (hash === 'abc-ops/install') {
      if (typeof global.loadAbcInstallStats === 'function') {
        global.loadAbcInstallStats();
      }
      return;
    }
    loadOverview();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['abc-ops'] = {
    ready: true,
    loadPage: loadPage
  };
})(window);
