/**
 * 底部导航「消息」未读角标（依赖 auth.js 的 authFetch）
 */
(function () {
  'use strict';

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
        return r.json();
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
