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
      },
      {
        page: 'shouye',
        title: '禁止 100dvh 叠高',
        summary: 'body/首页叠 min-height:100dvh 会导致无法下滑；改 100vh + height:auto，通用 78px 顶距排除 iOS。',
        since: '2026-08-21'
      },
      {
        page: 'shouye',
        title: '中间服务卡按正版收小',
        summary: '全苹果机统一收小，撤销 iPhone 15 Pro Max / 全 iOS 3.1 特判。',
        since: '2026-08-22'
      },
      {
        page: 'mine',
        title: '顶安全区跨机型对齐',
        summary: '头图 bleed 进刘海，状态栏蓝对齐头像顶图；html 只在顶部画蓝带，避免底栏下露蓝。',
        since: '2026-08-06'
      },
      {
        page: 'nav',
        title: '底栏默认 8px 胶囊',
        summary: '高 54px、左右 16px、底浮 8px；勿再叠 safe-area，否则整条上移留灰底。backdrop-filter 会让「我的」底栏抬高。',
        since: '2026-07'
      },
      {
        page: 'type',
        title: 'PingFang 降字重',
        summary: '500/600 明显偏粗，汇总/列表标题多降到 400；问号与字等高。',
        since: '2026-05'
      },
      {
        page: 'interact',
        title: 'WKWebView 点击与输入',
        summary: '滚动容器内 click 易丢，用 touchend+click；年月 select 改 number；浏览器打开登录/我的不再误弹安装引导。',
        since: '2026-06'
      }
    ]
  }
];
