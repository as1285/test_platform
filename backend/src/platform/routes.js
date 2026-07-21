/**
 * 平台域：健康检查等
 */
function registerPlatformRoutes(app, deps) {
  var h = deps.handlers;

  function healthHandler(req, res) {
    if (typeof h.healthHandler === 'function') {
      return h.healthHandler(req, res);
    }
    res.json({ ok: true });
  }

  app.get('/health', healthHandler);
  app.get('/api/health', healthHandler);
}

module.exports = { registerPlatformRoutes };
