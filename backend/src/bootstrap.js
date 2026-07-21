/**
 * 应用装配：创建 Express app → 按域注册路由 → 启动。
 */
const { createApp, startServer, getHandlers, getMiddleware } = require('./legacy/monolith');
const { registerAuthRoutes } = require('./auth/routes');
const { registerUserRoutes } = require('./user/routes');
const { registerTaxRoutes } = require('./tax/routes');
const { registerPaymentsRoutes } = require('./payments/routes');
const { registerGrowthRoutes } = require('./growth/routes');
const { registerAdminRoutes } = require('./admin/routes');
const { registerChatRoutes } = require('./chat/routes');
const { registerPlatformRoutes } = require('./platform/routes');

function buildApp() {
  const app = createApp();
  const deps = {
    handlers: getHandlers(),
    middleware: getMiddleware()
  };

  registerAuthRoutes(app, deps);
  registerUserRoutes(app, deps);
  registerTaxRoutes(app, deps);
  registerChatRoutes(app, deps);
  registerPaymentsRoutes(app, deps);
  registerGrowthRoutes(app, deps);
  registerAdminRoutes(app, deps);
  registerPlatformRoutes(app, deps);

  return app;
}

function start() {
  buildApp();
  return startServer();
}

module.exports = {
  buildApp,
  start,
  startServer: start
};
