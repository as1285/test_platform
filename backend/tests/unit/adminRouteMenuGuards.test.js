'use strict';

const { readFileSync } = require('fs');
const { resolve } = require('path');

const routes = readFileSync(resolve(__dirname, '../../src/admin/routes.js'), 'utf8');

function anyMenuFor(handler) {
  const re = new RegExp(
    "requireAdminAnyMenu\\((\\[[^\\]]+\\])\\),\\s*h\\." + handler + "(?!\\w)"
  );
  const m = routes.match(re);
  return m ? m[1] : '';
}

describe('独立菜单接口不再因 users 放行', () => {
  it('邮箱管理接口只认 user-emails / 广告页', () => {
    expect(anyMenuFor('handleAdminEmailsUsers')).toBe("['user-emails']");
    expect(anyMenuFor('handleAdminEmailsSend')).toBe("['user-emails']");
    expect(anyMenuFor('handleAdminEmailsClear')).toBe("['user-emails']");
    expect(anyMenuFor('handleAdminEmailsSends')).not.toContain("'users'");
    expect(anyMenuFor('handleAdminEmailsOverview')).not.toContain("'users'");
    expect(anyMenuFor('handleAdminEmailsBulk')).not.toContain("'users'");
  });

  it('运营看板/未激活接口不因注册用户权限放行', () => {
    expect(anyMenuFor('handleOpsInactiveSummary')).not.toContain("'users'");
    expect(anyMenuFor('handleOpsInactiveUsers')).not.toContain("'users'");
    expect(anyMenuFor('handleAdminD1ReturnCohort')).not.toContain("'users'");
    expect(anyMenuFor('handleAdminHighIncomeInactive')).not.toContain("'users'");
    expect(anyMenuFor('handleAdminMessagesBulk')).not.toContain("'users'");
  });
});
