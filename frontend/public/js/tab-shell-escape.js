/**
 * 纳税明细等子页：若在 tab-shell iframe 内打开，则提升到顶层全屏，避免父页底栏 Tab 残留。
 */
(function (global) {
  var SUB_PAGE_RE = /^(shuiming|shuiming_result|xiangqing)\.html$/i;

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
      return !!(fe && fe.classList && fe.classList.contains('tab-shell-iframe'));
    } catch (e0) {
      return false;
    }
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

  if (!SUB_PAGE_RE.test(currentFile())) return;
  notifyParentHide();
  escapeToTop();
})(window);
