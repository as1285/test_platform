/**
 * 用户域路由：资料 / 任职 / 家人 / 银行卡等（user.php）+ 站内消息（message.php）
 */
function registerUserRoutes(app, deps) {
  var h = deps.handlers;
  var mw = deps.middleware;

  app.get('/api/user.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleUserGet);
  app.post('/api/user.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleUserPost);
  app.get('/user.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleUserGet);
  app.post('/user.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleUserPost);

  app.get('/api/message.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleMessageGet);
  app.post('/api/message.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleMessagePost);
  app.get('/message.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleMessageGet);
  app.post('/message.php', mw.requireAuthAndActivatedUnlessAllowed, h.handleMessagePost);
}

module.exports = { registerUserRoutes };
