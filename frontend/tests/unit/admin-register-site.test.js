import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const adminJs = readFileSync(resolve(__dirname, '../../public/js/admin_panel.js'), 'utf8');
const ops = readFileSync(
  resolve(__dirname, '../../public/js/admin/modules/ops-conversion.js'),
  'utf8'
);
const loader = readFileSync(resolve(__dirname, '../../public/js/admin/loader.js'), 'utf8');
const menuRegistry = readFileSync(
  resolve(__dirname, '../../../backend/src/admin/menuRegistry.js'),
  'utf8'
);

describe('管理后台注册站点分頁', () => {
  it('用户中心拆成新站注册 / 旧站注册两个 TAB', () => {
    expect(adminJs).toContain("label: '新站注册'");
    expect(adminJs).toContain("label: '旧站注册'");
    expect(adminJs).toContain("page: 'users-new'");
    expect(adminJs).toContain("defaultTab: 'new'");
    expect(adminJs).toContain("if (pageKey === 'users-new') return 'page-users'");
    expect(html).toContain('id="usersPageTitle"');
    expect(html).toContain('id="filterRegisterSiteField"');
    /* 后端 hubs 会覆盖前端定义，必须同步拆 TAB */
    expect(menuRegistry).toContain("label: '新站注册'");
    expect(menuRegistry).toContain("label: '旧站注册'");
    expect(menuRegistry).toContain("page: 'users-new'");
    expect(menuRegistry).toContain("defaultTab: 'new'");
  });

  it('新站页固定 getjob68，旧站页固定 lkj；旧域名后台隐藏新站 TAB', () => {
    expect(adminJs).toContain('function currentUsersListSite');
    expect(adminJs).toContain("if (cp === 'users-new') return 'getjob68'");
    expect(adminJs).toContain("if (cp === 'users') return 'lkj'");
    expect(adminJs).toContain("if (tabPage === 'users-new')");
    expect(adminJs).toContain('isLegacyAdminHostClient()');
    expect(adminJs).toContain("url += '&site='");
    expect(ops).toContain('function appendSiteQuery');
    expect(loader).toContain('ops-conversion.js?v=20261008-legacy-plain');
    expect(html).toContain('admin_panel.js?v=20261008-legacy-plain');
  });
  it('注册列表不再用站点下拉切换，由页面固定站点', () => {
    expect(adminJs).toContain('注册站点由「新站注册 / 旧站注册」页面决定');
    expect(adminJs).toContain("siteField.style.display = 'none'");
    expect(adminJs).toContain("h2.textContent = '注册用户'");
    expect(adminJs).toContain('applyUsersListPageChrome()');
  });
});
