/**
 * 纳税明细 / 登录注册 / 开通页：若在 tab-shell iframe 内打开，则提升到顶层。
 * iOS WKWebView 常拿不到 frameElement，且从「我的」点进开通页后 URL 不再带 tab_embed，
 * 必须用 top!==self 判断；否则套餐 fetch 会挂起、定时器也被节流，骨架屏一直转。
 */
(function (global) {
  var ESCAPE_PAGE_RE = /^(shuiming|shuiming_result|xiangqing|login|register|face_login|purchase)\.html$/i;
  var ESCAPE_ONCE_Q = 'top_esc';

  function currentFile() {
    try {
      var p = String(global.location.pathname || '');
      return (p.split('/').pop() || 'index.html').toLowerCase();
    } catch (e) {
      return 'index.html';
    }
  }

  function isNestedWindow() {
    try {
      if (global.top && global.top !== global) return true;
    } catch (e0) {
      return true;
    }
    try {
      if (global.parent && global.parent !== global) return true;
    } catch (e1) {
      return true;
    }
    return false;
  }

  function hasTabEmbed() {
    try {
      return new URLSearchParams(global.location.search).get('tab_embed') === '1';
    } catch (e) {
      return false;
    }
  }

  function alreadyEscaped() {
    try {
      return new URLSearchParams(global.location.search).get(ESCAPE_ONCE_Q) === '1';
    } catch (e) {
      return false;
    }
  }

  function isTabShellIframe() {
    if (alreadyEscaped()) return false;
    if (isNestedWindow()) return true;
    if (hasTabEmbed()) return true;
    try {
      var fe = global.frameElement;
      if (fe && fe.classList && fe.classList.contains('tab-shell-iframe')) return true;
    } catch (e0) {}
    try {
      if (global.parent && global.parent !== global) {
        var pdoc = global.parent.document;
        if (pdoc && pdoc.documentElement.getAttribute('data-tab-shell') === '1') return true;
      }
    } catch (e2) {}
    return false;
  }

  function cleanEscapeDest() {
    try {
      var u = new URL(global.location.href);
      u.searchParams.delete('tab_embed');
      u.searchParams.set(ESCAPE_ONCE_Q, '1');
      return u.pathname + u.search + u.hash;
    } catch (e) {
      return String(global.location.pathname || currentFile());
    }
  }

  function assignTopLocation(url) {
    var dest = String(url || '');
    if (!dest) return;
    try {
      if (typeof global.appendSalesChannelToUrl === 'function') {
        dest = global.appendSalesChannelToUrl(dest);
      }
    } catch (eAppend) {}
    try {
      if (global.top && global.top !== global) {
        global.top.location.assign(dest);
        return;
      }
    } catch (e0) {}
    global.location.assign(dest);
  }

  function notifyParentHide() {
    try {
      if (global.parent && global.parent !== global) {
        global.parent.postMessage(
          { type: 'tab-shell-subpage', hide: true, page: currentFile() },
          '*'
        );
      }
    } catch (e1) {}
  }

  function escapeToTop() {
    if (!isTabShellIframe()) return false;
    var dest = cleanEscapeDest();
    if (!isNestedWindow() && hasTabEmbed()) {
      try {
        global.history.replaceState({}, '', dest.replace(/([?&])top_esc=1&?/, '$1').replace(/[?&]$/, ''));
      } catch (eStrip) {}
      return false;
    }
    try {
      if (global.top && global.top !== global) {
        global.top.location.replace(dest);
        return true;
      }
    } catch (e2) {}
    try {
      global.location.replace(dest);
      return true;
    } catch (e3) {
      return false;
    }
  }

  global.assignTopLocation = assignTopLocation;

  if (!ESCAPE_PAGE_RE.test(currentFile())) return;
  if (alreadyEscaped() && !isNestedWindow()) {
    try {
      var cleaned = new URL(global.location.href);
      cleaned.searchParams.delete(ESCAPE_ONCE_Q);
      global.history.replaceState({}, '', cleaned.pathname + cleaned.search + cleaned.hash);
    } catch (eClean) {}
    return;
  }
  notifyParentHide();
  escapeToTop();
})(window);
