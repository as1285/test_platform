/**
 * 管理后台：独立 token（admin_token），与用户端 localStorage.token 分离。
 * 阶段 2：支持独立管理域 /admin 路径入口。
 */
(function () {
  var TOKEN_KEY = 'admin_token';
  var LOGIN_PAGE = '/admin_login.html';
  var PANEL_PAGE = '/admin_panel.html';
  /* 登录跳转带 ?v=，迫使部分 WebView/代理忽略 no-store 时仍拉取新壳页 */
  var PANEL_URL = '/admin_panel.html?v=20260907-rm-ylbx';

  function currentPath() {
    return String(window.location.pathname || '');
  }

  function isLoginPage() {
    var p = currentPath();
    return (
      p === LOGIN_PAGE ||
      p === '/admin_login.html' ||
      p === '/admin/login' ||
      /\/admin_login\.html$/i.test(p)
    );
  }

  function isPanelPage() {
    var p = currentPath();
    return (
      p === PANEL_PAGE ||
      p === '/admin_panel.html' ||
      p === '/admin/panel' ||
      /\/admin_panel\.html$/i.test(p)
    );
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  function adminHeaders() {
    var h = { 'Content-Type': 'application/json' };
    var t = getToken();
    if (t) {
      h['Authorization'] = 'Bearer ' + t;
    }
    return h;
  }

  function rejectUnauthorized() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
    window.location.href = LOGIN_PAGE;
    return Promise.reject(new Error('unauthorized'));
  }

  function adminParseJson(r) {
    return r.text().then(function (text) {
      var t = String(text == null ? '' : text).trim();
      if (!t) {
        throw new Error('服务器无响应（HTTP ' + r.status + '）');
      }
      try {
        return JSON.parse(t);
      } catch (e) {
        if (t.charAt(0) === '<') {
          throw new Error('接口异常（HTTP ' + r.status + '），请强制刷新后重试');
        }
        throw new Error('接口返回无法解析（HTTP ' + r.status + '）');
      }
    });
  }

  function adminFetch(url, opts) {
    opts = opts || {};
    opts.credentials = opts.credentials || 'include';
    opts.headers = Object.assign({}, adminHeaders(), opts.headers || {});
    // 管理域与主站同路径 API；绝对路径更稳
    if (typeof url === 'string' && url.indexOf('http') !== 0 && url.charAt(0) !== '/') {
      url = '/' + url;
    }
    return fetch(url, opts).then(function (r) {
      if (r.status === 401) {
        return rejectUnauthorized();
      }
      return r;
    });
  }

  function adminUpload(url, file, fieldName) {
    fieldName = fieldName || 'file';
    var fd = new FormData();
    fd.append(fieldName, file);
    var t = getToken();
    if (typeof url === 'string' && url.indexOf('http') !== 0 && url.charAt(0) !== '/') {
      url = '/' + url;
    }
    return fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: t ? { Authorization: 'Bearer ' + t } : {},
      body: fd
    }).then(function (r) {
      if (r.status === 401) {
        return rejectUnauthorized();
      }
      return adminParseJson(r);
    });
  }

  function issueUiCookie() {
    return fetch('/api/admin/ui-cookie', {
      method: 'POST',
      credentials: 'include',
      headers: adminHeaders()
    }).then(function (r) {
      if (r.status === 401) {
        return rejectUnauthorized();
      }
      return r;
    });
  }

  function adminLogout() {
    var done = false;
    function leave() {
      if (done) return;
      done = true;
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('admin_profile');
        localStorage.removeItem('admin_menu_tree');
      } catch (e) {}
      window.location.href = LOGIN_PAGE;
    }
    try {
      fetch('/api/admin/logout', { method: 'POST', credentials: 'include' }).then(leave, leave);
    } catch (eFetch) {
      leave();
      return;
    }
    setTimeout(leave, 2000);
  }

  window.adminGetToken = getToken;
  window.adminFetch = adminFetch;
  window.adminParseJson = adminParseJson;
  window.adminUpload = adminUpload;
  window.adminLogout = adminLogout;

  if (isPanelPage()) {
    if (!getToken()) {
      window.location.replace(LOGIN_PAGE);
    }
  } else if (isLoginPage()) {
    if (getToken()) {
      issueUiCookie()
        .then(function () {
          window.location.replace(PANEL_URL);
        })
        .catch(function () {});
    }
  }
})();
