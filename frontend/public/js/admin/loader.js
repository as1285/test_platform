/**
 * 管理端脚本/厂商库懒加载（阶段 2）
 */
(function (global) {
  var loaded = Object.create(null);
  var inflight = Object.create(null);

  var MODULE_SRC = {
    charts: '/js/admin/modules/charts.js?v=20260722-charts-window-fix',
    chat: '/js/admin/modules/chat.js?v=20260722-chat-window-fix',
    analytics: '/js/admin/modules/analytics.js?v=20260721-p2',
    feedback: '/js/admin/modules/feedback.js?v=20260721-p2',
    users: '/js/admin/modules/users.js?v=20260721-p2',
    'user-data': '/js/admin/modules/user-data.js?v=20260721-p2',
    codes: '/js/admin/modules/codes.js?v=20260721-p2',
    settings: '/js/admin/modules/settings.js?v=20260721-p2',
    accounts: '/js/admin/modules/accounts.js?v=20260721-p2',
    logs: '/js/admin/modules/logs.js?v=20260721-p2',
    monitor: '/js/admin/modules/monitor.js?v=20260721-p2',
    'sbdy-demo': '/js/admin/modules/sbdy-demo.js?v=20260724-no-operator'
  };

  var PAGE_MODULE = {
    settings: 'settings',
    'install-guide': 'settings',
    'sales-contacts': 'settings',
    appearance: 'settings',
    codes: 'codes',
    'weekly-codes': 'codes',
    'sbdy-demo': 'sbdy-demo',
    'admin-accounts': 'accounts',
    users: 'users',
    'guest-users': 'users',
    'users-deleted': 'users',
    'user-data': 'user-data',
    'user-behavior': 'user-data',
    'activated-user-analysis': 'user-data',
    feedback: 'feedback',
    chat: 'chat',
    'login-log': 'logs',
    'user-login-log': 'logs',
    'server-monitor': 'monitor',
    'analytics-conversion': 'analytics',
    'analytics-activity': 'analytics',
    'analytics-register': 'analytics',
    'analytics-purchase': 'analytics',
    'analytics-tracking': 'analytics',
    'analytics-devices': 'analytics',
    'install-guide-stats': 'analytics',
    'channel-analysis': 'analytics',
    'api-analytics': 'analytics'
  };

  var SCRIPT_LOAD_TIMEOUT_MS = 12000;

  function loadScript(src) {
    if (loaded[src]) return Promise.resolve();
    if (inflight[src]) return inflight[src];
    inflight[src] = new Promise(function (resolve, reject) {
      var done = false;
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      function finish(err) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        delete inflight[src];
        if (err) {
          try {
            if (s.parentNode) s.parentNode.removeChild(s);
          } catch (e0) {}
          reject(err);
        } else {
          loaded[src] = 1;
          resolve();
        }
      }
      var timer = setTimeout(function () {
        finish(new Error('timeout loading ' + src));
      }, SCRIPT_LOAD_TIMEOUT_MS);
      s.onload = function () {
        finish(null);
      };
      s.onerror = function () {
        finish(new Error('failed to load ' + src));
      };
      document.head.appendChild(s);
    });
    return inflight[src];
  }

  function ensureChart() {
    if (typeof global.Chart === 'function') return Promise.resolve();
    return loadScript('/js/vendor/chart.umd.min.js?v=4.4.7');
  }

  function ensureQrcode() {
    if (typeof global.QRCode === 'function') return Promise.resolve();
    return loadScript('/js/vendor/qrcode.min.js');
  }

  function ensureNajilu() {
    if (global.Najilu || global.renderNajilu || document.querySelector('script[src*="najilu.js"]')) {
      return Promise.resolve();
    }
    return loadScript('/js/najilu.js?v=20260721-stamp-single');
  }

  function ensureModule(name) {
    var src = MODULE_SRC[name];
    if (!src) return Promise.resolve();
    return loadScript(src);
  }

  function ensureForPage(pageKey) {
    var mod = PAGE_MODULE[pageKey] || '';
    var chain = Promise.resolve();
    if (mod === 'analytics' || mod === 'users' || mod === 'user-data') {
      chain = chain.then(ensureChart).then(function () {
        return ensureModule('charts');
      });
    }
    if (mod === 'codes') {
      chain = chain.then(ensureQrcode);
    }
    if (mod === 'users' || mod === 'user-data') {
      chain = chain.then(ensureNajilu);
    }
    if (mod) {
      chain = chain.then(function () {
        return ensureModule(mod);
      });
    }
    return chain;
  }

  function setPageModuleMap(pages) {
    if (!Array.isArray(pages)) return;
    pages.forEach(function (p) {
      if (p && p.page && p.module) {
        PAGE_MODULE[p.page] = p.module;
      }
    });
  }

  global.AdminLoader = {
    loadScript: loadScript,
    ensureChart: ensureChart,
    ensureQrcode: ensureQrcode,
    ensureNajilu: ensureNajilu,
    ensureModule: ensureModule,
    ensureForPage: ensureForPage,
    setPageModuleMap: setPageModuleMap,
    pageModule: function (page) {
      return PAGE_MODULE[page] || '';
    }
  };
})(window);
