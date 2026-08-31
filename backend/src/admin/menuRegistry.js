/**
 * 管理台菜单/页面单一来源（阶段 2）。
 * - menu_key：写入 admin_account_menus、用于 requireAdminMenu
 * - page：前端 hash / data-page（可与 menu_key 不同，如 users-deleted）
 * - module：前端懒加载模块名
 *
 * 信息架构：转化运营 → 内容配置 → 用户管理 → 业务工具 → 数据分析 → 系统与安全
 */
const ADMIN_MENU_GROUPS = [
  { id: 'ops-desk', label: '转化运营', order: 10 },
  { id: 'ops-config', label: '内容配置', order: 20 },
  { id: 'users', label: '用户管理', order: 30 },
  { id: 'cert-tools', label: '业务工具', order: 35 },
  { id: 'insights', label: '数据分析', order: 40 },
  { id: 'system', label: '系统与安全', order: 50 }
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
  /* —— 转化运营：收集未激活数据 → 调研转化 → 提高转化 —— */
  {
    page: 'ops-inactive',
    menu_key: 'ops-inactive',
    label: '未激活用户',
    group: 'ops-desk',
    module: 'ops-conversion',
    order: 10,
    alias_menus: ['analytics-conversion', 'users']
  },
  {
    page: 'ops-research',
    menu_key: 'ops-research',
    label: '转化调研',
    group: 'ops-desk',
    module: 'ops-conversion',
    order: 20,
    alias_menus: ['analytics-conversion', 'tax-fill-survey']
  },
  {
    page: 'ops-lift',
    menu_key: 'ops-lift',
    label: '提高转化',
    group: 'ops-desk',
    module: 'ops-conversion',
    order: 30,
    alias_menus: ['analytics-conversion']
  },
  {
    page: 'ops-ad-analytics',
    menu_key: 'ops-ad-analytics',
    label: '广告页数据运营',
    group: 'ops-desk',
    module: 'ad-analytics',
    order: 35,
    alias_menus: ['analytics-tracking', 'analytics-conversion']
  },
  {
    page: 'analytics-conversion',
    menu_key: 'analytics-conversion',
    label: '转化概览',
    group: 'ops-desk',
    module: 'analytics',
    order: 40
  },
  {
    page: 'analytics-purchase',
    menu_key: 'analytics-purchase',
    label: '支付分析',
    group: 'insights',
    module: 'analytics',
    order: 40
  },
  {
    page: 'channel-analysis',
    menu_key: 'channel-analysis',
    label: '渠道分析',
    group: 'insights',
    module: 'analytics',
    order: 50
  },
  { page: 'codes', menu_key: 'codes', label: '激活码', group: 'ops-desk', module: 'codes', order: 50 },

  /* —— 配置 —— */
  {
    page: 'settings',
    menu_key: 'settings',
    label: '定价与引导',
    group: 'ops-config',
    module: 'settings',
    order: 10
  },
  {
    page: 'install-guide',
    menu_key: 'install-guide',
    label: '安装分发',
    group: 'ops-config',
    module: 'settings',
    order: 20
  },
  {
    page: 'appearance',
    menu_key: 'appearance',
    label: '外观',
    group: 'ops-config',
    module: 'settings',
    order: 25
  },
  {
    page: 'install-guide-stats',
    menu_key: 'install-guide-stats',
    label: '安装统计',
    group: 'insights',
    module: 'analytics',
    order: 60
  },

  /* —— 用户 —— */
  { page: 'users', menu_key: 'users', label: '注册用户', group: 'users', module: 'users', order: 10 },
  {
    page: 'peer-accounts',
    menu_key: 'peer-accounts',
    label: '同行账号',
    group: 'users',
    module: 'users',
    order: 15
  },
  {
    page: 'rename-tax-daily',
    menu_key: 'rename-tax-daily',
    label: '高频改名',
    group: 'users',
    module: 'users',
    order: 20
  },
  {
    page: 'users-deleted',
    menu_key: 'users-deleted',
    label: '已删除',
    group: 'users',
    module: 'users',
    order: 30
  },
  { page: 'user-data', menu_key: 'user-data', label: '用户数据', group: 'users', module: 'user-data', order: 60 },
  {
    page: 'tax-records-edit',
    menu_key: 'tax-records-edit',
    label: '个税维护',
    group: 'users',
    module: 'user-data',
    order: 65
  },

  /* —— 工具 —— */
  {
    page: 'sbdy-demo',
    menu_key: 'sbdy-demo',
    label: '社保演示',
    group: 'cert-tools',
    module: 'sbdy-demo',
    order: 10
  },
  {
    page: 'gjj-demo',
    menu_key: 'gjj-demo',
    label: '公积金演示',
    group: 'cert-tools',
    module: 'gjj-demo',
    order: 15
  },
  {
    page: 'lizhi-cert',
    menu_key: 'lizhi-cert',
    label: '离职证明',
    group: 'cert-tools',
    module: 'lizhi-cert',
    order: 20
  },
  {
    page: 'zaizhi-cert',
    menu_key: 'zaizhi-cert',
    label: '在职证明',
    group: 'cert-tools',
    module: 'zaizhi-cert',
    order: 25
  },
  {
    page: 'ylbx-ps',
    menu_key: 'ylbx-ps',
    label: '社保图片PS',
    group: 'cert-tools',
    module: 'ylbx-ps',
    order: 30
  },
  {
    page: 'ccb-flow',
    menu_key: 'ccb-flow',
    label: '工资流水',
    group: 'cert-tools',
    module: 'ccb-flow',
    order: 35
  },
  {
    page: 'najilu-qr',
    menu_key: 'najilu-qr',
    label: '完税二维码',
    group: 'cert-tools',
    module: 'najilu-qr',
    order: 40
  },

  /* —— 数据 —— */
  {
    page: 'analytics-register',
    menu_key: 'analytics-register',
    label: '注册分析',
    group: 'insights',
    module: 'analytics',
    order: 10
  },
  {
    page: 'analytics-activity',
    menu_key: 'analytics-activity',
    label: '用户活跃',
    group: 'insights',
    module: 'analytics',
    order: 20
  },
  {
    page: 'tax-fill-survey',
    menu_key: 'tax-fill-survey',
    label: '填写调研',
    group: 'insights',
    module: 'tax-fill-survey',
    order: 22
  },
  {
    page: 'analytics-tracking',
    menu_key: 'analytics-tracking',
    label: '埋点分析',
    group: 'insights',
    module: 'analytics',
    order: 30
  },
  {
    page: 'analytics-devices',
    menu_key: 'analytics-devices',
    label: '机型',
    group: 'insights',
    module: 'devices',
    order: 25
  },

  /* —— 系统 —— */
  {
    page: 'downline-admins',
    menu_key: 'downline-admins',
    label: '下线管理员',
    group: 'system',
    module: 'accounts',
    order: 18,
    hide_for_super: true
  },
  {
    page: 'admin-accounts',
    menu_key: 'admin-accounts',
    label: '账号权限',
    group: 'system',
    module: 'accounts',
    order: 20,
    super_only: true,
    assignable: false
  },
  {
    page: 'login-log',
    menu_key: 'login-log',
    label: '管理登录',
    group: 'system',
    module: 'logs',
    order: 30
  },
  {
    page: 'user-login-log',
    menu_key: 'user-login-log',
    label: '用户登录',
    group: 'system',
    module: 'logs',
    order: 40
  },
  {
    page: 'server-monitor',
    menu_key: 'server-monitor',
    label: '监控',
    group: 'system',
    module: 'monitor',
    order: 50
  },
  {
    page: 'blocked-ips',
    menu_key: 'blocked-ips',
    label: 'IP 黑名单',
    group: 'system',
    module: 'users',
    order: 60
  }
];

