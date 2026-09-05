/** Admin module: 兼容 BUG 反馈列表 */
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

  function snippet(text, n) {
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return '—';
    if (s.length <= n) return s;
    return s.slice(0, n) + '…';
  }

  var state = { page: 1, limit: 30, total: 0, q: '', items: [] };

  function renderList(data) {
    var el = document.getElementById('feedbackMount');
    var sum = document.getElementById('feedbackSummary');
    if (!el) return;
    data = data || {};
    var items = Array.isArray(data.items) ? data.items : [];
    state.items = items;
    state.total = Number(data.total) || 0;
    state.page = Number(data.page) || 1;
    state.limit = Number(data.limit) || 30;
    if (sum) {
      sum.textContent = '共 ' + state.total + ' 条兼容反馈';
    }
    if (!items.length) {
      el.innerHTML = '<div class="share-stats-empty">暂无兼容 BUG 反馈</div>';
      return;
    }
    var html =
      '<div class="scroll-x"><table class="user-detail-table"><thead><tr>' +
      '<th>时间</th><th>账号</th><th>姓名</th><th>设备</th><th>描述</th><th>截图</th><th></th>' +
      '</tr></thead><tbody>';
    items.forEach(function (row) {
      var id = Number(row.id) || 0;
      html += '<tr data-feedback-id="' + esc(String(id)) + '">';
      html += '<td>' + esc(formatDt(row.created_at)) + '</td>';
      html += '<td class="cell-break"><code>' + esc(row.user_id || '—') + '</code></td>';
      html += '<td>' + esc(row.real_name || '—') + '</td>';
      html += '<td class="cell-break">' + esc(row.device_info || '—') + '</td>';
      html += '<td class="cell-break">' + esc(snippet(row.content, 48)) + '</td>';
      html += '<td>' + esc(String(row.image_count || 0)) + '</td>';
      html +=
        '<td><button type="button" class="btn-page btn-page-primary js-feedback-view" data-id="' +
        esc(String(id)) +
        '">查看</button></td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    if (state.total > state.limit) {
      var pages = Math.max(1, Math.ceil(state.total / state.limit));
      html +=
        '<div class="form-row flex-align-center mt-8">' +
        '<button type="button" class="btn-page" id="btnFeedbackPrev"' +
        (state.page <= 1 ? ' disabled' : '') +
        '>上一页</button>' +
        '<span class="hint">第 ' +
        esc(String(state.page)) +
        ' / ' +
        esc(String(pages)) +
        ' 页</span>' +
        '<button type="button" class="btn-page" id="btnFeedbackNext"' +
        (state.page >= pages ? ' disabled' : '') +
        '>下一页</button></div>';
    }
    html += '<div id="feedbackDetail" class="mt-8" hidden></div>';
    el.innerHTML = html;
    bindPager();
    el.querySelectorAll('.js-feedback-view').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showDetail(Number(btn.getAttribute('data-id')));
      });
    });
  }

  function revokeDetailUrls(box) {
    if (!box || !box.__feedbackObjectUrls) return;
    (box.__feedbackObjectUrls || []).forEach(function (u) {
      try {
        URL.revokeObjectURL(u);
      } catch (e0) {}
    });
    box.__feedbackObjectUrls = [];
  }

  function mountDetailImages(box, imgs) {
    var host = box.querySelector('.js-feedback-imgs');
    if (!host || !imgs || !imgs.length) return;
    box.__feedbackObjectUrls = [];
    imgs.forEach(function (im) {
      var src = im && im.url ? String(im.url) : '';
      if (!src) return;
      var a = document.createElement('a');
      a.target = '_blank';
      a.rel = 'noopener';
      var img = document.createElement('img');
      img.alt = '反馈截图';
      img.style.cssText =
        'max-width:220px;max-height:220px;border:1px solid #e2e8f0;border-radius:8px;object-fit:contain;background:#f8fafc;';
      a.appendChild(img);
      host.appendChild(a);
      fetchAdmin(src, { method: 'GET', cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('load_failed');
          return r.blob();
        })
        .then(function (blob) {
          var obj = URL.createObjectURL(blob);
          box.__feedbackObjectUrls.push(obj);
          img.src = obj;
          a.href = obj;
        })
        .catch(function () {
          img.alt = '图片加载失败';
        });
    });
  }

  function showDetail(id) {
    var row = null;
    state.items.forEach(function (it) {
      if (Number(it.id) === id) row = it;
    });
    var box = document.getElementById('feedbackDetail');
    if (!box || !row) return;
    var imgs = Array.isArray(row.images) ? row.images : [];
    var html =
      '<div class="card" style="padding:14px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;">' +
      '<p class="stat" style="margin:0 0 8px;">反馈 #' +
      esc(String(row.id)) +
      ' · ' +
      esc(formatDt(row.created_at)) +
      '</p>' +
      '<p class="hint mt-0">账号 <code>' +
      esc(row.user_id || '—') +
      '</code>　姓名 ' +
      esc(row.real_name || '—') +
      (row.contact ? '　联系 ' + esc(row.contact) : '') +
      '</p>' +
      '<p class="hint">设备 ' +
      esc(row.device_info || '—') +
      '</p>' +
      (row.user_agent
        ? '<p class="hint" style="word-break:break-all;">UA <code>' + esc(row.user_agent) + '</code></p>'
        : '') +
      '<p style="white-space:pre-wrap;line-height:1.55;margin:8px 0 12px;">' +
      esc(row.content) +
      '</p>';
    if (imgs.length) {
      html += '<div class="js-feedback-imgs" style="display:flex;flex-wrap:wrap;gap:10px;"></div>';
    } else {
      html += '<p class="hint">未上传截图</p>';
    }
    html += '</div>';
    revokeDetailUrls(box);
    box.innerHTML = html;
    box.hidden = false;
    mountDetailImages(box, imgs);
    try {
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e0) {}
  }

  function bindPager() {
    var prev = document.getElementById('btnFeedbackPrev');
    var next = document.getElementById('btnFeedbackNext');
    if (prev) {
      prev.addEventListener('click', function () {
        if (state.page > 1) {
          state.page -= 1;
          loadList();
        }
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        state.page += 1;
        loadList();
      });
    }
  }

  function loadList() {
    var el = document.getElementById('feedbackMount');
    if (!el) return;
    var qEl = document.getElementById('feedbackSearch');
    state.q = qEl ? String(qEl.value || '').trim() : state.q;
    el.textContent = '加载中…';
    var url =
      '/api/admin/feedback?page=' +
      encodeURIComponent(String(state.page)) +
      '&limit=' +
      encodeURIComponent(String(state.limit));
    if (state.q) url += '&q=' + encodeURIComponent(state.q);
    fetchAdmin(url)
      .then(function (r) {
        return (window.adminParseJson || function (res) {
          return res.json();
        })(r);
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          el.textContent = (j && j.msg) || '加载失败';
          return;
        }
        renderList(j.data);
      })
      .catch(function () {
        el.textContent = '网络错误';
      });
  }

  var bound = false;
  function bind() {
    if (bound) return;
    bound = true;
    var refresh = document.getElementById('btnRefreshFeedback');
    var search = document.getElementById('feedbackSearch');
    if (refresh) refresh.addEventListener('click', function () {
      state.page = 1;
      loadList();
    });
    if (search) {
      search.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          state.page = 1;
          loadList();
        }
      });
    }
  }

  function loadPage() {
    bind();
    loadList();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules.feedback = {
    ready: true,
    loadPage: loadPage,
    loadList: loadList,
    renderList: renderList,
    showDetail: showDetail,
    snippet: snippet,
    formatDt: formatDt
  };
})(window);
