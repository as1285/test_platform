/**
 * 操作教程视频引导弹窗（已下线：下载进 App / 登录页不再自动弹出）。
 * 保留 TutorialVideoPrompt 空实现，避免旧缓存页调用报错。
 */
(function () {
  var TUTORIAL_PAGE = 'tutorial_video.html';

  function noop() {}

  window.TutorialVideoPrompt = {
    TUTORIAL_PAGE: TUTORIAL_PAGE,
    maybeShowLoginPagePrompt: noop,
    showPrompt: noop
  };
})();
