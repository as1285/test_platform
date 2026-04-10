/**
 * 登录态：JWT 存 localStorage.token；未登录访问受保护页面时跳转登录页。
 * 受保护接口请使用 authFetch（自动带 Authorization，401 时清理并跳转）。
 */
(function () {
  var LOGIN_PAGE = 'index.html';
  var ACTIVATE_PAGE = 'activate.html';
  var PUBLIC_PAGES = {
    'index.html': true,
    'register.html': true,
    'login.html': true
  };

  function currentPageName() {
    var p = window.location.pathname || '';
    var i = p.lastIndexOf('/');
    var name = (i >= 0 ? p.slice(i + 1) : p) || '';
    if (!name) {
      return 'index.html';
    }
    return name;
  }

  function isPublicPage() {
    return !!PUBLIC_PAGES[currentPageName()];
  }

  function isActivationPage() {
    return currentPageName() === ACTIVATE_PAGE;
  }

  function isAccountActive() {
    try {
      return localStorage.getItem('account_active') === '1';
    } catch (e) {
      return false;
    }
  }

  function getToken() {
    try {
      return localStorage.getItem('token') || '';
    } catch (e) {
      return '';
    }
  }

  function authHeaders() {
    var h = { 'Content-Type': 'application/json' };
    var t = getToken();
    if (t) {
      h['Authorization'] = 'Bearer ' + t;
    }
    return h;
  }

  function clearSession() {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('userName');
      localStorage.removeItem('real_name');
      localStorage.removeItem('tax_id');
      localStorage.removeItem('employer_count');
      localStorage.removeItem('family_count');
      localStorage.removeItem('bank_card_count');
      localStorage.removeItem('gender');
      localStorage.removeItem('account_active');
    } catch (e) {}
  }

  function authFetch(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, authHeaders(), opts.headers || {});
    return fetch(url, opts).then(function (r) {
      if (r.status === 401) {
        clearSession();
        window.location.href = LOGIN_PAGE;
        return Promise.reject(new Error('unauthorized'));
      }
      if (r.status === 403) {
        return r.text().then(function (text) {
          var j = null;
          try {
            j = JSON.parse(text);
          } catch (e) {}
          if (j && j.banned) {
            clearSession();
            window.location.href = LOGIN_PAGE;
            return Promise.reject(new Error('banned'));
          }
          if (j && j.need_activation) {
            try {
              localStorage.setItem('account_active', '0');
            } catch (e2) {}
            window.location.href = ACTIVATE_PAGE;
            return Promise.reject(new Error('need_activation'));
          }
          return Promise.reject(new Error('forbidden'));
        });
      }
      return r;
    });
  }

  window.authGetToken = getToken;
  window.authHeaders = authHeaders;
  window.authFetch = authFetch;
  window.authClearSession = clearSession;

  if (!isPublicPage()) {
    if (!getToken()) {
      window.location.replace(LOGIN_PAGE);
      return;
    }
    if (isActivationPage()) {
      if (isAccountActive()) {
        window.location.replace('mine.html');
      }
      return;
    }
    if (!isAccountActive()) {
      window.location.replace(ACTIVATE_PAGE);
      return;
    }
  } else {
    var page = currentPageName();
    if ((page === 'index.html' || page === 'login.html') && getToken()) {
      if (isAccountActive()) {
        window.location.replace('mine.html');
      } else {
        window.location.replace(ACTIVATE_PAGE);
      }
    }
  }
})();
