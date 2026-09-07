'use strict';

const { readFileSync } = require('fs');
const { resolve } = require('path');

const monolith = readFileSync(resolve(__dirname, '../../src/legacy/monolith.js'), 'utf8');
const authJs = readFileSync(
  resolve(__dirname, '../../../frontend/public/js/auth.js'),
  'utf8'
);

describe('expired trial self-serve repurchase', () => {
  it('requireAuth whitelists alipay/price-bid paths alongside activate', () => {
    expect(monolith).toContain('function isTrialExpiredSelfServeAllowedRequest');
    expect(monolith).toContain("path.indexOf('/api/payments/alipay') === 0");
    expect(monolith).toContain('/api/payments/price-bid');
    expect(monolith).toContain('allowExpiredSelfServe');
    expect(monolith).toContain('支付宝/心理价等自助续开路径必须放行');
  });

  it('purchase page soft-handles activation_expired without clearing session', () => {
    expect(authJs).toContain('allowActivationExpired');
    expect(authJs).toContain('purchase.html');
    expect(authJs).toContain("localStorage.setItem('account_active', '0')");
    expect(authJs).toContain("errExpSoft.activation_expired = true");
    expect(authJs).toContain('开通页自助复购');
  });
});
