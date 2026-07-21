/**
 * 鉴权域路由：注册 / 登录 / 激活 / 会话（auth.php）
 */
function registerAuthRoutes(app, deps) {
  var h = deps.handlers;

  app.get('/api/auth.php', h.handleAuthGet);
  app.get('/auth.php', h.handleAuthGet);
  app.post('/api/auth.php', h.routeAuthPost);
  app.post('/auth.php', h.routeAuthPost);
}

module.exports = { registerAuthRoutes };
