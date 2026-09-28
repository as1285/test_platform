'use strict';

module.exports = [
  {
    id: 'oppo-a58',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO A58',
    match: ['PHJ110', 'OPPO\\s*A58'],
    issues: [
      {
        page: 'shuiming',
        title: '外置状态栏清零顶距',
        summary: 'PHJ110 已核实壳外置黑条，勿再叠 40px。与 A57（PFTM20）沉浸相反。',
        since: '2026-09-04'
      }
    ]
  },
  {
    id: 'oppo-find-x8s',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO Find X8s',
    match: ['Find\\s*X\\s*8s', 'PKT110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'oppo-find-x8-ultra',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO Find X8 Ultra',
    match: ['Find\\s*X\\s*8\\s*Ultra', 'PKJ110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'oppo-find-x9',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO Find X9',
    match: ['Find\\s*X\\s*9(?!\\s*Pro)', 'CPH2797', 'PLJ110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有 CPH2797。未进外置核实名单，对账按 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'oppo-k12s',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO K12s',
    match: ['K12s', 'PLD110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'oppo-k13-turbopro',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO K13 Turbo Pro',
    match: ['K13\\s*Turbo\\s*Pro', 'PLE110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'oppo-reno14-pro',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO Reno14 Pro',
    match: ['Reno14\\s*Pro', 'Reno 14\\s*Pro', 'PKZ110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'oppo-reno8',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO Reno8',
    match: ['Reno8(?!\\s*Pro)', 'Reno 8(?!\\s*Pro)', 'PGBM10'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'oppo-find-n3',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO Find N3',
    match: ['Find\\s*N3\\b', 'PHN110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。折叠机未单独核实外屏，对账按安卓通用 40px。', since: '2026-09-15' }]
  },
  {
    id: 'oppo-a2',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO A2 / A1s',
    match: ['PJB110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'huawei-mate-x5',
    platform: 'android',
    family: 'huawei',
    label: '华为 Mate X5',
    match: ['Mate\\s*X5', 'ALT-AL10', 'ALT-AL00'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上高频 ALT-AL10。折叠外屏未单独核实，对账按安卓通用 40px。', since: '2026-09-15' }]
  },
  {
    id: 'huawei-mate40-pro',
    platform: 'android',
    family: 'huawei',
    label: '华为 Mate 40 Pro',
    match: ['Mate\\s*40\\s*Pro', 'NOH-AN00', 'NOH-AL00', 'NOH-AN80'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'honor-magic8',
    platform: 'android',
    family: 'honor',
    label: '荣耀 Magic8',
    match: ['Magic\\s*8\\b(?!\\s*Pro)', 'BKQ-AN00', 'BKQ-AN80'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'honor-60se',
    platform: 'android',
    family: 'honor',
    label: '荣耀 60 SE',
    match: ['GIA-AN00'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'honor-200-pro',
    platform: 'android',
    family: 'honor',
    label: '荣耀 200 Pro',
    match: ['荣耀\\s*200\\s*Pro', 'ELP-AN00'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'honor-400-pro',
    platform: 'android',
    family: 'honor',
    label: '荣耀 400 Pro',
    match: ['荣耀\\s*400\\s*Pro', 'DNP-AN00'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'honor-x10',
    platform: 'android',
    family: 'honor',
    label: '荣耀 X10',
    match: ['荣耀\\s*X10\\b', 'TEL-AN00', 'TEL-AN00a', 'TEL-AN10'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'pixel-9',
    platform: 'android',
    family: 'google',
    label: 'Pixel 9',
    match: ['Pixel\\s*9\\b(?!\\s*Pro)'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'pixel-7',
    platform: 'android',
    family: 'google',
    label: 'Pixel 7',
    match: ['Pixel\\s*7\\b(?!\\s*Pro)(?!\\s*a)'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'samsung-s23-ultra',
    platform: 'android',
    family: 'samsung',
    label: '三星 S23 Ultra',
    match: ['S23\\s*Ultra', 'SM-S9180', 'SM-S918B', 'SM-S918U'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '已核实外置栏的三星机可清零；本档先按通用 40px 对账。', since: '2026-09-15' }]
  },
  {
    id: 'samsung-s24-ultra',
    platform: 'android',
    family: 'samsung',
    label: '三星 S24 Ultra',
    match: ['S24\\s*Ultra', 'SM-S9280', 'SM-S928B', 'SM-S928U'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'samsung-s25',
    platform: 'android',
    family: 'samsung',
    label: '三星 S25',
    match: ['S25\\b(?!\\s*Ultra)(?!\\s*\\+)', 'SM-S9310', 'SM-S931B'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'realme-gt7-pro',
    platform: 'android',
    family: 'realme',
    label: 'realme GT7 Pro',
    match: ['GT7\\s*Pro', 'GT 7\\s*Pro', 'RMX5010'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'meizu-21',
    platform: 'android',
    family: 'meizu',
    label: '魅族 21',
    match: ['魅族\\s*21', 'Meizu\\s*21', 'MEIZU\\s*21'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。Flyme 常压在系统栏下，对账按 40px。', since: '2026-09-15' }]
  },
  {
    id: 'xiaomi-13-ultra',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 13 Ultra',
    match: ['小米\\s*13\\s*Ultra', 'Xiaomi\\s*13\\s*Ultra', '2304FPN6DC'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'xiaomi-14-ultra',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 14 Ultra',
    match: ['小米\\s*14\\s*Ultra', 'Xiaomi\\s*14\\s*Ultra', '24031PN0DC'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'xiaomi-17',
    platform: 'android',
    family: 'xiaomi',
    label: '小米 17',
    match: ['小米\\s*17\\b(?!\\s*Pro)(?!\\s*Ultra)', 'Xiaomi\\s*17\\b(?!\\s*Pro)(?!\\s*Ultra)', '25113PN0EC'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 25113PN0EC。勿套 17 Pro / Ultra / Pro Max。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-note11-5g',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 Note 11 5G',
    match: ['21091116AC'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-note14-5g',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 Note 14 5G',
    match: ['24094RAD4C'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 24094RAD4C（Note 14 5G / Note 15R Pro 同码）。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-turbo5-max',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 Turbo 5 Max',
    match: ['Turbo\\s*5\\s*Max', '2602BRT18C'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-k60-ultra',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 K60 至尊版',
    match: ['K60\\s*(?:至尊|Ultra)', '23078RKD5C'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。勿套 K60 标准版。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-note12-turbo',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 Note 12 Turbo',
    match: ['Note\\s*12\\s*Turbo', '23049RAD8C'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'redmi-note10-pro5g',
    platform: 'android',
    family: 'xiaomi',
    label: '红米 Note 10 Pro 5G',
    match: ['M2104K10AC'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'vivo-x100s',
    platform: 'android',
    family: 'vivo',
    label: 'vivo X100s',
    match: ['X100s', 'V2359A'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。勿套 X100 / X100 Pro。', since: '2026-09-15' }]
  },
  {
    id: 'vivo-x300',
    platform: 'android',
    family: 'vivo',
    label: 'vivo X300',
    match: ['X300\\b(?!\\s*Pro)', 'V2509A'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 V2509A。勿套 X300 Pro（V2502A）。', since: '2026-09-15' }]
  },
  {
    id: 'iqoo-10-pro',
    platform: 'android',
    family: 'vivo',
    label: 'iQOO 10 Pro',
    match: ['iQOO\\s*10\\s*Pro', 'V2218A'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'iqoo-neo-855',
    platform: 'android',
    family: 'vivo',
    label: 'iQOO Neo 855',
    match: ['V1936A'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'oneplus-ace3',
    platform: 'android',
    family: 'oppo',
    label: '一加 Ace 3',
    match: ['Ace\\s*3(?!V)(?!\\s*V)(?!\\s*Pro)', 'PJE110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 PJE110。勿套 Ace 3 Pro / 3V。', since: '2026-09-15' }]
  },
  {
    id: 'oneplus-13',
    platform: 'android',
    family: 'oppo',
    label: '一加 13',
    match: ['PJZ110', '(?:OnePlus|一加)[\\s_-]*13(?![\\s_-]*[TRts])(?![A-Za-z0-9])'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 PJZ110。勿套 13T / 13R。', since: '2026-09-15' }]
  },
  {
    id: 'oneplus-13t',
    platform: 'android',
    family: 'oppo',
    label: '一加 13T',
    match: ['PKX110', '(?:OnePlus|一加)[\\s_-]*13T'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 PKX110。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'oneplus-ace5',
    platform: 'android',
    family: 'oppo',
    label: '一加 Ace 5',
    match: ['Ace\\s*5(?!\\s*Pro)', 'PKG110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 PKG110。勿套 Ace 5 Pro。', since: '2026-09-15' }]
  },
  {
    id: 'oneplus-ace6t',
    platform: 'android',
    family: 'oppo',
    label: '一加 Ace 6T',
    match: ['Ace\\s*6T', 'PLR110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 PLR110。勿套 Ace 6 标准版。', since: '2026-09-15' }]
  },
  {
    id: 'oppo-find-x7',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO Find X7',
    match: ['Find\\s*X\\s*7(?!\\s*Ultra)', 'PHZ110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 PHZ110。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'oppo-find-x9-pro',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO Find X9 Pro',
    match: ['Find\\s*X\\s*9\\s*Pro', 'PLG110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 PLG110。勿套 Find X9 标准版。', since: '2026-09-15' }]
  },
  {
    id: 'oppo-reno9',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO Reno9',
    match: ['Reno9(?!\\s*Pro)', 'Reno 9(?!\\s*Pro)', 'PHM110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 PHM110。勿套 Reno9 Pro / Pro+。', since: '2026-09-15' }]
  },
  {
    id: 'oppo-reno9-proplus',
    platform: 'android',
    family: 'oppo',
    label: 'OPPO Reno9 Pro+',
    match: ['Reno9\\s*Pro\\+', 'Reno 9\\s*Pro\\+', 'PGW110'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 PGW110。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'huawei-mate30-pro',
    platform: 'android',
    family: 'huawei',
    label: '华为 Mate 30 Pro',
    match: ['Mate\\s*30\\s*Pro', 'LIO-AN00', 'LIO-AL00', 'LIO-AN00m'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 LIO-AN00。勿套 Mate 30 标准版。', since: '2026-09-15' }]
  },
  {
    id: 'huawei-mate80',
    platform: 'android',
    family: 'huawei',
    label: '华为 Mate 80',
    match: ['Mate\\s*80(?!\\s*Pro)', 'VYG-AL00'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 VYG-AL00。勿套 Mate 80 Pro。', since: '2026-09-15' }]
  },
  {
    id: 'huawei-mate80-pro',
    platform: 'android',
    family: 'huawei',
    label: '华为 Mate 80 Pro / Pro Max',
    match: ['Mate\\s*80\\s*Pro', 'SGT-AL00', 'SGT-AL10', 'SGT-AL50'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 SGT-AL10。未单独核实外置栏，对账按安卓通用 40px。', since: '2026-09-15' }]
  },
  {
    id: 'huawei-p40-pro',
    platform: 'android',
    family: 'huawei',
    label: '华为 P40 Pro',
    match: ['P40\\s*Pro(?!\\+)', 'ELS-AN00', 'ELS-TN00'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'honor-x50',
    platform: 'android',
    family: 'honor',
    label: '荣耀 X50',
    match: ['荣耀\\s*X50\\b(?!\\s*Pro)(?!i)', 'ALI-AN00'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 ALI-AN00。勿套 X50 Pro。', since: '2026-09-15' }]
  },
  {
    id: 'honor-hinova9se',
    platform: 'android',
    family: 'honor',
    label: 'Hi nova 9 SE',
    match: ['FIO-BD00', 'FIO-TL00'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  },
  {
    id: 'samsung-s24',
    platform: 'android',
    family: 'samsung',
    label: '三星 S24',
    match: ['S24\\b(?!\\s*Ultra)(?!\\s*\\+)', 'SM-S9210', 'SM-S921B', 'SM-S921U'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上 SM-S921U。勿套 S24 Ultra。', since: '2026-09-15' }]
  },
  {
    id: 'realme-gt-neo5',
    platform: 'android',
    family: 'realme',
    label: 'realme GT Neo5',
    match: ['GT\\s*Neo5', 'GT Neo 5', 'RMX3700', 'RMX3706'],
    issues: [{ page: 'shuiming', title: '按安卓通用沉浸顶栏建档', summary: '线上已有用户。未单独核实外置栏，对账按安卓通用 40px 沉浸顶栏。', since: '2026-09-15' }]
  }
];
