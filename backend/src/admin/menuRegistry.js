/**
 * 管理台菜单/页面单一来源（阶段 2）。
 * - menu_key：写入 admin_account_menus、用于 requireAdminMenu
 * - page：前端 hash / data-page（可与 menu_key 不同，如 users-deleted）
 * - module：前端懒加载模块名
 */
const ADMIN_MENU_GROUPS = [
  { id: 'config', label: '系统配置', order: 10 },
  { id: 'accounts', label: '账号权限', order: 20 },
  { id: 'users', label: '用户管理', order: 30 },
  { id: 'logs', label: '日志审计', order: 40 },
  { id: 'ops', label: '系统运维', order: 50 },
  { id: 'stats', label: '数据统计', order: 60 }
];

/**
 * @typedef {object} AdminPageDef
 * @property {string} page
 * @property {string} menu_key
 * @property {string} label
 * @property {string} group
 * @property {string} module
 * @property {number} order
 * @property {boolean} [super_only]
 * @property {boolean} [assignable] 是否出现在子账号勾选列表；默认 true（仅正式 menu_key 一次）
 */

/** @type {AdminPageDef[]} */
const ADMIN_PAGE_DEFS = [
  { page: 'settings', menu_key: 'settings', label: '系统设置', group: 'config', module: 'settings', order: 10 },
  { page: 'install-guide', menu_key: 'install-guide', label: '引导安装', group: 'config', module: 'settings', order: 20 },
  { page: 'appearance', menu_key: 'appearance', label: '用户端外观', group: 'config', module: 'settings', order: 30 },
  { page: 'codes', menu_key: 'codes', label: '激活码', group: 'config', module: 'codes', order: 40 },

  { page: 'admin-accounts', menu_key: 'admin-accounts', label: '后台账号权限', group: 'accounts', module: 'accounts', order: 10 },

  { page: 'users', menu_key: 'users', label: '注册用户', group: 'users', module: 'users', order: 10 },
  { page: 'guest-users', menu_key: 'guest-users', label: '游客用户', group: 'users', module: 'users', order: 20, super_only: true },
  { page: 'users-deleted', menu_key: 'users', label: '已删除账号', group: 'users', module: 'users', order: 30, assignable: false },
  { page: 'user-data', menu_key: 'user-data', label: '用户数据', group: 'users', module: 'user-data', order: 40 },
  { page: 'user-behavior', menu_key: 'user-behavior', label: '用户行为', group: 'users', module: 'user-data', order: 50 },
  {
    page: 'activated-user-analysis',
    menu_key: 'activated-user-analysis',
    label: '激活用户分析',
    group: 'users',
    module: 'user-data',
    order: 60
  },
  { page: 'feedback', menu_key: 'feedback', label: '用户反馈', group: 'users', module: 'feedback', order: 70 },
  { page: 'chat', menu_key: 'chat', label: '在线客服', group: 'users', module: 'chat', order: 80 },

  { page: 'login-log', menu_key: 'login-log', label: '管理账号登录流水', group: 'logs', module: 'logs', order: 10 },
  { page: 'user-login-log', menu_key: 'login-log', label: '普通用户登录流水', group: 'logs', module: 'logs', order: 20, assignable: false },

  { page: 'server-monitor', menu_key: 'server-monitor', label: '服务器监控', group: 'ops', module: 'monitor', order: 10 },

  {
    page: 'analytics-conversion',
    menu_key: 'analytics-conversion',
    label: '转化分析',
    group: 'stats',
    module: 'analytics',
    order: 10
  },
  {
    page: 'analytics-activity',
    menu_key: 'analytics-activity',
    label: '用户活跃',
    group: 'stats',
    module: 'analytics',
    order: 20
  },
  {
    page: 'analytics-register',
    menu_key: 'analytics-register',
    label: '注册分析',
    group: 'stats',
    module: 'analytics',
    order: 30
  },
  {
    page: 'analytics-tracking',
    menu_key: 'analytics-tracking',
    label: '埋点分析',
    group: 'stats',
    module: 'analytics',
    order: 40
  },
  {
    page: 'analytics-devices',
    menu_key: 'analytics-devices',
    label: '设备分析',
    group: 'stats',
    module: 'analytics',
    order: 50
  },
  {
    page: 'install-guide-stats',
    menu_key: 'install-guide-stats',
    label: '安装页统计',
    group: 'stats',
    module: 'analytics',
    order: 60
  },
  {
    page: 'channel-analysis',
    menu_key: 'channel-analysis',
    label: '渠道分析',
    group: 'stats',
    module: 'analytics',
    order: 70
  },
  { page: 'api-analytics', menu_key: 'api-analytics', label: '接口统计', group: 'stats', module: 'analytics', order: 80 }
];

const ADMIN_MENU_KEYS = (function () {
  var seen = Object.create(null);
  var out = [];
  for (var i = 0; i < ADMIN_PAGE_DEFS.length; i++) {
    var k = ADMIN_PAGE_DEFS[i].menu_key;
    if (!seen[k]) {
      seen[k] = 1;
      out.push(k);
    }
  }
  return out;
})();

