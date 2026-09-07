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
      kpi('填完进入', s.after_tax_views, '跳过回记录 ' + (s.after_tax_continues || 0) + ' · 填完跳转 ' + (s.after_tax_go || 0)) +
      kpi('开通页看到', s.purchase_views, '开通页复制 ' + (s.purchase_copies || 0)) +
      kpi(
        '退税合格',
        s.refund_eligible,
        '已复制 ' +
          (s.refund_eligible_copied || 0) +
          ' · 复制率 ' +
          (s.refund_eligible_copy_rate != null ? s.refund_eligible_copy_rate + '%' : '—')
      );
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

  var refundPage = 1;
  var refundTotal = 0;
  var refundLimit = 20;

  function refundReasonLabel(reason) {
    if (reason === 'both') return '税额+收入';
    if (reason === 'income') return '年收入≥15万';
    if (reason === 'tax') return '税额>5000';
    return reason || '—';
  }

  function formatMoney(n) {
    var v = Number(n);
    if (!isFinite(v)) return '—';
    if (v >= 10000) return String(Math.round(v / 100) / 100) + '万';
    return String(Math.round(v * 100) / 100);
  }

  function refundQueryString() {
    var qs = [
      'page=' + encodeURIComponent(String(refundPage)),
      'limit=20'
    ];
    var year = val('opsRefundYear');
    if (year) qs.push('year=' + encodeURIComponent(year));
    var reason = val('opsRefundReason');
    if (reason) qs.push('reason=' + encodeURIComponent(reason));
    var copied = val('opsRefundCopied');
    if (copied) qs.push('copied=' + encodeURIComponent(copied));
    var active = val('opsRefundActive');
    if (active) qs.push('active=' + encodeURIComponent(active));
    var q = val('opsRefundQ');
    if (q) qs.push('q=' + encodeURIComponent(q));
    return qs.join('&');
  }

  function renderRefundSummary(data) {
    var el = document.getElementById('opsRefundSummary');
    if (!el) return;
    var s = (data && data.summary) || {};
    el.innerHTML =
      kpi('合格人数', s.eligible, '当前筛选') +
      kpi('仅税额', s.tax_only, '该年税额>5000') +
      kpi('仅收入', s.income_only, '该年收入≥15万') +
      kpi('两项都达标', s.both, '优先跟');
  }

  function renderRefundUsers(data) {
    var tbody = document.getElementById('opsRefundUserTbody');
    var info = document.getElementById('opsRefundPageInfo');
    var prev = document.getElementById('opsRefundPrev');
    var next = document.getElementById('opsRefundNext');
    refundTotal = data && data.total != null ? Number(data.total) : 0;
    refundLimit = data && data.limit != null ? Number(data.limit) : 20;
    var totalPages = Math.max(1, Math.ceil(refundTotal / refundLimit) || 1);
    if (info) info.textContent = '第 ' + refundPage + ' / ' + totalPages + ' 页 · 共 ' + refundTotal + ' 人';
    if (prev) prev.disabled = refundPage <= 1;
    if (next) next.disabled = refundPage >= totalPages;
    if (!tbody) return;
    var users = (data && data.users) || [];
    if (!users.length) {
      tbody.innerHTML = '<tr><td colspan="11">没有匹配的退税合格用户</td></tr>';
      return;
    }
    tbody.innerHTML = users
      .map(function (r) {
        return (
          '<tr>' +
          '<td>' +
          esc(r.username || '—') +
          '</td>' +
          '<td>' +
          esc(r.real_name || '—') +
          '</td>' +
          '<td>' +
          esc(r.account_active ? '已开通' : '未开通') +
          '</td>' +
          '<td>' +
          esc(String(r.hit_year || '—')) +
          '</td>' +
          '<td>' +
          esc(formatMoney(r.tax_sum)) +
          '</td>' +
          '<td>' +
          esc(formatMoney(r.income_sum)) +
          '</td>' +
          '<td>' +
          esc(refundReasonLabel(r.reason)) +
          '</td>' +
          '<td>' +
          esc(r.has_email ? '是' : '否') +
          '</td>' +
          '<td>' +
          esc(r.viewed ? '是' : '否') +
          '</td>' +
          '<td>' +
          esc(String(r.copies || 0)) +
          '</td>' +
          '<td>' +
          esc(formatDt(r.last_at)) +
          '</td>' +
          '</tr>'
        );
      })
      .join('');
  }

  function loadRefundEligible() {
    var box = document.getElementById('opsRefundSummary');
    if (box) box.textContent = '加载中…';
    fetchAdmin('api/admin/ops/refund-eligible?' + refundQueryString())
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r);
      })
      .then(function (j) {
        if (j.code !== 200 || !j.data) {
          if (box) box.textContent = j.msg || '加载失败';
          return;
        }
        renderRefundSummary(j.data);
        renderRefundUsers(j.data);
      })
      .catch(function () {
        if (box) box.textContent = '加载失败';
      });
  }

  function loadPageData() {
    var summary = document.getElementById('opsAdSummary');
    if (summary) summary.textContent = '加载中…';
    fetchAdmin('api/admin/analytics/ad-page-stats?' + queryString())
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r);
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
        return (window.adminParseJson||function(r){return r.json();})(r);
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

  function currentHubTab() {
    var hash = String(location.hash || '')
      .replace(/^#/, '')
      .trim()
      .toLowerCase();
    if (hash === 'ops-ad-analytics/data') return 'data';
    if (hash === 'ops-ad-analytics/reach') return 'reach';
    return 'config';
  }

  function applyHubPanes() {
    var tab = currentHubTab();
    var map = {
      config: document.getElementById('opsAdHubConfig'),
      data: document.getElementById('opsAdHubData'),
      reach: document.getElementById('opsAdHubReach')
    };
    Object.keys(map).forEach(function (k) {
      if (!map[k]) return;
      if (k === tab) map[k].removeAttribute('hidden');
      else map[k].setAttribute('hidden', '');
    });
    return tab;
  }

  function setInput(id, value) {
    var el = document.getElementById(id);
    if (el) el.value = value != null ? String(value) : '';
  }

  function setChecked(id, on) {
    var el = document.getElementById(id);
    if (el) el.checked = !!on;
  }

  function posterSrc(url) {
    var s = String(url || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s) || s.charAt(0) === '/') return s;
    return '/' + s;
  }

  function setPosterPreview(inputId, imgId) {
    var input = document.getElementById(inputId);
    var img = document.getElementById(imgId);
    if (!img) return;
    var src = posterSrc(input && input.value);
    if (!src) {
      img.removeAttribute('src');
      img.style.display = 'none';
      return;
    }
    img.src = src;
    img.style.display = '';
  }

  function fillAdPagesForm(cfg) {
    if (!cfg) return;
    setInput('adPagesWechatId', cfg.wechat_id || 'Tangdong6832');
    var pages = [
      { key: 'refund', prefix: 'Refund' },
      { key: 'gjj', prefix: 'Gjj' },
      { key: 'yuefu', prefix: 'Yuefu' }
    ];
    pages.forEach(function (p) {
      var block = cfg[p.key] || {};
      setChecked('adPages' + p.prefix + 'Enabled', block.enabled !== false);
      setInput('adPages' + p.prefix + 'Lede', block.lede || '');
      setInput('adPages' + p.prefix + 'Remark', block.remark || '');
      setInput('adPages' + p.prefix + 'Poster', block.poster_url || '');
      setPosterPreview('adPages' + p.prefix + 'Poster', 'adPages' + p.prefix + 'PosterPreview');
    });
  }

  function readAdPagesForm() {
    function page(prefix) {
      return {
        enabled: !!(document.getElementById('adPages' + prefix + 'Enabled') || {}).checked,
        lede: val('adPages' + prefix + 'Lede'),
        remark: val('adPages' + prefix + 'Remark'),
        poster_url: val('adPages' + prefix + 'Poster')
      };
    }
    return {
      wechat_id: val('adPagesWechatId') || 'Tangdong6832',
      refund: page('Refund'),
      gjj: page('Gjj'),
      yuefu: page('Yuefu')
    };
  }

  function setAdPagesStatus(text) {
    var el = document.getElementById('adPagesSaveStatus');
    if (el) el.textContent = text || '';
  }

  function loadAdPagesConfig() {
    setAdPagesStatus('加载中…');
    fetchAdmin('api/admin/ad-pages')
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r);
      })
      .then(function (j) {
        if (j.code !== 200 || !j.data) {
          setAdPagesStatus(j.msg || '加载失败');
          return;
        }
        fillAdPagesForm(j.data);
        setAdPagesStatus('');
      })
      .catch(function () {
        setAdPagesStatus('加载失败');
      });
  }

  function saveAdPagesConfig() {
    setAdPagesStatus('保存中…');
    var btn = document.getElementById('btnAdPagesSave');
    if (btn) btn.disabled = true;
    fetchAdmin('api/admin/ad-pages', {
      method: 'POST',
      body: JSON.stringify(readAdPagesForm())
    })
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r);
      })
      .then(function (j) {
        if (j.code !== 200 || !j.data) {
          setAdPagesStatus(j.msg || '保存失败');
          alert(j.msg || '保存失败');
          return;
        }
        fillAdPagesForm(j.data);
        setAdPagesStatus('已保存');
      })
      .catch(function () {
        setAdPagesStatus('保存失败');
        alert('保存失败');
      })
      .finally(function () {
        if (btn) btn.disabled = false;
      });
  }

  function bindPosterField(prefix) {
    var pick = document.getElementById('adPages' + prefix + 'PosterPick');
    var file = document.getElementById('adPages' + prefix + 'PosterFile');
    var input = document.getElementById('adPages' + prefix + 'Poster');
    if (pick && file) {
      pick.addEventListener('click', function () {
        file.click();
      });
      file.addEventListener('change', function () {
        var f = file.files && file.files[0];
        if (!f) return;
        var upload = global.adminUpload;
        if (typeof upload !== 'function') {
          alert('上传不可用');
          return;
        }
        pick.disabled = true;
        upload('api/admin/upload-asset', f)
          .then(function (data) {
            if (data && data.code === 200 && data.data && data.data.path) {
              if (input) input.value = data.data.path;
              setPosterPreview('adPages' + prefix + 'Poster', 'adPages' + prefix + 'PosterPreview');
            } else {
              alert((data && data.msg) || '上传失败');
            }
          })
          .catch(function () {
            alert('上传失败');
          })
          .finally(function () {
            pick.disabled = false;
            file.value = '';
          });
      });
    }
    if (input) {
      input.addEventListener('change', function () {
        setPosterPreview('adPages' + prefix + 'Poster', 'adPages' + prefix + 'PosterPreview');
      });
    }
  }

  var REACH_EMAIL_TEMPLATES = {
    refund: {
      subject: '二次退税：一键计算 2023–2025 可退税额，符合可联系客服',
      content:
        '你好，\n\n未开通也可以先看二次退税。打开页面可一键计算 2023、2024、2025 年大约可退税额。\n符合的话，复制微信号备注「二次退税」联系客服办理；同一顾问也可问公积金提取。\n不强制，不符合可忽略本邮件。',
      link_url: 'refund_ad.html?from=email_refund',
      cta_label: '打开二次退税说明',
      poster: 'refund'
    },
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

  function applyReachEmailTemplate(id) {
    var t = REACH_EMAIL_TEMPLATES[id] || REACH_EMAIL_TEMPLATES.activate;
    setInput('adReachEmailSubject', t.subject);
    setInput('adReachEmailContent', t.content);
    setInput('adReachEmailLink', t.link_url);
    setInput('adReachEmailCta', t.cta_label);
    setInput('adReachEmailPoster', t.poster);
  }

  function setReachMsgStatus(text) {
    var el = document.getElementById('adReachMsgStatus');
    if (el) el.textContent = text || '';
  }

  function setReachEmailStatus(text) {
    var el = document.getElementById('adReachEmailStatus');
    if (el) el.textContent = text || '';
  }

  function reachMsgPayload(dryRun) {
    var skipEl = document.getElementById('adReachMsgSkipSent');
    return {
      audience: val('adReachMsgAudience') || 'all_inactive',
      title: val('adReachMsgTitle'),
      content: String((document.getElementById('adReachMsgContent') || {}).value || '').trim(),
      link_url: val('adReachMsgLink') || 'refund_ad.html?from=msg_refund',
      skip_already_sent: !!(skipEl && skipEl.checked),
      skip_marker: '@@auto_refund_ad',
      allow_partial: true,
      dry_run: !!dryRun
    };
  }

  function isRefundReachEmail(payload) {
    var p = payload || {};
    var subject = String(p.subject || '');
    var content = String(p.content || '');
    var link = String(p.link_url || '');
    var poster = String(p.poster || '');
    var campaign = String(p.campaign || '');
    if (poster === 'refund') return true;
    if (campaign === 'refund_ad_amount' || campaign === 'refund_ad_auto') return true;
    if (subject.indexOf('二次退税') >= 0 || content.indexOf('二次退税') >= 0) return true;
    if (subject.indexOf('测算约可退') >= 0) return true;
    if (/refund_ad\.html/i.test(link)) return true;
    return false;
  }

  function reachEmailPayload(dryRun) {
    var skipEl = document.getElementById('adReachEmailSkipSent');
    var tpl = val('adReachEmailTemplate') || 'activate';
    return {
      audience: val('adReachEmailAudience') || 'has_email_inactive',
      subject: val('adReachEmailSubject'),
      content: String((document.getElementById('adReachEmailContent') || {}).value || '').trim(),
      link_url: val('adReachEmailLink') || 'purchase.html?from=email_activate',
      cta_label: val('adReachEmailCta') || '立即开通',
      poster: val('adReachEmailPoster') || 'activate',
      skip_already_sent: !!(skipEl && skipEl.checked),
      campaign: tpl === 'refund' ? 'refund_ad_auto' : 'ad_reach_' + tpl,
      allow_partial: true,
      dry_run: !!dryRun
    };
  }

  function reachAudienceLabel(audience) {
    if (audience === 'all_inactive') return '全部未激活';
    if (audience === 'inactive_has_tax') return '未激活且有个税';
    if (audience === 'has_email_inactive') return '未激活且已留邮箱';
    if (audience === 'refund_eligible_copied') return '退税合格·已复制';
    if (audience === 'refund_eligible_not_copied') return '退税合格·未复制';
    return '退税合格';
  }

  function postReach(url, payload, previewBtn, sendBtn, setStatus, kind) {
    setStatus(payload.dry_run ? '预览中…' : '发送中…');
    if (previewBtn) previewBtn.disabled = true;
    if (sendBtn && !payload.dry_run) sendBtn.disabled = true;
    fetchAdmin(url, {
      method: 'POST',
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r);
      })
      .then(function (j) {
        if (j.code !== 200 || !j.data) {
          setStatus(j.msg || (payload.dry_run ? '预览失败' : '发送失败'));
          if (!payload.dry_run) alert(j.msg || '发送失败');
          return;
        }
        if (payload.dry_run) {
          var matched = j.data.matched != null ? j.data.matched : 0;
          var extra = kind === 'email' && !j.data.smtp_ready ? '（SMTP 未配置，无法实发）' : '';
          setStatus('匹配 ' + matched + ' 人' + extra);
          return;
        }
        var n = j.data.sent;
        var msg = '已发送 ' + (n != null ? n : 0) + (kind === 'email' ? ' 封' : ' 条');
        setStatus(msg);
        alert(msg);
      })
      .catch(function (e) {
        setStatus(e && e.message ? e.message : '请求失败');
        if (!payload.dry_run) alert(e && e.message ? e.message : '发送失败');
      })
      .finally(function () {
        if (previewBtn) previewBtn.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
      });
  }

  function bindReach() {
    var msgPreview = document.getElementById('btnAdReachMsgPreview');
    var msgSend = document.getElementById('btnAdReachMsgSend');
    if (msgPreview) {
      msgPreview.addEventListener('click', function () {
        postReach(
          'api/admin/messages/bulk',
          reachMsgPayload(true),
          msgPreview,
          msgSend,
          setReachMsgStatus,
          'msg'
        );
      });
    }
    if (msgSend) {
      msgSend.addEventListener('click', function () {
        var payload = reachMsgPayload(false);
        if (
          !window.confirm(
            '向「' + reachAudienceLabel(payload.audience) + '」发送站内信？请先预览人数。'
          )
        ) {
          setReachMsgStatus('已取消');
          return;
        }
        postReach('api/admin/messages/bulk', payload, msgPreview, msgSend, setReachMsgStatus, 'msg');
      });
    }
    var emailTpl = document.getElementById('adReachEmailTemplate');
    if (emailTpl) {
      emailTpl.addEventListener('change', function () {
        applyReachEmailTemplate(emailTpl.value);
      });
    }
    var emailPreview = document.getElementById('btnAdReachEmailPreview');
    var emailSend = document.getElementById('btnAdReachEmailSend');
    if (emailPreview) {
      emailPreview.addEventListener('click', function () {
        postReach(
          'api/admin/emails/bulk',
          reachEmailPayload(true),
          emailPreview,
          emailSend,
          setReachEmailStatus,
          'email'
        );
      });
    }
    if (emailSend) {
      emailSend.addEventListener('click', function () {
        var payload = reachEmailPayload(false);
        if (isRefundReachEmail(payload)) {
          setReachEmailStatus('退税邮件已停发');
          return;
        }
        if (
          !window.confirm(
            '向「' + reachAudienceLabel(payload.audience) + '」中已留邮箱的人发邮件？请先预览人数。'
          )
        ) {
          setReachEmailStatus('已取消');
          return;
        }
        postReach(
          'api/admin/emails/bulk',
          payload,
          emailPreview,
          emailSend,
          setReachEmailStatus,
          'email'
        );
      });
    }
  }

  function bind() {
    if (bound) return;
    bound = true;
    bindPosterField('Refund');
    bindPosterField('Gjj');
    bindPosterField('Yuefu');
    var saveBtn = document.getElementById('btnAdPagesSave');
    if (saveBtn) saveBtn.addEventListener('click', saveAdPagesConfig);
    bindReach();
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
    function resetRefund() {
      refundPage = 1;
      loadRefundEligible();
    }
    var refundSearch = document.getElementById('btnOpsRefundSearch');
    var refundRefresh = document.getElementById('btnOpsRefundRefresh');
    if (refundSearch) refundSearch.addEventListener('click', resetRefund);
    if (refundRefresh) refundRefresh.addEventListener('click', loadRefundEligible);
    ['opsRefundYear', 'opsRefundReason', 'opsRefundCopied', 'opsRefundActive'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('change', resetRefund);
    });
    var refundQ = document.getElementById('opsRefundQ');
    if (refundQ) {
      refundQ.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          resetRefund();
        }
      });
    }
    var refundPrev = document.getElementById('opsRefundPrev');
    var refundNext = document.getElementById('opsRefundNext');
    if (refundPrev) {
      refundPrev.addEventListener('click', function () {
        if (refundPage > 1) {
          refundPage -= 1;
          loadRefundEligible();
        }
      });
    }
    if (refundNext) {
      refundNext.addEventListener('click', function () {
        refundPage += 1;
        loadRefundEligible();
      });
    }
  }

  function loadCampaignStats() {
    var el = document.getElementById('adReachCampaignStats');
    if (!el) return;
    el.textContent = '加载金额邮件失败率…';
    fetchAdmin('api/admin/emails/campaign-stats?campaign=refund_ad_amount&days=7')
      .then(function (r) {
        return (window.adminParseJson||function(r){return r.json();})(r);
      })
      .then(function (j) {
        if (j.code !== 200 || !j.data) {
          el.textContent = j.msg || '加载失败率失败';
          return;
        }
        var d = j.data;
        var rate = d.fail_rate != null ? d.fail_rate : 0;
        el.textContent =
          '近 ' +
          d.days +
          ' 天金额邮件（' +
          d.campaign +
          '）：成功 ' +
          d.sent +
          '，失败 ' +
          d.failed +
          '，失败率 ' +
          rate +
          '%。无 2023–2025 记录的用户已跳过，不计入上数。';
      })
      .catch(function () {
        el.textContent = '加载失败率失败';
      });
  }

  function loadPage() {
    bind();
    var tab = applyHubPanes();
    if (tab === 'config') {
      loadAdPagesConfig();
      return;
    }
    if (tab === 'reach') {
      loadCampaignStats();
      return;
    }
    page = 1;
    refundPage = 1;
    loadPageData();
    loadRefundEligible();
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['ad-analytics'] = {
    ready: true,
    loadPage: loadPage
  };
})(window);
