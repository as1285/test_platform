/**
 * 纳税明细 / 登录注册：若在 tab-shell iframe 内打开，则提升到顶层，
 * 避免父页底栏仍停在「我的」而 iframe 已跳到首页。
 */
(function (global) {
  var ESCAPE_PAGE_RE = /^(shuiming|shuiming_result|xiangqing|login|register|face_login)\.html$/i;

  function currentFile() {
    try {
      var p = String(global.location.pathname || '');
      return (p.split('/').pop() || 'index.html').toLowerCase();
    } catch (e) {
      return 'index.html';
    }
  }

  function isTabShellIframe() {
    try {
      var fe = global.frameElement;
      if (fe && fe.classList && fe.classList.contains('tab-shell-iframe')) return true;
    } catch (e0) {}
    try {
      if (new URLSearchParams(global.location.search).get('tab_embed') === '1') return true;
    } catch (e1) {}
    try {
      if (global.parent && global.parent !== global) {
        var pdoc = global.parent.document;
        if (pdoc && pdoc.documentElement.getAttribute('data-tab-shell') === '1') return true;
      }
    } catch (e2) {}
    return false;
  }

  function assignTopLocation(url) {
    var dest = String(url || '');
    if (!dest) return;
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
    try {
      global.top.location.replace(global.location.href);
      return true;
    } catch (e2) {
      return false;
    }
  }

  global.assignTopLocation = assignTopLocation;

  if (!ESCAPE_PAGE_RE.test(currentFile())) return;
  notifyParentHide();
  escapeToTop();
})(window);
