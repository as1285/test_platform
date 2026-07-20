/**
 * C 端跳转加速：
 * - 底栏 / 常用链接触摸即预取 HTML（配合 nginx 短缓存）
 * - Chrome Speculation Rules 预渲染底栏页
 * - 预热关键 JS（已强缓存时几乎无成本）
 */
(function () {
  if (typeof document === 'undefined') return;
  if (document.documentElement.getAttribute('data-fast-nav') === '1') return;
  document.documentElement.setAttribute('data-fast-nav', '1');

  var TAB_PAGES = ['shouye.html', 'daiban.html', 'bancha.html', 'message.html', 'mine.html'];
  var WARM_JS = [
    '/js/auth.js?v=20260720-api-opt',
    '/js/page-loading.js?v=20260720-detail-speed',
    '/js/theme-loader.js?v=20260720-nav-speed',
    '/js/toast-duration.js?v=20260529-toast-3s'
  ];
  var warmed = Object.create(null);
  var linkPrefetched = Object.create(null);

  function currentPageName() {
    try {
      var p = String(window.location.pathname || '');
      var parts = p.split('/');
      return (parts[parts.length - 1] || 'index.html').toLowerCase();
    } catch (e) {
      return 'index.html';
    }
  }

  function normalizeHtmlHref(href) {
    if (!href) return '';
    var s = String(href).trim();
    if (!s || s.charAt(0) === '#' || /^javascript:/i.test(s) || /^(https?:)?\/\//i.test(s)) {
      return '';
    }
    if (/^(mailto:|tel:)/i.test(s)) return '';
    try {
      var u = new URL(s, window.location.href);
      if (u.origin !== window.location.origin) return '';
      var path = u.pathname || '';
      var name = path.split('/').pop() || '';
      if (!/\.html$/i.test(name)) return '';
      return name.toLowerCase() + (u.search || '') + (u.hash || '');
    } catch (e2) {
      return '';
    }
  }

  function pageFileOnly(normalized) {
    if (!normalized) return '';
    return String(normalized).split(/[?#]/)[0].toLowerCase();
  }

  function warmUrl(url) {
    if (!url || warmed[url]) return;
    warmed[url] = 1;
    try {
      fetch(url, {
        credentials: 'same-origin',
        cache: 'force-cache',
        priority: 'low'
      }).catch(function () {});
    } catch (e) {
      try {
        var img = new Image();
        img.src = url;
      } catch (e2) {}
    }
  }

  function prefetchDocument(href) {
    var norm = normalizeHtmlHref(href);
    var file = pageFileOnly(norm);
    if (!file || file === currentPageName()) return;
    if (linkPrefetched[file]) {
      warmUrl(file);
      return;
    }
    linkPrefetched[file] = 1;
    try {
      if (!document.querySelector('link[data-fast-nav-prefetch="' + file + '"]')) {
        var link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'document';
        link.href = file;
        link.setAttribute('data-fast-nav-prefetch', file);
        document.head.appendChild(link);
      }
    } catch (e) {}
    warmUrl(file);
  }

  function warmCriticalAssets() {
    WARM_JS.forEach(warmUrl);
    TAB_PAGES.forEach(function (p) {
      if (p !== currentPageName()) prefetchDocument(p);
    });
    var here = currentPageName();
    if (here === 'mine.html' || here === 'shouye.html') {
      prefetchDocument('consult.html?v=20260721a');
      prefetchDocument('purchase.html');
      prefetchDocument('chat.html');
    }
  }

  function installSpeculationRules() {
    if (!HTMLScriptElement.supports || !HTMLScriptElement.supports('speculationrules')) {
      return;
    }
    if (document.querySelector('script[data-fast-nav-speculation]')) return;
    var here = currentPageName();
    var urls = TAB_PAGES.filter(function (p) {
      return p !== here;
    });
    if (!urls.length) return;
    try {
      var s = document.createElement('script');
      s.type = 'speculationrules';
      s.setAttribute('data-fast-nav-speculation', '1');
      s.textContent = JSON.stringify({
        prefetch: [{ source: 'list', urls: urls, eagerness: 'eager' }],
        prerender: [{ source: 'list', urls: urls, eagerness: 'moderate' }]
      });
      document.head.appendChild(s);
    } catch (e) {}
  }

  function onIntent(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var a = t.closest('a[href]');
    if (!a) return;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    var href = a.getAttribute('href');
    var norm = normalizeHtmlHref(href);
    if (!norm) return;
    prefetchDocument(norm);
  }

  document.addEventListener('pointerdown', onIntent, true);
  document.addEventListener('touchstart', onIntent, { capture: true, passive: true });

  function start() {
    warmCriticalAssets();
    installSpeculationRules();
  }

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(start, { timeout: 800 });
  } else {
    setTimeout(start, 120);
  }
})();
