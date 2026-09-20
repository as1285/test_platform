/**
 * 银行模拟器等外部对接路由。
 */
function registerPartnerRoutes(app, deps) {
  var h = deps.handlers;
  app.get('/api/partner/bank/health', h.handleBankPartnerHealth);
  app.post('/api/partner/bank/salary-flow', h.handleBankSalaryFlowPost);
  /* 方案 A：招行机调个税中台当面付（密钥仍在个税侧） */
  app.get('/api/partner/bank/alipay/config', h.handleBankAlipayConfig);
  app.post('/api/partner/bank/alipay/create', h.handleBankAlipayCreate);
  app.get('/api/partner/bank/alipay/status', h.handleBankAlipayStatus);
  app.post('/api/partner/bank/alipay/status', h.handleBankAlipayStatus);
}

module.exports = { registerPartnerRoutes };
