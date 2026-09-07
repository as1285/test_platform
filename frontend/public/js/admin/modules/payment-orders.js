/** Admin module: 订单检索 */
(function (global) {
  var page = 1;
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

  function val(id) {
    var el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
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

  function statusLabel(s) {
    var map = {
      pending: '待付',
      paid: '已支付',
      closed: '已关闭',
      refunded: '已退款'
    };
    return map[s] || s || '—';
  }

  function activeLabel(row) {
    if (row && row.currently_active) return '已开通';
    if (row && row.account_active) return '已过期';
    return '未开通';
  }

  function jumpUser(name) {
    var u = String(name || '').trim();
    if (!u) return;
    if (typeof global.jumpToRegisteredUser === 'function') {
      global.jumpToRegisteredUser(u);
    }
  }

  function copyText(text) {
    var t = String(text || '');
    if (!t) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).catch(function () {});
      return;
    }
    try {
      var ta = document.createElement('textarea');
      ta.value = t;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e0) {}
  }

  function queryString() {
    return [
      'page=' + encodeURIComponent(String(page)),
      'limit=20',
      'q=' + encodeURIComponent(val('payOrderQ')),
      'status=' + encodeURIComponent(val('payOrderStatus')),
      'issue=' + encodeURIComponent(val('payOrderIssue')),
      'days=' + encodeURIComponent(val('payOrderDays') || '90')
    ].join('&');
  }

  function renderRows(data) {
    var tbody = document.getElementById('payOrderTbody');
    var stat = document.getElementById('payOrderStat');
    var info = document.getElementById('payOrderPageInfo');
    var list = (data && data.list) || [];
    lastTotal = Number(data && data.total) || 0;
    lastLimit = Number(data && data.limit) || 20;
    page = Number(data && data.page) || page;
    if (stat) {
      stat.textContent = '共 ' + lastTotal + ' 笔 · 第 ' + page + ' 页';
    }
    if (info) {
      var pages = Math.max(1, Math.ceil(lastTotal / lastLimit) || 1);
      info.textContent = '第 ' + page + ' / ' + pages + ' 页';
    }
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="9">没有匹配的订单</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .map(function (row) {
        var warn = row.paid_not_active ? ' class="is-warn"' : '';
        return (
          '<tr' +
          warn +
          '>' +
          '<td>' +
          esc(formatDt(row.paid_at || row.created_at)) +
          '</td>' +
          '<td><button type="button" class="admin-user-jump js-pay-order-user" data-u="' +
          esc(row.username) +
          '">' +
          esc(row.username || '—') +
          '</button></td>' +
          '<td>' +
          esc(row.label || row.subject || '—') +
          '</td>' +
          '<td>¥' +
          esc(String(row.amount != null ? row.amount : '—')) +
          '</td>' +
          '<td>' +
          esc(statusLabel(row.status)) +
          '</td>' +
          '<td>' +
          esc(activeLabel(row)) +
          (row.paid_not_active ? ' <span class="pay-order-flag">付了没开通</span>' : '') +
          '</td>' +
          '<td class="cell-break"><button type="button" class="admin-user-jump js-pay-order-copy" data-copy="' +
          esc(row.out_trade_no) +
          '">' +
          esc(row.out_trade_no || '—') +
          '</button></td>' +
          '<td class="cell-break">' +
          esc(row.alipay_trade_no || '—') +
          '</td>' +
          '<td><button type="button" class="btn-sm btn-detail js-pay-order-user" data-u="' +
          esc(row.username) +
          '">用户</button></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function loadList() {
    var tbody = document.getElementById('payOrderTbody');
    var stat = document.getElementById('payOrderStat');
    if (stat) stat.textContent = '加载中…';
    if (tbody) tbody.innerHTML = '<tr><td colspan="9">加载中…</td></tr>';
    fetchAdmin('api/admin/payment-orders?' + queryString())
      .then(function (r) {
        return (global.adminParseJson || function (res) {
          return res.json();
        })(r);
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          if (tbody) {
            tbody.innerHTML =
              '<tr><td colspan="9">' + esc((j && j.msg) || '加载失败') + '</td></tr>';
          }
          if (stat) stat.textContent = (j && j.msg) || '加载失败';
          return;
        }
        renderRows(j.data);
      })
      .catch(function () {
        if (tbody) tbody.innerHTML = '<tr><td colspan="9">网络错误</td></tr>';
        if (stat) stat.textContent = '网络错误';
      });
  }

  function bind() {
    if (bound) return;
    bound = true;
    var search = document.getElementById('btnPayOrderSearch');
    var reset = document.getElementById('btnPayOrderReset');
    var prev = document.getElementById('payOrderPrev');
    var next = document.getElementById('payOrderNext');
    var tbody = document.getElementById('payOrderTbody');
    var q = document.getElementById('payOrderQ');
    ['payOrderStatus', 'payOrderIssue', 'payOrderDays'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', function () {
          page = 1;
          loadList();
        });
      }
    });
    if (search) {
      search.addEventListener('click', function () {
        page = 1;
        loadList();
      });
    }
    if (reset) {
      reset.addEventListener('click', function () {
        var qEl = document.getElementById('payOrderQ');
        var st = document.getElementById('payOrderStatus');
        var iss = document.getElementById('payOrderIssue');
        var days = document.getElementById('payOrderDays');
        if (qEl) qEl.value = '';
        if (st) st.value = '';
        if (iss) iss.value = '';
        if (days) days.value = '90';
        page = 1;
        loadList();
      });
    }
    if (q) {
      q.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          page = 1;
          loadList();
        }
      });
    }
    if (prev) {
      prev.addEventListener('click', function () {
        if (page <= 1) return;
        page -= 1;
        loadList();
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        var pages = Math.max(1, Math.ceil(lastTotal / lastLimit) || 1);
        if (page >= pages) return;
        page += 1;
        loadList();
      });
    }
    if (tbody) {
      tbody.addEventListener('click', function (ev) {
        var copy = ev.target && ev.target.closest ? ev.target.closest('.js-pay-order-copy') : null;
        if (copy) {
          copyText(copy.getAttribute('data-copy'));
          return;
        }
        var user = ev.target && ev.target.closest ? ev.target.closest('.js-pay-order-user') : null;
        if (user) jumpUser(user.getAttribute('data-u'));
      });
    }
  }

  function loadPage() {
    bind();
    loadList();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['payment-orders'] = {
    ready: true,
    loadPage: loadPage,
    loadList: loadList,
    renderRows: renderRows,
    statusLabel: statusLabel,
    activeLabel: activeLabel
  };
})(window);
