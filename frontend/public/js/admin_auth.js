/**
 * 管理后台：独立 token（admin_token），与用户端 localStorage.token 分离。
 */
(function () {
  var TOKEN_KEY = 'admin_token';
  var LOGIN_PAGE = 'admin_login.html';
  var PANEL_PAGE = 'admin_panel.html';

  function currentPageName() {
    var p = window.location.pathname || '';
    var i = p.lastIndexOf('/');
    var name = (i >= 0 ? p.slice(i + 1) : p) || '';
    return name || 'index.html';
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

  function adminFetch(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, adminHeaders(), opts.headers || {});
    return fetch(url, opts).then(function (r) {
      if (r.status === 401) {
        try {
          localStorage.removeItem(TOKEN_KEY);
        } catch (e) {}
        window.location.href = LOGIN_PAGE;
        return Promise.reject(new Error('unauthorized'));
      }
      return r;
    });
  }

  function adminLogout() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
    window.location.href = LOGIN_PAGE;
  }

  window.adminGetToken = getToken;
  window.adminHeaders = adminHeaders;
  window.adminFetch = adminFetch;
  window.adminLogout = adminLogout;

  var page = currentPageName();
  if (page === PANEL_PAGE) {
    if (!getToken()) {
      window.location.replace(LOGIN_PAGE);
    }
  } else if (page === LOGIN_PAGE) {
    if (getToken()) {
      window.location.replace(PANEL_PAGE);
    }
  }
})();
