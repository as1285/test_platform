/**
 * 站点对外域名配置（多机共用同一套代码）。
 * - 默认 publicOrigin 为空：优先使用 window.location.origin
 * - 部署时 scripts/render-site-config.sh 写入 deploy/runtime/site-config.js 并挂载覆盖
 * - 请勿把某台机器的域名提交进本文件
 */
window.__SITE_CONFIG__ = window.__SITE_CONFIG__ || {
  publicOrigin: '',
  trustedHosts: []
};

(function (g) {
  function trimSlash(s) {
    return String(s == null ? '' : s).replace(/\/+$/, '');
  }

  function configuredOrigin() {
    var cfg = g.__SITE_CONFIG__ || {};
    return trimSlash(cfg.publicOrigin || '');
  }

  function sitePublicOrigin() {
    var configured = configuredOrigin();
    try {
      var origin = String((g.location && g.location.origin) || '');
      var isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
      var isIp = /^https?:\/\/\d{1,3}(\.\d{1,3}){3}(:\d+)?$/i.test(origin);
      if (origin && !isLocal) {
        if (isIp && configured) {
          return configured;
        }
        return origin;
      }
      if (configured) {
        return configured;
      }
      if (origin) {
        return origin;
      }
    } catch (e0) {}
    return configured;
  }

  function siteIsTrustedHost(hostname) {
    var h = String(hostname || '').toLowerCase();
    if (!h) {
      return false;
    }
    if (h === 'localhost' || h === '127.0.0.1') {
      return true;
    }
    try {
      if (h === String((g.location && g.location.hostname) || '').toLowerCase()) {
        return true;
      }
    } catch (e1) {}
    var cfg = g.__SITE_CONFIG__ || {};
    var list = Array.isArray(cfg.trustedHosts) ? cfg.trustedHosts : [];
    var i;
    for (i = 0; i < list.length; i++) {
      if (String(list[i] || '').toLowerCase() === h) {
        return true;
      }
    }
    try {
      var origin = configuredOrigin();
      if (origin) {
        var u = new URL(origin);
        var oh = String(u.hostname || '').toLowerCase();
        if (h === oh || h === 'www.' + oh || ('www.' + h) === oh) {
          return true;
        }
      }
    } catch (e2) {}
    return false;
  }

  g.sitePublicOrigin = sitePublicOrigin;
  g.siteIsTrustedHost = siteIsTrustedHost;
})(window);
