/**
 * 全页加载 HUD：深灰方框 + 白色转圈。
 * - 进入业务页自动显示，数据/主题就绪后隐藏
 * - 点击站内页面链接切换前显示转圈
 */
(function () {
  var ROOT_ID = 'appPageLoadingRoot';
  var CSS_HREF = '/css/page-loading.css?v=20260521-consult-tab';
  var MIN_DISPLAY_MS = 280;
  var ABSOLUTE_MAX_MS = 12000;
  var count = 0;
  var queue = [];

  var SKIP_PAGES = {
    'index.html': true,
    'login.html': true,
    'register.html': true,
    'install_guide.html': true,
    'admin_login.html': true,
    'admin_panel.html': true
  };

  function currentPage() {
    var p = (window.location && window.location.pathname) || '';
    var parts = p.split('/');
    return parts[parts.length - 1] || 'index.html';
  }

  function isSkipPageLoading() {
    return !!SKIP_PAGES[currentPage()];
  }

  function ensureDom() {
    if (document.getElementById(ROOT_ID)) {
      return document.getElementById(ROOT_ID);
    }
    if (!document.querySelector('link[data-app-page-loading-css]')) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = CSS_HREF;
      link.setAttribute('data-app-page-loading-css', '1');
      document.head.appendChild(link);
    }
    var root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'app-page-loading';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="app-page-loading-box" role="status" aria-label="加载中">' +
      '<div class="app-page-loading-spinner"></div></div>';
    (document.body || document.documentElement).appendChild(root);
    return root;
  }

  function setVisible(visible) {
    var root = ensureDom();
    if (!root) {
      return;
    }
    if (visible) {
      root.classList.add('is-visible');
      root.setAttribute('aria-hidden', 'false');
    } else {
      root.classList.remove('is-visible');
      root.setAttribute('aria-hidden', 'true');
    }
  }

  function showPageLoading() {
    count += 1;
    setVisible(true);
  }

  function hidePageLoading() {
    count = Math.max(0, count - 1);
    if (count === 0) {
      setVisible(false);
    }
  }

  function forceHidePageLoading() {
    count = 0;
    setVisible(false);
  }

  function waitForImages(imgEls, done, timeoutMs) {
    var cb = typeof done === 'function' ? done : function () {};
    var timeout = typeof timeoutMs === 'number' ? timeoutMs : 10000;
    var imgs = (imgEls || []).filter(Boolean);
    if (!imgs.length) {
      cb();
      return;
    }
    var pending = 0;
    var finished = false;
    function finish() {
      if (finished) {
        return;
      }
      finished = true;
      cb();
    }
    imgs.forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) {
        return;
      }
      pending += 1;
      function onEnd() {
        pending -= 1;
        if (pending <= 0) {
          finish();
        }
      }
      img.addEventListener('load', onEnd, { once: true });
      img.addEventListener('error', onEnd, { once: true });
    });
    if (pending === 0) {
      finish();
      return;
    }
    setTimeout(finish, timeout);
  }

  function waitForElementImages(ids, done, timeoutMs) {
    var els = (ids || [])
      .map(function (id) {
        return document.getElementById(id);
      })
      .filter(Boolean);
    waitForImages(els, done, timeoutMs);
  }

  function drainQueue(list) {
    var item;
    var q = list || queue;
    while ((item = q.shift())) {
      if (item[0] === 'show') {
        showPageLoading();
      } else if (item[0] === 'hide') {
        hidePageLoading();
      } else if (item[0] === 'force') {
        forceHidePageLoading();
      }
    }
  }

  function dispatchLoadingEvent(name, doneFlag) {
    if (doneFlag) {
      window[doneFlag] = true;
    }
    try {
      window.dispatchEvent(new CustomEvent(name));
    } catch (e) {}
  }

  function normalizePagePath(pathname) {
    var p = String(pathname || '/');
    if (p.length > 1 && p.charAt(p.length - 1) === '/') {
      p = p.slice(0, -1);
    }
    return p.toLowerCase();
  }

  function isInternalNavHref(href) {
    href = String(href || '').trim();
    if (!href || href.charAt(0) === '#') {
      return false;
    }
    if (/^javascript:/i.test(href)) {
      return false;
    }
    if (/^(mailto:|tel:)/i.test(href)) {
      return false;
    }
    try {
      var u = new URL(href, window.location.href);
      if (u.origin !== window.location.origin) {
        return false;
      }
      /* 同 HTML 仅改 query/hash（如 consult 切换 TAB）不算页面跳转，避免转圈不消失 */
      if (normalizePagePath(u.pathname) === normalizePagePath(window.location.pathname)) {
        return false;
      }
      if (u.pathname === window.location.pathname && !u.search && u.hash) {
        return false;
      }
      var base = (u.pathname.split('/').pop() || '').toLowerCase();
      if (!base || base === '/') {
        return true;
      }
      if (/\.html$/i.test(base)) {
        return true;
      }
      return !/\.\w{2,5}$/i.test(base);
    } catch (e2) {
      return /\.html/i.test(href);
    }
  }

  function detectNavTargetFromClick(el) {
    if (!el) {
      return '';
    }
    if (el.tagName && el.tagName.toLowerCase() === 'a') {
      return String(el.getAttribute('href') || '').trim();
    }
    var oc = '';
    try {
      oc = String(el.getAttribute('onclick') || '');
    } catch (e) {}
    var m = oc.match(/(?:location\.href|location\.assign|window\.location)\s*=\s*['"]([^'"]+)['"]/i);
    if (m && m[1]) {
      return m[1];
    }
    m = oc.match(/(?:location\.href|location\.assign)\s*\(\s*['"]([^'"]+)['"]\s*\)/i);
    if (m && m[1]) {
      return m[1];
    }
    return '';
  }

  function bindNavigationClicks() {
    document.addEventListener(
      'click',
      function (ev) {
        if (isSkipPageLoading()) {
          return;
        }
        var t = ev.target;
        if (!t || !t.closest) {
          return;
        }
        var el = t.closest('a[href], button, [role="button"]');
        if (!el || ev.defaultPrevented) {
          return;
        }
        if (el.tagName && el.tagName.toLowerCase() === 'a') {
          if (el.target === '_blank' || el.hasAttribute('download')) {
            return;
          }
          var href = el.getAttribute('href');
          if (!isInternalNavHref(href)) {
            return;
          }
        } else {
          var jump = detectNavTargetFromClick(el);
          if (!isInternalNavHref(jump)) {
            return;
          }
        }
        showPageLoading();
      },
      true
    );
  }

  function hasScript(srcPart) {
    return !!document.querySelector('script[src*="' + srcPart + '"]');
  }

  function waitForEvent(name, timeoutMs, doneFlag) {
    if (doneFlag && window[doneFlag]) {
      return Promise.resolve();
    }
    return new Promise(function (resolve) {
      var settled = false;
      function finish() {
        if (settled) {
          return;
        }
        settled = true;
        resolve();
      }
      window.addEventListener(name, finish, { once: true });
      setTimeout(finish, timeoutMs || 10000);
    });
  }

  function startPageLifecycle() {
    if (isSkipPageLoading()) {
      return;
    }
    if (document.documentElement.getAttribute('data-app-page-loading-lifecycle') === '1') {
      return;
    }
    document.documentElement.setAttribute('data-app-page-loading-lifecycle', '1');

    bindNavigationClicks();
    showPageLoading();

    var startedAt = Date.now();
    var finished = false;

    function finishLoading() {
      if (finished) {
        return;
      }
      finished = true;
      var wait = Math.max(0, MIN_DISPLAY_MS - (Date.now() - startedAt));
      setTimeout(forceHidePageLoading, wait);
    }

    window.notifyPageLoadingDone = finishLoading;

    var waits = [];
    if (hasScript('theme-loader')) {
      waits.push(waitForEvent('appPageLoadingThemeDone', 12000, '__appPageLoadingThemeDone'));
    }
    if (currentPage() === 'consult.html') {
      waits.push(waitForEvent('appPageLoadingConsultDone', 20000, '__appPageLoadingConsultDone'));
    }
    if (document.body && document.body.classList.contains('page-shuiming-result')) {
      waits.push(waitForEvent('appPageLoadingDataDone', 20000, '__appPageLoadingDataDone'));
    }

    if (!waits.length) {
      if (document.readyState === 'complete') {
        finishLoading();
      } else {
        window.addEventListener('load', finishLoading, { once: true });
      }
      setTimeout(finishLoading, ABSOLUTE_MAX_MS);
      return;
    }

    Promise.all(waits)
      .then(finishLoading)
      .catch(finishLoading);
    setTimeout(finishLoading, ABSOLUTE_MAX_MS);
  }

  window.showPageLoading = showPageLoading;
  window.hidePageLoading = hidePageLoading;
  window.forceHidePageLoading = forceHidePageLoading;
  window.waitForPageImages = waitForImages;
  window.waitForPageElementImages = waitForElementImages;
  window.appPageLoadingDispatchThemeDone = function () {
    dispatchLoadingEvent('appPageLoadingThemeDone', '__appPageLoadingThemeDone');
  };
  window.appPageLoadingDispatchConsultDone = function () {
    dispatchLoadingEvent('appPageLoadingConsultDone', '__appPageLoadingConsultDone');
  };
  window.appPageLoadingDispatchDataDone = function () {
    dispatchLoadingEvent('appPageLoadingDataDone', '__appPageLoadingDataDone');
  };

  if (window.__pageLoadingQueue && window.__pageLoadingQueue.length) {
    drainQueue(window.__pageLoadingQueue);
    window.__pageLoadingQueue = [];
  }
  drainQueue();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startPageLifecycle);
  } else {
    startPageLifecycle();
  }

  window.addEventListener('pageshow', function (ev) {
    if (ev && ev.persisted) {
      forceHidePageLoading();
      document.documentElement.removeAttribute('data-app-page-loading-lifecycle');
      startPageLifecycle();
    }
  });
})();