const ADMIN_MENU_LABELS = (function () {
  var map = Object.create(null);
  for (var i = 0; i < ADMIN_PAGE_DEFS.length; i++) {
    var d = ADMIN_PAGE_DEFS[i];
    if (d.assignable === false) continue;
    if (!map[d.menu_key]) map[d.menu_key] = d.label;
  }
  // 历史兼容文案（账号勾选不展示，仅兜底）
  map.analytics = '数据统计（旧）';
  map['user-login-log'] = '普通用户登录流水';
  return map;
})();

/** 获取：AssignableMenuDefs */
function getAssignableMenuDefs() {
  var seen = Object.create(null);
  var out = [];
  for (var i = 0; i < ADMIN_PAGE_DEFS.length; i++) {
    var d = ADMIN_PAGE_DEFS[i];
    if (d.assignable === false) continue;
    if (seen[d.menu_key]) continue;
    seen[d.menu_key] = 1;
    out.push({
      key: d.menu_key,
      label: d.label,
      group: d.group,
      module: d.module,
      super_only: !!d.super_only
    });
  }
  return out;
}

/** 辅助函数：resolveMenuKeyForPage */
function resolveMenuKeyForPage(page) {
  var p = String(page || '')
    .replace(/^#/, '')
    .trim()
    .toLowerCase();
  if (p === 'system' || p === 'setting') p = 'settings';
  if (p === 'install' || p === 'guide') p = 'install-guide';
  if (p === 'analytics') p = 'analytics-conversion';
  for (var i = 0; i < ADMIN_PAGE_DEFS.length; i++) {
    if (ADMIN_PAGE_DEFS[i].page === p) return ADMIN_PAGE_DEFS[i].menu_key;
  }
  return p;
}

/** 获取：PageDef */
function getPageDef(page) {
  var p = String(page || '')
    .replace(/^#/, '')
    .trim()
    .toLowerCase();
  if (p === 'system' || p === 'setting') p = 'settings';
  if (p === 'install' || p === 'guide') p = 'install-guide';
  if (p === 'analytics') p = 'analytics-conversion';
  for (var i = 0; i < ADMIN_PAGE_DEFS.length; i++) {
    if (ADMIN_PAGE_DEFS[i].page === p) return ADMIN_PAGE_DEFS[i];
  }
  return null;
}

/** 辅助函数：adminProfileCanAccessPage */
function adminProfileCanAccessPage(admin, page) {
  var def = getPageDef(page);
  if (!def) return false;
  if (def.super_only && !(admin && admin.is_super)) return false;
  if (admin && admin.is_super) return true;
  var menus = admin && Array.isArray(admin.menus) ? admin.menus : [];
  if (menus.indexOf(def.menu_key) >= 0) return true;
  if (def.menu_key.indexOf('analytics-') === 0 && menus.indexOf('analytics') >= 0) return true;
  return false;
}

/** 构建：MenuTreeForAdmin */
function buildMenuTreeForAdmin(admin) {
  var groupMap = Object.create(null);
  for (var g = 0; g < ADMIN_MENU_GROUPS.length; g++) {
    groupMap[ADMIN_MENU_GROUPS[g].id] = {
      id: ADMIN_MENU_GROUPS[g].id,
      label: ADMIN_MENU_GROUPS[g].label,
      order: ADMIN_MENU_GROUPS[g].order,
      items: []
    };
  }
  var pages = [];
  for (var i = 0; i < ADMIN_PAGE_DEFS.length; i++) {
    var d = ADMIN_PAGE_DEFS[i];
    if (!adminProfileCanAccessPage(admin, d.page)) continue;
    var item = {
      page: d.page,
      menu_key: d.menu_key,
      label: d.label,
      module: d.module,
      order: d.order,
      super_only: !!d.super_only
    };
    pages.push(item);
    if (groupMap[d.group]) {
      groupMap[d.group].items.push(item);
    }
  }
  var tree = [];
  for (var j = 0; j < ADMIN_MENU_GROUPS.length; j++) {
    var grp = groupMap[ADMIN_MENU_GROUPS[j].id];
    if (grp && grp.items.length) {
      grp.items.sort(function (a, b) {
        return a.order - b.order;
      });
      tree.push(grp);
    }
  }
  tree.sort(function (a, b) {
    return a.order - b.order;
  });
  return { menu_tree: tree, pages: pages };
}

/** 辅助函数：firstAllowedPage */
function firstAllowedPage(admin) {
  var built = buildMenuTreeForAdmin(admin);
  if (built.pages.length) return built.pages[0].page;
  return 'settings';
}

/** 构建：AdminSessionPayload */
function buildAdminSessionPayload(admin) {
  var built = buildMenuTreeForAdmin(admin);
  return {
    admin: {
      username: admin.username,
      full_name: admin.full_name || '',
      is_super: !!admin.is_super,
      menus: Array.isArray(admin.menus) ? admin.menus.slice() : []
    },
    menu_tree: built.menu_tree,
    pages: built.pages,
    menu_defs: getAssignableMenuDefs(),
    first_page: firstAllowedPage(admin)
  };
}

module.exports = {
  ADMIN_MENU_GROUPS,
  ADMIN_PAGE_DEFS,
  ADMIN_MENU_KEYS,
  ADMIN_MENU_LABELS,
  getAssignableMenuDefs,
  resolveMenuKeyForPage,
  getPageDef,
  adminProfileCanAccessPage,
  buildMenuTreeForAdmin,
  firstAllowedPage,
  buildAdminSessionPayload
};
