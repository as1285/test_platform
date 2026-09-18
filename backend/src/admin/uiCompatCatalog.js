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
var CORE_MODELS = [
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
  },
  {
    id: 'iphone-11-pro',
    platform: 'ios',
    family: 'apple',
    label: 'iPhone 11 Pro',
    match: ['iPhone\\s*11\\s*Pro\\b(?!\\s*Max)', 'iPhone12,3'],
    issues: [
      { page: 'shuiming', title: '汇总/标题字重再变细', summary: 'PingFang 下「工资薪金」等偏粗，单独降字重；问号缩小。', since: '2026-05-20' },
      { page: 'shuiming', title: '筛选页顶栏与安全区白底一致', summary: '筛选页顶栏贴安全区，避免露缝。', since: '2026-05-20' }
    ]
  },
  {
    id: 'iphone-12',
    platform: 'ios',
    family: 'apple',
    label: 'iPhone 12 / 12 Pro',
    match: ['iPhone\\s*12\\s*Pro\\b(?!\\s*Max)', 'iPhone\\s*12\\b(?!\\s*Pro)', 'iPhone13,3', 'iPhone13,2'],
    issues: [
      { page: 'shuiming', title: '白顶栏深色系统时间', summary: '12 Pro 白顶栏改深色时间，避免浅色图标看不见。', since: '2026-08-13' },
      {
        page: 'shuiming',
        title: '进页首条钻进汇总',
        summary:
          'iPhone13,2 被误判成 13；14/12 安全区样式把汇总刷白且列表顶距不含刘海，首条「工资薪金」一进来就压在合计下。排除 12 系硬件号，汇总灰底并按盒底实测下推列表。',
        since: '2026-09-17'
      },
      { page: 'mine', title: '底栏不悬空', summary: 'layout viewport 比屏幕矮一截刘海，100dvh 会把底栏抬高。', since: '2026-08-11' }
    ]
  },
  {
    id: 'iphone-12-promax',
    platform: 'ios',
    family: 'apple',
    label: 'iPhone 12 Pro Max',
    match: ['iPhone\\s*12\\s*Pro\\s*Max', 'iPhone13,4'],
    issues: [
      { page: 'mine', title: '刘海白边', summary: '待办/办查/消息/我的用头图 bleed，取消固色垫带。', since: '2026-05-30' },
      { page: 'shuiming', title: '大屏正文字号放大', summary: '收入纳税明细大屏下正文字号偏小。', since: '2026-05-21' }
    ]
  },
  {
    id: 'iphone-13',
    platform: 'ios',
    family: 'apple',
    label: 'iPhone 13',
    match: ['iPhone\\s*13\\b(?!\\s*Pro)(?!\\s*(?:mini|Mini))', 'iPhone14,5'],
    issues: [
      { page: 'shuiming', title: '明细行字色 #666', summary: '列表字色加深，对齐官方。', since: '2026-08-14' },
      { page: 'shuiming', title: '扣缴义务人完整显示', summary: '不能裁成 11 字。', since: '2026-08-14' }
    ]
  },
  {
    id: 'iphone-13-promax',
    platform: 'ios',
    family: 'apple',
    label: 'iPhone 13 Pro Max',
    match: ['iPhone\\s*13\\s*Pro\\s*Max', 'iPhone14,3'],
    issues: [
      {
        page: 'nav',
        title: '底栏被 Home Indicator 裁掉',
        summary: '视口比 screen 矮一截刘海时按 screen.height 下拉会把 TAB 拽出屏；铺满底边并垫 safe-area。',
        since: '2026-08-26'
      }
    ]
  },
  {
    id: 'iphone-14',
    platform: 'ios',
    family: 'apple',
    label: 'iPhone 14',
    match: ['iPhone\\s*14\\b(?!\\s*Pro)(?!\\s*Plus)', 'iPhone14,7'],
    issues: [
      { page: 'shuiming', title: '顶栏防透出并恢复系统栏', summary: '白底铺满状态栏，避免列表字从刘海透出。', since: '2026-05-27' }
    ]
  },
  {
    id: 'iphone-14-promax',
    platform: 'ios',
    family: 'apple',
    label: 'iPhone 14 Pro Max',
    match: ['iPhone\\s*14\\s*Pro\\s*Max', 'iPhone15,3'],
    issues: [
      {
        page: 'shouye',
        title: '通知条字号放大',
        summary: '430 大屏上 a1 通知条 16px 偏小，提到 18px/500。',
        since: '2026-09-16'
      },
      {
        page: 'shuiming',
        title: '大屏正文字号放大',
        summary: '收入纳税明细默认 14–16px 偏小，对齐 16 Pro Max 放大。',
        since: '2026-09-16'
      },
      {
        page: 'mine',
        title: '我的页回退 9/1 画布',
        summary: '14 Pro Max 单独回退到 9/1 底图：按型号/430×932/显示放大+灵动岛识别，隐藏 HTML 胶囊，避免压住家庭成员。其它机型不动。',
        since: '2026-09-17'
      },
      {
        page: 'login',
        title: '登录页字号与表单过窄',
        summary: '按 375 设计的 15–17px / 343 宽在 14 Pro Max 上显小，标题 20px、输入 17px、表单拉到 390。',
        since: '2026-09-17'
      }
    ]
  },
  {
    id: 'iphone-15',
    platform: 'ios',
    family: 'apple',
    label: 'iPhone 15',
    match: [
      'iPhone\\s*15\\b(?!\\s*Plus)(?!\\s*Pro\\s*Max)',
      'iPhone15,4',
      'iPhone16,1',
      'iPhone15Pro\\b(?!Max)',
      'iPhone\\s*15\\s*Pro\\b(?!\\s*Max)'
    ],
    issues: [
      {
        page: 'chrome',
        title: 'iOS 27 顶栏毛玻璃',
        summary:
          '15 Pro 硬件号 iPhone16,1，曾被误判成 15 Pro Max，顶栏不铺进状态栏，Liquid Glass 采到灰底发糊。按 15 同套 393 实底白/蓝。',
        since: '2026-09-18'
      },
      { page: 'shuiming', title: '扣缴义务人箭头贴字底', summary: '公司名行「>」偏下；底边与公司名同一水平线。', since: '2026-09-04' },
      {
        page: 'shuiming',
        title: '切年份二次进入顶空白',
        summary:
          'iOS 按路径恢复滚动后重算顶距，或列表 padding-top 吃进汇总高度，使劲回弹会把灰垫整块拽出。列表接到汇总底下、padding-top 置 0，橡皮筋时不写 margin。',
        since: '2026-09-04'
      }
    ]
  },
  {
    id: 'iphone-15-promax',
    platform: 'ios',
    family: 'apple',
    label: 'iPhone 15 Pro Max / 15 Plus',
    match: ['iPhone\\s*15\\s*Pro\\s*Max', 'iPhone\\s*15\\s*Plus', 'iPhone16,2', 'iPhone15,5'],
    issues: [
      { page: 'shuiming', title: '扣缴义务人箭头贴字底', summary: '公司名行「>」偏下；底边与公司名同一水平线。', since: '2026-09-04' },
      { page: 'shuiming', title: '滑动时状态栏防透出', summary: '列表上滑不能从刘海透出内容。', since: '2026-05-27' },
      { page: 'nav', title: '底栏铺满盖住 Home Indicator', summary: '胶囊底下会透出页面；须 bottom:0、圆角 0。其它 iPhone 仍保持 8px 胶囊。', since: '2026-08-22' },
      { page: 'shouye', title: '首页状态栏铺蓝', summary: '刘海接缝处铺搜索顶栏蓝。', since: '2026-07-16' }
    ]
  },
  {
    id: 'iphone-16-pro',
    platform: 'ios',
    family: 'apple',
    label: 'iPhone 16 Pro',
    match: ['iPhone\\s*16\\s*Pro\\b(?!\\s*Max)', 'iPhone17,1'],
    issues: [
      { page: 'shouye', title: '状态栏白边改顶栏蓝', summary: '首页刘海白边接缝。', since: '2026-05-20' },
      { page: 'shuiming', title: '结果页状态栏改白 + 义务人完整', summary: '白顶栏浅色图标看不见；扣缴义务人不能截断。', since: '2026-05-20' },
      {
        page: 'shuiming',
        title: '结果页顶距勿被非 Cordova 通用规则盖掉',
        summary:
          '非 Cordova 的 env(safe-area)=0 规则优先级更高时，「返回/标题」贴顶。须排除 16 Pro 并强制至少 59px，汇总灰底对齐正确 UI。',
        since: '2026-09-06'
      },
      {
        page: 'shuiming',
        title: '结果页顶栏贴 Island + 汇总顶灰缝',
        summary:
          '官方标题下有 12px 灰缝再接「收入合计」。顶栏收为 44px 避免 Island 下多白，汇总 padding 12px 0 10px。',
        since: '2026-09-06'
      },
      { page: 'nav', title: '五 Tab 底栏间距统一', summary: '「我的」最容易悬空；100dvh 在 16 Pro 会少一截刘海。', since: '2026-08-16' }
    ]
  },
  {
    id: 'iphone-16-promax',
    platform: 'ios',
    family: 'apple',
    label: 'iPhone 16 Pro Max',
    match: ['iPhone\\s*16\\s*Pro\\s*Max', 'iPhone17,2', 'MYTN3'],
    issues: [
      { page: 'shuiming', title: '顶栏勿铺满状态栏', summary: '白底铺满会挡住系统时间，与 14/15 相反。', since: '2026-06-17' },
      { page: 'shuiming', title: '明细页大屏比例收窄', summary: '440 宽下贴边铺满+13em 公司名显得过宽；列表留白、字号与公司名加宽。', since: '2026-09-02' },
      { page: 'nav', title: '五 Tab 底栏间距统一', summary: '与 16 Pro 同一套 8px，勿套 15 Pro Max 铺满。', since: '2026-08-16' }
    ]
  },
  {
    id: 'iphone-air',
    platform: 'ios',
    family: 'apple',
    label: 'iPhone Air',
    match: ['iPhone\\s*Air', 'iPhone18,4'],
    issues: [
      {
        page: 'shuiming',
        title: '收入纳税明细左右贴边',
        summary:
          '逻辑宽 420 会命中 ≥414 的 20px 卡片留白，左右空条过大；class app-ios-iphoneair 压成贴边 16px（同 15 Plus）。420 还会误挂 promax-font 把汇总刷成白底，汇总与首条之间的灰缝消失，须压回 #f5f6fa。',
        since: '2026-09-04'
      }
    ]
  },
  {
    id: 'iphone-17',
    platform: 'ios',
    family: 'apple',
    label: 'iPhone 17 系列',
    match: ['iPhone\\s*17', 'iPhone18,', 'iPhone19,'],
    issues: [
      { page: 'shuiming', title: '问号改 Helvetica/SVG', summary: '描边在 Retina 上看不清；17 标准版问号缩到 13px。', since: '2026-06-13' },
      { page: 'shuiming', title: '大屏字号与顶栏字号', summary: '12/17 Pro Max 正文放大；17 Pro 返回/批量申诉字号放大。', since: '2026-05-21' },
      { page: 'shuiming', title: '17 Pro Max 贴边与箭头右齐', summary: 'UA 无型号时按 440×956 识别；列表 100vw 钉满并实测去灰边。箭头底边与公司名同一水平线。', since: '2026-09-04' }
    ]
  },

  {
    id: 'android-common',
    platform: 'android',
    family: 'android',
    label: '安卓通用',
    common: true,
    issues: [
      {
        page: 'shuiming',
        title: '白顶栏默认沉浸 40px',
        summary:
          'App 内 Cordova 多数仍画到系统栏下。收入纳税明细/筛选/详情默认留 40px，不再按 ColorOS/OriginOS/HyperOS 族名清零。仅 A58、Find X9、荣耀折叠、三星、Pura70、小米 14 等已核实外置栏清零。重叠优先于一条细缝。',
        since: '2026-09-04'
      },
      {
        page: 'shouye',
        title: '首页统一约 40px 顶距',
        summary: 'Cordova 普遍画到状态栏下，默认 inset 40px + 内容约 92px；Pura70 / 折叠外屏单独收。',
        since: '2026-08'
      },
      {
        page: 'mine',
        title: '默认 0-bleed',
        summary: '多数 OEM WebView 已在栏下；负 margin 会裁头像。一加 13 / Mix Fold / Reno10 等真沉浸才留 inset。',
        since: '2026-08-07'
      },
      {
        page: 'nav',
        title: '主 Tab 去掉白遮罩',
        summary: '全页重载 theme 常拖 1～2.5s；五页互切不盖转圈。从咨询等深层页离开立刻白底，防闪旧页。',
        since: '2026-08-21'
      },
      {
        page: 'type',
        title: 'Roboto 降字重、改字距',
        summary: '500 偏厚，汇总/标题降到 400；列表金额字距收到适中；汇总与列表缝约 8px。',
        since: '2026-05'
      },
      {
        page: 'interact',
        title: '弹层贴底 / 选图 / 支付宝',
        summary: '激活码与改资料弹框贴底；年月选择拉不起；社保选图无反应；支付宝勿 window.open https（易白屏），改 Intent。',
        since: '2026-06'
      }
    ]
  },
  {
    id: 'xiaomi-10',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 10',
    match: ['小米\\s*10\\b(?!S)', 'Xiaomi\\s*10\\b(?!S)', 'Mi\\s*10\\b', 'Mi 10'],
    issues: [{ page: 'shuiming', title: '刘海屏白顶栏避让', summary: 'WebView 压在状态栏下，须留 40px。', since: '2026-08-12' }]
  },
  {
    id: 'xiaomi-13',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 13',
    match: ['小米\\s*13\\b(?!\\s*Pro)(?!\\s*Ultra)', 'Xiaomi\\s*13\\b(?!\\s*Pro)(?!\\s*Ultra)', '2211133C', '2211133G'],
    issues: [
      { page: 'shuiming', title: '白顶栏避开系统状态栏', summary: 'HyperOS Cordova 仍压白状态栏，不能按普通小米清零。', since: '2026-08-22' },
      { page: 'shouye', title: '首页卡与个人信息卡圆角', summary: '首页卡适配；个人信息卡恢复顶部圆角。', since: '2026-07-08' }
    ]
  },
  {
    id: 'xiaomi-13-pro',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 13 Pro',
    match: ['小米\\s*13\\s*Pro', 'Xiaomi\\s*13\\s*Pro', '2210132C', '2210132G'],
    issues: [
      { page: 'shuiming', title: '标题避开系统时间', summary: '不能按普通小米外置栏清零，否则标题与 5G/电量重合。', since: '2026-08' }
    ]
  },
  {
    id: 'xiaomi-14',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 14',
    match: ['小米\\s*14\\b(?!\\s*Pro)(?!\\s*Ultra)', 'Xiaomi\\s*14\\b(?!\\s*Pro)(?!\\s*Ultra)', '23127PN0CC', '23127PN'],
    issues: [
      { page: 'shouye', title: '首页/办查/我的顶栏与横向贴边', summary: 'Cordova 壳状态栏为黑条，iframe 内 env 常为 0。', since: '2026-05-15' },
      { page: 'shuiming', title: '详情顶栏避让', summary: '首块内容被状态栏遮挡。', since: '2026-05-15' }
    ]
  },
  {
    id: 'xiaomi-14-pro',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 14 Pro',
    match: ['小米\\s*14\\s*Pro', 'Xiaomi\\s*14\\s*Pro', '23116PN5BC', '23116PN5BG'],
    issues: [
      { page: 'shuiming', title: '白顶栏 40px + 义务人完整', summary: 'Cordova 仍压白状态栏；扣缴义务人完整显示。', since: '2026-08-15' }
    ]
  },
  {
    id: 'xiaomi-15',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 15',
    match: ['小米\\s*15\\b(?!\\s*Pro)(?!\\s*Ultra)', 'Xiaomi\\s*15\\b(?!\\s*Pro)(?!\\s*Ultra)', '24129PN74C', '24129PN74G'],
    issues: [{ page: 'shuiming', title: '明细四行距拉开', summary: '行距过紧，单独拉齐；并避开 X300 Pro / Mate60 顶栏规则。', since: '2026-08-17' }]
  },
  {
    id: 'xiaomi-15-pro',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 15 Pro',
    match: ['小米\\s*15\\s*Pro', 'Xiaomi\\s*15\\s*Pro', '2410DPN6CC'],
    issues: [
      { page: 'nav', title: '底栏避开手势条', summary: 'Android 16 上 env(safe-area-inset-bottom) 常为 0，胶囊与系统手势条重叠。', since: '2026-08' }
    ]
  },
  {
    id: 'xiaomi-17-ultra',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 17 Ultra',
    match: ['小米\\s*17\\s*Ultra', 'Xiaomi\\s*17\\s*Ultra', '25128PNA1C'],
    issues: [{ page: 'shuiming', title: '顶栏避让 + 义务人完整', summary: '白顶栏避开状态栏。', since: '2026-08-13' }]
  },
  {
    id: 'xiaomi-mix-fold3',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 Mix Fold3',
    match: ['Mix\\s*Fold', 'MIX Fold', 'Fold3', 'Fold 3', '2308CPXD0C'],
    issues: [{ page: 'shouye', title: '外屏顶栏与服务卡缩放', summary: '折叠外屏状态栏在 WebView 外，服务卡宽窄屏单独缩放。', since: '2026-08-07' }]
  },
  {
    id: 'redmi-k70',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 K70 / 至尊',
    match: ['K70', 'Redmi\\s*K70', 'K70\\s*(?:至尊|Ultra)', '23113RKC6C', '23113RKC6G', '2407FRK8EC'],
    issues: [
      { page: 'shouye', title: '勿套小米 14 的 72px 留白', summary: '状态栏多为独立黑条，收紧首页顶距。', since: '2026-07-27' },
      { page: 'shuiming', title: 'K70 至尊白顶栏避让', summary: 'WebView 压在状态栏下的机型须留顶距。', since: '2026-08-13' },
      {
        page: 'mine',
        title: '「我的」underlap 黑垫',
        summary: 'K70 标准版（23113RKC6C）「我的」页顶 40px 黑垫；时间/电量由系统浅色图标画出，激活钮下移，勿把头图蓝铺进系统栏。至尊档仍走白顶沉浸。',
        since: '2026-09-10'
      }
    ]
  },
  {
    id: 'redmi-k80ultra',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 K80 Ultra',
    match: ['K80\\s*(?:至尊|Ultra)', '25060RK16C'],
    issues: [
      {
        page: 'shuiming',
        title: '白顶栏避开系统状态栏',
        summary: 'HyperOS 沉浸 WebView；勿按 K70 / mi-family 清零顶距。线上高频型号 25060RK16C。',
        since: '2026-09-05'
      }
    ]
  },
  {
    id: 'redmi-k80pro',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 K80 Pro',
    match: ['K80\\s*Pro', '24122RKC7C', '24127RK2CC', 'POCO\\s*F7\\s*Ultra'],
    issues: [
      {
        page: 'shuiming',
        title: '白顶栏避开系统状态栏',
        summary: 'HyperOS 沉浸 WebView 压在状态栏下；勿按 K70 的 1440×3200 兜底清零顶距，返回须留 40px。',
        since: '2026-08-29'
      }
    ]
  },
  {
    id: 'redmi-12c',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 12C',
    match: ['12C', 'Redmi\\s*12C', '22120RN86C'],
    issues: [{ page: 'shuiming', title: '白顶栏避开系统状态栏', summary: '与 K70 至尊同一套沉浸白顶栏。', since: '2026-08-13' }]
  },
  {
    id: 'redmi-note13-pro',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 Note 13 Pro',
    match: ['Note\\s*13\\s*Pro', 'Redmi\\s*Note\\s*13'],
    issues: [{ page: 'mine', title: '接缝漏蓝、「个人信息」挡眼睛', summary: '我的页接缝与底栏漏蓝。', since: '2026-08' }]
  },
  {
    id: 'huawei-mate30',
    platform: 'android',
    family: 'huawei',
    label: '华为 Mate 30',
    match: ['Mate\\s*30(?!\\s*Pro)', 'TAS-AL00', 'TAS-AN00', 'TAS-TL00', 'TAS-L29', 'HUAWEITAS'],
    issues: [
      {
        page: 'shuiming',
        title: '白顶栏标题避开系统状态栏',
        summary: 'TAS 被排除在通用鸿蒙沉浸外又走外置清零，标题压进系统栏只剩空白。须 40px 顶距。',
        since: '2026-08-27'
      }
    ]
  },
  {
    id: 'huawei-mate60',
    platform: 'android',
    family: 'huawei',
    label: '华为 Mate 60',
    match: ['Mate\\s*60', 'BRA-AL00', 'ALN-AL00', 'ALN-AL10', 'ALN-AL80', 'ALN-AN00', 'ALN-AL\\d{2}', 'ALN-AN\\d{2}', 'HUAWEIALN'],
    issues: [
      { page: 'mine', title: '0-bleed 完整头图（禁止负裁切）', summary: 'ArkWeb 负 margin 把头像裁进状态栏；冻在 8-12/e1 完整头图；主线 mine.html，旧 mine_v2 301 到主线。', since: '2026-08-24' },
      { page: 'mine', title: '实验层不可污染其它 Tab', summary: 'Jul23 卡片/40px 守卫曾加到没有 #mineE1Canvas 的首页/待办/消息。', since: '2026-08-21' },
      {
        page: 'mine',
        title: '系统栏黑条与 iOS 蓝顶区分',
        summary: '安卓/鸿蒙蓝顶页 StatusBar 用 #000 overlays=false，勿铺 #1677ff 沉浸；苹果仍 black-translucent 头图顶入。',
        since: '2026-09-03'
      },
      { page: 'shuiming', title: '全页避开状态栏', summary: '登录不再叠系统时间；沿用约 40px 顶距。', since: '2026-08-13' },
      {
        page: 'shuiming',
        title: '明细顶距选择器修复 + 列表贴边',
        summary:
          'auth.js 曾把 Mate60 与小米 10 用逗号拼坏，顶距/汇总/列表规则未命中；已拆成完整选择器并强制 40px；列表左右贴边对齐汇总。',
        since: '2026-09-03'
      },
      {
        page: 'shuiming',
        title: '扣缴义务人吃满箭头左侧宽度',
        summary:
          'JS 先截 12 字、HarmonyOS flex 再收到约 7 字；改为不预截，公司名吃满「>」左侧剩余宽度，「苏州宇量引力网络科技有限公司」完整显示。',
        since: '2026-09-14'
      },
      {
        page: 'message',
        title: '消息详情避开 ark 白顶 52/66',
        summary:
          'page-message-detail 被 pinArkWhiteTopInset 改成 relative+66px 并叠 body 顶距，状态栏下大块空白；改为自管 fixed+40px，跳过 ark 钉头。',
        since: '2026-09-03'
      },
      { page: 'shouye', title: 'ArkWeb 布局漂移自修复', summary: '全站顶距与「我的」头图多次回退（8/13、8/18、8/19）。', since: '2026-08-24' }
    ]
  },
  {
    id: 'huawei-mate70',
    platform: 'android',
    family: 'huawei',
    label: '华为 Mate 70 / 70 Air',
    match: ['Mate\\s*70', 'PLA-AL', 'PLR-AL', 'PLU-AL', 'SUP-AL90', 'CLS-AL00'],
    issues: [{ page: 'shuiming', title: '沿用 Mate60 顶距', summary: '全页避开状态栏，勿与 Mate60「我的」0-bleed 混用。', since: '2026-08-13' }]
  },
  {
    id: 'huawei-matepad115s',
    platform: 'android',
    family: 'huawei',
    label: '华为 MatePad 11.5S',
    match: [
      'MatePad[\\s_-]*11[\\s.]*5[\\s"]*S',
      'TGR-W09',
      'TGR-W19',
      'TGR-W00',
      'TGR-AL00',
      'TGR-AL09',
      'HUAWEITGR'
    ],
    issues: [
      {
        page: 'mine',
        title: '姓名/三宫格胶囊按画布宽度对齐',
        summary:
          '平板 ArkWeb 的 100vw/100cqw 常宽于画布，@sm 1180 裁切再竖向压底图；姓名漂在米色卡，添加/暂无掉到白卡下沿。改为真实底图比例 + 画布实测 rpx。后续 .user-name 16px 在平板上过小，姓名改 38rpx、税号 26rpx。',
        since: '2026-09-17'
      }
    ]
  },
  {
    id: 'huawei-nova13',
    platform: 'android',
    family: 'huawei',
    label: '华为 nova 13',
    match: ['nova\\s*13', 'NAM-AL00', 'NAM-AN00'],
    issues: [
      { page: 'mine', title: '叠字按画布宽度对齐', summary: '姓名/税号相对米色卡错位。', since: '2026-08-20' },
      { page: 'shuiming', title: '筛选/详情顶栏避让', summary: '白顶栏避开系统状态栏。', since: '2026-08-20' }
    ]
  },
  {
    id: 'huawei-harmony',
    platform: 'android',
    family: 'huawei',
    label: '鸿蒙 / HarmonyOS NEXT',
    match: ['HarmonyOS', 'OpenHarmony', 'ArkWeb', 'HMSCore'],
    issues: [
      { page: 'shouye', title: 'UA 无 Android 时勿当 iOS', summary: '首页搜索曾 padding:0 顶进状态栏；下载页曾误走 iOS 描述文件。', since: '2026-08-13' },
      { page: 'mine', title: '按外置栏，禁止 iOS 式裁切', summary: '套 59px 刘海 bleed 会裁 e1 头图。', since: '2026-08-18' }
    ]
  },
  {
    id: 'huawei-pura70',
    platform: 'android',
    family: 'huawei',
    label: '华为 Pura 70',
    match: ['Pura\\s*70', 'HBN-AL00', 'HBN-AL80', 'ADY-AL00', 'ADY-AL10'],
    issues: [{ page: 'shouye', title: '录屏右侧黑边；首页排除统一 40px', summary: 'Cordova 壳已避让状态栏，勿再叠 inset。', since: '2026-05-20' }]
  },
  {
    id: 'honor-magic5',
    platform: 'android',
    family: 'honor',
    label: '荣耀 Magic5 Pro',
    match: ['Magic\\s*5', 'PGT-AN', 'PGT-AN20'],
    issues: [
      { page: 'shouye', title: '搜索条去掉多余顶距', summary: '外置栏再叠 inset 出空蓝带。', since: '2026-08-20' },
      { page: 'shouye', title: '去申报按钮与服务卡收小', summary: 'Android 通用分栏会把卡片撑大。', since: '2026-08-20' }
    ]
  },
  {
    id: 'honor-magic6',
    platform: 'android',
    family: 'honor',
    label: '荣耀 Magic6 Pro',
    match: ['Magic\\s*6', 'BVL-AN16', 'BVL-AN00'],
    issues: [{ page: 'shouye', title: '去申报按钮收小', summary: '与 Magic5 同类卡片过大。', since: '2026-08-20' }]
  },
  {
    id: 'honor-vs3',
    platform: 'android',
    family: 'honor',
    label: '荣耀 Magic Vs3 / 折叠',
    match: ['Vs3', 'Magic\\s*Vs', 'FLC-AN', 'FCP-AN'],
    issues: [{ page: 'shouye', title: '外屏勿再叠 safe-area 蓝带', summary: '系统状态栏在 WebView 外。', since: '2026-08-03' }]
  },
  {
    id: 'honor-ptp-an00',
    platform: 'android',
    family: 'honor',
    label: '荣耀 PTP-AN00',
    match: ['PTP-AN00', 'PTP-AN'],
    issues: [{ page: 'shouye', title: 'Android 16 顶栏与通知条', summary: '顶部安全区与首页通知条单独档。', since: '2026-05-22' }]
  },
  {
    id: 'iqoo-neo8',
    platform: 'android',
    family: 'vivo',
    label: 'iQOO Neo8',
    match: ['Neo8(?!\\s*Pro)', 'Neo 8(?!\\s*Pro)', 'iQOO\\s*Neo8(?!\\s*Pro)', 'V2301A'],
    issues: [
      { page: 'shuiming', title: '白顶栏避开系统状态栏', summary: 'Cordova 仍压在系统栏下。', since: '2026-08-18' },
      { page: 'shuiming', title: '白顶栏系统字改深色', summary: '去掉黑条白字。', since: '2026-08-18' }
    ]
  },
  {
    id: 'iqoo-neo8pro',
    platform: 'android',
    family: 'vivo',
    label: 'iQOO Neo8 Pro',
    match: ['Neo8\\s*Pro', 'Neo 8\\s*Pro', 'V2302A', 'V2307A'],
    issues: [
      { page: 'shuiming', title: '国行 V2302A 顶栏识别', summary: '勿按 vivo 族外置黑条清零，否则「申诉」压到系统图标。', since: '2026-08-16' },
      { page: 'mine', title: '消息页标题避开系统时间', summary: '沉浸压栏。', since: '2026-08-15' }
    ]
  },
  {
    id: 'iqoo-15',
    platform: 'android',
    family: 'vivo',
    label: 'iQOO 15',
    match: ['iQOO\\s*15', 'V2505A', 'I2501'],
    issues: [{ page: 'shuiming', title: '纳税明细顶栏避开系统状态栏', summary: '强制 40px，UA 常无 vivo/iqoo 字样。', since: '2026-08-25' }]
  },
  {
    id: 'iqoo-z9turboplus',
    platform: 'android',
    family: 'vivo',
    label: 'iQOO Z9 Turbo+',
    match: ['V2417A', 'V2417DA', 'PD2417', 'Z9[\\s_-]*Turbo[\\s_-]*(?:\\+|Plus)'],
    issues: [
      {
        page: 'mine',
        title: '单层底图，避开 @sm 叠字',
        summary: '360×800 OriginOS 与 X90 同坑：双层底图残影 + 1180 压缩。只改「我的」。',
        since: '2026-09-10'
      }
    ]
  },
  {
    id: 'vivo-s15',
    platform: 'android',
    family: 'vivo',
    label: 'vivo S15',
    match: ['V2203A', 'S15\\b(?!\\s*Pro)(?!e)'],
    issues: [
      {
        page: 'shouye',
        title: '正版黑框：页内 40px 黑垫',
        summary:
          'OriginOS 4 常忽略 overlays=false，又被 vivo 族清零顶距，首页/办查会把蓝白铺进状态栏。对齐正版个税顶部黑框。',
        since: '2026-09-14'
      },
      {
        page: 'mine',
        title: '「我的」同样铺 40px 黑垫',
        summary: '与 K70 underlap 黑垫同一套，勿走 vivo 族 inset 0。',
        since: '2026-09-14'
      }
    ]
  },
  {
    id: 'vivo-s50promini',
    platform: 'android',
    family: 'vivo',
    label: 'vivo S50 Pro mini',
    match: ['S50\\s*Pro\\s*mini', 'V2527A'],
    issues: [
      { page: 'shuiming', title: '必须认出「S50 Pro mini」', summary: 'Cordova device.model 常无 vivo 前缀；识别失败会把顶距清零。', since: '2026-08-21' }
    ]
  },
  {
    id: 'vivo-x100',
    platform: 'android',
    family: 'vivo',
    label: 'vivo X100',
    match: ['X100\\b(?!\\s*Pro)', 'V2309A'],
    issues: [
      {
        page: 'shuiming',
        title: '白顶栏默认沉浸 40px',
        summary: '线上高频 V2309A。未进 X90 / X200 特判，勿按 OriginOS 族名清零。',
        since: '2026-09-05'
      }
    ]
  },
  {
    id: 'vivo-x200pro',
    platform: 'android',
    family: 'vivo',
    label: 'vivo X200 Pro',
    match: ['X200\\s*Pro\\b(?!\\s*mini)', 'V2405A'],
    issues: [{ page: 'shuiming', title: '状态栏避让，去掉顶栏下方空白', summary: '先修空白再恢复避让。', since: '2026-07-13' }]
  },
  {
    id: 'vivo-x300pro',
    platform: 'android',
    family: 'vivo',
    label: 'vivo X300 Pro',
    match: ['X300\\s*Pro', 'V2502A'],
    issues: [{ page: 'shuiming', title: '白顶栏避开系统状态栏', summary: '勿套小米 15 行距规则。', since: '2026-08-17' }]
  },
  {
    id: 'oneplus-ace2',
    platform: 'android',
    family: 'oppo',
    label: '一加 Ace 2',
    match: ['Ace\\s*2\\b(?!\\s*Pro)(?!\\s*V)', 'PHK110'],
    issues: [{ page: 'shuiming', title: '收入纳税明细顶栏避让', summary: 'ColorOS 沉浸 WebView。', since: '2026-08-16' }]
  },
  {
    id: 'oneplus-ace2v',
    platform: 'android',
    family: 'oppo',
    label: '一加 Ace 2V',
    match: ['Ace\\s*2V', 'Ace 2 V', 'PHP110'],
    issues: [{ page: 'shuiming', title: '顶栏避开系统状态栏', summary: '与首页推荐卡底对齐同一轮补齐。', since: '2026-08-16' }]
  },
  {
    id: 'oneplus-ace2pro',
    platform: 'android',
    family: 'oppo',
    label: '一加 Ace 2 Pro',
    match: ['Ace\\s*2\\s*Pro', 'PJA110'],
    issues: [{ page: 'shuiming', title: '避开系统时间栏', summary: 'ColorOS 沉浸压栏。', since: '2026-08-14' }]
  },
  {
    id: 'oneplus-12',
    platform: 'android',
    family: 'oppo',
    label: '一加 12',
    match: ['PJD110', 'CPH2573', 'CPH2581', 'CPH2583', '(?:OnePlus|一加)[\\s_-]*12(?![\\s_-]*R)(?![A-Za-z0-9])'],
    issues: [{ page: 'shuiming', title: '避开系统时间栏', summary: 'ColorOS 16 沉浸 WebView 仍压在状态栏下，顶栏「返回/批量申诉」须留 40px。', since: '2026-09-04' }]
  },
  {
    id: 'oneplus-ace6',
    platform: 'android',
    family: 'oppo',
    label: '一加 Ace 6',
    match: ['Ace\\s*6\\b(?!\\s*Pro)', 'PLQ110'],
    issues: [{ page: 'shuiming', title: '避开系统时间栏', summary: 'ColorOS 16 沉浸 WebView 仍压在状态栏下，顶栏「返回/批量申诉」须留 40px。', since: '2026-09-04' }]
  },
  {
    id: 'oppo-reno10',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO Reno10 5G',
    match: ['Reno10', 'Reno 10', 'CPH2531', 'PHW110'],
    issues: [{ page: 'shuiming', title: '避开 ColorOS 沉浸状态栏', summary: '真沉浸机，「我的」可保留 inset。', since: '2026-08-17' }]
  },
  {
    id: 'oppo-findx8',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO Find X8',
    match: ['PKB110', 'Find\\s*X\\s*8(?!s)(?!\\s*Pro)(?!\\s*Ultra)(?!\\s*s)'],
    issues: [
      {
        page: 'shuiming',
        title: '白顶栏默认沉浸 40px',
        summary: '线上高频 PKB110。未进 Find X9 外置核实名单，标题须避开系统时间。',
        since: '2026-09-05'
      }
    ]
  },
  {
    id: 'oppo-a57',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO A57 5G',
    match: ['PFTM20', 'OPPO\\s*A57', 'A57\\s*5G'],
    issues: [
      {
        page: 'shuiming',
        title: '白顶栏默认沉浸 40px',
        summary: '线上高频 PFTM20。勿套 A58（PHJ110）外置清零。',
        since: '2026-09-05'
      }
    ]
  },
  {
    id: 'oppo-a93s',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO A93s 5G',
    match: ['PFGM00', 'A93s'],
    issues: [
      {
        page: 'mine',
        title: '「我的」勿走 1180×100vw @sm 裁切',
        summary:
          'ColorOS WebView 上 100vw 常宽于画布，通用 @sm 会把底图与姓名/胶囊/热区错位。与 Reno10 同一套真实 <img> + 1284/2127 比例锁。',
        since: '2026-09-14'
      }
    ]
  },
  {
    id: 'oppo-k9x',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO K9x',
    match: ['PGCM10', '\\bK9x\\b'],
    issues: [{ page: 'shuiming', title: '收入纳税明细顶栏避让', summary: 'ColorOS 沉浸 WebView 仍压在系统状态栏下，顶栏「返回/标题」须留 40px，勿按 OPPO 族外置黑条清零。', since: '2026-08-27' }]
  },
  {
    id: 'meizu-20pro',
    platform: 'android',
    family: 'meizu',
    label: '魅族 20 Pro',
    match: ['魅族\\s*20', 'Meizu\\s*20', 'MEIZU\\s*20'],
    issues: [{ page: 'shuiming', title: '白顶栏留 40px', summary: 'Flyme Cordova 仍压在系统栏下，env(safe-area) 常为 0。', since: '2026-08-25' }]
  }
];

