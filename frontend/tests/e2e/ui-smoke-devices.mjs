/**
 * Playwright 冒烟机型档。
 *
 * - playwrightDevice：用 Playwright 内置 devices[name]
 * - 安卓 OEM：在 Pixel 视口上叠真实型号 UA + tax_device_model_v1，并带 TaxPlatformCordovaApp
 *   以触发 App 壳内白顶栏默认沉浸逻辑
 * - iOS 版本队列：在内置 iPhone 视口上叠线上高频 OS 版本 UA（Safari 不暴露硬件型号）
 *
 * suite（额外检查；每台机都会先跑完整业务冒烟）:
 *   full              — 仅业务冒烟（主档 iPhone 12）
 *   ios-chrome        — iOS 首页壳 + 收入纳税明细贴边
 *   android-home      — 安卓首页壳 class / 顶栏存在
 *   android-white-top — 收入纳税明细/查询/详情顶距
 *
 * UI_SMOKE_DEVICES=all|full|recent|popular|mainstream|id1,id2
 *   mainstream = 近一个月日活主力机 ∪ 近期兼容档（默认自测）
 *   recent     = 近期频繁改兼容性的机型
 *   popular    = 近一个月日活高频型号（见 PRODUCTION_TOP_MODELS）
 *   all        = 目录全量（长，本地/夜间用）
 *   full       = 仅 iPhone 12 完整业务冒烟
 */

function androidUa(model, brandLabel) {
  return (
    'Mozilla/5.0 (Linux; Android 15; ' +
    model +
    ' Build/UKQ1.230924.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/131.0.0.0 Mobile Safari/537.36 TaxPlatformCordovaApp/1.0 ' +
    brandLabel
  );
}

/** Safari / WKWebView UA：线上只报 iPhone OS x_y，不报 15,4 这类硬件号 */
function iosUa(osVersion) {
  const underscored = String(osVersion).replace(/\./g, '_');
  const version = String(osVersion).replace(/_/g, '.');
  return (
    'Mozilla/5.0 (iPhone; CPU iPhone OS ' +
    underscored +
    ' like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/' +
    version +
    ' Mobile/15E148 Safari/604.1'
  );
}

function immersive(model, label, classes, extra) {
  const profile = Object.assign(
    {
      id: extra && extra.id ? extra.id : undefined,
      label: label,
      playwrightDevice: 'Pixel 7',
      suite: 'android-white-top',
      platform: 'android',
      inApp: true,
      cordovaUa: true,
      deviceModel: model,
      userAgent: androidUa(model, label),
      expect: {
        immersiveWhiteTop: true,
        minInsetPx: (extra && extra.minInsetPx) || 40,
        classContains: classes
      }
    },
    extra && extra.id ? { id: extra.id } : {},
    extra && extra.userAgent ? { userAgent: extra.userAgent } : {},
    extra && extra.playwrightDevice ? { playwrightDevice: extra.playwrightDevice } : {}
  );
  if (extra && extra.expect) {
    Object.assign(profile.expect, extra.expect);
  }
  return profile;
}

function outer(model, label, extra) {
  return Object.assign(
    {
      label: label,
      playwrightDevice: 'Pixel 7',
      suite: 'android-white-top',
      platform: 'android',
      inApp: true,
      cordovaUa: true,
      deviceModel: model,
      userAgent: androidUa(model, label),
      expect: {
        immersiveWhiteTop: false,
        maxInsetPx: (extra && extra.maxInsetPx) || 8
      }
    },
    extra || {}
  );
}

