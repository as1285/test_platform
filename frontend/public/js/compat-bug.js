/**
 * C 端 · 兼容问题反馈
 * 选图（本地预览）→ 填写描述 → 一次提交（multipart）。
 */
(function () {
  var MAX_IMAGES = 6;
  var MAX_BYTES = 5 * 1024 * 1024;
  var CONTENT_MIN = 4;
  var picked = [];

  function $(id) {
    return document.getElementById(id);
  }

  function token() {
    try {
      return String(localStorage.getItem('token') || '').trim();
    } catch (e0) {
      return '';
    }
  }

  function showStatus(msg, ok) {
    var el = $('compatBugStatus');
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg || '';
    el.style.color = ok ? '#047857' : '#b45309';
  }

  function collectDeviceInfo() {
    var model = '';
    try {
      model = String(localStorage.getItem('tax_device_model_v1') || '').trim();
    } catch (e0) {}
    var payload = null;
    try {
      if (typeof window.buildClientDevicePayload === 'function') {
        payload = window.buildClientDevicePayload();
      }
    } catch (e1) {}
    var ua = '';
    try {
      ua = String(navigator.userAgent || '');
    } catch (e2) {}
    var screenTxt = '';
    try {
      screenTxt = screen.width + 'x' + screen.height;
      if (window.devicePixelRatio) screenTxt += '@' + window.devicePixelRatio;
    } catch (e3) {}
    var platform = payload && payload.platform ? String(payload.platform) : '';
    var parts = [];
    if (model) parts.push(model);
    if (platform) parts.push(platform);
    if (screenTxt) parts.push(screenTxt);
    if (payload && payload.app_version) parts.push('v' + payload.app_version);
    return {
      device_info: parts.join(' · ').slice(0, 255),
      user_agent: (payload && payload.user_agent ? String(payload.user_agent) : ua).slice(0, 512)
    };
  }

  function fillDeviceField() {
    var el = $('compatBugDevice');
    if (!el) return;
    var info = collectDeviceInfo();
    el.value = info.device_info || info.user_agent || '';
  }

  function fillContact() {
    var el = $('compatBugContact');
    if (!el || el.value) return;
    try {
      var name = String(localStorage.getItem('real_name') || '').trim();
      var uid = String(localStorage.getItem('user_id') || localStorage.getItem('userName') || '').trim();
      if (name && uid) el.placeholder = name + ' / ' + uid + '（可不填）';
      else if (uid) el.placeholder = '选填，如微信或手机。当前账号 ' + uid;
    } catch (e0) {}
  }

  function revokePreview(item) {
    if (item && item.url) {
      try {
        URL.revokeObjectURL(item.url);
      } catch (e0) {}
    }
  }

  function renderPreviews() {
    var grid = $('compatBugPreview');
    if (!grid) return;
    grid.innerHTML = '';
    picked.forEach(function (item, i) {
      var wrap = document.createElement('div');
      wrap.className = 'compat-preview-item';
      var img = document.createElement('img');
      img.src = item.url;
      img.alt = '截图 ' + (i + 1);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'compat-preview-remove';
      btn.setAttribute('aria-label', '移除这张图');
      btn.textContent = '×';
      btn.addEventListener('click', function () {
        revokePreview(item);
        picked.splice(i, 1);
        renderPreviews();
      });
      wrap.appendChild(img);
      wrap.appendChild(btn);
      grid.appendChild(wrap);
    });
    var hint = $('compatBugPhotoHint');
    if (hint) {
      hint.textContent = picked.length
        ? '已选 ' + picked.length + ' / ' + MAX_IMAGES + ' 张'
        : '可选，最多 ' + MAX_IMAGES + ' 张，单张不超过 5MB';
    }
  }

  function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || [], 0);
    var fail = '';
    files.forEach(function (file) {
      if (!file) return;
      var okType = /^image\//i.test(file.type || '') || /\.(jpe?g|png|gif|webp)$/i.test(file.name || '');
      if (!okType) {
        fail = '请选择图片文件';
        return;
      }
      if (file.size > MAX_BYTES) {
        fail = '单张图片不超过 5MB';
        return;
      }
      if (picked.length >= MAX_IMAGES) {
        fail = '最多上传 ' + MAX_IMAGES + ' 张';
        return;
      }
      picked.push({
        file: file,
        url: URL.createObjectURL(file)
      });
    });
    renderPreviews();
    if (fail) showStatus(fail, false);
    else showStatus('', true);
  }

  function formatDt(iso) {
    if (!iso) return '';
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

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderMine(items) {
    var box = $('compatBugMine');
    var list = $('compatBugMineList');
    if (!box || !list) return;
    items = Array.isArray(items) ? items : [];
    if (!items.length) {
      box.hidden = true;
      list.innerHTML = '';
      return;
    }
    list.innerHTML = items
      .map(function (row) {
        var replied = !!(row.admin_reply && String(row.admin_reply).trim());
        var html =
          '<div class="mine-item">' +
          '<div class="mine-meta">' +
          esc(formatDt(row.created_at) || '已提交') +
          (replied ? ' · 已回复' : ' · 待回复') +
          '</div>' +
          '<div class="mine-content">' +
          esc(row.content || '') +
          '</div>';
        if (replied) {
          html +=
            '<div class="mine-reply"><div class="mine-reply-label">官方回复</div>' +
            esc(row.admin_reply) +
            '</div>';
        } else {
          html += '<p class="mine-wait">收到后会在这里和站内信同步回复</p>';
        }
        html += '</div>';
        return html;
      })
      .join('');
    box.hidden = false;
  }

  function loadMine() {
    if (!token()) return;
    fetch('/api/feedback', {
      headers: { Authorization: 'Bearer ' + token() },
      credentials: 'same-origin'
    })
      .then(function (r) {
        return (window.authParseJson || function (res) {
          return res.json();
        })(r);
      })
      .then(function (j) {
        if (!j || j.code !== 200 || !j.data) return;
        renderMine(j.data.items);
      })
      .catch(function () {});
  }

  function validateContent(raw) {
    var s = String(raw || '').trim();
    if (!s) return '请填写问题描述';
    if (s.length < CONTENT_MIN) return '请把遇到的情况写清楚（至少 ' + CONTENT_MIN + ' 个字）';
    return '';
  }

  function goLogin() {
    var next = 'compat_bug.html';
    try {
      next = encodeURIComponent(location.pathname.replace(/^\//, '') + location.search);
    } catch (e0) {}
    window.location.href = 'login.html?next=' + next;
  }

  function submit() {
    var err = validateContent($('compatBugContent') && $('compatBugContent').value);
    if (err) {
      showStatus(err, false);
      return;
    }
    if (!token()) {
      showStatus('请先登录后再提交', false);
      setTimeout(goLogin, 800);
      return;
    }
    var btn = $('compatBugSubmit');
    if (btn) btn.disabled = true;
    showStatus('正在提交…', true);
    var device = collectDeviceInfo();
    var fd = new FormData();
    fd.append('content', String($('compatBugContent').value || '').trim());
    var contact = $('compatBugContact') ? String($('compatBugContact').value || '').trim() : '';
    if (contact) fd.append('contact', contact);
    var deviceOverride = $('compatBugDevice') ? String($('compatBugDevice').value || '').trim() : '';
    fd.append('device_info', deviceOverride || device.device_info);
    fd.append('user_agent', device.user_agent);
    picked.forEach(function (item) {
      if (item && item.file) fd.append('images', item.file, item.file.name || 'image.jpg');
    });
    var headers = { Authorization: 'Bearer ' + token() };
    try {
      if (typeof window.getClientDeviceHeaders === 'function') {
        var extra = window.getClientDeviceHeaders();
        if (extra && extra['X-Client-Device']) headers['X-Client-Device'] = extra['X-Client-Device'];
      }
    } catch (e1) {}
    fetch('/api/feedback', {
      method: 'POST',
      headers: headers,
      body: fd,
      credentials: 'same-origin'
    })
      .then(function (r) {
        return (window.authParseJson || function (res) {
          return res.json();
        })(r).then(function (j) {
          return { status: r.status, body: j };
        });
      })
      .then(function (x) {
        if (x.status === 401) {
          showStatus('登录状态已失效，请重新登录', false);
          setTimeout(goLogin, 900);
          return;
        }
        if (x.status === 200 && x.body && x.body.code === 200) {
          showStatus('已提交，我们会尽快查看。感谢反馈。', true);
          if (typeof window.trackUserAction === 'function') {
            window.trackUserAction('track_compat_bug_submit', {
              page: 'compat_bug',
              image_count: picked.length
            });
          }
          picked.forEach(revokePreview);
          picked = [];
          renderPreviews();
          if ($('compatBugContent')) $('compatBugContent').value = '';
          var ok = $('compatBugOk');
          if (ok) ok.hidden = false;
          loadMine();
          return;
        }
        showStatus((x.body && x.body.msg) || '提交失败', false);
      })
      .catch(function () {
        showStatus('网络异常，请稍后重试', false);
      })
      .then(function () {
        if (btn) btn.disabled = false;
      });
  }

  function bind() {
    fillDeviceField();
    fillContact();
    var input = $('compatBugInput');
    var pick = $('compatBugPick');
    if (input) {
      try {
        input.removeAttribute('capture');
      } catch (eCap) {}
      input.addEventListener('change', function () {
        addFiles(input.files);
        input.value = '';
      });
    }
    if (pick) {
      pick.addEventListener('click', function (ev) {
        if (!token()) {
          ev.preventDefault();
          showStatus('请先登录后再上传截图', false);
          setTimeout(goLogin, 800);
          return;
        }
        if (pick.tagName !== 'LABEL' && input) {
          if (typeof input.showPicker === 'function') {
            try {
              input.showPicker();
              return;
            } catch (eSp) {}
          }
          input.click();
        }
      });
    }
    var form = $('compatBugForm');
    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        submit();
      });
    }
    var back = $('compatBugBack');
    if (back && !back.getAttribute('href')) {
      back.setAttribute('href', 'consult.html?tab=products');
    }
    loadMine();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }

  window.CompatBugFeedback = {
    validateContent: validateContent,
    collectDeviceInfo: collectDeviceInfo,
    addFiles: addFiles,
    renderMine: renderMine,
    MAX_IMAGES: MAX_IMAGES,
    MAX_BYTES: MAX_BYTES,
    CONTENT_MIN: CONTENT_MIN
  };
})();
