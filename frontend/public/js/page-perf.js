/**
 * C 端页面加载性能埋点：Navigation Timing + FCP，上报 track_page_load_perf。
 * 依赖 auth.js 提供的 trackUserAction / trackPublicAction（异步加载时会重试）。
 */
(function (global) {
  if (global.__pagePerfBoot) {
    return;
  }
  global.__pagePerfBoot = 1;

  function pageName() {
    try {
      if (typeof global.currentPageName === 'function') {
        return global.currentPageName();
      }
      var p = String(global.location.pathname || '').split('/').pop();
      return p || 'index.html';
    } catch (e) {
      return 'unknown';
    }
  }

  function skipPage() {
    var n = pageName();
    return n === 'admin_panel.html' || n === 'admin_login.html';
  }

  function roundMs(n) {
    n = Number(n);
    if (!isFinite(n) || n < 0 || n > 120000) {
      return null;
    }
    return Math.round(n);
  }

  function collectMetrics(trigger) {
    var out = { page: pageName(), trigger: trigger || 'load' };
    try {
      var nav = performance.getEntriesByType('navigation')[0];
      if (nav && nav.startTime >= 0) {
        if (nav.domContentLoadedEventEnd > 0) {
          out.dom_ready_ms = roundMs(nav.domContentLoadedEventEnd - nav.startTime);
        }
        if (nav.loadEventEnd > 0) {
          out.load_ms = roundMs(nav.loadEventEnd - nav.startTime);
        }
        if (nav.responseStart >= 0 && nav.requestStart >= 0) {
          out.ttfb_ms = roundMs(nav.responseStart - nav.requestStart);
        }
      } else if (performance.timing) {
        var t = performance.timing;
        if (t.navigationStart && t.domContentLoadedEventEnd) {
          out.dom_ready_ms = roundMs(t.domContentLoadedEventEnd - t.navigationStart);
        }
        if (t.navigationStart && t.loadEventEnd) {
          out.load_ms = roundMs(t.loadEventEnd - t.navigationStart);
        }
      }
    } catch (eNav) {}
    try {
      var paints = performance.getEntriesByType('paint');
      for (var i = 0; i < paints.length; i++) {
        if (paints[i].name === 'first-contentful-paint') {
          out.fcp_ms = roundMs(paints[i].startTime);
          break;
        }
      }
    } catch (ePaint) {}
    try {
      var ua = String(navigator.userAgent || '');
      var model = '';
      try {
        model = String(localStorage.getItem('tax_device_model_v1') || '').trim();
      } catch (eModel) {}
      out.platform = /Android|HarmonyOS|OpenHarmony|ArkWeb/i.test(ua)
        ? 'android'
        : /iPhone|iPad|iPod/i.test(ua)
          ? 'ios'
          : 'other';
      out.cordova =
        typeof global.cordova !== 'undefined' || /Cordova|taxapp|WebView/i.test(ua) ? 1 : 0;
      if (model) {
        out.device_model = model.substring(0, 48);
      }
      out.vw = Math.round(global.innerWidth || 0);
      out.dpr = Math.round((global.devicePixelRatio || 1) * 10) / 10;
    } catch (eMeta) {}
    if (out.dom_ready_ms == null && out.load_ms == null && out.fcp_ms == null) {
      return null;
    }
    return out;
  }

  function canTrack() {
    return (
      (typeof global.trackUserAction === 'function' &&
        typeof global.authGetToken === 'function' &&
        global.authGetToken()) ||
      typeof global.trackPublicAction === 'function'
    );
  }

  function dispatch(meta) {
    if (
      typeof global.trackUserAction === 'function' &&
      typeof global.authGetToken === 'function' &&
      global.authGetToken()
    ) {
      global.trackUserAction('track_page_load_perf', meta);
      return true;
    }
    if (typeof global.trackPublicAction === 'function') {
      global.trackPublicAction('track_page_load_perf', meta);
      return true;
    }
    return false;
  }

  var sendTries = 0;

  function sendPerf(trigger) {
    if (global.__pageLoadPerfSent || skipPage()) {
      return;
    }
    var meta = collectMetrics(trigger);
    if (!meta) {
      return;
    }
    if (!canTrack()) {
      sendTries += 1;
      if (sendTries < 48) {
        setTimeout(function () {
          sendPerf(trigger);
        }, 250);
      }
      return;
    }
    global.__pageLoadPerfSent = true;
    dispatch(meta);
  }

  function schedule() {
    if (skipPage()) {
      return;
    }
    global.addEventListener('load', function () {
      sendPerf('load');
    }, { once: true });
    /* 底栏切 Tab 常等不到 load：DOM 就绪或离开页时也上报 */
    if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        function () {
          sendPerf('domcontentloaded');
        },
        { once: true }
      );
    } else {
      setTimeout(function () {
        sendPerf('domcontentloaded');
      }, 0);
    }
    global.addEventListener(
      'pagehide',
      function () {
        sendPerf('pagehide');
      },
      { once: true }
    );
    global.addEventListener('pageshow', function (ev) {
      if (ev && ev.persisted) {
        global.__pageLoadPerfSent = false;
        sendPerf('bfcache');
      }
    });
    setTimeout(function () {
      sendPerf('timeout');
    }, 12000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }
})(typeof window !== 'undefined' ? window : this);