export const DEVICE_PROFILES = [
  /* —— iOS —— */
  {
    id: 'iphone-12',
    label: 'iPhone 12',
    playwrightDevice: 'iPhone 12',
    suite: 'full',
    platform: 'ios',
    deviceModel: 'iPhone 12'
  },
  {
    id: 'iphone-13-promax',
    label: 'iPhone 13 Pro Max',
    playwrightDevice: 'iPhone 13 Pro Max',
    suite: 'ios-chrome',
    platform: 'ios',
    deviceModel: 'iPhone 13 Pro Max'
  },
  {
    id: 'iphone-14-promax',
    label: 'iPhone 14 Pro Max',
    playwrightDevice: 'iPhone 14 Pro Max',
    suite: 'ios-chrome',
    platform: 'ios',
    deviceModel: 'iPhone 14 Pro Max'
  },
  {
    id: 'iphone-15',
    label: 'iPhone 15',
    playwrightDevice: 'iPhone 15',
    suite: 'ios-chrome',
    platform: 'ios',
    deviceModel: 'iPhone 15'
  },
  {
    id: 'iphone-15-webclip',
    label: 'iPhone 15 描述文件 WebClip',
    playwrightDevice: 'iPhone 15',
    suite: 'ios-chrome',
    platform: 'ios',
    deviceModel: 'iPhone 15',
    webclipStandalone: true,
    expect: { iosWebClipOuter: true }
  },
  {
    id: 'iphone-15-promax',
    label: 'iPhone 15 Pro Max',
    playwrightDevice: 'iPhone 15 Pro Max',
    suite: 'ios-chrome',
    platform: 'ios',
    deviceModel: 'iPhone 15 Pro Max'
  },
  {
    id: 'iphone-16-pro',
    label: 'iPhone 16 Pro',
    playwrightDevice: 'iPhone 16 Pro',
    suite: 'ios-chrome',
    platform: 'ios',
    deviceModel: 'iPhone 16 Pro'
  },
  {
    id: 'iphone-16-promax',
    label: 'iPhone 16 Pro Max',
    playwrightDevice: 'iPhone 16 Pro Max',
    suite: 'ios-chrome',
    platform: 'ios',
    deviceModel: 'iPhone 16 Pro Max'
  },
  {
    id: 'iphone-air',
    label: 'iPhone Air',
    playwrightDevice: 'iPhone Air',
    suite: 'ios-chrome',
    platform: 'ios',
    deviceModel: 'iPhone Air'
  },
  {
    id: 'iphone-17-pro',
    label: 'iPhone 17 Pro',
    playwrightDevice: 'iPhone 17 Pro',
    suite: 'ios-chrome',
    platform: 'ios',
    deviceModel: 'iPhone 17 Pro'
  },
  {
    id: 'iphone-17-promax',
    label: 'iPhone 17 Pro Max',
    playwrightDevice: 'iPhone 17 Pro Max',
    suite: 'ios-chrome',
    platform: 'ios',
    deviceModel: 'iPhone 17 Pro Max'
  },
  {
    id: 'iphone-ios18-7',
    label: 'iPhone iOS 18.7（线上主队列）',
    playwrightDevice: 'iPhone 15',
    suite: 'ios-chrome',
    platform: 'ios',
    deviceModel: 'iPhone',
    userAgent: iosUa('18.7')
  },
  {
    id: 'iphone-ios18-5',
    label: 'iPhone iOS 18.5',
    playwrightDevice: 'iPhone 15',
    suite: 'ios-chrome',
    platform: 'ios',
    deviceModel: 'iPhone',
    userAgent: iosUa('18.5')
  },
  {
    id: 'iphone-ios17-6',
    label: 'iPhone iOS 17.6.1',
    playwrightDevice: 'iPhone 14 Pro Max',
    suite: 'ios-chrome',
    platform: 'ios',
    deviceModel: 'iPhone',
    userAgent: iosUa('17.6.1')
  },
  {
    id: 'iphone-ios14-4',
    label: 'iPhone iOS 14.4',
    playwrightDevice: 'iPhone 12',
    suite: 'ios-chrome',
    platform: 'ios',
    deviceModel: 'iPhone',
    userAgent: iosUa('14.4')
  },

  /* —— 通用安卓 —— */
  {
    id: 'pixel-7',
    label: 'Pixel 7',
    playwrightDevice: 'Pixel 7',
    suite: 'android-home',
    platform: 'android',
    inApp: true,
    cordovaUa: true
  },
  Object.assign(outer('SM-S9210', 'Galaxy S24', { id: 'galaxy-s24', maxInsetPx: 8 }), {
    /* Playwright 1.52 无 Galaxy S24 内置档，视口走 Pixel 7，UA 仍用 SM-S9210 */
    playwrightDevice: 'Pixel 7',
    userAgent: androidUa('SM-S9210', 'Galaxy S24')
  }),
  {
    id: 'pixel-9',
    label: 'Pixel 9',
    playwrightDevice: 'Pixel 7',
    suite: 'android-home',
    platform: 'android',
    inApp: true,
    cordovaUa: true,
    deviceModel: 'Pixel 9',
    userAgent: androidUa('Pixel 9', 'Pixel 9')
  },

  /* —— 一加 / OPPO（近期 ColorOS 沉浸白顶栏高频） —— */
  immersive('PJD110', '一加 12', ['app-android-oneplus-12', 'app-android-immersive-white-top'], {
    id: 'oneplus-12'
  }),
  immersive('PLQ110', '一加 Ace 6', ['app-android-oneplus-ace6', 'app-android-immersive-white-top'], {
    id: 'oneplus-ace6'
  }),
  immersive('PJA110', '一加 Ace 2 Pro', ['app-android-oneplus-ace2pro', 'app-android-immersive-white-top'], {
    id: 'oneplus-ace2pro'
  }),
  immersive('PHP110', '一加 Ace 2V', ['app-android-oneplus-ace2v', 'app-android-immersive-white-top'], {
    id: 'oneplus-ace2v'
  }),
  immersive('PGP110', '一加 Ace Pro', ['app-android-oneplus-acepro', 'app-android-immersive-white-top'], {
    id: 'oneplus-acepro'
  }),
  /* 近一个月日活第 6：PLK110。未进一加特判，走 App 内安卓白顶默认沉浸 40px */
  immersive('PLK110', '一加 Ace 3V', ['app-android-immersive-white-top'], {
    id: 'oneplus-ace3v'
  }),
  immersive('PHW110', 'OPPO Reno10 5G', ['app-android-oppo-reno10', 'app-android-immersive-white-top'], {
    id: 'oppo-reno10'
  }),
  immersive('PGCM10', 'OPPO K9x', ['app-android-oppo-k9x', 'app-android-immersive-white-top'], {
    id: 'oppo-k9x'
  }),
  Object.assign(outer('PHJ110', 'OPPO A58 5G', { id: 'oppo-a58' }), {}),
  Object.assign(outer('CPH2797', 'OPPO Find X9', { id: 'oppo-findx9' }), {
    userAgent: androidUa('CPH2797', 'OPPO Find X9')
  }),
  /* 线上 PKB110：Find X8。未进核实外置名单，走白顶栏默认沉浸 40px */
  immersive('PKB110', 'OPPO Find X8', ['app-android-oppo-family', 'app-android-immersive-white-top'], {
    id: 'oppo-findx8'
  }),
  /* 线上 PFTM20：A57 5G。未进 A58 外置名单，走默认沉浸，勿误套 A58 清零 */
  immersive('PFTM20', 'OPPO A57 5G', ['app-android-oppo-family', 'app-android-immersive-white-top'], {
    id: 'oppo-a57'
  }),

  /* —— 小米 / 红米 —— */
  immersive('2211133C', '小米 13', ['app-android-xiaomi-13', 'app-android-immersive-white-top'], {
    id: 'xiaomi-13'
  }),
  immersive('2210132C', '小米 13 Pro', ['app-android-xiaomi-13pro', 'app-android-immersive-white-top'], {
    id: 'xiaomi-13pro'
  }),
  immersive('2304FPN6DC', '小米 13 Ultra', ['app-android-xiaomi-13ultra', 'app-android-immersive-white-top'], {
    id: 'xiaomi-13ultra'
  }),
  immersive('23116PN5BC', '小米 14 Pro', ['app-android-xiaomi-14pro', 'app-android-immersive-white-top'], {
    id: 'xiaomi-14pro'
  }),
  {
    id: 'xiaomi-14',
    label: '小米 14',
    playwrightDevice: 'Pixel 7',
    suite: 'android-white-top',
    platform: 'android',
    inApp: true,
    cordovaUa: true,
    deviceModel: '23127PN0CC',
    userAgent: androidUa('23127PN0CC', 'Xiaomi 14'),
    expect: {
      /* 页内黑条 48px，不走 40px 白顶沉浸 class */
      immersiveWhiteTop: false,
      minInsetPx: 48,
      maxInsetPx: 56,
      classContains: ['app-android-xiaomi-14']
    }
  },
  immersive('24129PN74C', '小米 15', ['app-android-xiaomi-15', 'app-android-immersive-white-top'], {
    id: 'xiaomi-15'
  }),
  immersive('2410DPN6CC', '小米 15 Pro', ['app-android-xiaomi-15pro', 'app-android-immersive-white-top'], {
    id: 'xiaomi-15pro'
  }),
  immersive('24122RKC7C', '红米 K80 Pro', ['app-android-redmi-k80pro', 'app-android-immersive-white-top'], {
    id: 'redmi-k80pro'
  }),
  immersive(
    '25060RK16C',
    '红米 K80 Ultra',
    ['app-android-redmi-k80ultra', 'app-android-25060rk16c', 'app-android-immersive-white-top'],
    { id: 'redmi-k80ultra' }
  ),
  immersive('2407FPN8EG', '红米 K70 至尊', ['app-android-redmi-k70-ultra', 'app-android-immersive-white-top'], {
    id: 'redmi-k70-ultra'
  }),
  /* 线上 23113RKC6C：K70 标准版。白顶栏仍沉浸；「我的」外置 40px 黑条 */
  immersive('23113RKC6C', '红米 K70', ['app-android-redmi-k70', 'app-android-immersive-white-top'], {
    id: 'redmi-k70',
    expect: { mineBlackStatus: true }
  }),
  immersive('22120RN86C', '红米 12C', ['app-android-redmi-12c', 'app-android-immersive-white-top'], {
    id: 'redmi-12c'
  }),
  immersive(
    '21091116AC',
    '红米 Note 11 5G',
    ['app-android-redmi-note11-5g', 'app-android-immersive-white-top'],
    { id: 'redmi-note11-5g', minInsetPx: 70 }
  ),

  /* —— 华为 / 荣耀 / Hi nova —— */
  immersive('ALN-AL00', '华为 Mate 60', ['app-android-huawei-mate60', 'app-android-immersive-white-top'], {
    id: 'mate60'
  }),
  immersive('PLA-AL10', '华为 Mate 70', ['app-android-huawei-mate70', 'app-android-immersive-white-top'], {
    id: 'mate70'
  }),
  immersive('TAS-AN00', '华为 Mate 30', ['app-android-huawei-mate30', 'app-android-immersive-white-top'], {
    id: 'mate30'
  }),
  immersive('LIO-AN00', '华为 Mate 30 Pro', ['app-android-huawei-mate30pro', 'app-android-immersive-white-top'], {
    id: 'mate30pro'
  }),
  immersive('BLK-AL80', '华为 nova 13', ['app-android-huawei-nova13', 'app-android-immersive-white-top'], {
    id: 'huawei-nova13'
  }),
  immersive('TGR-W09', '华为 MatePad 11.5S', ['app-android-huawei-matepad115s'], {
    id: 'huawei-matepad115s'
  }),
  immersive('FIO-BD00', 'Hi nova 9 SE', ['app-android-hinova9se', 'app-android-immersive-white-top'], {
    id: 'hinova9se'
  }),
  Object.assign(outer('HBN-AL00', '华为 Pura 70', { id: 'pura70' }), {
    userAgent:
      'Mozilla/5.0 (Linux; Android 12; HBN-AL00 Build/HUAWEIHBN-AL00; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/114.0.5735.196 Mobile Safari/537.36 Huawei HBN-AL00 HarmonyOS TaxPlatformCordovaApp/1.0 Pura 70'
  }),
  Object.assign(outer('FLC-AN00', '荣耀 Magic V3', { id: 'honor-magic-v3' }), {
    userAgent: androidUa('FLC-AN00', 'HONOR Magic V3')
  }),

  /* —— vivo / iQOO / 魅族 —— */
  immersive('V2405A', 'vivo X200 Pro', ['app-android-vivo-x200pro', 'app-android-immersive-white-top'], {
    id: 'vivo-x200pro'
  }),
  immersive('V2502A', 'vivo X300 Pro', ['app-android-vivo-x300pro', 'app-android-immersive-white-top'], {
    id: 'vivo-x300pro'
  }),
  immersive('V2527A', 'vivo S50 Pro mini', ['app-android-vivo-s50promini', 'app-android-immersive-white-top'], {
    id: 'vivo-s50promini'
  }),
  immersive('V2203A', 'vivo S15', ['app-android-vivo-s15', 'app-android-immersive-white-top'], {
    id: 'vivo-s15'
  }),
  immersive('V2241A', 'vivo X90', ['app-android-vivo-x90', 'app-android-immersive-white-top'], {
    id: 'vivo-x90',
    /* OriginOS 5「我的」底图必须单层绘制：见 assertMineE1SingleLayer */
    expect: { mineE1PlainImg: true }
  }),
  /* 线上 V2309A：X100。未进 X90/X200 特判，白顶栏走默认沉浸，勿误套 X90 单层底图 */
  immersive('V2309A', 'vivo X100', ['app-android-vivo-family', 'app-android-immersive-white-top'], {
    id: 'vivo-x100'
  }),
  immersive('V2301A', 'iQOO Neo8', ['app-android-iqoo-neo8', 'app-android-immersive-white-top'], {
    id: 'iqoo-neo8'
  }),
  immersive('V2302A', 'iQOO Neo8 Pro', ['app-android-iqoo-neo8pro', 'app-android-immersive-white-top'], {
    id: 'iqoo-neo8pro'
  }),
  immersive('V2408A', 'iQOO 13', ['app-android-iqoo-13', 'app-android-immersive-white-top'], {
    id: 'iqoo-13'
  }),
  immersive('V2505A', 'iQOO 15', ['app-android-iqoo-15', 'app-android-immersive-white-top'], {
    id: 'iqoo-15'
  }),
  immersive('M391Q', '魅族 20 Pro', ['app-android-meizu-20pro', 'app-android-immersive-white-top'], {
    id: 'meizu-20pro',
    userAgent: androidUa('M391Q', 'MZ-MEIZU 20 Pro')
  })
].map((p) => {
  /* immersive()/outer() 可能漏写 id：用 label slug 兜底不应发生 */
  if (!p.id) throw new Error('device profile missing id: ' + p.label);
  return p;
});

