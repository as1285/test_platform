/**
 * 管理台菜单/页面单一来源（阶段 2）。
 * - menu_key：写入 admin_account_menus、用于 requireAdminMenu
 * - page：前端 hash / data-page（可与 menu_key 不同，如 users-deleted）
 * - module：前端懒加载模块名
 *
 * 信息架构：转化运营 → 内容配置 → 用户管理 → 业务工具 → 数据分析 → 系统与安全
 * C 档合并：内容配置 / 证明工具 / 社保公积金 / 登录审计 / 产品洞察 / 增长洞察
 */
const config = require('../shared/config');
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
  /* —— 转化运营：统一看板 + 名单/广告/发码 —— */
  {
    page: 'ops-board',
    menu_key: 'ops-board',
    label: '运营看板',
    group: 'ops-desk',
    module: 'ops-conversion',
    order: 5,
    alias_menus: ['analytics-conversion', 'ops-lift', 'ops-research']
  },
  {
    page: 'ops-research',
    menu_key: 'ops-research',
    label: '转化调研',
    group: 'ops-desk',
    module: 'ops-conversion',
    order: 20,
    alias_menus: ['analytics-conversion', 'tax-fill-survey', 'ops-board'],
    assignable: false,
    nav_hidden: true
  },
  {
    page: 'ops-lift',
    menu_key: 'ops-lift',
    label: '提高转化',
    group: 'ops-desk',
    module: 'ops-conversion',
    order: 30,
    alias_menus: ['analytics-conversion', 'ops-board'],
    assignable: false,
    nav_hidden: true
  },
  {
    page: 'abc-ops',
    menu_key: 'abc-ops',
    label: 'ABC渠道',
    group: 'ops-desk',
    module: 'abc-ops',
    order: 12,
    alias_menus: ['abc-users', 'abc-install-stats', 'insights-growth', 'install-guide-stats']
  },
  {
    page: 'abc-users',
    menu_key: 'abc-ops',
    label: 'ABC用户',
    group: 'ops-desk',
    module: 'abc-ops',
    order: 13,
    assignable: false,
    nav_hidden: true,
    alias_menus: ['abc-ops', 'insights-growth']
  },
  {
    page: 'ops-ad-analytics',
    menu_key: 'ops-ad-analytics',
    label: '广告页',
    group: 'ops-desk',
    module: 'ad-analytics',
    order: 35,
    alias_menus: ['analytics-conversion', 'ops-board']
  },
  {
    page: 'analytics-conversion',
    menu_key: 'analytics-conversion',
    label: '转化概览',
    group: 'ops-desk',
    module: 'analytics',
    order: 40,
    assignable: false,
    nav_hidden: true
  },
  {
    page: 'analytics-purchase',
    menu_key: 'analytics-purchase',
    label: '支付分析',
    group: 'insights',
    module: 'analytics',
    order: 40
  },
  { page: 'codes', menu_key: 'codes', label: '激活码', group: 'ops-desk', module: 'codes', order: 50 },
  {
    page: 'payment-orders',
    menu_key: 'payment-orders',
    label: '订单检索',
    group: 'ops-desk',
    module: 'payment-orders',
    order: 55,
    alias_menus: ['analytics-purchase', 'ops-board', 'codes']
  },

  /* —— 内容配置 hub —— */
  {
    page: 'settings',
    menu_key: 'settings',
    label: '内容配置',
    group: 'ops-config',
    module: 'settings',
    order: 10,
    alias_menus: ['install-guide', 'appearance']
  },
  {
    page: 'install-guide',
    menu_key: 'install-guide',
    label: '安装分发',
    group: 'ops-config',
    module: 'settings',
    order: 20,
    assignable: false,
    nav_hidden: true
  },
  {
    page: 'appearance',
    menu_key: 'appearance',
    label: '外观',
    group: 'ops-config',
    module: 'settings',
    order: 25,
    assignable: false,
    nav_hidden: true
  },

  /* —— 用户 —— */
  { page: 'users', menu_key: 'users', label: '注册用户', group: 'users', module: 'users', order: 10 },
  {
    page: 'rename-tax-daily',
    menu_key: 'rename-tax-daily',
    label: '同行 · 高频改名',
    group: 'users',
    module: 'users',
    order: 15,
    alias_menus: ['peer-accounts']
  },
  {
    page: 'user-emails',
    menu_key: 'user-emails',
    label: '邮箱管理',
    group: 'users',
    module: 'user-emails',
    order: 20,
    alias_menus: ['users', 'ops-board']
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
    label: '社保公积金',
    group: 'cert-tools',
    module: 'sbdy-demo',
    order: 10,
    alias_menus: ['gjj-demo']
  },
  {
    page: 'gjj-demo',
    menu_key: 'gjj-demo',
    label: '公积金演示',
    group: 'cert-tools',
    module: 'gjj-demo',
    order: 15,
    assignable: false,
    nav_hidden: true
  },
  {
    page: 'lizhi-cert',
    menu_key: 'lizhi-cert',
    label: '证明工具',
    group: 'cert-tools',
    module: 'lizhi-cert',
    order: 20,
    alias_menus: ['zaizhi-cert']
  },
  {
    page: 'zaizhi-cert',
    menu_key: 'zaizhi-cert',
    label: '在职证明',
    group: 'cert-tools',
    module: 'zaizhi-cert',
    order: 25,
    assignable: false,
    nav_hidden: true
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

  /* —— 数据：产品洞察 / 增长洞察 hub —— */
  {
    page: 'insights-product',
    menu_key: 'insights-product',
    label: '产品洞察',
    group: 'insights',
    module: 'analytics',
    order: 18,
    alias_menus: ['analytics-activity', 'analytics-devices', 'tax-fill-survey', 'feedback', 'feature-survey']
  },
  {
    page: 'insights-growth',
    menu_key: 'insights-growth',
    label: '增长洞察',
    group: 'insights',
    module: 'analytics',
    order: 19,
    alias_menus: ['ops-inactive', 'channel-analysis', 'install-guide-stats']
  },
  {
    page: 'ops-inactive',
    menu_key: 'ops-inactive',
    label: '未激活用户',
    group: 'insights',
    module: 'ops-conversion',
    order: 21,
    alias_menus: ['analytics-conversion', 'users', 'ops-board', 'insights-growth'],
    assignable: false,
    nav_hidden: true
  },
  {
    page: 'analytics-activity',
    menu_key: 'analytics-activity',
    label: '用户活跃',
    group: 'insights',
    module: 'analytics',
    order: 20,
    assignable: false,
    nav_hidden: true
  },
  {
    page: 'feature-survey',
    menu_key: 'feature-survey',
    label: '功能调研',
    group: 'insights',
    module: 'feature-survey',
    order: 21,
    assignable: false,
    nav_hidden: true,
    alias_menus: ['insights-product', 'tax-fill-survey', 'analytics-purchase', 'analytics']
  },
  {
    page: 'tax-fill-survey',
    menu_key: 'tax-fill-survey',
    label: '填写调研',
    group: 'insights',
    module: 'tax-fill-survey',
    order: 22,
    assignable: false,
    nav_hidden: true
  },
  {
    page: 'analytics-devices',
    menu_key: 'analytics-devices',
    label: '机型',
    group: 'insights',
    module: 'devices',
    order: 25,
    assignable: false,
    nav_hidden: true
  },
  {
    page: 'feedback',
    menu_key: 'feedback',
    label: '兼容反馈',
    group: 'insights',
    module: 'feedback',
    order: 26,
    assignable: false,
    nav_hidden: true,
    alias_menus: ['insights-product', 'analytics-devices']
  },
  {
    page: 'channel-analysis',
    menu_key: 'channel-analysis',
    label: '渠道分析',
    group: 'insights',
    module: 'analytics',
    order: 50,
    assignable: false,
    nav_hidden: true
  },
  {
    page: 'install-guide-stats',
    menu_key: 'install-guide-stats',
    label: '安装统计',
    group: 'insights',
    module: 'analytics',
    order: 60,
    assignable: false,
    nav_hidden: true
  },
  {
    page: 'abc-install-stats',
    menu_key: 'abc-ops',
    label: 'ABC下载页',
    group: 'ops-desk',
    module: 'abc-ops',
    order: 14,
    assignable: false,
    nav_hidden: true,
    alias_menus: ['install-guide-stats', 'insights-growth', 'abc-ops']
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
    label: '登录审计',
    group: 'system',
    module: 'logs',
    order: 30,
    alias_menus: ['user-login-log']
  },
  {
    page: 'user-login-log',
    menu_key: 'user-login-log',
    label: '用户登录',
    group: 'system',
    module: 'logs',
    order: 40,
    assignable: false,
    nav_hidden: true
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
  'ops-board',
  'abc-ops',
  'ops-inactive',
  'ops-ad-analytics',
  'codes',
  'settings',
  'insights-growth',
  'insights-product',
  'users'
];

/**
 * 侧栏 hub：旧页仍保留 DOM，hash `#hub/tab` 或旧 hash 打开对应内容页。
 * tab → 实际 content page（有独立 #page-*）
 */
const ADMIN_HUB_DEFS = {
  settings: {
    nav: 'settings',
    defaultTab: 'pricing',
    tabs: [
      { id: 'pricing', label: '定价与引导', page: 'settings' },
      { id: 'install', label: '安装分发', page: 'install-guide' },
      { id: 'appearance', label: '外观', page: 'appearance' }
    ]
  },
  'lizhi-cert': {
    nav: 'lizhi-cert',
    defaultTab: 'lizhi',
    tabs: [
      { id: 'lizhi', label: '离职证明', page: 'lizhi-cert' },
      { id: 'zaizhi', label: '在职证明', page: 'zaizhi-cert' }
    ]
  },
  'sbdy-demo': {
    nav: 'sbdy-demo',
    defaultTab: 'sbdy',
    tabs: [
      { id: 'sbdy', label: '社保演示', page: 'sbdy-demo' },
      { id: 'gjj', label: '公积金演示', page: 'gjj-demo' }
    ]
  },
  'login-log': {
    nav: 'login-log',
    defaultTab: 'admin',
    tabs: [
      { id: 'admin', label: '管理登录', page: 'login-log' },
      { id: 'user', label: '用户登录', page: 'user-login-log' }
    ]
  },
  'insights-product': {
    nav: 'insights-product',
    defaultTab: 'activity',
    tabs: [
      { id: 'activity', label: '用户活跃', page: 'analytics-activity' },
      { id: 'devices', label: '机型', page: 'analytics-devices' },
      { id: 'features', label: '功能调研', page: 'feature-survey' },
      { id: 'survey', label: '填写调研', page: 'tax-fill-survey' },
      { id: 'feedback', label: '兼容反馈', page: 'feedback' }
    ]
  },
  'insights-growth': {
    nav: 'insights-growth',
    defaultTab: 'channel',
    tabs: [
      { id: 'channel', label: '渠道分析', page: 'channel-analysis' },
      { id: 'inactive', label: '未激活用户', page: 'ops-inactive' },
      { id: 'install-stats', label: '安装统计', page: 'install-guide-stats' }
    ]
  },
  'abc-ops': {
    nav: 'abc-ops',
    defaultTab: 'funnel',
    tabs: [
      { id: 'funnel', label: '转化', page: 'abc-ops' },
      { id: 'users', label: '用户', page: 'abc-users' },
      { id: 'install', label: '下载页', page: 'abc-install-stats' }
    ]
  },
  'ops-ad-analytics': {
    nav: 'ops-ad-analytics',
    defaultTab: 'config',
    tabs: [
      { id: 'config', label: '配置', page: 'ops-ad-analytics' },
      { id: 'data', label: '数据', page: 'ops-ad-analytics' },
      { id: 'reach', label: '触达', page: 'ops-ad-analytics' }
    ]
  }
};

/** 内容页 → 所属 hub（用于侧栏高亮与旧 hash 归一） */
const ADMIN_CONTENT_TO_HUB = (function () {
  var map = Object.create(null);
  Object.keys(ADMIN_HUB_DEFS).forEach(function (hub) {
    ADMIN_HUB_DEFS[hub].tabs.forEach(function (t) {
      map[t.page] = { hub: hub, tab: t.id };
    });
  });
  return map;
})();

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

/** 已合并侧栏页：旧 hash 仍指向同一面板 */
var ADMIN_PAGE_ALIASES = {
  'peer-accounts': 'rename-tax-daily',
  'analytics-tracking': 'analytics-purchase'
};

/**
 * 解析 hash：`settings` / `settings/install` / `install-guide`
 * @returns {{ page: string, hub: string|null, tab: string|null, contentPage: string }}
 */
function parseAdminRoute(raw) {
  var full = String(raw || '')
    .replace(/^#/, '')
    .trim()
    .toLowerCase();
  var slash = full.indexOf('/');
  var head = slash >= 0 ? full.slice(0, slash) : full;
  var tabPart = slash >= 0 ? full.slice(slash + 1).replace(/\/+$/, '') : '';
  if (head === 'system' || head === 'setting') head = 'settings';
  if (head === 'install' || head === 'guide') head = 'install-guide';
  if (head === 'analytics' || head === 'analytics-conversion') head = 'ops-board';
  if (head === 'ops-research' || head === 'ops-lift') head = 'ops-board';
  if (head === 'insights-growth' && tabPart === 'abc') {
    head = 'abc-ops';
    tabPart = 'install';
  }
  if (head === 'analytics-register') head = 'install-guide-stats';
  if (head === 'analytics-tracking') head = 'analytics-purchase';
  if (ADMIN_PAGE_ALIASES[head]) head = ADMIN_PAGE_ALIASES[head];

  if (ADMIN_HUB_DEFS[head]) {
    var hubDef = ADMIN_HUB_DEFS[head];
    var tabId = tabPart || hubDef.defaultTab;
    var tab = null;
    for (var i = 0; i < hubDef.tabs.length; i++) {
      if (hubDef.tabs[i].id === tabId) {
        tab = hubDef.tabs[i];
        break;
      }
    }
    if (!tab) tab = hubDef.tabs[0];
    return {
      page: head,
      hub: head,
      tab: tab.id,
      contentPage: tab.page
    };
  }

  var mapped = ADMIN_CONTENT_TO_HUB[head];
  if (mapped) {
    return {
      page: mapped.hub,
      hub: mapped.hub,
      tab: mapped.tab,
      contentPage: head
    };
  }

  return { page: head, hub: null, tab: null, contentPage: head };
}

function normalizeAdminPageKey(page) {
  var parsed = parseAdminRoute(page);
  return parsed.contentPage || parsed.page || '';
}

/** 辅助函数：resolveMenuKeyForPage */
function resolveMenuKeyForPage(page) {
  var parsed = parseAdminRoute(page);
  var p = parsed.hub || parsed.contentPage || parsed.page;
  for (var i = 0; i < ADMIN_PAGE_DEFS.length; i++) {
    if (ADMIN_PAGE_DEFS[i].page === p) return ADMIN_PAGE_DEFS[i].menu_key;
  }
  for (var j = 0; j < ADMIN_PAGE_DEFS.length; j++) {
    if (ADMIN_PAGE_DEFS[j].page === parsed.contentPage) return ADMIN_PAGE_DEFS[j].menu_key;
  }
  return p;
}

/** 获取：PageDef */
function getPageDef(page) {
  var parsed = parseAdminRoute(page);
  var candidates = [parsed.contentPage, parsed.hub, parsed.page];
  for (var c = 0; c < candidates.length; c++) {
    var p = candidates[c];
    if (!p) continue;
    for (var i = 0; i < ADMIN_PAGE_DEFS.length; i++) {
      if (ADMIN_PAGE_DEFS[i].page === p) return ADMIN_PAGE_DEFS[i];
    }
  }
  return null;
}

/** 辅助函数：adminProfileCanAccessPage */
function adminProfileCanAccessPage(admin, page) {
  var parsed = parseAdminRoute(page);
  /* hub 入口：有 hub menu 或任一 tab 内容页权限即可 */
  if (parsed.hub && ADMIN_HUB_DEFS[parsed.hub] && parsed.page === parsed.hub) {
    var hubDef = null;
    for (var hi = 0; hi < ADMIN_PAGE_DEFS.length; hi++) {
      if (ADMIN_PAGE_DEFS[hi].page === parsed.hub) {
        hubDef = ADMIN_PAGE_DEFS[hi];
        break;
      }
    }
    if (hubDef && adminProfileCanAccessPageRaw(admin, hubDef)) return true;
    var tabs = ADMIN_HUB_DEFS[parsed.hub].tabs;
    for (var t = 0; t < tabs.length; t++) {
      var tDef = null;
      for (var i = 0; i < ADMIN_PAGE_DEFS.length; i++) {
        if (ADMIN_PAGE_DEFS[i].page === tabs[t].page) {
          tDef = ADMIN_PAGE_DEFS[i];
          break;
        }
      }
      if (tDef && adminProfileCanAccessPageRaw(admin, tDef)) return true;
    }
    return false;
  }
  var def = getPageDef(page);
  if (adminProfileCanAccessPageRaw(admin, def)) return true;
  var contentKey = parsed.contentPage || parsed.page;
  var mapped = ADMIN_CONTENT_TO_HUB[contentKey];
  if (mapped && mapped.hub !== contentKey) {
    return adminProfileCanAccessPage(admin, mapped.hub);
  }
  return false;
}

function adminProfileCanAccessPageRaw(admin, def) {
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
  if (def.menu_key.indexOf('insights-') === 0 && menus.indexOf('analytics') >= 0) return true;
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
    if (d.nav_hidden) continue;
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
  return 'ops-board';
}

/** 构建：AdminSessionPayload */
function buildAdminSessionPayload(admin) {
  var built = buildMenuTreeForAdmin(admin);
  return {
    admin: {
      username: admin.username,
      full_name: admin.full_name || '',
      is_super: !!admin.is_super,
      is_root_admin:
        String(admin.username || '').trim().toLowerCase() ===
        String((config.ADMIN_PANEL_USER || 'admin') + '').trim().toLowerCase(),
      menus: Array.isArray(admin.menus) ? admin.menus.slice() : []
    },
    menu_tree: built.menu_tree,
    pages: built.pages,
    menu_defs: getAssignableMenuDefs(),
    first_page: firstAllowedPage(admin),
    hubs: ADMIN_HUB_DEFS
  };
}

module.exports = {
  ADMIN_MENU_GROUPS,
  ADMIN_PAGE_DEFS,
  ADMIN_PREFERRED_FIRST_PAGES,
  ADMIN_HUB_DEFS,
  ADMIN_CONTENT_TO_HUB,
  ADMIN_MENU_KEYS,
  ADMIN_MENU_LABELS,
  getAssignableMenuDefs,
  parseAdminRoute,
  normalizeAdminPageKey,
  resolveMenuKeyForPage,
  getPageDef,
  adminProfileCanAccessPage,
  buildMenuTreeForAdmin,
  firstAllowedPage,
  buildAdminSessionPayload
};
