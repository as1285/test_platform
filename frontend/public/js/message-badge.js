/**
 * 底部导航「消息」未读角标（由 auth.js 动态注入）。
 * 依赖 authFetch 拉未读数；无底栏或接口失败时静默。
 */
(function () {
  'use strict';

  // === DOM：定位消息 Tab / 渲染角标 ===
  function findMsgNavItem() {
    return document.querySelector(
      '.bottom-nav .nav-item[href="message.html"], .bottom-nav a[href="message.html"]'
    );
  }

  function renderBadge(count) {
    var item = findMsgNavItem();
    if (!item) return;
    var badge = item.querySelector('.nav-unread-badge');
    var n = Number(count) || 0;
    if (n <= 0) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'nav-unread-badge';
      badge.setAttribute('aria-label', '未读消息');
      var icon = item.querySelector('.nav-icon') || item;
      icon.appendChild(badge);
    }
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = false;
  }

  function refreshMessageUnreadBadge() {
    if (typeof window.authFetch !== 'function') return;
    window
      .authFetch('api/message?action=unread_count')
      .then(function (r) {
        return (window.authParseJson||function(r){return r.json();})(r);
      })
      .then(function (data) {
        if (data && data.code === 200 && data.data) {
          renderBadge(data.data.unread);
        }
      })
      .catch(function () {});
  }

  window.refreshMessageUnreadBadge = refreshMessageUnreadBadge;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshMessageUnreadBadge);
  } else {
    refreshMessageUnreadBadge();
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) refreshMessageUnreadBadge();
  });
})();
