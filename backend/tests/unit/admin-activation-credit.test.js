const fs = require('fs');
const path = require('path');

const monolith = fs.readFileSync(
  path.join(__dirname, '../../src/legacy/monolith.js'),
  'utf8'
);
const routes = fs.readFileSync(path.join(__dirname, '../../src/admin/routes.js'), 'utf8');
const report = fs.readFileSync(path.join(__dirname, '../../opsStatsReport.js'), 'utf8');

describe('admin 激活金额按用户列表填写统计', () => {
  it('admin 规则不再写死 100，按 activation_credit_amount 加总', () => {
    expect(monolith).toContain('function parseActivationCreditAmount');
    expect(monolith).toContain('use_user_amount: true');
    expect(monolith).toContain('activation_credit_amount DECIMAL(10,2)');
    expect(monolith).toContain('function isRootAdminAccount');
    expect(monolith).toContain('handleAdminUserActivationCredit');
    expect(monolith).toContain('仅 admin 可查看或保存激活金额');
    expect(monolith).toContain('MAX(COALESCE(u.activation_credit_amount, 0))');
    expect(monolith).toContain('paid_activation_amount');
    expect(monolith).toContain('paidActivationAmountMap');
    expect(monolith).not.toMatch(
      /admin_username: rootAdmin,\s*unit_amount: 100/
    );
    expect(routes).toContain('/api/admin/user-activation-credit');
    expect(report).toContain('use_user_amount: true');
    expect(report).toContain('按填写金额');
  });
});
