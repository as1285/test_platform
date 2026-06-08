/**
 * 微信内置浏览器内打开下载相关页面时，弹框提示用系统浏览器打开后再下载。
 */
(function () {
  var STYLE_ID = 'wechat-open-browser-prompt-style';
  var ROOT_ID = 'wechat-open-browser-prompt-root';

  function isWeChatBrowser() {
    return /MicroMessenger/i.test(navigator.userAgent || '');
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

  function shouldShowPrompt() {
    if (!isWeChatBrowser()) {
      return false;
    }
    if (isInAppShell()) {
      return false;
    }
    return true;
  }

  function trackPrompt(action) {
    try {
      if (typeof window.trackPublicAction === 'function') {
        window.trackPublicAction(action, {
          page: 'install_guide',
          surface: 'wechat_open_browser_prompt'
        });
      }
    } catch (e) {}
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent =
      '.wechat-open-browser-root{position:fixed;inset:0;z-index:10060;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;}' +
      '.wechat-open-browser-mask{position:absolute;inset:0;background:rgba(0,0,0,.55);}' +
      '.wechat-open-browser-arrow{position:absolute;top:8px;right:18px;width:72px;height:72px;opacity:.95;pointer-events:none;}' +
      '.wechat-open-browser-arrow svg{display:block;width:100%;height:100%;}' +
      '.wechat-open-browser-panel{position:relative;width:100%;max-width:320px;background:#fff;border-radius:12px;padding:20px 16px 14px;box-shadow:0 8px 28px rgba(0,0,0,.2);}' +
      '.wechat-open-browser-title{font-size:17px;font-weight:600;color:#333;margin:0 0 10px;line-height:1.35;}' +
      '.wechat-open-browser-msg{font-size:14px;color:#666;line-height:1.6;margin:0 0 16px;}' +
      '.wechat-open-browser-msg strong{color:#1e6fff;font-weight:600;}' +
      '.wechat-open-browser-actions{display:flex;justify-content:center;}' +
      '.wechat-open-browser-btn{min-width:120px;padding:10px 18px;border-radius:8px;font-size:15px;border:none;cursor:pointer;background:#1e6fff;color:#fff;-webkit-tap-highlight-color:transparent;}';
    document.head.appendChild(style);
  }

  function showPrompt() {
    if (document.getElementById(ROOT_ID)) {
      return;
    }
    injectStyles();
    var root = document.createElement('div');
    root.id = ROOT_ID;
    root.className = 'wechat-open-browser-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'wechat-open-browser-title');
    root.innerHTML =
      '<div class="wechat-open-browser-mask"></div>' +
      '<div class="wechat-open-browser-arrow" aria-hidden="true">' +
      '<svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M8 8 L58 8 L58 20" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M58 8 L42 24" stroke="#fff" stroke-width="3" stroke-linecap="round"/>' +
      '</svg></div>' +
      '<div class="wechat-open-browser-panel">' +
      '<p class="wechat-open-browser-title" id="wechat-open-browser-title">请用系统浏览器打开</p>' +
      '<p class="wechat-open-browser-msg">微信内<strong>无法直接下载</strong>安装包。请点击右上角「<strong>···</strong>」，选择「<strong>在浏览器中打开</strong>」后再下载。</p>' +
      '<div class="wechat-open-browser-actions">' +
      '<button type="button" class="wechat-open-browser-btn" data-action="ok">我知道了</button>' +
      '</div></div>';
    document.body.appendChild(root);

    function closePrompt() {
      if (root.parentNode) {
        root.parentNode.removeChild(root);
      }
    }

    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action="ok"]');
      if (!btn) {
        return;
      }
      trackPrompt('track_wechat_open_browser_prompt_ok');
      closePrompt();
    });

    trackPrompt('track_wechat_open_browser_prompt_show');
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
