/**
 * 浏览器打开登录页 / 我的页时，引导用户安装 APP。
 * Cordova 壳内、iOS 设备上不展示。
 */
(function () {
  var INSTALL_PAGE = 'install_guide.html';
  var SESSION_DISMISS_KEY = 'browser_install_prompt_dismissed';
  var TARGET_PAGES = { 'index.html': true, 'mine.html': true };

  function currentPageName() {
    var p = window.location.pathname || '';
    var i = p.lastIndexOf('/');
    var name = (i >= 0 ? p.slice(i + 1) : p) || '';
    return name || 'index.html';
  }

  function isInAppShell() {
    if (typeof window.isCordovaTaxAppShell === 'function' && window.isCordovaTaxAppShell()) {
      return true;
    }
    try {
      if (window.CLIENT_APP_VERSION != null && String(window.CLIENT_APP_VERSION).trim() !== '') {
        return true;
      }
    } catch (e) {}
    return false;
  }

  /** iPhone / iPad / iPod 及 iPadOS 桌面模式 */
  function isLikelyIOSClient() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) {
      return true;
    }
    try {
      if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  function wasDismissedThisSession() {
    try {
      return sessionStorage.getItem(SESSION_DISMISS_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markDismissed() {
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, '1');
    } catch (e) {}
  }

  function shouldShowPrompt() {
    if (!TARGET_PAGES[currentPageName()]) {
      return false;
    }
    if (isInAppShell()) {
      return false;
    }
    if (isLikelyIOSClient()) {
      return false;
    }
    if (wasDismissedThisSession()) {
      return false;
    }
    return true;
  }

  function trackPrompt(action) {
    var page = currentPageName();
    var meta = { page: page, surface: 'browser_install_prompt' };
    try {
      if (typeof window.trackUserAction === 'function' && typeof window.authGetToken === 'function' && window.authGetToken()) {
        window.trackUserAction(action, meta);
        return;
      }
      if (typeof window.trackPublicAction === 'function') {
        window.trackPublicAction(action, meta);
      }
    } catch (e) {}
  }

  function injectStyles() {
    if (document.getElementById('browser-install-prompt-style')) {
      return;
    }
    var style = document.createElement('style');
    style.id = 'browser-install-prompt-style';
    style.textContent =
      '.browser-install-prompt-root{position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;}' +
      '.browser-install-prompt-mask{position:absolute;inset:0;background:rgba(0,0,0,.45);}' +
      '.browser-install-prompt-panel{position:relative;width:100%;max-width:320px;background:#fff;border-radius:12px;padding:20px 16px 14px;box-shadow:0 8px 28px rgba(0,0,0,.18);}' +
      '.browser-install-prompt-title{font-size:17px;font-weight:600;color:#333;margin:0 0 10px;line-height:1.35;}' +
      '.browser-install-prompt-msg{font-size:14px;color:#666;line-height:1.55;margin:0 0 16px;}' +
      '.browser-install-prompt-actions{display:flex;gap:10px;justify-content:flex-end;}' +
      '.browser-install-prompt-btn{min-width:72px;padding:9px 14px;border-radius:8px;font-size:15px;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent;}' +
      '.browser-install-prompt-btn-cancel{background:#f0f0f0;color:#666;}' +
      '.browser-install-prompt-btn-ok{background:#1e6fff;color:#fff;}';
    document.head.appendChild(style);
  }

  function showPrompt() {
    injectStyles();
    var root = document.createElement('div');
    root.className = 'browser-install-prompt-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML =
      '<div class="browser-install-prompt-mask" data-action="cancel"></div>' +
      '<div class="browser-install-prompt-panel">' +
      '<p class="browser-install-prompt-title">建议安装 APP</p>' +
      '<p class="browser-install-prompt-msg">您正在使用浏览器访问。下载并安装官方 APP 可获得更完整的功能与更流畅的使用体验。</p>' +
      '<div class="browser-install-prompt-actions">' +
      '<button type="button" class="browser-install-prompt-btn browser-install-prompt-btn-cancel" data-action="cancel" data-no-track="1">取消</button>' +
      '<button type="button" class="browser-install-prompt-btn browser-install-prompt-btn-ok" data-action="ok" data-no-track="1">确定</button>' +
      '</div></div>';
    document.body.appendChild(root);

    function closePrompt() {
      if (root.parentNode) {
        root.parentNode.removeChild(root);
      }
    }

    root.addEventListener('click', function (e) {
      var el = e.target.closest('[data-action]');
      if (!el) {
        return;
      }
      var action = el.getAttribute('data-action');
      if (action === 'ok') {
        trackPrompt('track_browser_install_prompt_ok');
        closePrompt();
        window.location.href = INSTALL_PAGE;
        return;
      }
      if (action === 'cancel') {
        trackPrompt('track_browser_install_prompt_cancel');
        markDismissed();
        closePrompt();
      }
    });

    trackPrompt('track_browser_install_prompt_show');
  }

  function init() {
    if (!shouldShowPrompt()) {
      return;
    }
    showPrompt();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
