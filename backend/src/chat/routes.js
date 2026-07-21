/**
 * 客服 / 反馈域路由（C 端）
 */
function registerChatRoutes(app, deps) {
  var h = deps.handlers;
  var mw = deps.middleware;

  app.get('/api/feedback.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleFeedbackGet);
  app.post('/api/feedback.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleFeedbackPost);
  app.get('/feedback.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleFeedbackGet);
  app.post('/feedback.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleFeedbackPost);

  app.get('/api/chat.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleChatGet);
  app.post('/api/chat.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleChatPost);
  app.get('/chat.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleChatGet);
  app.post('/chat.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleChatPost);
}

module.exports = { registerChatRoutes };
