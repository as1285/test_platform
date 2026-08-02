/**
 * 增长域公开路由：安装包、渠道归因、落地 AB、游客会话、mine-ui 等
 */
function registerGrowthRoutes(app, deps) {
  var h = deps.handlers;
  var mw = deps.middleware;

  app.get('/api/growth/bilibili-share/status', mw.requireAuth, h.handleBilibiliShareStatus);
  app.post('/api/growth/bilibili-share/start', mw.requireAuth, h.handleBilibiliShareStart);
  app.post('/api/growth/bilibili-share/complete', mw.requireAuth, h.handleBilibiliShareComplete);
  app.get('/api/public/mine-ui', h.handlePublicMineUi);
  app.get('/api/public/install-packages', h.handlePublicInstallPackages);
  app.get('/api/public/asset', h.handlePublicAssetGet);
  app.get('/api/public/resolve-sales-channel', h.handlePublicResolveSalesChannel);
  app.post('/api/public/sales-channel-attribution', h.handlePublicSalesChannelAttribution);
  app.get('/api/public/conversion-config', h.handlePublicConversionConfig);
  app.get('/api/public/landing-ab-config', h.handlePublicLandingAbConfig);
  app.post('/api/public/guest-session', h.handlePublicGuestSession);
  app.get('/api/public/sbdy-demo/verify', h.handlePublicSbdyDemoVerify);
  app.get('/api/public/sbdy-demo/show/:token', h.handlePublicSbdyDemoShow);
}

module.exports = { registerGrowthRoutes };
