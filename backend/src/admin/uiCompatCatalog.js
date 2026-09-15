/**
 * 近几个月（2026-05 ~ 2026-08）C 端 UI 兼容修改点目录。
 * 供管理台「机型」页与线上 user_devices 对账：哪台机改过什么、现在有多少用户。
 */

var PAGE_DEFS = [
  { key: 'shouye', label: '首页' },
  { key: 'mine', label: '我的' },
  { key: 'shuiming', label: '纳税明细' },
  { key: 'nav', label: '底栏' },
  { key: 'interact', label: '交互' },
  { key: 'type', label: '字体排版' }
];

var PAGE_LABEL = PAGE_DEFS.reduce(function (map, p) {
  map[p.key] = p.label;
  return map;
}, {});

/**
 * match：对 UA + Cordova model + brand 拼接串做 i 匹配。
 * 具体机型须带负向排除，避免 13 套到 13 Pro、Mate60 套到 Mate70。
 * common:true 表示该平台通用规则，按系统计入，不按型号对账。
 */
var MODELS = [
  {
    id: 'ios-common',
    platform: 'ios',
    family: 'apple',
    label: '苹果通用',
    common: true,
    issues: [
      {
        page: 'shouye',
        title: '状态栏与搜索顶栏同蓝',
        summary: '刘海/灵动岛不能露白；全机统一铺顶栏蓝，不再按型号枚举。',
        since: '2026-07'
      }
    ]
  }
];
