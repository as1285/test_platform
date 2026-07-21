/**
 * 用户域路由：资料 / 任职 / 家人 / 银行卡等 + 站内消息
 * 规范路径 /api/user、/api/message；*.php 为兼容别名
 */
function registerUserRoutes(app, deps) {
  var h = deps.handlers;
  var mw = deps.middleware;
  var authMw = mw.requireAuthAndActivatedUnlessAllowed;

  ['/api/user', '/api/user.php', '/user.php'].forEach(function (p) {
    app.get(p, authMw, h.handleUserGet);
    app.post(p, authMw, h.handleUserPost);
  });

  ['/api/message', '/api/message.php', '/message.php'].forEach(function (p) {
    app.get(p, authMw, h.handleMessageGet);
    app.post(p, authMw, h.handleMessagePost);
  });
}

module.exports = { registerUserRoutes };
