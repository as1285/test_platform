(function () {
  'use strict';

  function isDefaultDaibanHeader(src) {
    var s = src ? String(src).trim() : '';
    if (!s) return true;
    return s === 'daiban.jpg' || /(^|\/)daiban\.jpg(\?|#|$)/i.test(s);
  }

  function applyHeaderMode() {
    var header = document.querySelector('.daiban-header');
    var builtin = document.getElementById('daibanHeaderBuiltin');
    var img = document.getElementById('assetDaibanHeader');
    if (!header || !img) return;

    var src = img.getAttribute('src') || '';
    var useCustom = !isDefaultDaibanHeader(src);

    if (useCustom) {
      header.setAttribute('data-header-mode', 'custom');
      img.hidden = false;
      img.style.removeProperty('display');
      if (builtin) builtin.style.display = 'none';
      return;
    }

    header.setAttribute('data-header-mode', 'builtin');
    img.hidden = true;
    img.removeAttribute('src');
    img.style.setProperty('display', 'none', 'important');
    img.style.setProperty('visibility', 'hidden', 'important');
    img.style.setProperty('height', '0', 'important');
    img.style.setProperty('margin', '0', 'important');
    if (builtin) builtin.style.display = '';
  }

  function initTabs() {
    var tabs = document.querySelectorAll('.daiban-tab');
    var panels = document.querySelectorAll('.daiban-panel');
    if (!tabs.length || !panels.length) return;

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var key = tab.getAttribute('data-tab');
        if (!key || tab.classList.contains('active')) return;

        tabs.forEach(function (t) {
          var active = t === tab;
          t.classList.toggle('active', active);
          t.setAttribute('aria-selected', active ? 'true' : 'false');
        });

        panels.forEach(function (panel) {
          panel.classList.toggle('active', panel.getAttribute('data-panel') === key);
        });
      });
    });
  }

  function boot() {
    applyHeaderMode();
    initTabs();
    window.addEventListener('mineUiConfig', function () {
      // theme-loader 可能先写入自定义/默认头图，随后再校正一次
      setTimeout(applyHeaderMode, 0);
    });
    // 覆盖 theme-loader 异步拉取后的结果
    setTimeout(applyHeaderMode, 50);
    setTimeout(applyHeaderMode, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