/** 登录后优先进入的运营页（有权限则取第一个） */
const ADMIN_PREFERRED_FIRST_PAGES = [
  'ops-inactive',
  'ops-research',
  'ops-lift',
  'analytics-conversion',
  'settings',
  'codes',
  'channel-analysis',
  'users'
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
  return map;
})();

function menuGroupMeta(groupId) {
  for (var g = 0; g < ADMIN_MENU_GROUPS.length; g++) {
    if (ADMIN_MENU_GROUPS[g].id === groupId) return ADMIN_MENU_GROUPS[g];
  }
  return { id: groupId || '', label: '', order: 999 };
}

/** 获取：AssignableMenuDefs */
function getAssignableMenuDefs() {
  var seen = Object.create(null);
  var out = [];
  for (var i = 0; i < ADMIN_PAGE_DEFS.length; i++) {
    var d = ADMIN_PAGE_DEFS[i];
    if (d.assignable === false) continue;
    if (seen[d.menu_key]) continue;
    seen[d.menu_key] = 1;
    var grp = menuGroupMeta(d.group);
    out.push({
      key: d.menu_key,
      label: d.label,
      group: d.group,
      group_label: grp.label || '',
      group_order: grp.order,
      order: d.order,
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
  if (def.hide_for_super && admin && admin.is_super) return false;
  if (def.super_only && !(admin && admin.is_super)) return false;
  if (admin && admin.is_super) return true;
  var menus = admin && Array.isArray(admin.menus) ? admin.menus : [];
  if (menus.indexOf(def.menu_key) >= 0) return true;
  var aliases = Array.isArray(def.alias_menus) ? def.alias_menus : [];
  var a;
  for (a = 0; a < aliases.length; a++) {
    if (menus.indexOf(aliases[a]) >= 0) return true;
  }
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

/** 辅助函数：firstAllowedPage — 运营页优先 */
function firstAllowedPage(admin) {
  var i;
  for (i = 0; i < ADMIN_PREFERRED_FIRST_PAGES.length; i++) {
    if (adminProfileCanAccessPage(admin, ADMIN_PREFERRED_FIRST_PAGES[i])) {
      return ADMIN_PREFERRED_FIRST_PAGES[i];
    }
  }
  var built = buildMenuTreeForAdmin(admin);
  if (built.menu_tree.length && built.menu_tree[0].items && built.menu_tree[0].items.length) {
    return built.menu_tree[0].items[0].page;
  }
  if (built.pages.length) return built.pages[0].page;
  return 'analytics-conversion';
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
  ADMIN_PREFERRED_FIRST_PAGES,
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
