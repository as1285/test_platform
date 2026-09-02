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
    'zhzh_jhm.html': true,
    'refund_ad.html': true,
    'douyin_yuefu_ad.html': true,
    'gjj_extract_ad.html': true
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

  /** Android「我的」：不依赖机型 UA，首屏即走 750px @sm 底图（HyperOS WebView 大图合成极慢） */
  function primeAndroidMineE1SmFirstPaint() {
    try {
      if (currentPageName() !== 'mine.html') {
        return;
      }
      var ua = '';
      try {
        ua = String(navigator.userAgent || '');
      } catch (eUa) {}
      try {
        ua += ' ' + String(localStorage.getItem('tax_device_model_v1') || '');
      } catch (eModel) {}
      if (!/Android|HarmonyOS|OpenHarmony|ArkWeb|HMSCore|HUAWEI|Huawei/i.test(ua)) {
        return;
      }
      var p40pro = /ELS-AN00|ELS-AN10|ELS-N04|ELS-AN\d{2}|P40[\s_-]*Pro/i.test(ua);
      if (p40pro) {
        document.documentElement.classList.add('app-android-huawei-p40pro');
        document.documentElement.classList.remove('app-huawei-mine-noclip');
      }
      window.__mineE1ForceSm = true;
      document.documentElement.classList.add('app-android-mine-e1-sm');
      if (document.getElementById('androidMineSmFirstPaint')) {
        return;
      }
      var st = document.createElement('style');
      st.id = 'androidMineSmFirstPaint';
      st.setAttribute('data-android-mine-e1-sm-firstpaint', '1');
      st.textContent =
        'html.app-android-mine-e1-sm body.page-mine{--mine-top-bleed:0px!important;--mine-rpx:calc(100vw / 750)!important;background-color:#f5f6fa!important;background-image:none!important;}' +
        'html.app-android-mine-e1-sm:not(.app-android-xiaomi-14pro):not(.app-android-xiaomi-15):not(.app-android-xiaomi-15pro):not(.app-android-huawei-mate60):not(.app-android-huawei-p40pro) body.page-mine .mine-e1-canvas{padding-top:0!important;margin-top:0!important;overflow:hidden!important;background-color:#f5f6fa!important;background-image:url(/img/mine/e1_01@sm.png?v=20260901-android-mine-sm)!important;background-size:100% auto!important;background-position:top center!important;height:calc(1180 * 100vw / 750)!important;max-height:calc(1180 * 100vw / 750)!important;aspect-ratio:unset!important;container-type:normal!important;width:100%!important;}' +
        'html.app-android-huawei-p40pro.app-android-mine-e1-sm body.page-mine .mine-e1-canvas{padding-top:0!important;margin-top:0!important;overflow:hidden!important;background-color:#f5f6fa!important;background-image:url(/img/mine/e1_01@sm.png?v=20260901-android-mine-sm)!important;background-size:100% 100%!important;background-position:top center!important;height:auto!important;max-height:none!important;aspect-ratio:750/1180!important;container-type:normal!important;width:100%!important;}' +
        'html.app-android-mine-e1-sm body.page-mine .mine-e1-canvas>img,html.app-android-mine-e1-sm body.page-mine .mine-e1-canvas>#headerImg{margin-top:0!important;display:block!important;width:1px!important;height:1px!important;max-height:none!important;object-fit:fill!important;position:absolute!important;top:auto!important;transform:none!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;}' +
        'html.app-android-mine-e1-sm:not(.app-android-xiaomi-14pro):not(.app-android-xiaomi-15):not(.app-android-xiaomi-15pro):not(.app-android-huawei-mate60):not(.app-android-huawei-p40pro) body.page-mine .mine-e1-layer{top:0!important;padding-bottom:calc(1180 / 750 * 100%)!important;}' +
        'html.app-android-huawei-p40pro.app-android-mine-e1-sm body.page-mine .mine-e1-layer{top:0!important;padding-bottom:calc(1180 / 750 * 100%)!important;}' +
        'html.app-android-mine-e1-sm:not(.app-android-xiaomi-14pro):not(.app-android-xiaomi-15):not(.app-android-xiaomi-15pro):not(.app-android-huawei-mate60):not(.app-android-huawei-p40pro) body.page-mine .mine-e1-footer{padding-bottom:calc(var(--bottom-nav-height,54px) + var(--bottom-nav-bottom,8px) + 12px)!important;}';
      document.head.appendChild(st);
    } catch (ePrime) {}
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

  (function tabEmbedEarlyChrome() {
    function parentIsTabShellHost() {
      try {
        if (!window.parent || window.parent === window) return false;
        var pdoc = window.parent.document;
        return !!(pdoc && pdoc.documentElement.getAttribute('data-tab-shell') === '1');
      } catch (e0) {
        return false;
      }
    }
    var embed = false;
    try {
      if (new URLSearchParams(window.location.search).get('tab_embed') === '1') embed = true;
    } catch (e1) {}
    try {
      var fe = window.frameElement;
      if (fe && fe.classList && fe.classList.contains('tab-shell-iframe')) embed = true;
    } catch (e2) {}
    if (!embed && parentIsTabShellHost()) embed = true;
    if (!embed) return;
    document.documentElement.classList.add('tab-embed-mode');
    var st = document.createElement('style');
    st.setAttribute('data-tab-embed-boot', '1');
    /* 盖过各页 html body.page-* > .bottom-nav 的高优先级锁，避免 iframe 子页再冒出一条底栏 */
    st.textContent =
      'html.tab-embed-mode .bottom-nav,' +
      'html.tab-embed-mode body > .bottom-nav,' +
      'html.tab-embed-mode body.page-shouye > .bottom-nav,' +
      'html.tab-embed-mode body.page-daiban > .bottom-nav,' +
      'html.tab-embed-mode body.page-bancha > .bottom-nav,' +
      'html.tab-embed-mode body.page-message > .bottom-nav,' +
      'html.tab-embed-mode body.page-mine > .bottom-nav,' +
      'html.tab-embed-mode body .bottom-nav.ios-device,' +
      'html.app-ios-client.tab-embed-mode .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode .bottom-nav,' +
      'html.app-ios-iphone16promax.tab-embed-mode .bottom-nav,' +
      'html.app-ios-client.tab-embed-mode body > .bottom-nav,' +
      'html.app-ios-client.tab-embed-mode body.page-daiban > .bottom-nav,' +
      'html.app-ios-client.tab-embed-mode body.page-bancha > .bottom-nav,' +
      'html.app-ios-client.tab-embed-mode body.page-message > .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-daiban > .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-bancha > .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-message > .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-daiban > .bottom-nav.ios-device,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-bancha > .bottom-nav.ios-device,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-message > .bottom-nav.ios-device{' +
      'display:none!important;visibility:hidden!important;pointer-events:none!important;' +
      'height:0!important;min-height:0!important;max-height:0!important;overflow:hidden!important;' +
      'opacity:0!important;z-index:-1!important;}' +
      'html.tab-embed-mode body.has-bottom-nav,' +
      'html.tab-embed-mode body.page-daiban,' +
      'html.tab-embed-mode body.page-bancha,' +
      'html.tab-embed-mode body.page-message,' +
      'html.tab-embed-mode body.page-shouye,' +
      'html.tab-embed-mode body.page-mine{' +
      '--bottom-nav-clearance:0px!important;padding-bottom:0!important;}';
    (document.head || document.documentElement).appendChild(st);
    function stripEmbedBottomNav() {
      try {
        var nodes = document.querySelectorAll('.bottom-nav');
        for (var i = 0; i < nodes.length; i++) {
          var el = nodes[i];
          if (!el) continue;
          try {
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('height', '0', 'important');
            el.style.setProperty('opacity', '0', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
          } catch (eInline) {}
          if (el.parentNode) el.parentNode.removeChild(el);
        }
      } catch (e3) {}
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', stripEmbedBottomNav);
    } else {
      stripEmbedBottomNav();
    }
    /* iOS 16 Pro：auth.js 机型锁可能晚于首次 strip 再钉底栏，拉长复检 + MutationObserver */
    var n = 0;
    var timer = setInterval(function () {
      stripEmbedBottomNav();
      n += 1;
      if (n >= 40) clearInterval(timer);
    }, 250);
    try {
      var mo = new MutationObserver(function () {
        stripEmbedBottomNav();
      });
      var startMo = function () {
        if (!document.body) return;
        mo.observe(document.body, { childList: true, subtree: true });
        stripEmbedBottomNav();
      };
      if (document.body) startMo();
      else document.addEventListener('DOMContentLoaded', startMo);
      setTimeout(function () {
        try {
          mo.disconnect();
        } catch (eMo) {}
      }, 15000);
    } catch (eObs) {}
  })();

  markViewportChromeClasses();
  primeAndroidMineE1SmFirstPaint();

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