/**
 * 近一个月日活手机（2026-08-09 ~ 09-07）：每人最新一台，排除游客/已隐藏/电脑。
 * model 为 Cordova / UA 型号码；id 对应当前冒烟档。
 */
export const PRODUCTION_TOP_MODELS = [
  { count: 159, model: 'iPhone iOS 18.7', id: 'iphone-ios18-7' },
  { count: 19, model: '23127PN0CC', id: 'xiaomi-14' },
  { count: 15, model: '24129PN74C', id: 'xiaomi-15' },
  { count: 14, model: 'ALN-AL00', id: 'mate60' },
  { count: 13, model: '2211133C', id: 'xiaomi-13' },
  { count: 11, model: 'PLK110', id: 'oneplus-ace3v' },
  { count: 11, model: 'iPhone iOS 18.5', id: 'iphone-ios18-5' },
  { count: 8, model: 'V2505A', id: 'iqoo-15' },
  { count: 7, model: 'V2302A', id: 'iqoo-neo8pro' },
  { count: 7, model: '25060RK16C', id: 'redmi-k80ultra' },
  { count: 6, model: 'PJA110', id: 'oneplus-ace2pro' },
  { count: 6, model: 'PHJ110', id: 'oppo-a58' },
  { count: 6, model: '23116PN5BC', id: 'xiaomi-14pro' },
  { count: 6, model: 'PHW110', id: 'oppo-reno10' },
  { count: 6, model: '23113RKC6C', id: 'redmi-k70' },
  { count: 6, model: 'TAS-AN00', id: 'mate30' },
  { count: 5, model: 'PKB110', id: 'oppo-findx8' },
  { count: 5, model: 'Pixel 9', id: 'pixel-9' },
  { count: 5, model: '2210132C', id: 'xiaomi-13pro' },
  { count: 5, model: 'V2241A', id: 'vivo-x90' },
  { count: 5, model: 'V2301A', id: 'iqoo-neo8' }
];

