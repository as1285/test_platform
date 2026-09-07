/** Admin module: 邮箱管理 — 已留邮箱列表 / 定向发信 / 发送记录 */
(function (global) {
  var page = 1;
  var sendPage = 1;
  var lastUsers = [];
  var lastTotal = 0;
  var lastLimit = 20;
  var lastSendsTotal = 0;
  var lastSendsLimit = 20;
  var selected = Object.create(null);
  var pendingSendNames = [];
  var bound = false;

  function fetchAdmin(url, opts) {
    var fn = global.adminFetch;
    if (typeof fn !== 'function') {
      return Promise.reject(new Error('adminFetch unavailable'));
    }
    return fn(url, opts);
  }

  /** 网关/404 常回 HTML，避免 r.json() 抛 Unexpected token '<' */
  function parseAdminJson(r) {
    var fn = global.adminParseJson;
    if (typeof fn === 'function') return fn(r);
    return r.text().then(function (text) {
      var t = String(text == null ? '' : text).trim();
      if (!t) throw new Error('服务器无响应（HTTP ' + r.status + '）');
      try {
        return JSON.parse(t);
      } catch (e0) {
        if (t.charAt(0) === '<') {
          throw new Error('发信接口异常（HTTP ' + r.status + '），请强制刷新后台后重试');
        }
        throw new Error('接口返回无法解析（HTTP ' + r.status + '）');
      }
    });
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

  function selectedCount() {
    return Object.keys(selected).length;
  }

  function syncSendSelectedBtn() {
    var btn = document.getElementById('btnUserEmailSendSelected');
    if (!btn) return;
    var n = selectedCount();
    btn.disabled = n <= 0;
    btn.textContent = n > 0 ? '给勾选发邮件（' + n + '）' : '给勾选发邮件';
  }

  function syncCheckAll() {
    var all = document.getElementById('userEmailCheckAll');
    if (!all) return;
    if (!lastUsers.length) {
      all.checked = false;
      all.indeterminate = false;
      return;
    }
    var checked = 0;
    lastUsers.forEach(function (u) {
      if (u && u.username && selected[u.username]) checked += 1;
    });
    all.checked = checked === lastUsers.length && checked > 0;
    all.indeterminate = checked > 0 && checked < lastUsers.length;
  }

  function loadUsers() {
    var tbody = document.getElementById('userEmailTbody');
    var stat = document.getElementById('userEmailStat');
    var pageInfo = document.getElementById('userEmailPageInfo');
    if (tbody) tbody.innerHTML = '<tr><td colspan="10">加载中…</td></tr>';
    var active = String((document.getElementById('userEmailActive') || {}).value || '');
    var q = String((document.getElementById('userEmailQ') || {}).value || '').trim();
    var url =
      'api/admin/emails/users?page=' +
      page +
      '&limit=20' +
      (active ? '&active=' + encodeURIComponent(active) : '') +
      (q ? '&q=' + encodeURIComponent(q) : '');
    fetchAdmin(url)
      .then(function (r) {
        return parseAdminJson(r);
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          if (tbody) tbody.innerHTML = '<tr><td colspan="10">' + esc((j && j.msg) || '加载失败') + '</td></tr>';
          if (stat) stat.textContent = (j && j.msg) || '加载失败';
          return;
        }
        var data = j.data;
        lastUsers = Array.isArray(data.users) ? data.users : [];
        lastTotal = Number(data.total) || 0;
        lastLimit = Number(data.limit) || 20;
        var smtp = data.smtp_ready ? 'SMTP 已就绪' : 'SMTP 未配置';
        if (stat) {
          stat.textContent =
            '共 ' + lastTotal + ' 人已留邮箱 · 本页 ' + lastUsers.length + ' · ' + smtp;
        }
        var pages = Math.max(1, Math.ceil(lastTotal / lastLimit) || 1);
        if (pageInfo) pageInfo.textContent = '第 ' + page + ' / ' + pages + ' 页';
        if (!lastUsers.length) {
          if (tbody) tbody.innerHTML = '<tr><td colspan="10">暂无已留邮箱用户</td></tr>';
          syncCheckAll();
          syncSendSelectedBtn();
          return;
        }
        var html = '';
        lastUsers.forEach(function (u) {
          var uname = String(u.username || '');
          var checked = selected[uname] ? ' checked' : '';
          html +=
            '<tr>' +
            '<td><input type="checkbox" class="js-user-email-check" data-u="' +
            esc(uname) +
            '"' +
            checked +
            '></td>' +
            '<td>' +
            esc(uname) +
            '</td>' +
            '<td>' +
            esc(u.real_name || '—') +
            '</td>' +
            '<td>' +
            esc(u.email || '') +
            '</td>' +
            '<td>' +
            (u.account_active ? '已开通' : '未开通') +
            '</td>' +
            '<td>' +
            (u.half_price_email_sent ? '是' : '否') +
            '</td>' +
            '<td>' +
            esc(formatDt(u.created_at)) +
            '</td>' +
            '<td title="' +
            esc(u.last_email_subject || '') +
            '">' +
            esc(formatDt(u.last_email_at)) +
            '</td>' +
            '<td>' +
            (Number(u.last_email_click_count) > 0
              ? esc(formatDt(u.last_email_clicked_at)) +
                ' · ' +
                esc(String(u.last_email_click_count)) +
                '次'
              : '—') +
            '</td>' +
            '<td class="flex-actions">' +
            '<button type="button" class="btn-page js-user-email-send" data-u="' +
            esc(uname) +
            '">发邮件</button>' +
            '<button type="button" class="btn-page js-user-email-clear" data-u="' +
            esc(uname) +
            '">清空邮箱</button>' +
            '</td>' +
            '</tr>';
        });
        if (tbody) tbody.innerHTML = html;
        syncCheckAll();
        syncSendSelectedBtn();
      })
      .catch(function (e) {
        if (tbody) {
          tbody.innerHTML =
            '<tr><td colspan="10">' + esc((e && e.message) || '加载失败') + '</td></tr>';
        }
        if (stat) stat.textContent = (e && e.message) || '加载失败';
      });
  }

  function loadSends() {
    var tbody = document.getElementById('userEmailSendTbody');
    var stat = document.getElementById('userEmailSendStat');
    var pageInfo = document.getElementById('userEmailSendPageInfo');
    if (tbody) tbody.innerHTML = '<tr><td colspan="8">加载中…</td></tr>';
    var q = String((document.getElementById('userEmailSendQ') || {}).value || '').trim();
    var url =
      'api/admin/emails/sends?page=' +
      sendPage +
      '&limit=20' +
      (q ? '&q=' + encodeURIComponent(q) : '');
    fetchAdmin(url)
      .then(function (r) {
        return parseAdminJson(r);
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          if (tbody) tbody.innerHTML = '<tr><td colspan="8">' + esc((j && j.msg) || '加载失败') + '</td></tr>';
          if (stat) stat.textContent = (j && j.msg) || '加载失败';
          return;
        }
        var data = j.data;
        var items = Array.isArray(data.items) ? data.items : [];
        lastSendsTotal = Number(data.total) || 0;
        lastSendsLimit = Number(data.limit) || 20;
        if (stat) stat.textContent = '共 ' + lastSendsTotal + ' 条发送记录';
        var pages = Math.max(1, Math.ceil(lastSendsTotal / lastSendsLimit) || 1);
        if (pageInfo) pageInfo.textContent = '第 ' + sendPage + ' / ' + pages + ' 页';
        if (!items.length) {
          if (tbody) tbody.innerHTML = '<tr><td colspan="8">暂无发送记录</td></tr>';
          return;
        }
        var html = '';
        items.forEach(function (it) {
          var st = String(it.status || '');
          var stLabel = st === 'sent' ? '成功' : st === 'failed' ? '失败' : st || '—';
          var err = it.error_msg ? ' · ' + it.error_msg : '';
          var clickN = Number(it.click_count) || 0;
          var clickLabel =
            clickN > 0
              ? esc(formatDt(it.clicked_at)) + ' · ' + clickN + '次'
              : it.has_track
                ? '未点'
                : '—';
          html +=
            '<tr>' +
            '<td>' +
            esc(formatDt(it.created_at)) +
            '</td>' +
            '<td>' +
            esc(it.username || '') +
            '</td>' +
            '<td>' +
            esc(it.email || '') +
            '</td>' +
            '<td>' +
            esc(it.subject || '') +
            '</td>' +
            '<td>' +
            esc(it.audience || '—') +
            '</td>' +
            '<td title="' +
            esc(it.error_msg || '') +
            '">' +
            esc(stLabel + err) +
            '</td>' +
            '<td title="' +
            esc(it.dest_url || '') +
            '">' +
            clickLabel +
            '</td>' +
            '<td>' +
            esc(it.admin_username || '—') +
            '</td>' +
            '</tr>';
        });
        if (tbody) tbody.innerHTML = html;
      })
      .catch(function (e) {
        if (tbody) {
          tbody.innerHTML =
            '<tr><td colspan="8">' + esc((e && e.message) || '加载失败') + '</td></tr>';
        }
      });
  }

  var EMAIL_COPY_TEMPLATES = {
    activate: {
      subject: '开通后去除水印，完整查看收入纳税明细',
      content:
        '你好，\n\n开通后可去除演示水印，完整查看与导出收入纳税明细、纳税记录。\n付款一般几秒内自动到账，点下方按钮即可前往开通。',
      link_url: 'purchase.html?from=email_activate',
      cta_label: '立即开通',
      poster: 'activate'
    },
    offer: {
      subject: '你的专属优惠仍有效，打开即可按优惠价开通',
      content:
        '你好，\n\n你的专属优惠价仍然有效。打开支付页将按该价格下单；开通后去除水印，完整使用收入明细与纳税记录。\n优惠可能随时调整，建议尽早开通。',
      link_url: 'purchase.html?from=email_offer',
      cta_label: '按优惠价开通',
      poster: 'offer'
    },
    soft_recall: {
      subject: '你的演示账号还在，开通即可完整体验',
      content:
        '你好，\n\n你之前留下的演示账号仍可继续使用。开通后去除水印，可完整查看收入纳税明细并导出纳税记录。\n若暂时不需要，忽略本邮件即可。',
      link_url: 'purchase.html?from=email_recall',
      cta_label: '去开通页看看',
      poster: 'activate'
    }
  };

  function applySendTemplate(id) {
    var t = EMAIL_COPY_TEMPLATES[id] || EMAIL_COPY_TEMPLATES.activate;
    var subj = document.getElementById('userEmailSendSubject');
    var body = document.getElementById('userEmailSendContent');
    var link = document.getElementById('userEmailSendLink');
    var cta = document.getElementById('userEmailSendCta');
    var poster = document.getElementById('userEmailSendPoster');
    if (subj) subj.value = t.subject;
    if (body) body.value = t.content;
    if (link) link.value = t.link_url;
    if (cta) cta.value = t.cta_label;
    if (poster) poster.value = t.poster;
  }

  function openSendModal(names) {
    pendingSendNames = (names || []).filter(Boolean);
    var backdrop = document.getElementById('userEmailSendBackdrop');
    var meta = document.getElementById('userEmailSendMeta');
    var status = document.getElementById('userEmailSendStatus');
    if (status) status.textContent = '';
    if (meta) {
      if (pendingSendNames.length === 1) {
        meta.textContent = '收件人：' + pendingSendNames[0];
      } else {
        meta.textContent = '将向 ' + pendingSendNames.length + ' 个已勾选账号发送';
      }
    }
    if (backdrop) backdrop.hidden = false;
  }

  function closeSendModal() {
    var backdrop = document.getElementById('userEmailSendBackdrop');
    if (backdrop) backdrop.hidden = true;
    pendingSendNames = [];
  }

  function confirmSend() {
    if (!pendingSendNames.length) return;
    var subject = String((document.getElementById('userEmailSendSubject') || {}).value || '').trim();
    var content = String((document.getElementById('userEmailSendContent') || {}).value || '').trim();
    var link =
      String((document.getElementById('userEmailSendLink') || {}).value || '').trim() ||
      'purchase.html';
    var cta =
      String((document.getElementById('userEmailSendCta') || {}).value || '').trim() || '立即开通';
    var poster = String((document.getElementById('userEmailSendPoster') || {}).value || 'activate');
    var status = document.getElementById('userEmailSendStatus');
    var btn = document.getElementById('userEmailSendConfirm');
    if (!subject || !content) {
      if (status) status.textContent = '请填写标题和正文';
      return;
    }
    if (
      poster === 'refund' ||
      subject.indexOf('二次退税') >= 0 ||
      content.indexOf('二次退税') >= 0 ||
      subject.indexOf('测算约可退') >= 0 ||
      /refund_ad\.html/i.test(link)
    ) {
      if (status) status.textContent = '退税邮件已停发';
      return;
    }
    if (
      !confirm(
        '确认向 ' + pendingSendNames.length + ' 人发送邮件「' + subject.slice(0, 40) + '」？'
      )
    ) {
      return;
    }
    if (btn) btn.disabled = true;
    if (status) status.textContent = '发送中…';
    fetchAdmin('api/admin/emails/send', {
      method: 'POST',
      body: JSON.stringify({
        usernames: pendingSendNames,
        subject: subject,
        content: content,
        link_url: link,
        cta_label: cta,
        poster: poster
      })
    })
      .then(function (r) {
        return parseAdminJson(r);
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) {
          if (status) status.textContent = (j && j.msg) || '发送失败';
          alert((j && j.msg) || '发送失败');
          return;
        }
        var msg =
          '成功 ' +
          (j.data.sent != null ? j.data.sent : 0) +
          '，失败 ' +
          (j.data.failed != null ? j.data.failed : 0);
        if (status) status.textContent = msg;
        alert(msg);
        closeSendModal();
        loadUsers();
        loadSends();
      })
      .catch(function (e) {
        if (status) status.textContent = (e && e.message) || '发送失败';
        alert((e && e.message) || '发送失败');
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function clearEmail(uname) {
    if (!uname) return;
    if (!confirm('清空账号「' + uname + '」的邮箱？用户可在个人信息中重新填写。')) return;
    fetchAdmin('api/admin/emails/clear', {
      method: 'POST',
      body: JSON.stringify({ username: uname })
    })
      .then(function (r) {
        return parseAdminJson(r);
      })
      .then(function (j) {
        if (!j || j.code !== 200) {
          alert((j && j.msg) || '清空失败');
          return;
        }
        delete selected[uname];
        syncSendSelectedBtn();
        loadUsers();
      })
      .catch(function (e) {
        alert((e && e.message) || '清空失败');
      });
  }

  function exportCsv() {
    if (!lastUsers.length) return;
    var header = [
      '账号',
      '姓名',
      '邮箱',
      '开通',
      '是否发送半价邮件',
      '注册',
      '最近发信',
      '最近标题',
      '最近点击',
      '点击次数'
    ];
    var lines = [header.join(',')];
    lastUsers.forEach(function (u) {
      var cells = [
        u.username,
        u.real_name || '',
        u.email || '',
        u.account_active ? '已开通' : '未开通',
        u.half_price_email_sent ? '是' : '否',
        formatDt(u.created_at),
        formatDt(u.last_email_at),
        u.last_email_subject || '',
        formatDt(u.last_email_clicked_at),
        Number(u.last_email_click_count) || 0
      ].map(function (v) {
        return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
      });
      lines.push(cells.join(','));
    });
    var blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'user-emails.csv';
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 800);
  }

  function bind() {
    if (bound) return;
    bound = true;
    var search = document.getElementById('btnUserEmailSearch');
    if (search) {
      search.addEventListener('click', function () {
        page = 1;
        loadUsers();
      });
    }
    var active = document.getElementById('userEmailActive');
    if (active) {
      active.addEventListener('change', function () {
        page = 1;
        loadUsers();
      });
    }
    var q = document.getElementById('userEmailQ');
    if (q) {
      q.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          page = 1;
          loadUsers();
        }
      });
    }
    var prev = document.getElementById('userEmailPrev');
    if (prev) {
      prev.addEventListener('click', function () {
        if (page <= 1) return;
        page -= 1;
        loadUsers();
      });
    }
    var next = document.getElementById('userEmailNext');
    if (next) {
      next.addEventListener('click', function () {
        var pages = Math.max(1, Math.ceil(lastTotal / lastLimit) || 1);
        if (page >= pages) return;
        page += 1;
        loadUsers();
      });
    }
    var checkAll = document.getElementById('userEmailCheckAll');
    if (checkAll) {
      checkAll.addEventListener('change', function () {
        var on = !!checkAll.checked;
        lastUsers.forEach(function (u) {
          if (!u || !u.username) return;
          if (on) selected[u.username] = true;
          else delete selected[u.username];
        });
        var boxes = document.querySelectorAll('.js-user-email-check');
        boxes.forEach(function (box) {
          box.checked = on;
        });
        syncSendSelectedBtn();
        syncCheckAll();
      });
    }
    var tbody = document.getElementById('userEmailTbody');
    if (tbody) {
      tbody.addEventListener('change', function (ev) {
        var box = ev.target && ev.target.closest ? ev.target.closest('.js-user-email-check') : null;
        if (!box) return;
        var u = box.getAttribute('data-u');
        if (!u) return;
        if (box.checked) selected[u] = true;
        else delete selected[u];
        syncSendSelectedBtn();
        syncCheckAll();
      });
      tbody.addEventListener('click', function (ev) {
        var sendBtn = ev.target && ev.target.closest ? ev.target.closest('.js-user-email-send') : null;
        if (sendBtn) {
          openSendModal([sendBtn.getAttribute('data-u')]);
          return;
        }
        var clearBtn =
          ev.target && ev.target.closest ? ev.target.closest('.js-user-email-clear') : null;
        if (clearBtn) {
          clearEmail(clearBtn.getAttribute('data-u'));
        }
      });
    }
    var sendSelected = document.getElementById('btnUserEmailSendSelected');
    if (sendSelected) {
      sendSelected.addEventListener('click', function () {
        var names = Object.keys(selected);
        if (!names.length) return;
        openSendModal(names);
      });
    }
    var exp = document.getElementById('btnUserEmailExport');
    if (exp) exp.addEventListener('click', exportCsv);

    var sendSearch = document.getElementById('btnUserEmailSendSearch');
    if (sendSearch) {
      sendSearch.addEventListener('click', function () {
        sendPage = 1;
        loadSends();
      });
    }
    var sendQ = document.getElementById('userEmailSendQ');
    if (sendQ) {
      sendQ.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          sendPage = 1;
          loadSends();
        }
      });
    }
    var sendPrev = document.getElementById('userEmailSendPrev');
    if (sendPrev) {
      sendPrev.addEventListener('click', function () {
        if (sendPage <= 1) return;
        sendPage -= 1;
        loadSends();
      });
    }
    var sendNext = document.getElementById('userEmailSendNext');
    if (sendNext) {
      sendNext.addEventListener('click', function () {
        var pages = Math.max(1, Math.ceil(lastSendsTotal / lastSendsLimit) || 1);
        if (sendPage >= pages) return;
        sendPage += 1;
        loadSends();
      });
    }

    var cancel = document.getElementById('userEmailSendCancel');
    if (cancel) cancel.addEventListener('click', closeSendModal);
    var confirmBtn = document.getElementById('userEmailSendConfirm');
    if (confirmBtn) confirmBtn.addEventListener('click', confirmSend);
    var tpl = document.getElementById('userEmailSendTemplate');
    if (tpl) {
      tpl.addEventListener('change', function () {
        applySendTemplate(tpl.value);
      });
    }
    var backdrop = document.getElementById('userEmailSendBackdrop');
    if (backdrop) {
      backdrop.addEventListener('click', function (ev) {
        if (ev.target === backdrop) closeSendModal();
      });
    }
  }

  function loadPage() {
    bind();
    page = 1;
    sendPage = 1;
    loadUsers();
    loadSends();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['user-emails'] = {
    ready: true,
    loadPage: loadPage
  };
})(window);
