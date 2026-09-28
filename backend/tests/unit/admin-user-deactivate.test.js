'use strict';

const { readFileSync } = require('fs');
const { resolve } = require('path');

const monolith = readFileSync(resolve(__dirname, '../../src/legacy/monolith.js'), 'utf8');
const routes = readFileSync(resolve(__dirname, '../../src/admin/routes.js'), 'utf8');

describe('admin cancel activation', () => {
  it('exposes handleAdminUserDeactivate and users menu route', () => {
    expect(monolith).toContain('async function handleAdminUserDeactivate');
    expect(monolith).toContain('handleAdminUserDeactivate,');
    expect(routes).toContain("'/api/admin/user-deactivate'");
    expect(routes).toContain('h.handleAdminUserDeactivate');
  });

  it('clears activation without ban/refund/hide', () => {
    expect(monolith).toContain('已取消激活');
    expect(monolith).toContain('activation_cancelled_at');
    expect(monolith).toContain('activation_cancelled: !!(r.used_user_activation_cancelled_at)');
    expect(monolith).toMatch(
      /function handleAdminUserDeactivate[\s\S]*account_active = 0[\s\S]*activation_kind = 'none'[\s\S]*activation_cancelled_at = NOW\(3\)/
    );
    expect(monolith).toMatch(/function handleAdminUserDeactivate[\s\S]*invalidateUserAuthCache\(target\)/);
    expect(monolith).not.toMatch(
      /function handleAdminUserDeactivate[\s\S]*function handleAdminUserPriceOfferGet[\s\S]{0,80}banned = 1/
    );
    const fn = monolith.slice(
      monolith.indexOf('async function handleAdminUserDeactivate'),
      monolith.indexOf('/** 管理端：查询账号专属报价 */')
    );
    expect(fn).not.toContain('banned = 1');
    expect(fn).not.toContain('list_hidden_at = NOW');
    expect(fn).not.toContain('activation_refunded_at');
  });
});
