'use strict';

module.exports = [
  {
    id: 'xiaomi-10s',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 10S',
    match: ['小米\\s*10S', 'Xiaomi\\s*10S', 'M2102J2SC'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'xiaomi-11',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 11',
    match: ['小米\\s*11\\b(?!\\s*Ultra)(?!\\s*Pro)', 'Xiaomi\\s*11\\b(?!\\s*Ultra)(?!\\s*Pro)', 'M2011K2C'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'xiaomi-15-ultra',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 15 Ultra',
    match: ['小米\\s*15\\s*Ultra', 'Xiaomi\\s*15\\s*Ultra', '25019PNF3C'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'xiaomi-17-pro',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 17 Pro',
    match: ['小米\\s*17\\s*Pro\\b(?!\\s*Max)', 'Xiaomi\\s*17\\s*Pro\\b(?!\\s*Max)', '25098PN5AC'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'xiaomi-17-promax',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 17 Pro Max',
    match: ['小米\\s*17\\s*Pro\\s*Max', 'Xiaomi\\s*17\\s*Pro\\s*Max', '2509FPN0BC'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上高频 2509FPN0BC。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-k50',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 K50',
    match: ['K50(?!\\s*(?:Pro|Ultra|至尊|电竞))', 'Redmi\\s*K50(?!\\s*(?:Pro|Ultra|至尊|电竞))', '22041211AC'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-k50-pro',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 K50 Pro',
    match: ['K50\\s*Pro', 'Redmi\\s*K50\\s*Pro', '22011211C'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-k60',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 K60',
    match: ['K60(?!\\s*(?:Pro|Ultra|至尊|E))', 'Redmi\\s*K60(?!\\s*(?:Pro|Ultra|至尊|E))', '23013RK75C'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-k70e',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 K70E',
    match: ['K70E', 'K70\\s*E', '2311DRK48C'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-k70-pro',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 K70 Pro',
    match: ['K70\\s*Pro', '23117RK66C'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-k80',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 K80',
    match: ['K80(?!\\s*(?:Pro|Ultra|至尊|E))', 'Redmi\\s*K80(?!\\s*(?:Pro|Ultra|至尊|E))', '24117RK2CC'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上高频 24117RK2CC。勿套 K80 Pro / Ultra 规则。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-k90',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 K90',
    match: ['K90(?!\\s*Pro)', 'Redmi\\s*K90(?!\\s*Pro)', '2510DRK44C'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-k90-promax',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 K90 Pro Max',
    match: ['K90\\s*Pro\\s*Max', '25102RKBEC'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-turbo3',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 Turbo 3',
    match: ['Turbo\\s*3\\b', 'Redmi\\s*Turbo\\s*3', '24069RA21C'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-turbo4-pro',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 Turbo 4 Pro',
    match: ['Turbo\\s*4\\s*Pro', '25053RT47C'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-note12-proplus',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 Note 12 Pro+',
    match: ['Note\\s*12\\s*Pro\\+', '22101316UCP'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 UA 常写成 zh-cn; 22101316UCP。未单独核实外置栏。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-note13-5g',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 Note 13 5G',
    match: ['2312DRAABC'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-note15-pro',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 Note 15 Pro',
    match: ['Note\\s*15\\s*Pro', '25080RABDC'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'vivo-x80',
    platform: 'android',
    family: 'vivo',
    label: 'vivo X80',
    match: ['X80\\b(?!\\s*Pro)', 'V2183A'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'vivo-x90',
    platform: 'android',
    family: 'vivo',
    label: 'vivo X90',
    match: ['X90\\b(?!\\s*Pro)', 'V2241A'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上高频 V2241A。勿套 X90 Pro。未单独核实外置栏。', since: '2026-09-15' }]
  },
  {
    id: 'vivo-x200s',
    platform: 'android',
    family: 'vivo',
    label: 'vivo X200s',
    match: ['X200s', 'V2458A'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'vivo-x200-promini',
    platform: 'android',
    family: 'vivo',
    label: 'vivo X200 Pro mini',
    match: ['X200\\s*Pro\\s*mini', 'V2419A'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'iqoo-13',
    platform: 'android',
    family: 'vivo',
    label: 'iQOO 13',
    match: ['iQOO\\s*13\\b', 'V2408A'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上高频 V2408A。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'iqoo-neo9',
    platform: 'android',
    family: 'vivo',
    label: 'iQOO Neo9',
    match: ['Neo9(?!\\s*S)(?!\\s*Pro)', 'Neo 9(?!\\s*S)(?!\\s*Pro)', 'V2338A'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上高频 V2338A。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'iqoo-neo10',
    platform: 'android',
    family: 'vivo',
    label: 'iQOO Neo10',
    match: ['Neo10(?!\\s*Pro)', 'Neo 10(?!\\s*Pro)', 'V2425A'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上高频 V2425A。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'iqoo-neo5',
    platform: 'android',
    family: 'vivo',
    label: 'iQOO Neo5',
    match: ['Neo5\\b', 'Neo 5\\b', 'V2055A'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'iqoo-11',
    platform: 'android',
    family: 'vivo',
    label: 'iQOO 11',
    match: ['iQOO\\s*11\\b', 'V2243A'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'iqoo-9',
    platform: 'android',
    family: 'vivo',
    label: 'iQOO 9',
    match: ['iQOO\\s*9\\b(?!\\s*Pro)', 'V2171A'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'iqoo-z10-turbo',
    platform: 'android',
    family: 'vivo',
    label: 'iQOO Z10 Turbo',
    match: ['Z10[\\s_-]*Turbo(?!\\s*Pro)', 'V2452A'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'vivo-s50',
    platform: 'android',
    family: 'vivo',
    label: 'vivo S50',
    match: ['S50\\b(?!\\s*Pro)', 'V2528A'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。勿套 S50 Pro mini。', since: '2026-09-15' }]
  },
  {
    id: 'oneplus-ace-pro',
    platform: 'android',
    family: 'oppo',
    label: '一加 Ace Pro',
    match: ['Ace\\s*Pro\\b(?!\\s*2)', 'PGP110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上高频 PGP110。ColorOS 沉浸 WebView，对账按 40px 顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'oneplus-15',
    platform: 'android',
    family: 'oppo',
    label: '一加 15',
    match: ['PLK110', '(?:OnePlus|一加)[\\s_-]*15(?![\\s_-]*[TR])(?![A-Za-z0-9])'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上高频 PLK110。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'oneplus-ace-race',
    platform: 'android',
    family: 'oppo',
    label: '一加 Ace 竞速版',
    match: ['Ace\\s*竞速', 'PGZ110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'oneplus-ace3-pro',
    platform: 'android',
    family: 'oppo',
    label: '一加 Ace 3 Pro',
    match: ['Ace\\s*3\\s*Pro', 'PJX110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'oneplus-11',
    platform: 'android',
    family: 'oppo',
    label: '一加 11',
    match: ['PHB110', '(?:OnePlus|一加)[\\s_-]*11(?![\\s_-]*R)(?![A-Za-z0-9])'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'oneplus-ace3v',
    platform: 'android',
    family: 'oppo',
    label: '一加 Ace 3V',
    match: ['Ace\\s*3V', 'Ace 3 V', 'PJF110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'oneplus-ace5-pro',
    platform: 'android',
    family: 'oppo',
    label: '一加 Ace 5 Pro',
    match: ['Ace\\s*5\\s*Pro', 'PKR110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  }
];
