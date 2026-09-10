'use strict';

const {
  resolveMenuKeyForPage,
  getPageDef,
  adminProfileCanAccessPage,
  buildMenuTreeForAdmin,
  firstAllowedPage,
  getAssignableMenuDefs,
  parseAdminRoute,
  ADMIN_MENU_GROUPS,
  ADMIN_PAGE_DEFS,
  ADMIN_HUB_DEFS
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

  it('resolves page aliases and hub routes', () => {
    expect(resolveMenuKeyForPage('analytics')).toBe('ops-board');
    expect(resolveMenuKeyForPage('#settings')).toBe('settings');
    expect(resolveMenuKeyForPage('install')).toBe('settings');
    expect(resolveMenuKeyForPage('install-guide')).toBe('settings');
    expect(resolveMenuKeyForPage('settings/install')).toBe('settings');
    expect(resolveMenuKeyForPage('zaizhi-cert')).toBe('sbdy-demo');
    expect(resolveMenuKeyForPage('insights-product/survey')).toBe('insights-product');
    expect(resolveMenuKeyForPage('ops-inactive')).toBe('insights-product');
    expect(resolveMenuKeyForPage('codes')).toBe('ops-board');
  });

  it('parseAdminRoute maps legacy hashes to hub tabs', () => {
    expect(parseAdminRoute('appearance')).toEqual({
      page: 'settings',
      hub: 'settings',
      tab: 'appearance',
      contentPage: 'appearance'
    });
    expect(parseAdminRoute('settings/install')).toEqual({
      page: 'settings',
      hub: 'settings',
      tab: 'install',
      contentPage: 'install-guide'
    });
    expect(parseAdminRoute('user-login-log')).toEqual({
      page: 'login-log',
      hub: 'login-log',
      tab: 'user',
      contentPage: 'user-login-log'
    });
    expect(parseAdminRoute('insights-growth/abc')).toEqual({
      page: 'abc-ops',
      hub: 'abc-ops',
      tab: 'install',
      contentPage: 'abc-install-stats'
    });
    expect(parseAdminRoute('abc-install-stats')).toEqual({
      page: 'abc-ops',
      hub: 'abc-ops',
      tab: 'install',
      contentPage: 'abc-install-stats'
    });
    expect(parseAdminRoute('abc-ops')).toEqual({
      page: 'abc-ops',
      hub: 'abc-ops',
      tab: 'funnel',
      contentPage: 'abc-ops'
    });
    expect(parseAdminRoute('abc-ops/users')).toEqual({
      page: 'abc-ops',
      hub: 'abc-ops',
      tab: 'users',
      contentPage: 'abc-users'
    });
    expect(parseAdminRoute('ops-inactive')).toEqual({
      page: 'insights-product',
      hub: 'insights-product',
      tab: 'inactive',
      contentPage: 'ops-inactive'
    });
    expect(parseAdminRoute('insights-growth/inactive')).toEqual({
      page: 'insights-growth',
      hub: 'insights-growth',
      tab: 'inactive',
      contentPage: 'ops-inactive'
    });
    expect(parseAdminRoute('ops-board/ads-data')).toEqual({
      page: 'ops-board',
      hub: 'ops-board',
      tab: 'ads-data',
      contentPage: 'ops-ad-analytics'
    });
    expect(parseAdminRoute('users/emails')).toEqual({
      page: 'users',
      hub: 'users',
      tab: 'emails',
      contentPage: 'user-emails'
    });
    expect(parseAdminRoute('server-monitor')).toEqual({
      page: 'login-log',
      hub: 'login-log',
      tab: 'monitor',
      contentPage: 'server-monitor'
    });
    expect(parseAdminRoute('admin-operation-log')).toEqual({
      page: 'login-log',
      hub: 'login-log',
      tab: 'op-log',
      contentPage: 'admin-operation-log'
    });
    expect(parseAdminRoute('login-log/op-log')).toEqual({
      page: 'login-log',
      hub: 'login-log',
      tab: 'op-log',
      contentPage: 'admin-operation-log'
    });
  });

  it('getPageDef finds appearance under ops-config', () => {
    const def = getPageDef('appearance');
    expect(def).toBeTruthy();
    expect(def.group).toBe('ops-config');
    expect(def.label).toBe('外观');
    expect(def.nav_hidden).toBe(true);
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

  it('admin-operation-log is super_only and not granted by login-log', () => {
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['login-log'] }, 'admin-operation-log')
    ).toBe(false);
    expect(
      adminProfileCanAccessPage(
        { is_super: false, menus: ['admin-operation-log'] },
        'admin-operation-log'
      )
    ).toBe(false);
    expect(
      adminProfileCanAccessPage({ is_super: true, menus: [] }, 'admin-operation-log')
    ).toBe(true);
    const def = getPageDef('admin-operation-log');
    expect(def.super_only).toBe(true);
    expect(def.assignable).toBe(false);
    expect(def.strict_hub_tab).toBe(true);
    expect(ADMIN_HUB_DEFS['login-log'].tabs.map((t) => t.id)).toEqual([
      'accounts',
      'downline',
      'admin',
      'op-log',
      'user',
      'monitor',
      'ip'
    ]);
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

  it('buildMenuTreeForAdmin hides merged pages and shows hubs', () => {
    const payload = buildMenuTreeForAdmin({ is_super: true, username: 'admin', menus: [] });
    const tree = payload.menu_tree;
    expect(Array.isArray(tree)).toBe(true);
    expect(tree[0].label).toBe('转化运营');
    const deskPages = tree[0].items.map((i) => i.page);
    expect(deskPages).toEqual(['ops-board']);
    expect(tree[0].items[0].label).toBe('转化运营');
    expect(deskPages).not.toContain('ops-inactive');
    expect(deskPages).not.toContain('ops-ad-analytics');
    expect(deskPages).not.toContain('codes');
    expect(deskPages).not.toContain('payment-orders');
    expect(deskPages).not.toContain('abc-ops');
    expect(deskPages).not.toContain('ops-research');
    expect(deskPages).not.toContain('ops-lift');
    expect(ADMIN_HUB_DEFS['ops-board'].tabs.map((t) => t.id)).toEqual([
      'board',
      'ads',
      'ads-data',
      'ads-reach',
      'codes',
      'orders',
      'abc'
    ]);
    expect(getPageDef('ops-ad-analytics').label).toBe('广告页');
    expect(getPageDef('ops-ad-analytics').module).toBe('ad-analytics');
    expect(parseAdminRoute('ops-ad-analytics')).toEqual({
      page: 'ops-ad-analytics',
      hub: 'ops-ad-analytics',
      tab: 'config',
      contentPage: 'ops-ad-analytics'
    });
    expect(parseAdminRoute('ops-ad-analytics/data')).toEqual({
      page: 'ops-ad-analytics',
      hub: 'ops-ad-analytics',
      tab: 'data',
      contentPage: 'ops-ad-analytics'
    });
    expect(parseAdminRoute('ops-ad-analytics/reach').tab).toBe('reach');
    expect(ADMIN_HUB_DEFS['ops-ad-analytics'].tabs.map((t) => t.id)).toEqual([
      'config',
      'data',
      'reach'
    ]);
    const settings = tree.flatMap((g) => g.items || []).find((i) => i.page === 'settings');
    expect(settings.label).toBe('内容配置');
    const configGroup = tree.find((g) => g.id === 'ops-config');
    expect(configGroup.items.map((i) => i.page)).toEqual(['settings']);
    const tools = tree.find((g) => g.id === 'cert-tools');
    expect(tools.items.map((i) => i.page)).toEqual(['sbdy-demo']);
    expect(tools.items[0].label).toBe('业务工具');
    expect(tools.items.map((i) => i.page)).not.toContain('lizhi-cert');
    expect(tools.items.map((i) => i.page)).not.toContain('gjj-demo');
    expect(tools.items.map((i) => i.page)).not.toContain('zaizhi-cert');
    expect(tools.items.map((i) => i.page)).not.toContain('ylbx-ps');
    expect(getPageDef('ylbx-ps')).toBeNull();
    const dataGroup = tree.find((g) => g.id === 'insights');
    const insightPages = dataGroup.items.map((i) => i.page);
    expect(insightPages).toEqual(['insights-product']);
    expect(dataGroup.items[0].label).toBe('数据分析');
    expect(insightPages).not.toContain('insights-growth');
    expect(insightPages).not.toContain('analytics-purchase');
    expect(insightPages).not.toContain('analytics-tracking');
    expect(insightPages).not.toContain('channel-analysis');
    expect(insightPages).not.toContain('analytics-activity');
    expect(insightPages).not.toContain('abc-install-stats');
    expect(insightPages).not.toContain('abc-ops');
    expect(ADMIN_HUB_DEFS['insights-product'].tabs.map((t) => t.page)).toEqual(
      expect.arrayContaining([
        'analytics-activity',
        'feature-survey',
        'feedback',
        'channel-analysis',
        'ops-inactive',
        'analytics-purchase'
      ])
    );
    expect(ADMIN_HUB_DEFS['insights-product'].tabs.map((t) => t.page)).not.toContain(
      'analytics-tracking'
    );
    expect(ADMIN_HUB_DEFS['insights-growth'].tabs.map((t) => t.page)).toEqual(
      expect.arrayContaining(['channel-analysis', 'install-guide-stats', 'ops-inactive'])
    );
    expect(getPageDef('abc-install-stats').label).toBe('ABC下载页');
    expect(getPageDef('abc-install-stats').menu_key).toBe('abc-ops');
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['abc-ops'] }, 'abc-install-stats')
    ).toBe(true);
    expect(
      adminProfileCanAccessPage(
        { is_super: false, menus: ['install-guide-stats'] },
        'abc-install-stats'
      )
    ).toBe(true);
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['insights-growth'] }, 'abc-install-stats')
    ).toBe(true);
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['codes'] }, 'abc-install-stats')
    ).toBe(false);
    expect(getPageDef('tax-fill-survey').label).toBe('填写调研');
    expect(getPageDef('feature-survey').label).toBe('功能调研');
    expect(getPageDef('payment-orders').label).toBe('订单检索');
    expect(ADMIN_HUB_DEFS.settings).toBeTruthy();
  });

  it('firstAllowedPage prefers ops board', () => {
    const page = firstAllowedPage({ is_super: true, menus: [] });
    expect(page).toBe('ops-board');
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
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['ops-board'] }, 'ops-ad-analytics')
    ).toBe(true);
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['codes'] }, 'ops-ad-analytics')
    ).toBe(false);
  });

  it('hub aliases grant access to nested content pages', () => {
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['settings'] }, 'install-guide')
    ).toBe(true);
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['install-guide'] }, 'settings')
    ).toBe(true);
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['lizhi-cert'] }, 'zaizhi-cert')
    ).toBe(true);
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['sbdy-demo'] }, 'zaizhi-cert')
    ).toBe(true);
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['downline-admins'] }, 'login-log')
    ).toBe(true);
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['login-log'] }, 'user-login-log')
    ).toBe(true);
    expect(
      adminProfileCanAccessPage(
        { is_super: false, menus: ['analytics-activity'] },
        'insights-product'
      )
    ).toBe(true);
  });

  it('系统与安全独立 TAB：持有 login-log 不能自动开 IP/监控/下线', () => {
    const onlyHub = { is_super: false, menus: ['login-log'] };
    expect(adminProfileCanAccessPage(onlyHub, 'login-log')).toBe(true);
    expect(adminProfileCanAccessPage(onlyHub, 'user-login-log')).toBe(true);
    expect(adminProfileCanAccessPage(onlyHub, 'blocked-ips')).toBe(false);
    expect(adminProfileCanAccessPage(onlyHub, 'server-monitor')).toBe(false);
    expect(adminProfileCanAccessPage(onlyHub, 'downline-admins')).toBe(false);
    expect(adminProfileCanAccessPage(onlyHub, 'admin-accounts')).toBe(false);
    expect(adminProfileCanAccessPage(onlyHub, 'admin-operation-log')).toBe(false);

    const onlyDownline = { is_super: false, menus: ['downline-admins'] };
    expect(adminProfileCanAccessPage(onlyDownline, 'login-log')).toBe(true);
    expect(adminProfileCanAccessPage(onlyDownline, 'downline-admins')).toBe(true);
    expect(adminProfileCanAccessPage(onlyDownline, 'blocked-ips')).toBe(false);
    expect(adminProfileCanAccessPage(onlyDownline, 'server-monitor')).toBe(false);

    const withIp = { is_super: false, menus: ['login-log', 'blocked-ips'] };
    expect(adminProfileCanAccessPage(withIp, 'blocked-ips')).toBe(true);
    expect(adminProfileCanAccessPage(withIp, 'server-monitor')).toBe(false);
  });

  it('ADMIN_PAGE_DEFS pages are unique', () => {
    const pages = ADMIN_PAGE_DEFS.map((d) => d.page);
    expect(new Set(pages).size).toBe(pages.length);
  });

  it('sidebar hubs are assignable; nested pages are not', () => {
    const assignable = getAssignableMenuDefs().map((d) => d.key);
    expect(assignable).toEqual(
      expect.arrayContaining([
        'settings',
        'lizhi-cert',
        'sbdy-demo',
        'login-log',
        'insights-product',
        'insights-growth',
        'rename-tax-daily',
        'users-deleted',
        'abc-ops',
        'payment-orders'
      ])
    );
    expect(assignable).not.toContain('peer-accounts');
    expect(assignable).not.toContain('install-guide');
    expect(assignable).not.toContain('appearance');
    expect(assignable).not.toContain('zaizhi-cert');
    expect(assignable).not.toContain('gjj-demo');
    expect(assignable).not.toContain('user-login-log');
    expect(assignable).not.toContain('admin-operation-log');
    expect(assignable).not.toContain('analytics-activity');
    expect(getPageDef('rename-tax-daily').menu_key).toBe('rename-tax-daily');
    expect(getPageDef('peer-accounts')).toEqual(getPageDef('rename-tax-daily'));
    expect(
      adminProfileCanAccessPage({ is_super: false, menus: ['peer-accounts'] }, 'rename-tax-daily')
    ).toBe(true);
    const tree = buildMenuTreeForAdmin({ is_super: true, username: 'admin', menus: [] });
    const usersGroup = tree.menu_tree.find((g) => g.id === 'users');
    expect(usersGroup.items.map((i) => i.page)).toEqual(['users']);
    expect(usersGroup.items[0].label).toBe('用户管理');
    expect(usersGroup.items.map((i) => i.page)).not.toContain('rename-tax-daily');
    expect(usersGroup.items.map((i) => i.page)).not.toContain('users-deleted');
    expect(usersGroup.items.map((i) => i.page)).not.toContain('peer-accounts');
    const systemGroup = tree.menu_tree.find((g) => g.id === 'system');
    expect(systemGroup.items.map((i) => i.page)).toEqual(['login-log']);
    expect(systemGroup.items[0].label).toBe('系统与安全');
    expect(systemGroup.items.map((i) => i.page)).not.toContain('user-login-log');
    expect(systemGroup.items.map((i) => i.page)).not.toContain('admin-accounts');
    expect(systemGroup.items.map((i) => i.page)).not.toContain('server-monitor');
    expect(systemGroup.items.map((i) => i.page)).not.toContain('blocked-ips');
    const sidebarPages = tree.menu_tree.flatMap((g) => (g.items || []).map((i) => i.page));
    expect(sidebarPages).toEqual([
      'ops-board',
      'settings',
      'users',
      'sbdy-demo',
      'insights-product',
      'login-log'
    ]);
    const subTree = buildMenuTreeForAdmin({
      is_super: false,
      username: 'agent',
      menus: ['downline-admins']
    });
    const subSystem = subTree.menu_tree.find((g) => g.id === 'system');
    expect(subSystem.items.map((i) => i.page)).toEqual(['login-log']);
  });
});
