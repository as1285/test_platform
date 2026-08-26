/** Admin module: 机型 · UI 兼容对照 */
(function (global) {
  var cache = null;
  var filters = { platform: 'all', page: 'all', q: '', onlyUsers: false };
  var bound = false;

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

  function platformLabel(os) {
    if (os === 'ios') return '苹果';
    if (os === 'android') return '安卓';
    return '其他';
  }

  function pageLabels(pages, pageDefs) {
    var map = Object.create(null);
    (pageDefs || []).forEach(function (p) {
      map[p.key] = p.label;
    });
    return (pages || [])
      .map(function (k) {
        return map[k] || k;
      })
      .join('、');
  }

  function compareBar(ios, android) {
    var a = Number(ios) || 0;
    var b = Number(android) || 0;
    var t = a + b;
    if (!t) return '<span class="device-compat-bar is-empty">无</span>';
    var iosPct = Math.round((a / t) * 100);
    return (
      '<span class="device-compat-bar" title="苹果 ' +
      a +
      ' / 安卓 ' +
      b +
      '"><i class="is-ios" style="width:' +
      iosPct +
      '%"></i><i class="is-android"></i></span>'
    );
  }

  function renderCards(summary) {
    var el = document.getElementById('deviceCompatCards');
    if (!el) return;
    var s = summary || {};
    el.innerHTML =
      '<div class="user-data-stat-card"><div class="ud-label">苹果用户</div><div class="ud-val">' +
      esc(String(s.users_ios || 0)) +
      '</div></div>' +
      '<div class="user-data-stat-card"><div class="ud-label">安卓用户</div><div class="ud-val">' +
      esc(String(s.users_android || 0)) +
      '</div></div>' +
      '<div class="user-data-stat-card"><div class="ud-label">已建档机型</div><div class="ud-val">' +
      esc(String(s.catalog_models || 0)) +
      '</div><div class="hint" style="margin-top:4px;font-size:12px;">修改点 ' +
      esc(String(s.catalog_issues || 0)) +
      '</div></div>' +
      '<div class="user-data-stat-card"><div class="ud-label">匹配到目录的用户</div><div class="ud-val">' +
      esc(String(s.matched_users || 0)) +
      '</div></div>' +
      '<div class="user-data-stat-card"><div class="ud-label">未建档机型</div><div class="ud-val">' +
      esc(String(s.unmatched_models || 0)) +
      '</div></div>';
  }

  function renderCompare(rows) {
    var tbody = document.getElementById('deviceCompatCompareTbody');
    if (!tbody) return;
    if (!rows || !rows.length) {
      tbody.innerHTML = '<tr><td colspan="6">暂无</td></tr>';
      return;
    }
    tbody.innerHTML = rows
      .map(function (r) {
        return (
          '<tr><td>' +
          esc(r.label || r.page) +
          '</td><td>' +
          esc(String(r.ios_issues || 0)) +
          '</td><td>' +
          esc(String(r.android_issues || 0)) +
          '</td><td>' +
          esc(String(r.ios_users || 0)) +
          '</td><td>' +
          esc(String(r.android_users || 0)) +
          '</td><td>' +
          compareBar(r.ios_issues, r.android_issues) +
          '</td></tr>'
        );
      })
      .join('');
  }

  function modelVisible(m, pageDefs) {
    if (filters.platform !== 'all' && m.platform !== filters.platform) return false;
    if (filters.onlyUsers && !(m.user_count > 0) && !m.common) return false;
    if (filters.page !== 'all') {
      var hitPage = (m.pages || []).indexOf(filters.page) >= 0;
      if (!hitPage) return false;
    }
    var q = String(filters.q || '').trim().toLowerCase();
    if (!q) return true;
    var blob = [m.label, platformLabel(m.platform), pageLabels(m.pages, pageDefs)]
      .concat(
        (m.issues || []).map(function (it) {
          return [it.title, it.summary, it.page_label].join(' ');
        })
      )
      .join(' ')
      .toLowerCase();
    return blob.indexOf(q) >= 0;
  }

  function renderModels(data) {
    var tbody = document.getElementById('deviceCompatModelTbody');
    if (!tbody) return;
    var list = (data.models || []).filter(function (m) {
      return modelVisible(m, data.pages);
    });
    list.sort(function (a, b) {
      if (!!a.common !== !!b.common) return a.common ? -1 : 1;
      if (a.platform !== b.platform) return a.platform === 'ios' ? -1 : 1;
      return (b.user_count || 0) - (a.user_count || 0);
    });
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6">没有符合筛选的机型</td></tr>';
      return;
    }
    var html = '';
    list.forEach(function (m) {
      var osCls = m.platform === 'ios' ? 'is-ios' : m.platform === 'android' ? 'is-android' : '';
      html +=
        '<tr class="device-compat-row" data-model="' +
        esc(m.id) +
        '"><td>' +
        esc(m.label) +
        (m.common ? ' <span class="device-compat-tag">通用</span>' : '') +
        '</td><td><span class="device-compat-os ' +
        osCls +
        '">' +
        esc(platformLabel(m.platform)) +
        '</span></td><td>' +
        esc(String(m.user_count || 0)) +
        '</td><td>' +
        esc(String(m.device_count || 0)) +
        '</td><td>' +
        esc(String(m.issue_count || 0)) +
        '</td><td>' +
        esc(pageLabels(m.pages, data.pages)) +
        '</td></tr>';
      html +=
        '<tr class="device-compat-detail" data-for="' +
        esc(m.id) +
        '" hidden><td colspan="6"><ul class="device-compat-issues">';
      (m.issues || []).forEach(function (it) {
        if (filters.page !== 'all' && it.page !== filters.page) return;
        html +=
          '<li><strong>' +
          esc(it.page_label || it.page) +
          ' · ' +
          esc(it.title) +
          '</strong>' +
          (it.since ? '<span class="device-compat-since">' + esc(it.since) + '</span>' : '') +
          '<div>' +
          esc(it.summary || '') +
          '</div></li>';
      });
      html += '</ul></td></tr>';
    });
    tbody.innerHTML = html;
  }

  function renderUnmatched(rows) {
    var tbody = document.getElementById('deviceCompatUnmatchedTbody');
    if (!tbody) return;
    var list = rows || [];
    if (filters.platform !== 'all') {
      list = list.filter(function (r) {
        return r.os_key === filters.platform;
      });
    }
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="4">没有未建档机型</td></tr>';
      return;
    }
    tbody.innerHTML = list
      .map(function (r) {
        return (
          '<tr><td>' +
          esc(r.label) +
          '</td><td>' +
          esc(platformLabel(r.os_key)) +
          '</td><td>' +
          esc(String(r.user_count || 0)) +
          '</td><td>' +
          esc(String(r.device_count || 0)) +
          '</td></tr>'
        );
      })
      .join('');
  }

  function renderAll(data) {
    cache = data;
    var s = (data && data.summary) || {};
    var summaryEl = document.getElementById('deviceCompatSummary');
    if (summaryEl) {
      summaryEl.textContent =
        (data.range_label || '') +
        ' 目录已对齐。线上用户 ' +
        (s.users_total || 0) +
        '，设备 ' +
        (s.devices_total || 0) +
        '。点击机型行展开修改点。';
    }
    renderCards(s);
    renderCompare(data.page_compare || []);
    renderModels(data);
    renderUnmatched(data.unmatched || []);
  }

  function rerender() {
    if (cache) renderAll(cache);
  }

  function setBusy(busy) {
    var btn = document.getElementById('btnRefreshDeviceCompat');
    if (btn) {
      btn.disabled = !!busy;
      btn.textContent = busy ? '对账中…' : '刷新对账';
    }
  }

  function loadPage() {
    bind();
    var summaryEl = document.getElementById('deviceCompatSummary');
    if (summaryEl) summaryEl.textContent = '加载中…';
    setBusy(true);
    fetchAdmin('api/admin/analytics/devices')
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        setBusy(false);
        if (!j || j.code !== 200 || !j.data) {
          if (summaryEl) summaryEl.textContent = (j && j.msg) || '加载失败';
          return;
        }
        renderAll(j.data);
      })
      .catch(function () {
        setBusy(false);
        if (summaryEl) summaryEl.textContent = '网络错误';
      });
  }

  function bind() {
    if (bound) return;
    bound = true;
    var btn = document.getElementById('btnRefreshDeviceCompat');
    if (btn) btn.addEventListener('click', loadPage);
    var only = document.getElementById('deviceCompatOnlyUsers');
    if (only) {
      only.addEventListener('change', function () {
        filters.onlyUsers = !!only.checked;
        rerender();
      });
    }
    var search = document.getElementById('deviceCompatSearch');
    if (search) {
      search.addEventListener('input', function () {
        filters.q = search.value || '';
        rerender();
      });
    }
    var wrap = document.getElementById('deviceCompatFilters');
    if (wrap) {
      wrap.addEventListener('click', function (ev) {
        var btnChip = ev.target && ev.target.closest ? ev.target.closest('.device-compat-chip') : null;
        if (!btnChip) return;
        var group = btnChip.parentNode;
        var key = group && group.getAttribute('data-filter');
        if (!key) return;
        filters[key] = btnChip.getAttribute('data-value') || 'all';
        Array.prototype.forEach.call(group.querySelectorAll('.device-compat-chip'), function (el) {
          el.classList.toggle('is-on', el === btnChip);
        });
        rerender();
      });
    }
    var tbody = document.getElementById('deviceCompatModelTbody');
    if (tbody) {
      tbody.addEventListener('click', function (ev) {
        var row = ev.target && ev.target.closest ? ev.target.closest('tr.device-compat-row') : null;
        if (!row) return;
        var id = row.getAttribute('data-model');
        var detail = tbody.querySelector('tr.device-compat-detail[data-for="' + id + '"]');
        if (!detail) return;
        var open = detail.hasAttribute('hidden');
        tbody.querySelectorAll('tr.device-compat-detail').forEach(function (el) {
          el.setAttribute('hidden', '');
        });
        tbody.querySelectorAll('tr.device-compat-row').forEach(function (el) {
          el.classList.remove('is-open');
        });
        if (open) {
          detail.removeAttribute('hidden');
          row.classList.add('is-open');
        }
      });
    }
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules.devices = { ready: true, loadPage: loadPage };
  global.loadAnalyticsDevicesPage = loadPage;
})(window);
