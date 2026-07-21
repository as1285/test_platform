/**
 * 支付域路由（支付宝）
 */
function registerPaymentsRoutes(app, deps) {
  var h = deps.handlers;
  var mw = deps.middleware;

  app.get('/api/payments/alipay/config', mw.requireAuth, h.handleAlipayConfig);
  app.post('/api/payments/alipay/create', mw.requireAuth, h.handleAlipayCreateOrder);
  app.get('/api/payments/alipay/latest', mw.requireAuth, h.handleAlipayLatestOrder);
  app.post('/api/payments/alipay/notify', h.handleAlipayNotify);
}

module.exports = { registerPaymentsRoutes };