/** 线上高频机（含 iOS 版本队列）。勿并入 recent，以免默认 CI 过长 */
export const POPULAR_DEVICE_IDS = [...new Set(PRODUCTION_TOP_MODELS.map((row) => row.id))];

/** 近期频繁改兼容性的机型（白顶栏 / 顶距 / 首屏） */
export const RECENT_DEVICE_IDS = [
  'iphone-15-webclip',
  'iphone-16-promax',
  'iphone-17-promax',
  'iphone-air',
  'iphone-ios18-7',
  'oneplus-12',
  'oneplus-ace6',
  'oneplus-ace2pro',
  'oneplus-ace2v',
  'oneplus-acepro',
  'oneplus-ace3v',
  'oppo-reno10',
  'oppo-k9x',
  'oppo-a58',
  'oppo-findx8',
  'xiaomi-13',
  'xiaomi-13pro',
  'xiaomi-13ultra',
  'xiaomi-14',
  'xiaomi-14pro',
  'xiaomi-15',
  'xiaomi-15pro',
  'redmi-k80pro',
  'redmi-k80ultra',
  'redmi-k70-ultra',
  'redmi-k70',
  'redmi-note11-5g',
  'mate60',
  'mate70',
  'mate30',
  'mate30pro',
  'huawei-nova13',
  'hinova9se',
  'pura70',
  'vivo-x200pro',
  'vivo-x300pro',
  'vivo-s50promini',
  'vivo-x90',
  'vivo-x100',
  'iqoo-neo8',
  'iqoo-neo8pro',
  'iqoo-13',
  'iqoo-15',
  'pixel-9',
  'meizu-20pro'
];

