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
        /* 引擎级收窄才干预：>24px 排除桌面/协同窗口滚动条(~16px)；用 100% 而非 100vw 防横向溢出。
         * 勿再做 margin-left 水平补偿：滚动条环境会把 body 推出 -16px（右侧被裁）。 */
        if (window.innerWidth - br.width > 24) {
          document.body.style.setProperty('width', '100%', 'important');
          document.body.style.setProperty('max-width', '100%', 'important');
        }
      } catch (e) {}
    }

    /* 蓝顶沉浸页有专属头图处理，白顶自动顶距不适用 */
    var ARK_BLUE_TOP_PAGES = ['page-shouye', 'page-daiban', 'page-bancha', 'page-message', 'page-mine'];
    var ARK_TOP_INSET = 52;
    function isArkBlueTopPage() {
      var b = document.body;
      if (!b) return false;
      for (var i = 0; i < ARK_BLUE_TOP_PAGES.length; i++) {
        if (b.classList.contains(ARK_BLUE_TOP_PAGES[i])) return true;
      }
      return false;
    }

    function pinArkWhiteTopInset() {
      try {
        if (isArkBlueTopPage()) return;
        var b = document.body;
        if (!b) return;
        var root = document.documentElement;
        var insetPx = ARK_TOP_INSET + 'px';
        root.style.setProperty('--app-shell-statusbar-top', insetPx, 'important');
        root.style.setProperty('--safe-t', insetPx, 'important');
        b.style.setProperty('--app-shell-statusbar-top', insetPx, 'important');
        b.style.setProperty('--safe-t', insetPx, 'important');
        /* 全站浅色设计：防鸿蒙深色模式把页面/遮挡条算法反转成深灰 */
        try {
          root.style.colorScheme = 'light';
          b.style.colorScheme = 'light';
          if (!document.querySelector('meta[name="color-scheme"]')) {
            var csMeta = document.createElement('meta');
            csMeta.setAttribute('name', 'color-scheme');
            csMeta.setAttribute('content', 'light');
            (document.head || root).appendChild(csMeta);
          }
        } catch (eScheme) {}
        /* 状态栏遮挡条：吸附头下移后 0-52px 会透出滚动内容；底色写死站内浅灰，勿取计算色（深色模式会反转） */
        if (!document.getElementById('arkWhiteTopShield')) {
          var shield = document.createElement('div');
          shield.id = 'arkWhiteTopShield';
          /* 预打标记 + border-box：防止被下一轮 fixed 扫描当页面头再垫 52px */
          shield.setAttribute('data-ark-top-pad', '1');
          shield.style.cssText =
            'position:fixed;left:0;right:0;top:0;height:' +
            ARK_TOP_INSET +
            'px;box-sizing:border-box;padding:0;background:#f5f6fa;color-scheme:light;z-index:3000;pointer-events:none;';
          b.appendChild(shield);
        }
        var needBodyPad = false;
        var firstFlowChecked = false;
        var kids = b.children;
        for (var i = 0; i < kids.length; i++) {
          var el = kids[i];
          if (/^(SCRIPT|STYLE|LINK|TEMPLATE)$/i.test(el.tagName)) continue;
          if (el.id === 'arkWhiteTopShield' || el.id === 'mate60DebugHud') continue;
          var cs;
          try { cs = getComputedStyle(el); } catch (eCs) { continue; }
          if (!cs || cs.display === 'none' || cs.visibility === 'hidden') continue;
          var r = el.getBoundingClientRect();
          if (r.width < window.innerWidth * 0.6) continue;
          if (cs.position === 'fixed') {
            if (r.height > window.innerHeight * 0.6) continue;
            if (r.top <= 2 && !el.getAttribute('data-ark-top-pad')) {
              var fPad = parseFloat(cs.paddingTop) || 0;
              if (fPad < 40) {
                el.style.setProperty('padding-top', fPad + ARK_TOP_INSET + 'px', 'important');
              }
              el.setAttribute('data-ark-top-pad', '1');
              needBodyPad = true;
            }
            continue;
          }
          if (cs.position === 'sticky') {
            if (r.height > 260) continue;
            if (!el.getAttribute('data-ark-sticky-top')) {
              var sTop = parseFloat(cs.top) || 0;
              /* 页级已预置 top:52 时勿再叠加 */
              if (sTop < 40) {
                el.style.setProperty('top', sTop + ARK_TOP_INSET + 'px', 'important');
              }
              el.setAttribute('data-ark-sticky-top', '1');
            }
            /*
             * sticky 的 top 只影响吸附态，不会把文档流起点下移。
             * 遮挡条盖住 0-52px；必须垫高 sticky 头本身，否则「个人信息」等顶栏会整段藏住。
             */
            if (!el.getAttribute('data-ark-sticky-pad')) {
              var stickyPad = 0;
              try {
                stickyPad = parseFloat(getComputedStyle(el).paddingTop) || 0;
              } catch (eStickyPad) {
                stickyPad = parseFloat(cs.paddingTop) || 0;
              }
              if (stickyPad < 40) {
                el.style.setProperty('padding-top', stickyPad + ARK_TOP_INSET + 'px', 'important');
              }
              el.setAttribute('data-ark-sticky-pad', '1');
            }
          }
          if (!firstFlowChecked && cs.position !== 'absolute' && cs.position !== 'sticky') {
            firstFlowChecked = true;
            var sy = window.scrollY || 0;
            var selfPad = parseFloat(cs.paddingTop) || 0;
            if (sy <= 2 && r.top <= 2 && selfPad < 40) {
              needBodyPad = true;
            }
          }
        }
        if (needBodyPad && !b.getAttribute('data-ark-body-pad')) {
          var bPad = parseFloat(getComputedStyle(b).paddingTop) || 0;
          b.style.setProperty('padding-top', bPad + ARK_TOP_INSET + 'px', 'important');
          b.setAttribute('data-ark-body-pad', '1');
        }
      } catch (e) {}
    }

    function tick() {
      fixDrift();
      pinArkWhiteTopInset();
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
