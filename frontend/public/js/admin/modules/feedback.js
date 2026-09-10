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

  function jumpToUser(username) {
    var name = String(username || '').trim();
    if (!name || name === '—') return;
    if (typeof global.jumpToRegisteredUser === 'function') {
      global.jumpToRegisteredUser(name);
      return;
    }
    var usernameEl = document.getElementById('filterUsername');
    var exactEl = document.getElementById('filterExact');
    if (usernameEl) usernameEl.value = name;
    if (exactEl) exactEl.checked = true;
    global.location.hash = 'users';
  }

  function accountButton(userId) {
    var name = String(userId || '').trim();
    if (!name) return '—';
    return (
      '<button type="button" class="admin-user-jump js-feedback-open-user" data-u="' +
      esc(name) +
      '" title="跳转到注册用户">' +
      esc(name) +
      '</button>'
    );
  }

  function snippet(text, n) {
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    if (!s) return '—';
    if (s.length <= n) return s;
    return s.slice(0, n) + '…';
  }

  var state = { page: 1, limit: 30, total: 0, q: '', status: '', items: [], openId: 0 };

  function hasReply(row) {
    return !!(row && row.admin_reply && String(row.admin_reply).trim());
  }

  function replyBadge(row) {
    if (hasReply(row)) {
      return '<span class="badge badge-yes">已回复</span>';
    }
    return '<span class="badge badge-no">未回复</span>';
  }

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
      '<th>时间</th><th>账号</th><th>姓名</th><th>设备</th><th>描述</th><th>截图</th><th>回复</th><th></th>' +
      '</tr></thead><tbody>';
    items.forEach(function (row) {
      var id = Number(row.id) || 0;
      html += '<tr data-feedback-id="' + esc(String(id)) + '">';
      html += '<td>' + esc(formatDt(row.created_at)) + '</td>';
      html += '<td class="cell-break">' + accountButton(row.user_id) + '</td>';
      html += '<td>' + esc(row.real_name || '—') + '</td>';
      html += '<td class="cell-break">' + esc(row.device_info || '—') + '</td>';
      html += '<td class="cell-break">' + esc(snippet(row.content, 48)) + '</td>';
      html += '<td>' + esc(String(row.image_count || 0)) + '</td>';
      html += '<td>' + replyBadge(row) + '</td>';
      html +=
        '<td><button type="button" class="btn-page btn-page-primary js-feedback-view" data-id="' +
        esc(String(id)) +
        '">' +
        (hasReply(row) ? '查看' : '回复') +
        '</button></td>';
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
    bindAccountJumps(el);
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
      '<p class="hint mt-0">账号 ' +
      accountButton(row.user_id) +
      '　姓名 ' +
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
    html +=
      '<div class="feedback-reply-box" style="margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;">' +
      '<p class="stat" style="margin:0 0 8px;">回复用户</p>';
    if (hasReply(row)) {
      html +=
        '<p class="hint mt-0">已回复 · ' +
        esc(formatDt(row.replied_at)) +
        (row.replied_by ? ' · ' + esc(row.replied_by) : '') +
        '</p>' +
        '<p style="white-space:pre-wrap;line-height:1.55;margin:0 0 10px;padding:10px 12px;background:#f0fdfa;border-radius:8px;border:1px solid #ccfbf1;">' +
        esc(row.admin_reply) +
        '</p>';
    }
    html +=
      '<label class="hint" for="feedbackReplyInput">回复会发站内信；用户已留邮箱时，会把回复同步发到邮箱</label>' +
      '<textarea id="feedbackReplyInput" maxlength="2000" rows="4" style="width:100%;min-height:88px;margin:6px 0 10px;display:block;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font:inherit;" placeholder="例如：已定位到该机型状态栏和按钮错位，下个版本会修。">' +
      esc(row.admin_reply || '') +
      '</textarea>' +
      '<div class="form-row flex-align-center">' +
      '<button type="button" class="btn-page btn-page-primary" id="btnFeedbackReply">' +
      (hasReply(row) ? '更新并通知' : '发送回复') +
      '</button>' +
      '<span class="hint" id="feedbackReplyStatus"></span>' +
      '</div></div></div>';
    revokeDetailUrls(box);
    box.innerHTML = html;
    box.hidden = false;
    state.openId = id;
    bindAccountJumps(box);
    bindReplyForm(id);
    mountDetailImages(box, imgs);
    try {
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e0) {}
  }

  function submitReply(id, text) {
    var reply = String(text == null ? '' : text).trim();
    if (!reply) return Promise.reject(new Error('请填写回复内容'));
    return fetchAdmin('/api/admin/feedback/' + encodeURIComponent(String(id)) + '/reply', {
      method: 'POST',
      body: JSON.stringify({ reply: reply })
    })
      .then(function (r) {
        return (window.adminParseJson || function (res) {
          return res.json();
        })(r);
      })
      .then(function (j) {
        if (!j || j.code !== 200) {
          throw new Error((j && j.msg) || '回复失败');
        }
        return j;
      });
  }

  function bindReplyForm(id) {
    var btn = document.getElementById('btnFeedbackReply');
    var input = document.getElementById('feedbackReplyInput');
    var status = document.getElementById('feedbackReplyStatus');
    if (!btn || !input) return;
    function send() {
      var text = String(input.value || '').trim();
      if (!text) {
        if (status) status.textContent = '请填写回复内容';
        return;
      }
      btn.disabled = true;
      if (status) status.textContent = '发送中…';
      submitReply(id, text)
        .then(function (j) {
          if (status) status.textContent = (j && j.msg) || '已发送';
          loadList({ openId: id });
        })
        .catch(function (e) {
          if (status) status.textContent = (e && e.message) || '发送失败';
        })
        .then(function () {
          btn.disabled = false;
        });
    }
    btn.addEventListener('click', send);
    input.addEventListener('keydown', function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key === 'Enter') {
        ev.preventDefault();
        send();
      }
    });
  }

  function bindAccountJumps(root) {
    if (!root) return;
    root.querySelectorAll('.js-feedback-open-user').forEach(function (btn) {
      if (btn.__feedbackJumpBound) return;
      btn.__feedbackJumpBound = true;
      btn.addEventListener('click', function () {
        jumpToUser(btn.getAttribute('data-u'));
      });
    });
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

  function loadList(opts) {
    var el = document.getElementById('feedbackMount');
    if (!el) return;
    opts = opts || {};
    var qEl = document.getElementById('feedbackSearch');
    var stEl = document.getElementById('feedbackReplyFilter');
    state.q = qEl ? String(qEl.value || '').trim() : state.q;
    state.status = stEl ? String(stEl.value || '').trim() : state.status;
    var keepId = opts.openId != null ? Number(opts.openId) : state.openId;
    el.textContent = '加载中…';
    var url =
      '/api/admin/feedback?page=' +
      encodeURIComponent(String(state.page)) +
      '&limit=' +
      encodeURIComponent(String(state.limit));
    if (state.q) url += '&q=' + encodeURIComponent(state.q);
    if (state.status) url += '&status=' + encodeURIComponent(state.status);
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
        if (keepId) showDetail(keepId);
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
    var filter = document.getElementById('feedbackReplyFilter');
    if (filter) {
      filter.addEventListener('change', function () {
        state.page = 1;
        loadList();
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
    submitReply: submitReply,
    snippet: snippet,
    formatDt: formatDt
  };
})(window);
