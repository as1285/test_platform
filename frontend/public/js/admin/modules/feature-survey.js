/** Admin module: 功能调研总览 */
(function (global) {
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

  function pctCell(v) {
    if (v == null || v === '') return '—';
    return esc(String(v)) + '%';
  }

  function topLabel(list) {
    if (!list || !list.length) return '—';
    return list
      .map(function (t) {
        return (t.label || t.key) + ' ' + String(t.count || 0);
      })
      .join('、');
  }

  function jumpUser(name) {
    var u = String(name || '').trim();
    if (!u) return;
    if (typeof global.jumpToRegisteredUser === 'function') {
      global.jumpToRegisteredUser(u);
    }
  }

  function renderOverview(data) {
    var el = document.getElementById('featureSurveyMount');
    if (!el) return;
    var features = (data && data.features) || [];
    var suggestions = (data && data.suggestions) || [];
    var html = '';
    if (data && data.period && data.period.label) {
      html +=
        '<p class="hint" style="margin:0 0 10px;">统计区间：' +
        esc(data.period.label) +
        '</p>';
    }
    if (data && data.note) {
      html += '<p class="hint share-stats-note">' + esc(String(data.note)) + '</p>';
    }
    html +=
      '<div class="scroll-x"><table class="user-detail-table feature-survey-table"><thead><tr>' +
      '<th>功能</th><th>状态</th><th>提交</th><th>偏贵%</th><th>不满意%</th><th>优化 Top</th><th>建议</th><th></th>' +
      '</tr></thead><tbody>';
    if (!features.length) {
      html += '<tr><td colspan="8">暂无数据</td></tr>';
    } else {
      features.forEach(function (f) {
        var live = !!f.wired;
        html += '<tr' + (live ? '' : ' class="is-muted"') + '>';
        html += '<td><strong>' + esc(f.title || f.id) + '</strong></td>';
        html +=
          '<td>' +
          (live ? '已接' : 'C 端未接') +
          '</td>';
        html += '<td>' + (live ? esc(String(f.submitted || 0)) : '—') + '</td>';
        html += '<td>' + (live ? pctCell(f.expensive_pct) : '—') + '</td>';
        html += '<td>' + (live ? pctCell(f.bad_pct) : '—') + '</td>';
        html += '<td>' + (live ? esc(topLabel(f.top_concerns)) : '—') + '</td>';
        html += '<td>' + (live ? esc(String(f.suggestion_count || 0)) : '—') + '</td>';
        html +=
          '<td>' +
          (f.detail_hash
            ? '<a class="admin-user-jump" href="#' +
              esc(f.detail_hash) +
              '">详情</a>'
            : '—') +
          '</td>';
        html += '</tr>';
      });
    }
    html += '</tbody></table></div>';

    html += '<div class="share-kpi-section-label">建议原文</div>';
    html +=
      '<p class="hint mt-0 mb-8">目前只有个税填写问卷会落文字建议。证明 / 支付页没有建议字段。</p>';
    if (!suggestions.length) {
      html += '<div class="share-stats-empty">该区间暂无建议原文</div>';
    } else {
      html +=
        '<div class="scroll-x"><table class="user-detail-table"><thead><tr>' +
        '<th>时间</th><th>功能</th><th>账号</th><th>建议</th>' +
        '</tr></thead><tbody>';
      suggestions.forEach(function (row) {
        html += '<tr>';
        html += '<td>' + esc(formatDt(row.created_at)) + '</td>';
        html += '<td>' + esc(row.feature_title || row.feature_id || '—') + '</td>';
        html +=
          '<td><button type="button" class="admin-user-jump js-feature-survey-user" data-u="' +
          esc(row.username || '') +
          '">' +
          esc(row.username || '—') +
          '</button></td>';
        html += '<td class="cell-break">' + esc(row.suggestion || '—') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    }
    el.innerHTML = html;
  }

  function loadOverview() {
    var el = document.getElementById('featureSurveyMount');
    if (!el) return;
    var daysEl = document.getElementById('featureSurveyDays');
    var days = daysEl ? String(daysEl.value || '7') : '7';
    el.textContent = '加载中…';
    fetchAdmin('api/admin/feature-survey/overview?days=' + encodeURIComponent(days))
      .then(function (r) {
        return (global.adminParseJson || function (res) {
          return res.json();
        })(r);
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          el.textContent = (j && j.msg) || '加载失败';
          return;
        }
        renderOverview(j.data);
      })
      .catch(function () {
        el.textContent = '网络错误';
      });
  }

  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    var refresh = document.getElementById('btnRefreshFeatureSurvey');
    var daysEl = document.getElementById('featureSurveyDays');
    var mount = document.getElementById('featureSurveyMount');
    if (refresh) refresh.addEventListener('click', loadOverview);
    if (daysEl) daysEl.addEventListener('change', loadOverview);
    if (mount) {
      mount.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest ? ev.target.closest('.js-feature-survey-user') : null;
        if (!btn) return;
        jumpUser(btn.getAttribute('data-u'));
      });
    }
  }

  function loadPage() {
    bind();
    loadOverview();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['feature-survey'] = {
    ready: true,
    loadPage: loadPage,
    loadOverview: loadOverview,
    renderOverview: renderOverview,
    topLabel: topLabel,
    pctCell: pctCell
  };
})(window);
