/**
 * 管理端脚本/厂商库懒加载（阶段 2）
 */
(function (global) {
  var loaded = Object.create(null);
  var inflight = Object.create(null);

  /* 空壳模块（仅 ready:true）已删除；PAGE_MODULE 仍映射以便按页拉 Chart/QR 等依赖 */
  var MODULE_SRC = {
    charts: '/js/admin/modules/charts.js?v=20260910-ch-simple',
    'sbdy-demo': '/js/admin/modules/sbdy-demo.js?v=20260906-js-new-441',
    'gjj-demo': '/js/admin/modules/gjj-demo.js?v=20260826-deadcode',
    'lizhi-cert': '/js/admin/modules/lizhi-cert.js?v=20260828-cert-survey',
    'zaizhi-cert': '/js/admin/modules/zaizhi-cert.js?v=20260828-cert-survey',
    'ccb-flow': '/js/admin/modules/ccb-flow.js?v=20260826-expense-sum',
    'najilu-qr': '/js/admin/modules/najilu-qr.js?v=20260910-usage-users-collapse',
    devices: '/js/admin/modules/devices.js?v=20260910-reg-os',
    'tax-fill-survey': '/js/admin/modules/tax-fill-survey.js?v=20260901-tax-fill',
    'feature-survey': '/js/admin/modules/feature-survey.js?v=20260907-hub6',
    'payment-orders': '/js/admin/modules/payment-orders.js?v=20260907-hub6',
    feedback: '/js/admin/modules/feedback.js?v=20260910-fb-act',
    'ops-conversion': '/js/admin/modules/ops-conversion.js?v=20260910-ops-range',
    'ad-analytics': '/js/admin/modules/ad-analytics.js?v=20260907-hub6',
    'user-emails': '/js/admin/modules/user-emails.js?v=20260910-week-fill',
    'abc-ops': '/js/admin/modules/abc-ops.js?v=20260907-hub6'
  };

  var PAGE_MODULE = {
    settings: 'settings',
    'install-guide': 'settings',
    appearance: 'settings',
    codes: 'codes',
    'sbdy-demo': 'sbdy-demo',
    'gjj-demo': 'gjj-demo',
    'lizhi-cert': 'lizhi-cert',
    'zaizhi-cert': 'zaizhi-cert',
    'ccb-flow': 'ccb-flow',
    'najilu-qr': 'najilu-qr',
    'admin-accounts': 'accounts',
    'downline-admins': 'accounts',
    users: 'users',
    'rename-tax-daily': 'users',
    'users-deleted': 'users',
    'user-data': 'user-data',
    'tax-records-edit': 'user-data',
    'login-log': 'logs',
    'admin-operation-log': 'logs',
    'user-login-log': 'logs',
    'server-monitor': 'monitor',
    'ops-board': 'ops-conversion',
    'ops-inactive': 'ops-conversion',
    'ops-research': 'ops-conversion',
    'ops-lift': 'ops-conversion',
    'ops-ad-analytics': 'ad-analytics',
    'user-emails': 'user-emails',
    'analytics-conversion': 'analytics',
    'analytics-activity': 'analytics',
    'analytics-purchase': 'analytics',
    'analytics-devices': 'devices',
    'tax-fill-survey': 'tax-fill-survey',
    'feature-survey': 'feature-survey',
    'payment-orders': 'payment-orders',
    feedback: 'feedback',
    'install-guide-stats': 'analytics',
    'abc-ops': 'abc-ops',
    'abc-users': 'abc-ops',
    'abc-install-stats': 'abc-ops',
    'channel-analysis': 'analytics',
    'insights-product': 'analytics',
    'insights-growth': 'analytics'
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
    if (typeof global.QRCode !== 'undefined' && typeof global.QRCode.create === 'function') {
      return Promise.resolve();
    }
    if (typeof global.QRCode !== 'undefined' && typeof global.QRCode.toDataURL === 'function') {
      return Promise.resolve();
    }
    return loadScript('/js/vendor/qrcode.min.js');
  }

  function ensureNajilu() {
    if (global.Najilu || global.renderNajilu || document.querySelector('script[src*="najilu.js"]')) {
      return Promise.resolve();
    }
    return loadScript('/js/najilu.js?v=20260903-qr-wm');
  }

  /** 个税批量工具：仅 tax-records-edit 页按需加载（~240KB）
   *  consult-core / consult-batch-tax 的 ?v= 必须与 C 端 consult.html 同步，否则管理端跑旧缓存逻辑 */
  function ensureTaxBatchScripts() {
    var scripts = [
      '/js/consult-core.js?v=20260914-same-month',
      '/js/consult-batch-tax.js?v=20260914-same-month',
      '/js/admin-tax-batch-bridge.js?v=20260806-admin-tax-align'
    ];
    var chain = Promise.resolve();
    scripts.forEach(function (src) {
      chain = chain.then(function () {
        return loadScript(src);
      });
    });
    return chain;
  }

  function ensureModule(name) {
    var src = MODULE_SRC[name];
    if (!src) return Promise.resolve();
    return loadScript(src);
  }

  function ensureForPage(pageKey) {
    var mod = PAGE_MODULE[pageKey] || '';
    var chain = Promise.resolve();
    if (mod === 'analytics' || mod === 'users' || mod === 'user-data' || mod === 'abc-ops') {
      chain = chain.then(ensureChart).then(function () {
        return ensureModule('charts');
      });
    }
    if (mod === 'codes') {
      chain = chain.then(ensureQrcode);
    }
    if (mod === 'users' || mod === 'user-data' || mod === 'najilu-qr') {
      chain = chain.then(ensureQrcode).then(ensureNajilu);
    }
    if (pageKey === 'tax-records-edit') {
      chain = chain.then(ensureTaxBatchScripts);
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
    ensureTaxBatchScripts: ensureTaxBatchScripts,
    ensureModule: ensureModule,
    ensureForPage: ensureForPage,
    setPageModuleMap: setPageModuleMap,
    pageModule: function (page) {
      return PAGE_MODULE[page] || '';
    }
  };
})(window);
