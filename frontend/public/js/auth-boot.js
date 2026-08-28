/**
 * 首屏同步引导（小文件）：登录态、公开页判断、window 上立刻要用的 API、安全区 class、未登录跳转。
 * 机型顶栏补丁仍在 auth.js（defer），勿把大段 OEM 样式放进本文件。
 */
(function () {
  if (typeof window === 'undefined') {
    return;
  }
  if (window.__authBootRan) {
    return;
  }
  window.__authBootRan = 1;

  var LOGIN_PAGE = 'login.html';
  var SALES_CHANNEL_KEY = 'sales_channel_v1';
  var SALES_CHANNEL_TTL_MS = 15 * 60 * 1000;
  var PUBLIC_PAGES = {
    'index.html': true,
    'mine.html': true,
    'shouye.html': true,
    'bancha.html': true,
    'register.html': true,
    'login.html': true,
    'install_guide.html': true,
    'install-ios.html': true,
    'tutorial_video.html': true,
    'zhzh_jhm.html': true
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

  function getToken() {
    try {
      return localStorage.getItem('token') || '';
    } catch (e) {
      return '';
    }
  }

  function isNajiluVerifyView() {
    if (currentPageName() !== 'najilu.html') {
      return false;
    }
    try {
      return new URLSearchParams(window.location.search).get('view') === 'verify';
    } catch (e) {
      return false;
    }
  }

  function isForgotPwdFromLoginPage() {
    if (currentPageName() !== 'xiugaimima.html') {
      return false;
    }
    try {
      return new URLSearchParams(window.location.search).get('from') === 'login';
    } catch (e) {
      return false;
    }
  }

  function isPublicPage() {
    return !!PUBLIC_PAGES[currentPageName()] || isNajiluVerifyView() || isForgotPwdFromLoginPage();
  }

  function isActivationPage() {
    if (currentPageName() !== 'login.html' && currentPageName() !== 'index.html') {
      return false;
    }
    try {
      return new URLSearchParams(window.location.search).get('need_activate') === '1';
    } catch (e) {
      return false;
    }
  }

  function isAccountActive() {
    try {
      return localStorage.getItem('account_active') === '1';
    } catch (e) {
      return false;
    }
  }

  function sanitizeLoginNext(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return '';
    try {
      s = decodeURIComponent(s);
    } catch (eDec) {}
    s = s.replace(/^\/+/, '');
    if (s.indexOf('://') >= 0 || s.indexOf('//') === 0) return '';
    if (!/^[a-z0-9_\-]+\.html([?#][^\s]*)?$/i.test(s)) return '';
    s = s.split('#')[0];
    var pageOnly = String(s).split('?')[0].toLowerCase();
    if (pageOnly === 'purchase.html') return '';
    return s;
  }

  function getLoginNextTarget() {
    try {
      return sanitizeLoginNext(new URLSearchParams(window.location.search).get('next'));
    } catch (e) {
      return '';
    }
  }

  function sanitizeSalesChannelId(raw) {
    var s = String(raw || '').trim().toLowerCase();
    if (!s || s.length > 64) {
      return '';
    }
    if (!/^[a-z0-9_-]+$/.test(s)) {
      return '';
    }
    return s;
  }

  function getSalesChannel() {
    try {
      var raw = localStorage.getItem(SALES_CHANNEL_KEY);
      if (!raw) {
        return '';
      }
      var o = JSON.parse(raw);
      if (!o || !o.ch) {
        return '';
      }
      if (Date.now() - Number(o.at) > SALES_CHANNEL_TTL_MS) {
        localStorage.removeItem(SALES_CHANNEL_KEY);
        return '';
      }
      return sanitizeSalesChannelId(o.ch);
    } catch (e) {
      return '';
    }
  }

  function appendSalesChannelToUrl(url) {
    var ch = getSalesChannel();
    if (!ch || !url) {
      return url;
    }
    try {
      var u = new URL(url, window.location.href);
      if (!u.searchParams.get('ch') && !u.searchParams.get('channel')) {
        u.searchParams.set('ch', ch);
      }
      return u.pathname + u.search + u.hash;
    } catch (e) {
      if (url.indexOf('ch=') >= 0 || url.indexOf('channel=') >= 0) {
        return url;
      }
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'ch=' + encodeURIComponent(ch);
    }
  }

  function buildLoginPageUrl(nextPage, extras) {
    var next = sanitizeLoginNext(nextPage);
    var u;
    try {
      u = new URL(LOGIN_PAGE, window.location.href);
    } catch (e0) {
      return LOGIN_PAGE;
    }
    if (next) u.searchParams.set('next', next);
    if (extras && typeof extras === 'object') {
      Object.keys(extras).forEach(function (k) {
        if (extras[k] != null && String(extras[k]) !== '') {
          u.searchParams.set(k, String(extras[k]));
        }
      });
    }
    return appendSalesChannelToUrl(u.pathname + u.search + u.hash);
  }

  function bearerTokenFetch(url, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (!headers.Authorization && !headers.authorization) {
      var t = '';
      try {
        t = String(localStorage.getItem('token') || '').trim();
      } catch (eTok) {}
      if (t) headers.Authorization = 'Bearer ' + t;
    }
    return fetch(
      url,
      Object.assign({}, opts, {
        headers: headers,
        credentials: opts.credentials || 'same-origin'
      })
    );
  }

  function markViewportChromeClasses() {
    try {
      var root = document.documentElement;
      var ua = '';
      try {
        ua = String(navigator.userAgent || '');
      } catch (eUa) {}
      try {
        ua += ' ' + String(localStorage.getItem('tax_device_model_v1') || '');
      } catch (eModel) {}
      try {
        ua += ' ' + String(localStorage.getItem('tax_device_ua_v1') || '');
      } catch (eStoredUa) {}
      var ios =
        /iPhone|iPad|iPod/i.test(ua) ||
        (typeof navigator.platform === 'string' &&
          navigator.platform === 'MacIntel' &&
          navigator.maxTouchPoints > 1);
      var android =
        !ios &&
        (/Android/i.test(ua) ||
          /HarmonyOS|OpenHarmony|ArkWeb|HMSCore|HUAWEI|Huawei/i.test(ua) ||
          /Mate\s*60|ALN-AL/i.test(ua));
      if (android) {
        root.classList.add('app-android-client');
        root.classList.add('app-top-safe-shell');
      }
      if (ios) {
        root.classList.add('app-ios-client');
        root.classList.add('app-top-safe-shell');
      }
    } catch (eMark) {}
  }

  try {
    if (typeof window.authFetch !== 'function') {
      window.authFetch = bearerTokenFetch;
    }
  } catch (eAuthStub) {}

  window.authGetToken = getToken;
  window.currentPageName = currentPageName;
  window.isPublicPage = isPublicPage;
  window.sanitizeLoginNext = sanitizeLoginNext;
  window.getLoginNextTarget = getLoginNextTarget;
  window.getSalesChannel = getSalesChannel;
  window.appendSalesChannelToUrl = appendSalesChannelToUrl;
  window.buildLoginPageUrl = buildLoginPageUrl;
  window.markViewportChromeClasses = markViewportChromeClasses;

  window.__pageLoadingQueue = window.__pageLoadingQueue || [];
  if (typeof window.showPageLoading !== 'function') {
    window.showPageLoading = function () {
      window.__pageLoadingQueue.push(['show']);
    };
    window.hidePageLoading = function () {
      window.__pageLoadingQueue.push(['hide']);
    };
    window.forceHidePageLoading = function () {
      window.__pageLoadingQueue.push(['force']);
    };
  }

  markViewportChromeClasses();

  if (!isPublicPage()) {
    if (!getToken()) {
      var curPage = currentPageName();
      var loginExtras = {};
      try {
        if (new URLSearchParams(window.location.search).get('from') === 'share') {
          loginExtras.from = 'share';
        }
      } catch (eFrom) {}
      window.location.replace(buildLoginPageUrl(curPage, loginExtras));
      return;
    }
    if (isActivationPage()) {
      if (isAccountActive()) {
        window.location.replace('shouye.html');
      }
      return;
    }
  } else {
    var page = currentPageName();
    if ((page === 'index.html' || page === 'login.html') && getToken()) {
      var nextTarget = getLoginNextTarget();
      if (nextTarget) {
        window.location.replace(appendSalesChannelToUrl(nextTarget));
        return;
      }
      if (isAccountActive()) {
        window.location.replace('shouye.html');
      } else {
        if ((page === 'login.html' || page === 'index.html') && isActivationPage()) {
          return;
        }
        window.location.replace('shouye.html');
      }
    }
    if (page === 'index.html' && !getToken() && !isActivationPage()) {
      try {
        var qs = window.location.search || '';
        var hs = window.location.hash || '';
        window.location.replace('shouye.html' + qs + hs);
      } catch (eIdx) {
        window.location.replace('shouye.html');
      }
    }
  }
})();
