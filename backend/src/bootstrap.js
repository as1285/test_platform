/**
 * 应用装配：创建 Express app → 按域注册路由 → 启动。
 */
const { createApp, startServer, getHandlers, getMiddleware } = require('./legacy/monolith');
const sbdyDemo = require('./admin/sbdyDemo');
const gjjDemo = require('./admin/gjjDemo');
const lizhiCert = require('./admin/lizhiCert');
const lizhiCertUser = require('./user/lizhiCertUser');
const zaizhiCert = require('./admin/zaizhiCert');
const zaizhiCertUser = require('./user/zaizhiCertUser');
const sbdyDemoUser = require('./user/sbdyDemoUser');
const shebaoPhoto = require('./user/shebaoPhoto');
const ylbxPs = require('./admin/ylbxPs');
const ccbFlow = require('./admin/ccbFlow');
const najiluQr = require('./admin/najiluQr');
const deviceStats = require('./admin/deviceStats');
const purchasePriceSurvey = require('./growth/purchasePriceSurvey');
const certPageSurvey = require('./growth/certPageSurvey');
const taxFillSurvey = require('./growth/taxFillSurvey');
const opsConversion = require('./admin/opsConversion');
const adPageAnalytics = require('./admin/adPageAnalytics');
const { registerAuthRoutes } = require('./auth/routes');
const { registerUserRoutes } = require('./user/routes');
const { registerTaxRoutes } = require('./tax/routes');
const { registerPaymentsRoutes } = require('./payments/routes');
const { registerGrowthRoutes } = require('./growth/routes');
const { registerAdminRoutes } = require('./admin/routes');
const { registerPlatformRoutes } = require('./platform/routes');
const { registerPartnerRoutes } = require('./partner/routes');
const bankSalaryFlow = require('./partner/bankSalaryFlow');

/** 创建 Express 应用并按域挂载全部路由 */
function buildApp() {
  const app = createApp();
  const deps = {
    handlers: Object.assign(
      {},
      getHandlers(),
      sbdyDemo.getHandlers(),
      gjjDemo.getHandlers(),
      lizhiCert.getHandlers(),
      lizhiCertUser.getHandlers(),
      zaizhiCert.getHandlers(),
      zaizhiCertUser.getHandlers(),
      sbdyDemoUser.getHandlers(),
      shebaoPhoto.getHandlers(),
      ylbxPs.getHandlers(),
      ccbFlow.getHandlers(),
      najiluQr.getHandlers(),
      deviceStats.getHandlers(),
      purchasePriceSurvey.getHandlers(),
      certPageSurvey.getHandlers(),
      taxFillSurvey.getHandlers(),
      opsConversion.getHandlers(),
      adPageAnalytics.getHandlers(),
      bankSalaryFlow.getHandlers()
    ),
    middleware: Object.assign({}, getMiddleware(), {
      userShebaoPhotoUpload: shebaoPhoto.userShebaoPhotoUpload,
      userNajiluQrUpload: najiluQr.userNajiluQrUpload
    })
  };

  registerAuthRoutes(app, deps);
  registerUserRoutes(app, deps);
  registerTaxRoutes(app, deps);
  registerPaymentsRoutes(app, deps);
  registerGrowthRoutes(app, deps);
  registerAdminRoutes(app, deps);
  registerPlatformRoutes(app, deps);
  registerPartnerRoutes(app, deps);

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
