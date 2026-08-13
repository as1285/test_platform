/**
 * 侧栏由后端 menu_tree 渲染（阶段 2）
 */
(function (global) {
  var cachedTree = null;
  var selectedCommandIndex = 0;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setMenuTree(tree) {
    cachedTree = Array.isArray(tree) ? tree : [];
    if (isCommandOpen()) renderCommandResults();
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
      var hasActive = items.some(function (it) {
        return String(it.page || '') === activePage;
      });
      var collapsed = !hasActive;
      try {
        var saved = sessionStorage.getItem('admin_nav_' + gid);
        if (saved === '1') collapsed = false;
        if (saved === '0') collapsed = true;
        if (hasActive) collapsed = false;
      } catch (e0) {}
      html +=
        '<div class="nav-group' +
        (collapsed ? ' is-collapsed' : '') +
        '" data-nav-group="' +
        esc(gid) +
        '">';
      html +=
        '<button type="button" class="nav-group-label" aria-expanded="' +
        (collapsed ? 'false' : 'true') +
        '">' +
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
          '"' +
          (active ? ' aria-current="page"' : '') +
          '>' +
          esc(it.label || page) +
          '</button>';
      });
      html += '</div></div>';
    });
    navEl.innerHTML = html;
  }

  function goToPage(p) {
    p = String(p || '').replace(/^#/, '').trim();
    if (!p) return;
    if (typeof global.goAdminPage === 'function') {
      global.goAdminPage(p);
      return;
    }
    var cur = String(location.hash || '').replace(/^#/, '');
    if (cur === p && typeof global.applyAdminRoute === 'function') {
      global.applyAdminRoute({ force: true });
      return;
    }
    location.hash = p;
  }

  function bindNavClicks(navEl) {
    if (!navEl || navEl._adminNavBound) return;
    navEl._adminNavBound = true;
    navEl.addEventListener('click', function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest('.nav-item') : null;
      if (!btn || !navEl.contains(btn)) return;
      var p = btn.getAttribute('data-page');
      if (p) {
        goToPage(p);
        closeSidebar();
      }
    });
  }

  function flattenTree() {
    var out = [];
    getMenuTree().forEach(function (group) {
      (group.items || []).forEach(function (item) {
        out.push({
          page: String(item.page || ''),
          label: String(item.label || item.page || ''),
          group: String(group.label || ''),
          groupId: String(group.id || '')
        });
      });
    });
    return out;
  }

  function findPage(page) {
    var key = String(page || '').replace(/^#/, '');
    var list = flattenTree();
    for (var i = 0; i < list.length; i++) {
      if (list[i].page === key) return list[i];
    }
    return null;
  }

  function setActivePage(page) {
    var key = String(page || '').replace(/^#/, '');
    document.querySelectorAll('.nav-item').forEach(function (btn) {
      var active = btn.getAttribute('data-page') === key;
      btn.classList.toggle('active', active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
    var current = findPage(key);
    var groupLabel = document.getElementById('pageGroupLabel');
    if (groupLabel) groupLabel.textContent = current ? current.group : '管理后台';
    renderPageOutline(key);
  }

  function renderPageOutline(page) {
    /* 已下线：页内「本页」锚点条占用版面，且会把 hidden 区块算进导航 */
    document.querySelectorAll('.page-outline').forEach(function (el) {
      el.remove();
    });
    var panel = document.getElementById('page-' + page);
    if (!panel) return;
    var sections = Array.prototype.slice.call(panel.children).filter(function (el) {
      if (el.tagName !== 'SECTION' || !el.querySelector('h2')) return false;
      if (el.hidden || el.getAttribute('aria-hidden') === 'true') return false;
      if (el.hasAttribute('hidden')) return false;
      var style = window.getComputedStyle ? window.getComputedStyle(el) : null;
      if (style && style.display === 'none') return false;
      return true;
    });
    enhanceSectionDensity(page, sections);
  }

  function enhanceSectionDensity(page, sections) {
    /* 转化概览页不再自动折叠后续区块，避免支付 A/B 与注册转化率之间出现大块空白 */
    if (page !== 'analytics-conversion') return;
    (sections || []).forEach(function (section) {
      section.classList.remove('admin-section-collapsible', 'is-section-collapsed');
      section.removeAttribute('data-density-ready');
      var toggle = section.querySelector('.section-collapse-toggle');
      if (toggle && toggle.parentNode) toggle.parentNode.removeChild(toggle);
    });
  }

  function isCommandOpen() {
    var command = document.getElementById('adminCommand');
    return !!(command && !command.hidden);
  }

  function commandMatches(item, query) {
    if (!query) return true;
    var haystack = (item.label + ' ' + item.group + ' ' + item.page).toLowerCase();
    return query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every(function (word) {
        return haystack.indexOf(word) >= 0;
      });
  }

  function renderCommandResults() {
    var input = document.getElementById('adminCommandInput');
    var mount = document.getElementById('adminCommandResults');
    var empty = document.getElementById('adminCommandEmpty');
    if (!mount) return;
    var query = input ? input.value.trim() : '';
    var list = flattenTree().filter(function (item) {
      return commandMatches(item, query);
    });
    if (selectedCommandIndex >= list.length) selectedCommandIndex = Math.max(0, list.length - 1);
    var lastGroup = null;
    var html = '';
    list.forEach(function (item, index) {
      if (item.group !== lastGroup) {
        html += '<div class="admin-command-group">' + esc(item.group) + '</div>';
        lastGroup = item.group;
      }
      html +=
        '<button type="button" class="admin-command-item' +
        (index === selectedCommandIndex ? ' is-selected' : '') +
        '" data-command-page="' +
        esc(item.page) +
        '" data-command-index="' +
        index +
        '"><span>' +
        esc(item.label) +
        '</span><small>进入</small></button>';
    });
    mount.innerHTML = html;
    if (empty) empty.hidden = list.length > 0;
  }

  function openCommand() {
    var command = document.getElementById('adminCommand');
    var input = document.getElementById('adminCommandInput');
    if (!command || !input) return;
    selectedCommandIndex = 0;
    command.hidden = false;
    document.body.classList.add('admin-command-open');
    input.value = '';
    renderCommandResults();
    requestAnimationFrame(function () {
      input.focus();
    });
  }

  function closeCommand() {
    var command = document.getElementById('adminCommand');
    if (!command) return;
    command.hidden = true;
    document.body.classList.remove('admin-command-open');
  }

  function navigateCommandSelection() {
    var selected = document.querySelector('.admin-command-item.is-selected');
    if (!selected) return;
    var page = selected.getAttribute('data-command-page');
    closeCommand();
    if (page) goToPage(page);
  }

  function openSidebar() {
    document.body.classList.add('admin-sidebar-open');
    var toggle = document.getElementById('adminSidebarToggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    document.body.classList.remove('admin-sidebar-open');
    var toggle = document.getElementById('adminSidebarToggle');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  }

  function toggleSidebar() {
    if (global.matchMedia && global.matchMedia('(max-width: 900px)').matches) {
      if (document.body.classList.contains('admin-sidebar-open')) closeSidebar();
      else openSidebar();
      return;
    }
    var collapsed = document.body.classList.toggle('admin-sidebar-collapsed');
    var toggle = document.getElementById('adminSidebarToggle');
    if (toggle) toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    try {
      localStorage.setItem('admin_sidebar_collapsed', collapsed ? '1' : '0');
    } catch (e0) {}
  }

  function applyAdminIdentity(profile) {
    var el = document.getElementById('adminIdentity');
    if (!el || !profile) return;
    var text = String(profile.full_name || profile.username || '').trim();
    if (!text) return;
    el.textContent = text;
    el.title = text;
    el.hidden = false;
  }

  function initShell() {
    if (initShell.done) return;
    initShell.done = true;
    var sidebarToggle = document.getElementById('adminSidebarToggle');
    var sidebarClose = document.getElementById('adminSidebarClose');
    var sidebarBackdrop = document.getElementById('adminSidebarBackdrop');
    var searchButtons = [
      document.getElementById('adminNavSearchTrigger'),
      document.getElementById('adminTopSearchTrigger')
    ];
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);
    if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
    if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);
    searchButtons.forEach(function (btn) {
      if (btn) btn.addEventListener('click', openCommand);
    });
    try {
      if (
        global.matchMedia &&
        global.matchMedia('(min-width: 901px)').matches &&
        localStorage.getItem('admin_sidebar_collapsed') === '1'
      ) {
        document.body.classList.add('admin-sidebar-collapsed');
        if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
      } else if (sidebarToggle && global.matchMedia && global.matchMedia('(min-width: 901px)').matches) {
        sidebarToggle.setAttribute('aria-expanded', 'true');
      }
    } catch (e0) {}

    var command = document.getElementById('adminCommand');
    var input = document.getElementById('adminCommandInput');
    if (command) {
      command.addEventListener('click', function (ev) {
        var close = ev.target.closest('[data-command-close]');
        if (close) {
          closeCommand();
          return;
        }
        var item = ev.target.closest('[data-command-page]');
        if (!item) return;
        closeCommand();
        goToPage(item.getAttribute('data-command-page'));
      });
    }
    if (input) {
      input.addEventListener('input', function () {
        selectedCommandIndex = 0;
        renderCommandResults();
      });
      input.addEventListener('keydown', function (ev) {
        var items = document.querySelectorAll('.admin-command-item');
        if (ev.key === 'ArrowDown' && items.length) {
          ev.preventDefault();
          selectedCommandIndex = (selectedCommandIndex + 1) % items.length;
          renderCommandResults();
        } else if (ev.key === 'ArrowUp' && items.length) {
          ev.preventDefault();
          selectedCommandIndex = (selectedCommandIndex - 1 + items.length) % items.length;
          renderCommandResults();
        } else if (ev.key === 'Enter') {
          ev.preventDefault();
          navigateCommandSelection();
        }
      });
    }
    document.addEventListener('keydown', function (ev) {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
        ev.preventDefault();
        if (isCommandOpen()) closeCommand();
        else openCommand();
      } else if (ev.key === 'Escape') {
        if (isCommandOpen()) closeCommand();
        else closeSidebar();
      }
    });
  }

  global.AdminNav = {
    setMenuTree: setMenuTree,
    getMenuTree: getMenuTree,
    renderSidebar: renderSidebar,
    bindNavClicks: bindNavClicks,
    setActivePage: setActivePage,
    applyAdminIdentity: applyAdminIdentity,
    initShell: initShell,
    openCommand: openCommand
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShell);
  } else {
    initShell();
  }
})(window);
