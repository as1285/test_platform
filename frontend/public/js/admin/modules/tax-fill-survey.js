/** Admin module: 个税填写页体验调研 */
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
      var pad = function (n) {
        return n < 10 ? '0' + n : String(n);
      };
      return (
        d.getFullYear() +
        '-' +
        pad(d.getMonth() + 1) +
        '-' +
        pad(d.getDate()) +
        ' ' +
        pad(d.getHours()) +
        ':' +
        pad(d.getMinutes())
      );
    } catch (e0) {
      return String(iso);
    }
  }

  function satisfactionLabel(key) {
    if (key === 'good') return '满意';
    if (key === 'ok') return '一般';
    if (key === 'bad') return '不满意';
    if (key === 'skipped') return '跳过';
    return key || '—';
  }

  function improveLabel(key) {
    var map = {
      start: '开始方式',
      paste: '粘贴导入',
      manual: '手动填写',
      generate: '一键生成',
      list: '记录列表',
      calc: '计算说明',
      other: '其他'
    };
    return map[key] || key || '—';
  }

  function renderStats(data) {
    var el = document.getElementById('taxFillSurveyMount');
    if (!el) return;
    var s = (data && data.survey) || {};
    var sat = s.satisfaction || {};
    var html = '';
    if (data.period && data.period.label) {
      html +=
        '<p class="hint" style="margin:0 0 10px;">统计区间：' +
        esc(data.period.label) +
        '</p>';
    }
    if (data.note) {
      html += '<p class="hint share-stats-note">' + esc(String(data.note)) + '</p>';
    }
    html += '<div class="share-kpi-grid">';
    html +=
      '<div class="share-kpi-card"><div class="ud-label">调研提交</div><div class="ud-val">' +
      esc(String(s.submitted || 0)) +
      '</div><div class="share-kpi-sub">跳过 ' +
      esc(String(s.skipped || 0)) +
      ' · 合计 ' +
      esc(String(s.total || 0)) +
      '</div></div>';
    html +=
      '<div class="share-kpi-card is-convert"><div class="ud-label">满意占比</div><div class="ud-val">' +
      esc(String(s.good_pct != null ? s.good_pct : 0)) +
      '%</div><div class="share-kpi-sub">满意 ' +
      esc(String(sat.good || 0)) +
      ' · 一般 ' +
      esc(String(sat.ok || 0)) +
      ' · 不满意 ' +
      esc(String(sat.bad || 0)) +
      '</div></div>';
    html +=
      '<div class="share-kpi-card"><div class="ud-label">不满意</div><div class="ud-val">' +
      esc(String(sat.bad || 0)) +
      '</div><div class="share-kpi-sub">不满意占比 ' +
      esc(String(s.bad_pct != null ? s.bad_pct : 0)) +
      '%</div></div>';
    html +=
      '<div class="share-kpi-card"><div class="ud-label">有文字建议</div><div class="ud-val">' +
      esc(String(s.with_suggestion || 0)) +
      '</div><div class="share-kpi-sub">正式提交中含优化建议</div></div>';
    html += '</div>';

    html += '<div class="analytics-grid mb-12">';
    html +=
      '<div class="scroll-x"><p class="stat">满意度分布</p><table class="user-detail-table"><thead><tr><th>选项</th><th>人数</th></tr></thead><tbody>';
    [
      ['满意', sat.good],
      ['一般', sat.ok],
      ['不满意', sat.bad]
    ].forEach(function (row) {
      html +=
        '<tr><td>' + esc(row[0]) + '</td><td>' + esc(String(row[1] || 0)) + '</td></tr>';
    });
    html += '</tbody></table></div>';

    html +=
      '<div class="scroll-x"><p class="stat">最想优化</p><table class="user-detail-table"><thead><tr><th>选项</th><th>人数</th></tr></thead><tbody>';
    var improve = s.improve || {};
    ['start', 'paste', 'manual', 'generate', 'list', 'calc', 'other'].forEach(function (key) {
      html +=
        '<tr><td>' +
        esc(improveLabel(key)) +
        '</td><td>' +
        esc(String(improve[key] || 0)) +
        '</td></tr>';
    });
    html += '</tbody></table></div></div>';

    var recent = s.recent || [];
    var withText = recent.filter(function (row) {
      return !row.skipped && row.suggestion;
    });
    html +=
      '<div class="share-kpi-section-label">优化建议原文（' +
      esc(String(withText.length)) +
      '）</div>';
    if (!withText.length) {
      html += '<div class="share-stats-empty">该区间暂无文字建议</div>';
    } else {
      html +=
        '<div class="scroll-x"><table class="user-detail-table"><thead><tr><th>时间</th><th>用户</th><th>姓名</th><th>满意度</th><th>优化项</th><th>建议</th></tr></thead><tbody>';
      withText.forEach(function (row) {
        html += '<tr>';
        html += '<td>' + esc(formatDt(row.created_at)) + '</td>';
        html += '<td class="cell-break"><code>' + esc(row.username || '—') + '</code></td>';
        html += '<td>' + esc(row.real_name || '—') + '</td>';
        html += '<td>' + esc(satisfactionLabel(row.satisfaction)) + '</td>';
        html +=
          '<td>' +
          esc(row.improve_topic ? improveLabel(row.improve_topic) : '—') +
          '</td>';
        html += '<td class="cell-break">' + esc(row.suggestion) + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    }

    html += '<div class="share-kpi-section-label">最近调研（最多 80）</div>';
    if (!recent.length) {
      html += '<div class="share-stats-empty">该区间暂无调研记录</div>';
    } else {
      html +=
        '<div class="scroll-x"><table class="user-detail-table"><thead><tr><th>时间</th><th>用户</th><th>姓名</th><th>满意度</th><th>优化项</th><th>建议</th><th>类型</th></tr></thead><tbody>';
      recent.forEach(function (row) {
        html += '<tr>';
        html += '<td>' + esc(formatDt(row.created_at)) + '</td>';
        html += '<td class="cell-break"><code>' + esc(row.username || '—') + '</code></td>';
        html += '<td>' + esc(row.real_name || '—') + '</td>';
        html += '<td>' + esc(satisfactionLabel(row.satisfaction)) + '</td>';
        html +=
          '<td>' +
          esc(row.improve_topic ? improveLabel(row.improve_topic) : '—') +
          '</td>';
        html +=
          '<td class="cell-break">' +
          esc(row.suggestion || '—') +
          '</td>';
        html += '<td>' + (row.skipped ? '跳过' : '提交') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    }
    el.innerHTML = html;
  }

  function loadStats() {
    var el = document.getElementById('taxFillSurveyMount');
    if (!el) return;
    var daysEl = document.getElementById('taxFillSurveyDays');
    var days = daysEl ? String(daysEl.value || '7') : '7';
    el.textContent = '加载中…';
    fetchAdmin('/api/admin/tax-fill-survey/stats?days=' + encodeURIComponent(days))
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          el.textContent = (j && j.msg) || '加载失败';
          return;
        }
        renderStats(j.data);
      })
      .catch(function () {
        el.textContent = '网络错误';
      });
  }

  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    var refresh = document.getElementById('btnRefreshTaxFillSurvey');
    var daysEl = document.getElementById('taxFillSurveyDays');
    if (refresh) refresh.addEventListener('click', loadStats);
    if (daysEl) daysEl.addEventListener('change', loadStats);
  }

  function loadPage() {
    bind();
    loadStats();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['tax-fill-survey'] = {
    ready: true,
    loadPage: loadPage,
    loadStats: loadStats,
    renderStats: renderStats,
    satisfactionLabel: satisfactionLabel,
    improveLabel: improveLabel
  };
})(window);
