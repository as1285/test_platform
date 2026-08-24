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

  /* ===== Mate 60 全页面 ArkWeb 布局漂移自修复（2026-08-24）=====
   * HarmonyOS 多屏协同/窗口化下，引擎会把文档流内容布局到视口上方并整体收窄，
   * 且 loading=lazy 图片因视口错乱永不判定可见（首页下半空白）。
   * 处理：探测页面主容器实际位置，测多少补多少（双向收敛防误判）；
   * body 收窄钉回 100vw；lazy 图片改 eager。
   * 仅 Mate 60 生效；「我的」页由专属冻结页自带补偿，跳过。 */
  (function () {
    if (global.__mate60ArkFix) return;
    function isMate60() {
      var ua = String(navigator.userAgent || '');
      try { ua += ' ' + String(localStorage.getItem('tax_device_model_v1') || ''); } catch (e0) {}
      try { ua += ' ' + String(localStorage.getItem('tax_device_ua_v1') || ''); } catch (e1) {}
      if (/Mate\s*70|PLA-AL|PLR-AL|PLU-AL/i.test(ua)) return false;
      return /Mate\s*60|ALN-AL00|ALN-AL10|ALN-AL80|ALN-AN00|ALN-AL\d{2}|ALN-AN\d{2}|HUAWEIALN/i.test(ua);
    }
    if (!isMate60()) return;
    global.__mate60ArkFix = 1;

    function probeEl() {
      var b = document.body;
      if (!b) return null;
      for (var i = 0; i < b.children.length; i++) {
        var el = b.children[i];
        if (/^(SCRIPT|STYLE|LINK|META|TEMPLATE)$/i.test(el.tagName)) continue;
        var cs;
        try { cs = getComputedStyle(el); } catch (e) { continue; }
        if (!cs || cs.display === 'none') continue;
        if (cs.position === 'fixed' || cs.position === 'absolute' || cs.position === 'sticky') continue;
        if (el.getBoundingClientRect().height < 40) continue;
        return el;
      }
      return null;
    }

    function eagerizeLazyImages() {
      try {
        var imgs = document.querySelectorAll('img[loading="lazy"]');
        for (var i = 0; i < imgs.length; i++) {
          imgs[i].setAttribute('loading', 'eager');
        }
      } catch (e) {}
    }

    function fixDrift() {
      try {
        if (document.body && document.body.classList.contains('page-mine')) return;
        var el = probeEl();
        if (!el) return;
        var sy = window.scrollY || (document.documentElement && document.documentElement.scrollTop) || 0;
        var sx = window.scrollX || 0;
        var r = el.getBoundingClientRect();
        var curT = parseFloat(el.getAttribute('data-ark-fix-t') || '0') || 0;
        if (sy <= 2) {
          var delta = 0;
          if (r.top < -8) delta = -r.top;
          else if (r.top > 8 && curT > 0) delta = -Math.min(r.top, curT);
          if (delta && Math.abs(curT + delta) < 1600) {
            var wantT = curT + delta;
            el.style.setProperty('margin-top', wantT + 'px', 'important');
            el.setAttribute('data-ark-fix-t', String(wantT));
          }
        }
        var br = document.body.getBoundingClientRect();
        if (window.innerWidth - br.width > 8) {
          document.body.style.setProperty('width', '100vw', 'important');
          document.body.style.setProperty('max-width', '100vw', 'important');
        }
        var curL = parseFloat(document.body.getAttribute('data-ark-fix-x') || '0') || 0;
        if (sx <= 2 && Math.abs(br.left) > 2 && Math.abs(curL - br.left) < 300) {
          var wantL = curL - br.left;
          document.body.style.setProperty('margin-left', wantL + 'px', 'important');
          document.body.setAttribute('data-ark-fix-x', String(wantL));
        }
      } catch (e) {}
    }

    function tick() {
      fixDrift();
      eagerizeLazyImages();
    }
    function boot() {
      tick();
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tick);
      window.addEventListener('resize', tick);
      window.addEventListener('pageshow', tick);
      [120, 360, 900, 2000, 4000].forEach(function (ms) { setTimeout(tick, ms); });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }
  })();
})(window);
