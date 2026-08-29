'use strict';

const {
  resolveMenuKeyForPage,
  getPageDef,
  adminProfileCanAccessPage,
  buildMenuTreeForAdmin,
  firstAllowedPage,
  getAssignableMenuDefs,
  ADMIN_MENU_GROUPS,
  ADMIN_PAGE_DEFS
} = require('../../src/admin/menuRegistry');

describe('menuRegistry', () => {
  it('has task-oriented group labels', () => {
    expect(ADMIN_MENU_GROUPS.map((g) => g.label)).toEqual([
      '转化运营',
      '内容配置',
      '用户管理',
      '业务工具',
      '数据分析',
      '系统与安全'
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

  it('guest-users and activated-user-analysis are removed from menu', () => {
    expect(getPageDef('guest-users')).toBeNull();
    expect(getPageDef('activated-user-analysis')).toBeNull();
    expect(
      adminProfileCanAccessPage({ is_super: true, menus: [] }, 'guest-users')
    ).toBe(false);
    expect(
      adminProfileCanAccessPage({ is_super: true, menus: [] }, 'activated-user-analysis')
    ).toBe(false);
  });

  it('admin-accounts is super_only and not assignable', () => {
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['admin-accounts'] }, 'admin-accounts')
    ).toBe(false);
    expect(
      adminProfileCanAccessPage({ is_super: true, menus: [] }, 'admin-accounts')
    ).toBe(true);
    const def = getPageDef('admin-accounts');
    expect(def.super_only).toBe(true);
    expect(def.assignable).toBe(false);
  });

  it('downline-admins is assignable to sub-admins and hidden from super sidebar', () => {
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['downline-admins'] }, 'downline-admins')
    ).toBe(true);
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['users'] }, 'downline-admins')
    ).toBe(false);
    expect(
      adminProfileCanAccessPage({ is_super: true, menus: [] }, 'downline-admins')
    ).toBe(false);
    const def = getPageDef('downline-admins');
    expect(def.super_only).toBeFalsy();
    expect(def.assignable).not.toBe(false);
    expect(def.hide_for_super).toBe(true);
    const tree = buildMenuTreeForAdmin({ is_super: true, username: 'admin', menus: [] });
    expect(tree.pages.map((p) => p.page)).not.toContain('downline-admins');
  });

  it('buildMenuTreeForAdmin returns ordered groups', () => {
    const payload = buildMenuTreeForAdmin({ is_super: true, username: 'admin', menus: [] });
    const tree = payload.menu_tree;
    expect(Array.isArray(tree)).toBe(true);
    expect(tree[0].label).toBe('转化运营');
    expect(tree[0].items.map((i) => i.page)).toEqual(
      expect.arrayContaining(['ops-inactive', 'ops-research', 'ops-lift', 'analytics-conversion'])
    );
    const settings = tree
      .flatMap((g) => g.items || [])
      .find((i) => i.page === 'settings');
    expect(settings.label).toBe('定价与引导');
    const dataGroup = tree.find((g) => g.id === 'insights');
    expect(dataGroup.items.map((i) => i.page)).toContain('analytics-purchase');
    expect(dataGroup.items.map((i) => i.page)).toContain('channel-analysis');
    expect(dataGroup.items.map((i) => i.page)).toContain('analytics-devices');
    expect(dataGroup.items.map((i) => i.page)).toContain('tax-fill-survey');
    expect(getPageDef('tax-fill-survey').label).toBe('填写调研');
    expect(getPageDef('analytics-devices').label).toBe('机型');
  });

  it('firstAllowedPage prefers unactivated-user ops desk', () => {
    const page = firstAllowedPage({ is_super: true, menus: [] });
    expect(page).toBe('ops-inactive');
  });

  it('ops conversion pages are visible via analytics-conversion alias', () => {
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['analytics-conversion'] }, 'ops-inactive')
    ).toBe(true);
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['analytics-conversion'] }, 'ops-research')
    ).toBe(true);
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['analytics-conversion'] }, 'ops-lift')
    ).toBe(true);
    expect(adminProfileCanAccessPage({ is_super: false, menus: ['users'] }, 'ops-inactive')).toBe(
      true
    );
    expect(adminProfileCanAccessPage({ is_super: false, menus: ['codes'] }, 'ops-inactive')).toBe(
      false
    );
  });

  it('ADMIN_PAGE_DEFS pages are unique', () => {
    const pages = ADMIN_PAGE_DEFS.map((d) => d.page);
    expect(new Set(pages).size).toBe(pages.length);
  });

  it('sidebar child pages are independently assignable', () => {
    const assignable = getAssignableMenuDefs().map((d) => d.key);
    expect(assignable).toEqual(
      expect.arrayContaining([
        'peer-accounts',
        'rename-tax-daily',
        'users-deleted',
        'user-login-log'
      ])
    );
    expect(getPageDef('peer-accounts').menu_key).toBe('peer-accounts');
    expect(getPageDef('rename-tax-daily').menu_key).toBe('rename-tax-daily');
    expect(getPageDef('users-deleted').menu_key).toBe('users-deleted');
    expect(getPageDef('user-login-log').menu_key).toBe('user-login-log');
    expect(adminProfileCanAccessPage({ is_super: false, menus: ['users'] }, 'peer-accounts')).toBe(
      false
    );
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['peer-accounts'] }, 'peer-accounts')
    ).toBe(true);
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['users'] }, 'rename-tax-daily')
    ).toBe(false);
    expect(
      adminProfileCanAccessPage(
        { is_super: false, menus: ['rename-tax-daily'] },
        'rename-tax-daily'
      )
    ).toBe(true);
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['login-log'] }, 'user-login-log')
    ).toBe(false);
    expect(
      adminProfileCanAccessPage(
        { is_super: false, menus: ['user-login-log'] },
        'user-login-log'
      )
    ).toBe(true);
    const tree = buildMenuTreeForAdmin({ is_super: true, username: 'admin', menus: [] });
    const usersGroup = tree.menu_tree.find((g) => g.id === 'users');
    expect(usersGroup.items.map((i) => i.page)).toEqual(
      expect.arrayContaining(['users', 'peer-accounts', 'rename-tax-daily', 'users-deleted'])
    );
    const peerDef = getAssignableMenuDefs().find((d) => d.key === 'peer-accounts');
    expect(peerDef.group_label).toBe('用户管理');
  });
});