/** 默认自测：近一个月日活主力 ∪ 近期兼容档 */
export const MAINSTREAM_DEVICE_IDS = [...new Set(RECENT_DEVICE_IDS.concat(POPULAR_DEVICE_IDS))];

/** UI_SMOKE_DEVICES=all|full|recent|popular|mainstream|id1,id2 */
export function resolveSmokeDevices(raw) {
  const all = DEVICE_PROFILES.slice();
  const spec = String(raw || process.env.UI_SMOKE_DEVICES || 'mainstream').trim().toLowerCase();
  if (spec === 'all') return all;
  if (spec === 'full') return all.filter((d) => d.suite === 'full');
  if (spec === 'recent') {
    const want = new Set(RECENT_DEVICE_IDS);
    return all.filter((d) => want.has(d.id));
  }
  if (spec === 'popular') {
    const want = new Set(POPULAR_DEVICE_IDS);
    return all.filter((d) => want.has(d.id));
  }
  if (spec === 'mainstream') {
    const want = new Set(MAINSTREAM_DEVICE_IDS);
    return all.filter((d) => want.has(d.id));
  }
  const want = new Set(
    spec
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const picked = all.filter((d) => want.has(d.id));
  if (!picked.length) {
    throw new Error(
      'UI_SMOKE_DEVICES 无匹配机型。可选: all | full | recent | popular | mainstream | ' +
        all.map((d) => d.id).join(', ')
    );
  }
  return picked;
}

export function buildContextOptions(profile, devices) {
  const baseName = profile.playwrightDevice || 'Pixel 7';
  const base = devices[baseName];
  if (!base) {
    throw new Error('Playwright 无内置设备: ' + baseName);
  }
  const opts = {
    ...base,
    locale: 'zh-CN'
  };
  let ua = profile.userAgent || base.userAgent || '';
  if (profile.cordovaUa && ua && !/TaxPlatformCordovaApp\//i.test(ua)) {
    ua += ' TaxPlatformCordovaApp/1.0';
  }
  if (ua) opts.userAgent = ua;
  return opts;
}
