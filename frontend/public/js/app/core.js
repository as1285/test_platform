/**
 * TaxApp 设计系统壳入口（阶段 3）
 * 门面包装现有 auth.js 全局能力，供核心页统一引用。
 */
(function (global) {
  function pick(name, fallback) {
    if (typeof global[name] === 'function') return global[name];
    return fallback;
  }

  var ui = global.TaxAppUI || {
    toast: function (t) {
      try {
        global.alert(String(t == null ? '' : t));
      } catch (e) {}
    },
    alert: function (t) {
      try {
        global.alert(String(t == null ? '' : t));
      } catch (e) {}
    },
    durationMs: function () {
      return 3000;
    }
  };

  var nav = global.TaxAppNav || {
    hydrateBottomNav: function () {},
    activeKey: function () {
      return '';
    },
    currentPageName: function () {
      return '';
    }
  };

  var TaxApp = {
    version: '3.0.0',
    ui: ui,
    nav: nav,
    auth: {
      getToken: pick('authGetToken', function () {
        return '';
      }),
      headers: pick('authHeaders', function () {
        return {};
      }),
      fetch: pick('authFetch', function (url, opts) {
        return fetch(url, opts || {});
      }),
      clearSession: pick('authClearSession', function () {})
    },
    api: {
      fetch: function (url, opts) {
        return TaxApp.auth.fetch(url, opts);
      }
    },
    analytics: {
      trackUser: pick('trackUserAction', function () {}),
      trackPublic: pick('trackPublicAction', function () {})
    },
    device: {
      getId: pick('getOrCreateClientDeviceId', function () {
        return '';
      }),
      headers: pick('getClientDeviceHeaders', function () {
        return {};
      }),
      payload: pick('buildClientDevicePayload', function () {
        return {};
      })
    },
    install: {
      getPackages: pick('fetchPublicInstallPackages', function () {
        return Promise.resolve(null);
      }),
      getCachedPackages: pick('getCachedPublicInstallPackages', function () {
        return null;
      }),
      refreshUi: pick('refreshPublicInstallPackagesUi', function () {}),
      markReferral: pick('markInstallGuideReferral', function () {}),
      hasReferral: pick('hasInstallGuideReferral', function () {
        return false;
      })
    },
    shell: {
      isCordova: function () {
        return typeof global.isCordovaTaxAppShell === 'function'
          ? !!global.isCordovaTaxAppShell()
          : !!global.isCordovaTaxAppShell;
      },
      openExternal: function (url) {
        var u = String(url || '');
        if (!u) return;
        try {
          if (global.parent && global.parent !== global) {
            global.parent.postMessage({ type: 'open-external', url: u }, '*');
            return;
          }
        } catch (e0) {}
        try {
          global.open(u, '_blank', 'noopener,noreferrer');
        } catch (e1) {
          global.location.href = u;
        }
      }
    },
    ready: function (fn) {
      if (typeof fn !== 'function') return;
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn);
      } else {
        fn();
      }
    }
  };

  global.TaxApp = TaxApp;

  TaxApp.ready(function () {
    try {
      TaxApp.nav.hydrateBottomNav();
    } catch (e) {}
  });
})(window);
