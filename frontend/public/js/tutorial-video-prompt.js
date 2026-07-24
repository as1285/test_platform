/**
 * 操作教程视频引导弹窗：登录页首次进入（登录成功后引导已下线）。
 */
(function () {
  var TUTORIAL_PAGE = 'tutorial_video.html';
  var LOGIN_PROMPT_KEY = 'tax_tutorial_login_prompt_v1';
  var LEGACY_LOGIN_WELCOME_KEY = 'tax_login_welcome_v1';

  function injectStyles() {
    if (document.getElementById('tutorial-video-prompt-style')) {
      return;
    }
    var style = document.createElement('style');
    style.id = 'tutorial-video-prompt-style';
    style.textContent =
      '.tutorial-video-prompt-root{position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;z-index:10000;overflow:hidden}' +
      '.tutorial-video-prompt-mask{position:absolute;top:0;left:0;right:0;bottom:0;width:100%;height:100%;background:rgba(0,0,0,.45)}' +
      '.tutorial-video-prompt-panel{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);-webkit-transform:translate(-50%,-50%);z-index:1;width:calc(100% - 48px);max-width:320px;background:#fff;border-radius:12px;padding:22px 20px 18px;box-shadow:0 8px 32px rgba(0,0,0,.12)}' +
      '.tutorial-video-prompt-title{font-size:17px;font-weight:600;color:#333;text-align:center;margin-bottom:14px}' +
      '.tutorial-video-prompt-body{font-size:15px;line-height:1.65;color:#444;text-align:center}' +
      '.tutorial-video-prompt-actions{display:flex;flex-direction:column;gap:10px;margin-top:20px}' +
      '.tutorial-video-prompt-btn{display:block;width:100%;height:44px;border:none;border-radius:8px;font-size:16px;-webkit-tap-highlight-color:transparent}' +
      '.tutorial-video-prompt-btn.primary{background:#1e6fff;color:#fff}' +
      '.tutorial-video-prompt-btn.secondary{background:#f5f6fa;color:#666}';
    document.head.appendChild(style);
  }

  function track(eventName, payload) {
    if (typeof window.trackPublicAction === 'function') {
      window.trackPublicAction(eventName, payload || {});
      return;
    }
    if (typeof window.trackUserAction === 'function') {
      window.trackUserAction(eventName, payload || {});
    }
  }

  function markLoginPromptSeen() {
    try {
      localStorage.setItem(LOGIN_PROMPT_KEY, '1');
    } catch (e) {}
  }

  function hasSeenLoginPrompt() {
    try {
      if (localStorage.getItem(LOGIN_PROMPT_KEY) === '1') {
        return true;
      }
      if (localStorage.getItem(LEGACY_LOGIN_WELCOME_KEY) === '1') {
        return true;
      }
    } catch (e) {}
    return false;
  }

  function currentPageName() {
    var p = window.location.pathname || '';
    var i = p.lastIndexOf('/');
    return (i >= 0 ? p.slice(i + 1) : p) || 'index.html';
  }

  function isNeedActivateMode() {
    try {
      return new URLSearchParams(window.location.search).get('need_activate') === '1';
    } catch (e) {
      return false;
    }
  }

  function showPrompt(options) {
    injectStyles();
    var title = options.title || '温馨提示';
    var body = options.body || '';
    var source = options.source || 'unknown';

    var root = document.createElement('div');
    root.className = 'tutorial-video-prompt-root';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.innerHTML =
      '<div class="tutorial-video-prompt-mask" data-action="dismiss"></div>' +
      '<div class="tutorial-video-prompt-panel">' +
      '<p class="tutorial-video-prompt-title">' + title + '</p>' +
      '<p class="tutorial-video-prompt-body">' + body + '</p>' +
      '<div class="tutorial-video-prompt-actions">' +
      '<button type="button" class="tutorial-video-prompt-btn primary" data-action="watch">观看操作教程</button>' +
      '<button type="button" class="tutorial-video-prompt-btn secondary" data-action="dismiss">' +
      (options.dismissLabel || '我知道了') +
      '</button></div></div>';
    document.body.appendChild(root);
    var prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function closePrompt() {
      document.body.style.overflow = prevBodyOverflow;
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
      if (action === 'watch') {
        track('track_tutorial_prompt_watch_click', { source: source, page: currentPageName() });
        if (typeof options.onDismiss === 'function') {
          options.onDismiss();
        }
        closePrompt();
        window.location.href = TUTORIAL_PAGE;
        return;
      }
      if (action === 'dismiss') {
        track('track_tutorial_prompt_dismiss', { source: source, page: currentPageName() });
        if (typeof options.onDismiss === 'function') {
          options.onDismiss();
        }
        closePrompt();
      }
    });

    track('track_tutorial_prompt_show', { source: source, page: currentPageName() });
  }

  function maybeShowLoginPagePrompt() {
    if (currentPageName() !== 'index.html' && currentPageName() !== 'login.html') {
      return;
    }
    if (isNeedActivateMode()) {
      return;
    }
    if (hasSeenLoginPrompt()) {
      return;
    }
    showPrompt({
      source: 'login_page',
      title: '温馨提示',
      body: '欢迎使用中。建议先观看操作教程，了解如何注册登录与修改数据。',
      dismissLabel: '我知道了',
      onDismiss: markLoginPromptSeen
    });
  }

  window.TutorialVideoPrompt = {
    TUTORIAL_PAGE: TUTORIAL_PAGE,
    maybeShowLoginPagePrompt: maybeShowLoginPagePrompt
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', maybeShowLoginPagePrompt);
  } else {
    maybeShowLoginPagePrompt();
  }
})();
