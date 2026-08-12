/** Admin module: 同步指定用户到远程新服 */
(function (global) {
  var bound = false;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function adminFetch(url, opts) {
    if (typeof global.adminFetch === 'function') return global.adminFetch(url, opts);
    return Promise.reject(new Error('adminFetch unavailable'));
  }

  function setStatus(html) {
    var el = document.getElementById('userRemoteSyncStatus');
    if (el) el.innerHTML = html;
  }

  function setResult(html) {
    var el = document.getElementById('userRemoteSyncResult');
    if (el) el.innerHTML = html;
  }

  function renderCounts(counts) {
    if (!counts) return '';
    var keys = Object.keys(counts).filter(function (k) {
      return Number(counts[k]) > 0;
    });
    if (!keys.length) return '<span class="hint">无关联业务数据</span>';
    return (
      '<ul class="hint m-0" style="padding-left:18px;">' +
      keys
        .map(function (k) {
          return '<li>' + esc(k) + '：' + esc(counts[k]) + '</li>';
        })
        .join('') +
      '</ul>'
    );
  }

  function loadStatus() {
    return adminFetch('/api/admin/user-remote-sync/status')
      .then(function (r) {
        return r.json().then(function (j) {
          return { status: r.status, body: j };
        });
      })
      .then(function (x) {
        var d = (x.body && x.body.data) || {};
        if (!d.enabled) {
          setStatus(
            '<span style="color:#b45309">未启用。请在服务器 <code>.env</code> 配置 <code>USER_REMOTE_SYNC_ENABLED=1</code> 及 SSH/DB 参数后重建后端。</span>'
          );
          return;
        }
        setStatus(
          '目标：<strong>' +
            esc(d.label || d.host || '-') +
            '</strong>（' +
            esc(d.mode) +
            ' / ' +
            esc(d.host) +
            '）'
        );
      })
      .catch(function (e) {
        setStatus('<span style="color:#b45309">状态加载失败：' + esc(e.message || e) + '</span>');
      });
  }

  function username() {
    var el = document.getElementById('userRemoteSyncUsername');
    return String((el && el.value) || '').trim();
  }

  function doPreview() {
    var un = username();
    if (!un) {
      setResult('<span style="color:#b45309">请输入用户名</span>');
      return;
    }
    setResult('预览中…');
    adminFetch('/api/admin/user-remote-sync/preview', {
      method: 'POST',
      body: JSON.stringify({ username: un })
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { status: r.status, body: j };
        });
      })
      .then(function (x) {
        if (!x.body || x.body.code !== 200) {
          setResult('<span style="color:#b45309">' + esc((x.body && x.body.msg) || '预览失败') + '</span>');
          return;
        }
        var d = x.body.data || {};
        setResult(
          '<p class="m-0"><strong>' +
            esc(d.username) +
            '</strong> ' +
            esc(d.real_name || '') +
            '　密码：' +
            esc(d.plain_password || '(无明文)') +
            '　激活：' +
            esc(d.activation_kind) +
            ' / active=' +
            esc(d.account_active) +
            '</p>' +
            '<p class="hint mt-8 mb-4">本机将同步的数据量：</p>' +
            renderCounts(d.counts)
        );
      })
      .catch(function (e) {
        setResult('<span style="color:#b45309">' + esc(e.message || e) + '</span>');
      });
  }

  function doPush() {
    var un = username();
    if (!un) {
      setResult('<span style="color:#b45309">请输入用户名</span>');
      return;
    }
    if (!window.confirm('确认把用户 ' + un + ' 的数据覆盖导入到新服务器？\n（同名用户在新服会被替换，不改动其他账号）')) {
      return;
    }
    setResult('正在同步，请稍候…');
    var btn = document.getElementById('btnUserRemoteSyncPush');
    if (btn) btn.disabled = true;
    adminFetch('/api/admin/user-remote-sync/push', {
      method: 'POST',
      body: JSON.stringify({ username: un })
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { status: r.status, body: j };
        });
      })
      .then(function (x) {
        if (btn) btn.disabled = false;
        if (!x.body || x.body.code !== 200) {
          setResult('<span style="color:#b45309">' + esc((x.body && x.body.msg) || '同步失败') + '</span>');
          return;
        }
        var d = x.body.data || {};
        var ru = d.remote_user || {};
        var skipped = (d.skipped_tables || []).join(', ');
        setResult(
          '<p class="m-0" style="color:#15803d"><strong>同步成功</strong></p>' +
            '<p class="hint mt-8 mb-4">新服用户：id=' +
            esc(ru.id) +
            '　' +
            esc(ru.username) +
            '　' +
            esc(ru.real_name || '') +
            '</p>' +
            '<p class="hint mb-4">新服校验计数：</p>' +
            renderCounts(d.remote_counts) +
            (skipped
              ? '<p class="hint mt-8">远程缺少、已跳过的表：' + esc(skipped) + '</p>'
              : '')
        );
      })
      .catch(function (e) {
        if (btn) btn.disabled = false;
        setResult('<span style="color:#b45309">' + esc(e.message || e) + '</span>');
      });
  }

  function bind() {
    if (bound) return;
    bound = true;
    var btnPreview = document.getElementById('btnUserRemoteSyncPreview');
    var btnPush = document.getElementById('btnUserRemoteSyncPush');
    if (btnPreview) btnPreview.addEventListener('click', doPreview);
    if (btnPush) btnPush.addEventListener('click', doPush);
    var input = document.getElementById('userRemoteSyncUsername');
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          doPreview();
        }
      });
    }
  }

  function loadPage() {
    bind();
    loadStatus();
    setResult('输入用户名后可预览，再确认同步。');
  }

  global.AdminModules = global.AdminModules || {};
  global.AdminModules['user-remote-sync'] = { loadPage: loadPage };
})(typeof window !== 'undefined' ? window : this);
