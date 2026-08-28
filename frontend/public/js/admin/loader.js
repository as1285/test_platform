/**
 * 管理端脚本/厂商库懒加载（阶段 2）
 */
(function (global) {
  var loaded = Object.create(null);
  var inflight = Object.create(null);

  /* 空壳模块（仅 ready:true）已删除；PAGE_MODULE 仍映射以便按页拉 Chart/QR 等依赖 */
  var MODULE_SRC = {
    charts: '/js/admin/modules/charts.js?v=20260808-deadcode',
    'sbdy-demo': '/js/admin/modules/sbdy-demo.js?v=20260828-list-del',
    'gjj-demo': '/js/admin/modules/gjj-demo.js?v=20260826-deadcode',
    'lizhi-cert': '/js/admin/modules/lizhi-cert.js?v=20260810-lizhi-tpl',
    'zaizhi-cert': '/js/admin/modules/zaizhi-cert.js?v=20260815-zaizhi',
    'ylbx-ps': '/js/admin/modules/ylbx-ps.js?v=20260802-tool-ux',
    'ccb-flow': '/js/admin/modules/ccb-flow.js?v=20260826-expense-sum',
    'najilu-qr': '/js/admin/modules/najilu-qr.js?v=20260825-crop-pad',
    devices: '/js/admin/modules/devices.js?v=20260826-device-compat'
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
    'ylbx-ps': 'ylbx-ps',
    'ccb-flow': 'ccb-flow',
    'najilu-qr': 'najilu-qr',
    'admin-accounts': 'accounts',
    'downline-admins': 'accounts',
    users: 'users',
    'peer-accounts': 'users',
    'rename-tax-daily': 'users',
    'users-deleted': 'users',
    'user-data': 'user-data',
    'tax-records-edit': 'user-data',
    'login-log': 'logs',
    'user-login-log': 'logs',
    'server-monitor': 'monitor',
    'analytics-conversion': 'analytics',
    'analytics-activity': 'analytics',
    'analytics-register': 'analytics',
    'analytics-purchase': 'analytics',
    'analytics-tracking': 'analytics',
    'analytics-devices': 'devices',
    'install-guide-stats': 'analytics',
    'channel-analysis': 'analytics'
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
    return loadScript('/js/najilu.js?v=20260821-qr-smooth');
  }

  /** 个税批量工具：仅 tax-records-edit 页按需加载（~240KB）
   *  consult-core / consult-batch-tax 的 ?v= 必须与 C 端 consult.html 同步，否则管理端跑旧缓存逻辑 */
  function ensureTaxBatchScripts() {
    var scripts = [
      '/js/consult-core.js?v=20260828-multi-bonus',
      '/js/consult-batch-tax.js?v=20260828-multi-bonus',
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
    if (mod === 'analytics' || mod === 'users' || mod === 'user-data') {
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