var MODELS = CORE_MODELS.concat(
  require('./uiCompatCatalogExtraA'),
  require('./uiCompatCatalogExtraB')
);


function compileMatchers(model) {
  if (model._compiled) return model._compiled;
  var list = Array.isArray(model.match) ? model.match : [];
  model._compiled = list.map(function (src) {
    return new RegExp(src, 'i');
  });
  return model._compiled;
}

function modelMatchesBlob(model, blob) {
  if (model.common) return false;
  var regs = compileMatchers(model);
  for (var i = 0; i < regs.length; i++) {
    if (regs[i].test(blob)) return true;
  }
  return false;
}

function listCatalogModels() {
  return MODELS;
}

function listPageDefs() {
  return PAGE_DEFS;
}

function pageLabel(key) {
  return PAGE_LABEL[key] || key;
}

function catalogStats() {
  var models = 0;
  var issues = 0;
  MODELS.forEach(function (m) {
    if (!m.common) models += 1;
    issues += (m.issues || []).length;
  });
  return { catalog_models: models, catalog_issues: issues };
}

module.exports = {
  PAGE_DEFS: PAGE_DEFS,
  MODELS: MODELS,
  listCatalogModels: listCatalogModels,
  listPageDefs: listPageDefs,
  pageLabel: pageLabel,
  catalogStats: catalogStats,
  modelMatchesBlob: modelMatchesBlob
};
