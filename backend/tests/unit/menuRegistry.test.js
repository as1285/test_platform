'use strict';

const {
  resolveMenuKeyForPage,
  getPageDef,
  adminProfileCanAccessPage,
  buildMenuTreeForAdmin,
  firstAllowedPage,
  ADMIN_MENU_GROUPS,
  ADMIN_PAGE_DEFS
} = require('../../src/admin/menuRegistry');

describe('menuRegistry', () => {
  it('has concise group labels', () => {
    expect(ADMIN_MENU_GROUPS.map((g) => g.label)).toEqual([
      '工作台',
      '配置',
      '用户',
      '工具',
      '数据',
      '系统'
    ]);
  });

  it('resolves page aliases', () => {
    expect(resolveMenuKeyForPage('analytics')).toBe('analytics-conversion');
    expect(resolveMenuKeyForPage('#settings')).toBe('settings');
    expect(resolveMenuKeyForPage('install')).toBe('install-guide');
  });

  it('getPageDef finds appearance under ops-config', () => {
    const def = getPageDef('appearance');
    expect(def).toBeTruthy();
    expect(def.group).toBe('ops-config');
    expect(def.label).toBe('外观');
  });

  it('super admin can access all pages', () => {
    expect(
      adminProfileCanAccessPage({ is_super: true, menus: [] }, 'admin-accounts')
    ).toBe(true);
  });

  it('sub account needs menu_key', () => {
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['users'] }, 'codes')
    ).toBe(false);
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['codes'] }, 'codes')
    ).toBe(true);
  });

  it('guest-users is super_only', () => {
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['guest-users'] }, 'guest-users')
    ).toBe(false);
    expect(
      adminProfileCanAccessPage({ is_super: true, menus: [] }, 'guest-users')
    ).toBe(true);
  });

  it('buildMenuTreeForAdmin returns ordered groups', () => {
    const payload = buildMenuTreeForAdmin({ is_super: true, username: 'admin', menus: [] });
    const tree = payload.menu_tree;
    expect(Array.isArray(tree)).toBe(true);
    expect(tree[0].label).toBe('工作台');
    const settings = tree
      .flatMap((g) => g.items || [])
      .find((i) => i.page === 'settings');
    expect(settings.label).toBe('定价与弹窗');
  });

  it('firstAllowedPage prefers conversion analytics', () => {
    const page = firstAllowedPage({ is_super: true, menus: [] });
    expect(page).toBe('analytics-conversion');
  });

  it('ADMIN_PAGE_DEFS pages are unique', () => {
    const pages = ADMIN_PAGE_DEFS.map((d) => d.page);
    expect(new Set(pages).size).toBe(pages.length);
  });
});
