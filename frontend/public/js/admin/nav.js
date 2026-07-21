/**
 * 侧栏由后端 menu_tree 渲染（阶段 2）
 */
(function (global) {
  var cachedTree = null;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setMenuTree(tree) {
    cachedTree = Array.isArray(tree) ? tree : [];
  }

  function getMenuTree() {
    return cachedTree || [];
  }

  function renderSidebar(navEl, tree, activePage) {
    if (!navEl) return;
    var groups = Array.isArray(tree) ? tree : [];
    var html = '';
    groups.forEach(function (g) {
      var items = Array.isArray(g.items) ? g.items : [];
      if (!items.length) return;
      var gid = String(g.id || 'g');
      html += '<div class="nav-group" data-nav-group="' + esc(gid) + '">';
      html +=
        '<button type="button" class="nav-group-label" aria-expanded="true">' +
        esc(g.label || gid) +
        '</button>';
      html += '<div class="nav-group-items">';
      items.forEach(function (it) {
        var page = String(it.page || '');
        var active = page === activePage ? ' active' : '';
        html +=
          '<button type="button" class="nav-item' +
          active +
          '" data-page="' +
          esc(page) +
          '" data-title="' +
          esc(it.label || page) +
          '" data-module="' +
          esc(it.module || '') +
          '">' +
          esc(it.label || page) +
          '</button>';
      });
      html += '</div></div>';
    });
    navEl.innerHTML = html;
  }

  function bindNavClicks(navEl) {
    if (!navEl || navEl._adminNavBound) return;
    navEl._adminNavBound = true;
    navEl.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('.nav-item') : null;
      if (!btn || !navEl.contains(btn)) return;
      var p = btn.getAttribute('data-page');
      if (p) location.hash = p;
    });
  }

  global.AdminNav = {
    setMenuTree: setMenuTree,
    getMenuTree: getMenuTree,
    renderSidebar: renderSidebar,
    bindNavClicks: bindNavClicks
  };
})(window);
