/** Admin module: 广告页数据运营 — 停留时间与操作 */
(function (global) {
  var page = 1;
  var lastTotal = 0;
  var lastLimit = 20;
  var bound = false;
  var openVisitor = '';

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

  function formatDwell(sec) {
    var n = Number(sec);
    if (!isFinite(n) || n < 0) return '—';
    if (n < 60) return n + '秒';
    var m = Math.floor(n / 60);
    var s = Math.round(n % 60);
    if (m < 60) return s ? m + '分' + s + '秒' : m + '分';
    var h = Math.floor(m / 60);
    m = m % 60;
    return m ? h + '小时' + m + '分' : h + '小时';
  }

  function queryString() {
    var qs = [
      'page=' + encodeURIComponent(String(page)),
      'limit=20',
      'days=' + encodeURIComponent(val('opsAdDays') || '7')
    ];
    var source = val('opsAdSource');
    if (source) qs.push('source=' + encodeURIComponent(source));
    var copied = val('opsAdCopied');
    if (copied) qs.push('copied=' + encodeURIComponent(copied));
    var q = val('opsAdQ');
    if (q) qs.push('q=' + encodeURIComponent(q));
    return qs.join('&');
  }

  function kpi(label, value, sub) {
    return (
      '<div class="share-kpi-card' +
      (sub && String(sub).indexOf('复制') >= 0 ? ' is-convert' : '') +
      '"><div class="ud-label">' +
      esc(label) +
      '</div><div class="ud-val">' +
      esc(String(value != null ? value : '—')) +
      '</div>' +
      (sub ? '<div class="share-kpi-sub">' + esc(sub) + '</div>' : '') +
      '</div>'
    );
  }

  function renderSummary(data) {
    var el = document.getElementById('opsAdSummary');
    if (!el) return;
    var s = (data && data.summary) || {};
    var period = (data && data.period && data.period.label) || '';
    el.innerHTML =
      kpi('浏览人数', s.view_visitors, period) +
      kpi('浏览次数', s.views, '含底栏 / 填完 / 开通页') +
      kpi('平均停留', formatDwell(s.avg_dwell_seconds), '中位 ' + formatDwell(s.median_dwell_seconds)) +
      kpi('复制微信', s.copy_visitors, '复制率 ' + (s.copy_rate != null ? s.copy_rate + '%' : '—')) +
      kpi('填完进入', s.after_tax_views, '跳过回记录 ' + (s.after_tax_continues || 0)) +
      kpi('开通页看到', s.purchase_views, '开通页复制 ' + (s.purchase_copies || 0));
  }

  function renderActions(list) {
    var tbody = document.getElementById('opsAdActionTbody');
    if (!tbody) return;
    if (!list || !list.length) {
      tbody.innerHTML = '<tr><td colspan="3">这段时间还没有广告页操作</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .map(function (r) {
        return (
          '<tr><td>' +
          esc(r.label || r.event_key) +
          '</td><td>' +
          esc(String(r.total || 0)) +
          '</td><td>' +
          esc(String(r.visitors || 0)) +
          '</td></tr>'
        );
      })
      .join('');
  }

  function renderDaily(list) {
    var tbody = document.getElementById('opsAdDailyTbody');
    if (!tbody) return;
    if (!list || !list.length) {
      tbody.innerHTML = '<tr><td colspan="5">暂无按日数据</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .map(function (r) {
        return (
          '<tr><td>' +
          esc(r.date || '—') +
          '</td><td>' +
          esc(String(r.views || 0)) +
          '</td><td>' +
          esc(String(r.visitors || 0)) +
          '</td><td>' +
          esc(String(r.copies || 0)) +
          '</td><td>' +
          esc(formatDwell(r.avg_dwell_seconds)) +
          '</td></tr>'
        );
      })
      .join('');
  }

  function displayName(row) {
    if (row.username) return row.username;
    var v = String(row.visitor_key || '');
    if (v.indexOf('anon:') === 0) return '未登录';
    return v || '未登录';
  }

  function renderUsers(data) {
    var tbody = document.getElementById('opsAdUserTbody');
    var stat = document.getElementById('opsAdUserStat');
    var info = document.getElementById('opsAdPageInfo');
    var prev = document.getElementById('opsAdPrev');
    var next = document.getElementById('opsAdNext');
    lastTotal = data && data.total != null ? Number(data.total) : 0;
    lastLimit = data && data.limit != null ? Number(data.limit) : 20;
    var totalPages = Math.max(1, Math.ceil(lastTotal / lastLimit) || 1);
    if (stat) stat.textContent = '共 ' + lastTotal + ' 人有广告页行为';
    if (info) info.textContent = '第 ' + page + ' / ' + totalPages + ' 页';
    if (prev) prev.disabled = page <= 1;
    if (next) next.disabled = page >= totalPages;
    if (!tbody) return;
    var users = (data && data.users) || [];
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="10">没有匹配的用户</td></tr>';
      return;
    }
    tbody.innerHTML = users
      .map(function (r) {
        var active =
          r.account_active == null ? '—' : r.account_active ? '已开通' : '未开通';
        var recent = (r.recent_actions || []).slice(0, 3).join(' / ') || '—';
        return (
          '<tr>' +
          '<td>' +
          esc(displayName(r)) +
          '</td>' +
          '<td>' +
          esc(r.real_name || '—') +
          '</td>' +
          '<td>' +
          esc(active) +
          '</td>' +
          '<td>' +
          esc(String(r.views || 0)) +
          '</td>' +
          '<td>' +
          esc(formatDwell(r.total_dwell_seconds)) +
          '</td>' +
          '<td>' +
          esc(formatDwell(r.avg_dwell_seconds)) +
          '</td>' +
          '<td>' +
          esc(String(r.copies || 0)) +
          '</td>' +
          '<td>' +
          esc(recent) +
          '</td>' +
          '<td>' +
          esc(formatDt(r.last_at)) +
          '</td>' +
          '<td><button type="button" class="btn-page js-ops-ad-detail" data-username="' +
          esc(r.username || '') +
          '" data-visitor="' +
          esc(r.visitor_key || '') +
          '">明细</button></td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function renderUserDetail(data, username, visitor) {
    var el = document.getElementById('opsAdUserDetail');
    if (!el) return;
    el.hidden = false;
    var user = (data && data.user) || {};
    var title = user.username || username || '未登录访客';
    if (user.real_name) title += '（' + user.real_name + '）';
    var events = (data && data.events) || [];
    var rows = events.length
      ? events
          .map(function (ev) {
            var extra = [];
            if (ev.source) extra.push(ev.source);
            if (ev.target) extra.push(ev.target);
            if (ev.year) extra.push(ev.year + '年');
            return (
              '<tr><td>' +
              esc(formatDt(ev.created_at)) +
              '</td><td>' +
              esc(ev.label || ev.event_key) +
              '</td><td>' +
              esc(
                ev.event_key === 'track_refund_ad_page_leave' ||
                ev.event_key === 'track_douyin_yuefu_ad_page_leave' ||
                ev.event_key === 'track_gjj_extract_ad_page_leave'
                  ? formatDwell(ev.dwell_seconds)
                  : '—'
              ) +
              '</td><td>' +
              esc(extra.join(' · ') || '—') +
              '</td></tr>'
            );
          })
          .join('')
      : '<tr><td colspan="4">没有明细</td></tr>';
    el.innerHTML =
      '<h3>操作时间线 · ' +
      esc(title) +
      '</h3>' +
      '<div class="scroll-x"><table class="users-registry-table"><thead><tr><th>时间</th><th>操作</th><th>停留</th><th>来源 / 去向</th></tr></thead><tbody>' +
      rows +
      '</tbody></table></div>';
    openVisitor = visitor || username || '';
  }

  function loadPageData() {
    var summary = document.getElementById('opsAdSummary');
    if (summary) summary.textContent = '加载中…';
    fetchAdmin('api/admin/analytics/ad-page-stats?' + queryString())
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (j.code !== 200 || !j.data) {
          if (summary) summary.textContent = j.msg || '加载失败';
          return;
        }
        renderSummary(j.data);
        renderActions(j.data.actions);
        renderDaily(j.data.daily);
        renderUsers(j.data);
      })
      .catch(function () {
        if (summary) summary.textContent = '加载失败';
      });
  }

  function loadUserDetail(username, visitor) {
    var qs = ['days=' + encodeURIComponent(val('opsAdDays') || '7')];
    if (username) qs.push('username=' + encodeURIComponent(username));
    else if (visitor) qs.push('visitor=' + encodeURIComponent(visitor));
    var el = document.getElementById('opsAdUserDetail');
    if (el) {
      el.hidden = false;
      el.textContent = '加载明细…';
    }
    fetchAdmin('api/admin/analytics/ad-page-stats/user?' + qs.join('&'))
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (j.code !== 200 || !j.data) {
          if (el) el.textContent = j.msg || '加载明细失败';
          return;
        }
        renderUserDetail(j.data, username, visitor);
      })
      .catch(function () {
        if (el) el.textContent = '加载明细失败';
      });
  }

  function bind() {
    if (bound) return;
    bound = true;
    var search = document.getElementById('btnOpsAdSearch');
    var refresh = document.getElementById('btnOpsAdRefresh');
    var prev = document.getElementById('opsAdPrev');
    var next = document.getElementById('opsAdNext');
    var q = document.getElementById('opsAdQ');
    function resetAndLoad() {
      page = 1;
      loadPageData();
    }
    if (search) search.addEventListener('click', resetAndLoad);
    if (refresh) refresh.addEventListener('click', loadPageData);
    ['opsAdDays', 'opsAdSource', 'opsAdCopied'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', resetAndLoad);
    });
    if (q) {
      q.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          resetAndLoad();
        }
      });
    }
    if (prev) {
      prev.addEventListener('click', function () {
        if (page > 1) {
          page -= 1;
          loadPageData();
        }
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        page += 1;
        loadPageData();
      });
    }
    var tbody = document.getElementById('opsAdUserTbody');
    if (tbody) {
      tbody.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('.js-ops-ad-detail') : null;
        if (!btn) return;
        loadUserDetail(btn.getAttribute('data-username') || '', btn.getAttribute('data-visitor') || '');
      });
    }
  }

  function loadPage() {
    bind();
    page = 1;
    loadPageData();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['ad-analytics'] = {
    ready: true,
    loadPage: loadPage
  };
})(window);
