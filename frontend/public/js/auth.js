/**
 * 登录态：JWT 存 localStorage.token；未登录访问受保护页面时跳转登录页。
 * 受保护接口请使用 authFetch（自动带 Authorization + X-Client-Device，401 时清理并跳转）。
 * WebView / App 可设置 window.CLIENT_APP_VERSION；可选 window.buildClientDevicePayloadHook(base) 合并字段。
 */
(function () {
  var LOGIN_PAGE = 'index.html';
  var ACTIVATE_PAGE = 'activate.html';
  var CLIENT_DEVICE_STORAGE_KEY = 'client_device_id';
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

  function randomClientDeviceId() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var a = new Uint8Array(16);
      crypto.getRandomValues(a);
      var h = '';
      for (var i = 0; i < a.length; i++) {
        h += a[i].toString(16).padStart(2, '0');
      }
      return 'web_' + h;
    }
    return 'web_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
  }

  function getOrCreateClientDeviceId() {
    try {
      var v = localStorage.getItem(CLIENT_DEVICE_STORAGE_KEY);
      if (v && String(v).length >= 8) {
        return String(v).substring(0, 128);
      }
      var id = randomClientDeviceId();
      localStorage.setItem(CLIENT_DEVICE_STORAGE_KEY, id);
      return id;
    } catch (e) {
      return 'web_sess_' + String(Date.now());
    }
  }

  function buildClientDevicePayload() {
    var tz = '';
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (e) {}
    var appVer = '';
    try {
      if (typeof window !== 'undefined' && window.CLIENT_APP_VERSION != null) {
        appVer = String(window.CLIENT_APP_VERSION);
      }
    } catch (e2) {}
    var payload = {
      client_id: getOrCreateClientDeviceId(),
      source: 'web',
      platform: typeof navigator !== 'undefined' ? String(navigator.platform || '') : '',
      user_agent: typeof navigator !== 'undefined' ? String(navigator.userAgent || '').substring(0, 400) : '',
      language: typeof navigator !== 'undefined' ? String(navigator.language || '') : '',
      screen: typeof screen !== 'undefined' ? screen.width + 'x' + screen.height : '',
      dpr: typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1,
      timezone: tz.substring(0, 64),
      app_version: appVer.substring(0, 64)
    };
    if (typeof window !== 'undefined' && typeof window.buildClientDevicePayloadHook === 'function') {
      try {
        var patch = window.buildClientDevicePayloadHook(Object.assign({}, payload));
        if (patch && typeof patch === 'object') {
          Object.assign(payload, patch);
        }
      } catch (e3) {}
    }
    return payload;
  }

  function getClientDeviceHeaders() {
    try {
      var payload = buildClientDevicePayload();
      var j = JSON.stringify(payload);
      if (j.length > 8192) {
        j = JSON.stringify({
          client_id: payload.client_id,
          source: payload.source,
          user_agent: payload.user_agent
        });
      }
      return { 'X-Client-Device': j };
    } catch (e) {
      return {};
    }
  }

  function authHeaders() {
    var h = Object.assign({ 'Content-Type': 'application/json' }, getClientDeviceHeaders());
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
  window.getClientDeviceHeaders = getClientDeviceHeaders;
  window.buildClientDevicePayload = buildClientDevicePayload;

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
