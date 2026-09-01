/**
 * 底栏 Tab 单页壳：主 Tab 切换走 iframe 缓存，避免整页重载（Android / Cordova 卡顿根因）。
 * 嵌入页带 ?tab_embed=1，隐藏子页底栏，不在 iframe 内再套壳。
 */
(function (global) {
  if (typeof document === 'undefined') return;
  if (document.documentElement.getAttribute('data-tab-shell-js') === '1') return;
  document.documentElement.setAttribute('data-tab-shell-js', '1');

  var TAB_BY_FILE = {
    'shouye.html': 'shouye',
    'daiban.html': 'daiban',
    'bancha.html': 'bancha',
    'message.html': 'message',
    'mine.html': 'mine'
  };
  var FILE_BY_KEY = {
    shouye: 'shouye.html',
    daiban: 'daiban.html',
    bancha: 'bancha.html',
    message: 'message.html',
    mine: 'mine.html'
  };
  var SUB_PAGE_FILES = {
    'shuiming.html': true,
    'shuiming_result.html': true,
    'xiangqing.html': true
  };

  function currentPageFile() {
    try {
      var p = String(global.location.pathname || '');
      var parts = p.split('/');
      return (parts[parts.length - 1] || 'index.html').toLowerCase();
    } catch (e) {
      return 'index.html';
    }
  }

  function isTabEmbedded() {
    try {
      if (new URLSearchParams(global.location.search).get('tab_embed') === '1') return true;
    } catch (e0) {}
    try {
      var fe = global.frameElement;
      if (fe && fe.classList && fe.classList.contains('tab-shell-iframe')) return true;
    } catch (e1) {}
    /* iOS WKWebView 常拿不到 frameElement：用父页 data-tab-shell 兜底 */
    try {
      if (global.parent && global.parent !== global) {
        var pdoc = global.parent.document;
        if (pdoc && pdoc.documentElement.getAttribute('data-tab-shell') === '1') return true;
      }
    } catch (e2) {}
    return false;
  }

  function scrubIframeBottomNav(iframe) {
    if (!iframe || iframe.__tabEmbedScrubbing) return;
    iframe.__tabEmbedScrubbing = true;
    try {
      var doc = iframe.contentDocument;
      if (!doc) return;
      try {
        doc.documentElement.classList.add('tab-embed-mode');
      } catch (eCls) {}
      if (!doc.querySelector('style[data-tab-embed-host-scrub]')) {
        var st = doc.createElement('style');
        st.setAttribute('data-tab-embed-host-scrub', '1');
        st.textContent =
          'html.tab-embed-mode .bottom-nav,html.tab-embed-mode body > .bottom-nav,' +
          'html.tab-embed-mode body.page-shouye > .bottom-nav,html.tab-embed-mode body.page-daiban > .bottom-nav,' +
          'html.tab-embed-mode body.page-bancha > .bottom-nav,html.tab-embed-mode body.page-message > .bottom-nav,' +
          'html.tab-embed-mode body.page-mine > .bottom-nav,html.tab-embed-mode body .bottom-nav.ios-device,' +
          'html.app-ios-client.tab-embed-mode .bottom-nav,html.app-ios-iphone16pro.tab-embed-mode .bottom-nav,' +
          'html.app-ios-iphone16pro.tab-embed-mode body.page-daiban > .bottom-nav,' +
          'html.app-ios-iphone16pro.tab-embed-mode body.page-bancha > .bottom-nav,' +
          'html.app-ios-iphone16pro.tab-embed-mode body.page-message > .bottom-nav,' +
          'html.app-ios-iphone16pro.tab-embed-mode body.page-daiban > .bottom-nav.ios-device,' +
          'html.app-ios-iphone16pro.tab-embed-mode body.page-bancha > .bottom-nav.ios-device,' +
          'html.app-ios-iphone16pro.tab-embed-mode body.page-message > .bottom-nav.ios-device{' +
          'display:none!important;visibility:hidden!important;pointer-events:none!important;' +
          'height:0!important;min-height:0!important;max-height:0!important;opacity:0!important;z-index:-1!important;}';
        (doc.head || doc.documentElement).appendChild(st);
      }
      var nodes = doc.querySelectorAll('.bottom-nav');
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
      if (iframe.getAttribute('data-tab-embed-mo') !== '1') {
        iframe.setAttribute('data-tab-embed-mo', '1');
        try {
          if (doc.body && typeof MutationObserver !== 'undefined') {
            var mo = new MutationObserver(function () {
              scrubIframeBottomNav(iframe);
            });
            mo.observe(doc.body, { childList: true, subtree: true });
            global.setTimeout(function () {
              try {
                mo.disconnect();
              } catch (eD) {}
            }, 15000);
          }
        } catch (eMo) {}
      }
    } catch (e0) {
    } finally {
      iframe.__tabEmbedScrubbing = false;
    }
  }

  function scrubAllIframeBottomNavs() {
    Object.keys(iframes).forEach(function (k) {
      scrubIframeBottomNav(iframes[k]);
    });
  }

  function isShellDisabled() {
    try {
      if (new URLSearchParams(global.location.search).get('tab_shell') === '0') return true;
    } catch (e0) {}
    try {
      if (global.localStorage && global.localStorage.getItem('tax_tab_shell_off') === '1') return true;
    } catch (e1) {}
    return false;
  }

  function normalizeTabHref(href) {
    if (!href) return '';
    var s = String(href).trim();
    if (!s || s.charAt(0) === '#' || /^javascript:/i.test(s)) return '';
    try {
      var u = new URL(s, global.location.href);
      if (u.origin !== global.location.origin) return '';
      var name = (u.pathname.split('/').pop() || '').toLowerCase();
      if (!TAB_BY_FILE[name]) return '';
      return name;
    } catch (e) {
      return '';
    }
  }

  function injectStyles() {
    if (document.querySelector('style[data-tab-shell-css]')) return;
    var st = document.createElement('style');
    st.setAttribute('data-tab-shell-css', '1');
    st.textContent =
      'html[data-tab-shell="1"] .tab-shell-pane:not(.tab-shell-pane-active){display:none!important}' +
      'html[data-tab-shell="1"] #tab-shell-stage{display:none}' +
      'html[data-tab-shell="1"] #tab-shell-stage.tab-shell-stage-active{' +
      'display:block;position:fixed;top:0;left:0;right:0;bottom:var(--bottom-nav-clearance,70px);z-index:9000;background:#fff}' +
      'html[data-tab-shell-subpage="1"] .bottom-nav{display:none!important}' +
      'html[data-tab-shell-subpage="1"] #tab-shell-stage.tab-shell-stage-active{bottom:0!important}' +
      'html[data-tab-shell="1"] .tab-shell-iframe{width:100%;height:100%;border:0;display:block;background:#fff}' +
      'html.tab-embed-mode .bottom-nav,' +
      'html.tab-embed-mode body > .bottom-nav,' +
      'html.tab-embed-mode body.page-shouye > .bottom-nav,' +
      'html.tab-embed-mode body.page-daiban > .bottom-nav,' +
      'html.tab-embed-mode body.page-bancha > .bottom-nav,' +
      'html.tab-embed-mode body.page-message > .bottom-nav,' +
      'html.tab-embed-mode body.page-mine > .bottom-nav,' +
      'html.tab-embed-mode body .bottom-nav.ios-device{' +
      'display:none!important;visibility:hidden!important;pointer-events:none!important;}' +
      'html.tab-embed-mode body.has-bottom-nav,' +
      'html.tab-embed-mode body.page-daiban,' +
      'html.tab-embed-mode body.page-bancha,' +
      'html.tab-embed-mode body.page-message{' +
      '--bottom-nav-clearance:0px!important;padding-bottom:0!important}';
    document.head.appendChild(st);
  }

  function refreshNavIcons() {
    if (global.TaxAppNav && typeof global.TaxAppNav.hydrateBottomNavByKey === 'function') {
      global.TaxAppNav.hydrateBottomNavByKey(null, activeKey);
    } else if (global.TaxAppNav && typeof global.TaxAppNav.hydrateBottomNav === 'function') {
      global.TaxAppNav.hydrateBottomNav();
    }
    var navItems = document.querySelectorAll('.bottom-nav .nav-item');
    for (var i = 0; i < navItems.length; i++) {
      var item = navItems[i];
      var icon = item.getAttribute('data-icon');
      var img = item.querySelector('.nav-icon img');
      if (!img || !icon) continue;
      img.src = item.classList.contains('active')
        ? 'caidan/' + icon + '1.png'
        : 'caidan/' + icon + '2.png';
    }
    if (typeof global.__refreshNavFromMineUi === 'function') {
      global.__refreshNavFromMineUi();
    }
  }

  var nativeKey = '';
  var activeKey = '';
  var stageEl = null;
  var nativeEl = null;
  var iframes = Object.create(null);
  var switching = false;

  function iframePageFile(iframe) {
    if (!iframe) return '';
    try {
      var p = String(iframe.contentWindow.location.pathname || '');
      return (p.split('/').pop() || '').toLowerCase();
    } catch (e) {
      return '';
    }
  }

  function syncSubpageChrome() {
    var hideNav = false;
    if (stageEl && stageEl.classList.contains('tab-shell-stage-active')) {
      Object.keys(iframes).forEach(function (k) {
        var fr = iframes[k];
        if (!fr || fr.style.display === 'none') return;
        if (SUB_PAGE_FILES[iframePageFile(fr)]) hideNav = true;
      });
    }
    if (hideNav) {
      document.documentElement.setAttribute('data-tab-shell-subpage', '1');
    } else {
      document.documentElement.removeAttribute('data-tab-shell-subpage');
    }
  }

  function bindIframeNavWatch(iframe) {
    if (!iframe || iframe.getAttribute('data-tab-shell-watch') === '1') return;
    iframe.setAttribute('data-tab-shell-watch', '1');
    iframe.addEventListener('load', function () {
      scrubIframeBottomNav(iframe);
      syncSubpageChrome();
    });
  }

  function ensureIframe(key) {
    if (iframes[key]) return iframes[key];
    if (!stageEl) return null;
    var iframe = document.createElement('iframe');
    iframe.className = 'tab-shell-iframe';
    iframe.setAttribute('data-tab', key);
    iframe.setAttribute('title', FILE_BY_KEY[key] || key);
    iframe.setAttribute('loading', 'eager');
    iframe.src = FILE_BY_KEY[key] + '?tab_embed=1';
    iframe.style.display = 'none';
    stageEl.appendChild(iframe);
    bindIframeNavWatch(iframe);
    iframes[key] = iframe;
    return iframe;
  }

  function showPane(key) {
    if (key === nativeKey) {
      if (nativeEl) {
        nativeEl.classList.add('tab-shell-pane-active');
        nativeEl.hidden = false;
      }
      if (stageEl) {
        stageEl.classList.remove('tab-shell-stage-active');
        stageEl.hidden = true;
      }
      Object.keys(iframes).forEach(function (k) {
        if (iframes[k]) iframes[k].style.display = 'none';
      });
      return;
    }
    if (nativeEl) {
      nativeEl.classList.remove('tab-shell-pane-active');
      nativeEl.hidden = true;
    }
    if (stageEl) {
      stageEl.classList.add('tab-shell-stage-active');
      stageEl.hidden = false;
    }
    Object.keys(iframes).forEach(function (k) {
      if (!iframes[k]) return;
      iframes[k].style.display = k === key ? 'block' : 'none';
      if (k === key) scrubIframeBottomNav(iframes[k]);
    });
  }

  function switchTo(key, opts) {
    opts = opts || {};
    if (!key || !FILE_BY_KEY[key] || key === activeKey || switching) return false;
    switching = true;
    var prev = activeKey;
    if (key !== nativeKey) ensureIframe(key);
    showPane(key);
    activeKey = key;
    refreshNavIcons();
    if (!opts.fromHistory) {
      try {
        global.history.pushState({ tabShell: key }, '', FILE_BY_KEY[key]);
      } catch (e0) {}
    }
    try {
      if (typeof global.trackUserAction === 'function') {
        global.trackUserAction('track_tab_shell_switch', { tab: key, from: prev });
      }
    } catch (e1) {}
    switching = false;
    scrubAllIframeBottomNavs();
    syncSubpageChrome();
    return true;
  }

  function onNavClick(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var a = t.closest('.bottom-nav a.nav-item[href], a.nav-item[href]');
    if (!a || !a.closest('.bottom-nav')) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    var file = normalizeTabHref(a.getAttribute('href'));
    if (!file) return;
    var key = TAB_BY_FILE[file];
    if (!key) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    switchTo(key);
  }

  function wrapNativeContent() {
    var nav = document.querySelector('.bottom-nav');
    if (!nav || document.getElementById('tab-shell-native')) return false;

    nativeEl = document.createElement('div');
    nativeEl.id = 'tab-shell-native';
    nativeEl.className = 'tab-shell-pane tab-shell-pane-active';
    nativeEl.setAttribute('data-tab', nativeKey);

    stageEl = document.createElement('div');
    stageEl.id = 'tab-shell-stage';
    stageEl.className = 'tab-shell-stage';
    stageEl.hidden = true;

    var kids = Array.prototype.slice.call(document.body.children);
    for (var i = 0; i < kids.length; i++) {
      var node = kids[i];
      if (node === nav) continue;
      if (node.nodeType === 1 && node.tagName === 'SCRIPT') continue;
      nativeEl.appendChild(node);
    }

    document.body.insertBefore(nativeEl, nav);
    document.body.insertBefore(stageEl, nav);
    return true;
  }

  function isAndroidLike() {
    try {
      return /Android|HarmonyOS|OpenHarmony|ArkWeb|HMSCore|HUAWEI|Huawei/i.test(
        String(navigator.userAgent || '')
      );
    } catch (e0) {
      return false;
    }
  }

  function warmOtherTabs() {
    /* Android：预热更晚、间隔更大，避免与首屏解码/机型适配抢主线程 */
    var android = isAndroidLike();
    var baseDelay = android ? 2800 : 600;
    var step = android ? 900 : 500;
    Object.keys(FILE_BY_KEY).forEach(function (key, idx) {
      if (key === nativeKey) return;
      global.setTimeout(function () {
        ensureIframe(key);
      }, baseDelay + idx * step);
    });
  }

  function onPopState(ev) {
    var key = ev && ev.state && ev.state.tabShell ? ev.state.tabShell : '';
    if (!key || !FILE_BY_KEY[key]) {
      key = TAB_BY_FILE[currentPageFile()] || nativeKey;
    }
    if (key && key !== activeKey) switchTo(key, { fromHistory: true });
  }

  function bootShell() {
    var file = currentPageFile();
    if (!TAB_BY_FILE[file]) return;
    if (isTabEmbedded() || isShellDisabled()) return;

    nativeKey = TAB_BY_FILE[file];
    activeKey = nativeKey;
    injectStyles();
    document.documentElement.setAttribute('data-tab-shell', '1');

    if (!wrapNativeContent()) return;

    document.addEventListener('click', onNavClick, true);
    global.addEventListener('popstate', onPopState);
    global.addEventListener('message', function (ev) {
      var data = ev && ev.data;
      if (!data || data.type !== 'tab-shell-subpage') return;
      if (data.hide) {
        document.documentElement.setAttribute('data-tab-shell-subpage', '1');
      } else {
        document.documentElement.removeAttribute('data-tab-shell-subpage');
      }
    });

    try {
      global.history.replaceState({ tabShell: nativeKey }, '', global.location.href);
    } catch (e0) {}

    refreshNavIcons();

    global.setTimeout(warmOtherTabs, isAndroidLike() ? 2200 : 1200);
    /* iOS：切 Tab 后子页 auth 机型锁可能晚于 load 事件再钉底栏，宿主侧持续清 */
    var scrubTicks = 0;
    var scrubTimer = global.setInterval(function () {
      scrubTicks += 1;
      scrubAllIframeBottomNavs();
      if (scrubTicks >= 60) {
        try {
          global.clearInterval(scrubTimer);
        } catch (eClr) {}
      }
    }, 500);
  }

  global.TaxAppTabShell = {
    switchTo: switchTo,
    activeKey: function () {
      return activeKey;
    },
    nativeKey: function () {
      return nativeKey;
    },
    isHost: function () {
      return document.documentElement.getAttribute('data-tab-shell') === '1';
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootShell);
  } else {
    bootShell();
  }
})(window);
