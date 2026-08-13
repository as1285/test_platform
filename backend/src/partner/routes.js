/**
 * 银行模拟器等外部对接路由。
 */
function registerPartnerRoutes(app, deps) {
  var h = deps.handlers;
  app.get('/api/partner/bank/health', h.handleBankPartnerHealth);
  app.post('/api/partner/bank/salary-flow', h.handleBankSalaryFlowPost);
}

module.exports = { registerPartnerRoutes };
