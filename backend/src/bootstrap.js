/**
 * 应用装配：创建 Express app → 按域注册路由 → 启动。
 */
const { createApp, startServer, getHandlers, getMiddleware } = require('./legacy/monolith');
const sbdyDemo = require('./admin/sbdyDemo');
const lizhiCert = require('./admin/lizhiCert');
const lizhiCertUser = require('./user/lizhiCertUser');
const ylbxPs = require('./admin/ylbxPs');
const najiluQr = require('./admin/najiluQr');
const { registerAuthRoutes } = require('./auth/routes');
const { registerUserRoutes } = require('./user/routes');
const { registerTaxRoutes } = require('./tax/routes');
const { registerPaymentsRoutes } = require('./payments/routes');
const { registerGrowthRoutes } = require('./growth/routes');
const { registerAdminRoutes } = require('./admin/routes');
const { registerPlatformRoutes } = require('./platform/routes');

/** 创建 Express 应用并按域挂载全部路由 */
function buildApp() {
  const app = createApp();
  const deps = {
    handlers: Object.assign(
      {},
      getHandlers(),
      sbdyDemo.getHandlers(),
      lizhiCert.getHandlers(),
      lizhiCertUser.getHandlers(),
      ylbxPs.getHandlers(),
      najiluQr.getHandlers()
    ),
    middleware: getMiddleware()
  };

  registerAuthRoutes(app, deps);
  registerUserRoutes(app, deps);
  registerTaxRoutes(app, deps);
  registerPaymentsRoutes(app, deps);
  registerGrowthRoutes(app, deps);
  registerAdminRoutes(app, deps);
  registerPlatformRoutes(app, deps);

  return app;
}

/** 装配应用并启动 HTTP 服务 */
function start() {
  buildApp();
  return startServer();
}

module.exports = {
  buildApp,
  start,
  startServer: start
};
