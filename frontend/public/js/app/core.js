/**
 * TaxApp 设计系统壳入口（阶段 3）
 * 门面包装现有 auth.js 全局能力，供核心页统一引用。
 *
 * 构建约定（assemble-site.mjs）：
 * - 本文件与 nav.js / ui.js / app-shell.css 会 content-hash 后注入优先页
 *   （mine / shouye / consult / install_guide）；源码路径保持 js/app/*.js。
 * - 产物在 site/js/app/*.HASH.js，勿手改 site/。
 * - 依赖顺序：ui.js → nav.js → core.js；auth-boot / auth 可并行 defer。
 */
(function (global) {
  // === 门面：把 window 上 auth/UI 能力收拢到 TaxApp ===
  function pick(name, fallback) {
    return function () {
      var fn = global[name];
      if (typeof fn === 'function') {
        return fn.apply(this, arguments);
      }
      return fallback.apply(this, arguments);
    };
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
        /* 引擎级收窄才干预：>24px 排除桌面/协同窗口滚动条(~16px)。
         * ArkWeb 会把 html/body 文档流收窄约 8% 并居中（fixed 搜索条不受影响），
         * 首页通知条/汇算卡/专项卡两侧多出约 20px 边距且第四张入口卡被挤出屏。
         * width:100% 解不开被收窄的包含块，须钉 px 视口宽；钉宽生效后再把
         * 居中偏移归零（测多少补多少）；钉宽失败则保持居中，不做半修。 */
        var vw = window.innerWidth || 0;
        var de = document.documentElement;
        var br = document.body.getBoundingClientRect();
        var hrW = de ? de.getBoundingClientRect().width : br.width;
        if (vw > 0 && Math.max(vw - br.width, vw - hrW) > 24) {
          if (de) {
            de.style.setProperty('width', vw + 'px', 'important');
            de.style.setProperty('max-width', 'none', 'important');
          }
          document.body.style.setProperty('width', vw + 'px', 'important');
          document.body.style.setProperty('max-width', 'none', 'important');
        }
        var sx = window.scrollX || (de && de.scrollLeft) || 0;
        if (vw > 0 && sx <= 2 && document.body.getAttribute('data-ark-fix-w') !== 'off') {
          var br2 = document.body.getBoundingClientRect();
          if (Math.abs(br2.left) > 2 && vw - br2.width <= 8) {
            var curL = parseFloat(document.body.getAttribute('data-ark-fix-l') || '0') || 0;
            var wantL = curL - br2.left;
            if (Math.abs(wantL) < 240) {
              document.body.style.setProperty('margin-left', wantL + 'px', 'important');
              document.body.setAttribute('data-ark-fix-l', String(wantL));
            }
          }
        }
      } catch (e) {}
    }

    /* 蓝顶沉浸页有专属头图处理，白顶自动顶距不适用 */
    var ARK_BLUE_TOP_PAGES = ['page-shouye', 'page-daiban', 'page-bancha', 'page-message', 'page-mine'];
    /*
     * 已自管 fixed+40px 白顶栏的页：勿再钉 52/66 相对头。
     * 否则 header 改 relative 占文档流，content 仍按 fixed 顶距留白 → 标题下大块空白
     *（Mate60 Pro 收入纳税明细筛选页实测）。
     */
    var ARK_SELF_MANAGED_WHITE_TOP_PAGES = [
      'page-message-detail',
      'page-shuiming',
      'page-shuiming-result',
      'page-xiangqing'
    ];
    var ARK_TOP_INSET = 52;
    function isArkBlueTopPage() {
      var b = document.body;
      if (!b) return false;
      for (var i = 0; i < ARK_BLUE_TOP_PAGES.length; i++) {
        if (b.classList.contains(ARK_BLUE_TOP_PAGES[i])) return true;
      }
      return false;
    }
    function isArkSelfManagedWhiteTopPage() {
      var b = document.body;
      if (!b) return false;
      for (var i = 0; i < ARK_SELF_MANAGED_WHITE_TOP_PAGES.length; i++) {
        if (b.classList.contains(ARK_SELF_MANAGED_WHITE_TOP_PAGES[i])) return true;
      }
      return false;
    }
    function clearArkPinnedHeader(hdr) {
      if (!hdr) return;
      try {
        hdr.style.removeProperty('position');
        hdr.style.removeProperty('top');
        hdr.style.removeProperty('padding-top');
        hdr.style.removeProperty('padding-bottom');
        hdr.style.removeProperty('height');
        hdr.style.removeProperty('min-height');
        hdr.removeAttribute('data-ark-sticky-pad');
        hdr.removeAttribute('data-ark-sticky-top');
        hdr.removeAttribute('data-ark-top-pad');
        var back = hdr.querySelector('.back-btn');
        if (back) {
          back.style.removeProperty('top');
          back.style.removeProperty('height');
          back.style.removeProperty('display');
          back.style.removeProperty('align-items');
        }
      } catch (eHdr) {}
    }
    function skipArkSelfManagedWhiteTop() {
      var b = document.body;
      if (!b || !isArkSelfManagedWhiteTopPage()) return false;
      var staleShield = document.getElementById('arkWhiteTopShield');
      if (staleShield) {
        try {
          staleShield.parentNode && staleShield.parentNode.removeChild(staleShield);
        } catch (eRm) {}
      }
      clearArkPinnedHeader(document.querySelector('body > .header'));
      try {
        b.style.removeProperty('padding-top');
        b.removeAttribute('data-ark-body-pad');
        var rootSkip = document.documentElement;
        rootSkip.style.setProperty('--app-shell-statusbar-top', '40px');
        rootSkip.style.setProperty('--android-status-inset', '40px');
        rootSkip.style.setProperty('--safe-top', '40px');
        rootSkip.style.setProperty('--safe-t', '40px');
      } catch (eVar) {}
      return true;
    }

    function pinArkPlainHeader() {
      var hdr = document.querySelector('body > .header');
      if (!hdr) return;
      hdr.style.setProperty('position', 'relative', 'important');
      hdr.style.setProperty('top', '0px', 'important');
      hdr.style.setProperty('padding-top', '66px', 'important');
      hdr.style.setProperty('padding-bottom', '14px', 'important');
      hdr.style.setProperty('box-sizing', 'border-box', 'important');
      hdr.style.setProperty('height', 'auto', 'important');
      hdr.style.setProperty('min-height', '0', 'important');
      hdr.style.setProperty('background', '#fff', 'important');
      hdr.style.setProperty('z-index', '100', 'important');
      hdr.setAttribute('data-ark-sticky-pad', '1');
      hdr.setAttribute('data-ark-sticky-top', '1');
      hdr.setAttribute('data-ark-top-pad', '1');
      var back = hdr.querySelector('.back-btn');
      if (back) {
        back.style.setProperty('top', '66px', 'important');
        back.style.setProperty('height', '24px', 'important');
        back.style.setProperty('display', 'flex', 'important');
        back.style.setProperty('align-items', 'center', 'important');
      }
    }
    function pinArkWhiteTopInset() {
      try {
        if (isArkBlueTopPage()) return;
        var b = document.body;
        if (!b) return;
        /* 自管 fixed+40px 白顶栏：再钉 52/66 相对头会叠出大块空白 */
        if (skipArkSelfManagedWhiteTop()) return;
        var root = document.documentElement;
        var insetPx = ARK_TOP_INSET + 'px';
        root.style.setProperty('--app-shell-statusbar-top', insetPx, 'important');
        root.style.setProperty('--safe-t', insetPx, 'important');
        b.style.setProperty('--app-shell-statusbar-top', insetPx, 'important');
        b.style.setProperty('--safe-t', insetPx, 'important');
        pinArkPlainHeader();
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
        var shieldBg = document.querySelector('body > .header') ? '#fff' : '#f5f6fa';
        var existedShield = document.getElementById('arkWhiteTopShield');
        if (existedShield) {
          existedShield.style.background = shieldBg;
        } else {
          var shield = document.createElement('div');
          shield.id = 'arkWhiteTopShield';
          shield.setAttribute('data-ark-top-pad', '1');
          shield.style.cssText =
            'position:fixed;left:0;right:0;top:0;height:' +
            ARK_TOP_INSET +
            'px;box-sizing:border-box;padding:0;background:' +
            shieldBg +
            ';color-scheme:light;z-index:3000;pointer-events:none;';
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
              el.setAttribute('data-ark-sticky-top', '1');
            }
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
