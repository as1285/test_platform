/**
 * 鉴权域路由：注册 / 登录 / 激活 / 会话
 * 规范路径 /api/auth；*.php 为兼容别名
 */
function registerAuthRoutes(app, deps) {
  var h = deps.handlers;
  var paths = ['/api/auth', '/api/auth.php', '/auth.php'];

  paths.forEach(function (p) {
    app.get(p, h.handleAuthGet);
    app.post(p, h.routeAuthPost);
  });
}

module.exports = { registerAuthRoutes };
