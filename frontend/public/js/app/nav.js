/**
 * TaxApp 底栏：激活态与 data-page 归一（阶段 3）
 */
(function (global) {
  var TAB_PAGES = {
    'shouye.html': 'shouye',
    'daiban.html': 'daiban',
    'bancha.html': 'bancha',
    'refund_ad.html': 'mine',
    'message.html': 'message',
    'mine.html': 'mine',
    'consult.html': 'mine'
  };

  function currentPageName() {
    var p = String(global.location && global.location.pathname ? global.location.pathname : '');
    var i = p.lastIndexOf('/');
    return (i >= 0 ? p.slice(i + 1) : p) || 'index.html';
  }

  function activeKey() {
    var name = currentPageName().toLowerCase();
    if (TAB_PAGES[name]) return TAB_PAGES[name];
    var body = document.body;
    if (body) {
      if (body.classList.contains('page-shouye')) return 'shouye';
      if (body.classList.contains('page-mine')) return 'mine';
      if (body.classList.contains('page-daiban')) return 'daiban';
      if (body.classList.contains('page-bancha')) return 'bancha';
      if (body.classList.contains('page-message')) return 'message';
      if (body.classList.contains('page-refund-ad')) return 'mine';
    }
    return '';
  }

  /** 根据当前页给 .bottom-nav .nav-item 打 active */
  function hydrateBottomNav(root) {
    var nav = root || document.querySelector('.bottom-nav');
    if (!nav) return;
    var key = activeKey();
    var items = nav.querySelectorAll('.nav-item');
    for (var i = 0; i < items.length; i++) {
      var a = items[i];
      var href = String(a.getAttribute('href') || '').split('?')[0].split('#')[0];
      var base = href.indexOf('/') >= 0 ? href.slice(href.lastIndexOf('/') + 1) : href;
      var itemKey = a.getAttribute('data-page') || TAB_PAGES[base.toLowerCase()] || '';
      var on = key && itemKey === key;
      if (on) a.classList.add('active');
      else a.classList.remove('active');
    }
  }

  global.TaxAppNav = {
    hydrateBottomNav: hydrateBottomNav,
    activeKey: activeKey,
    currentPageName: currentPageName
  };
})(window);
