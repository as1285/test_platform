/**
 * 【冻结副本 · 2026-08-12】仅供 mine_mate60_aug12.html 使用。
 * 勿与主线 auth.js 同步期望：缺主线后续注入（page-perf / tab-shell / email-reg 等）。
 * Mate60「我的」布局问题请改冻结页或此文件；其它机型走 mine.html + auth.js。
 *
 * 登录态：JWT 存 localStorage.token；未登录访问受保护页面时跳转登录页。
 * 受保护接口请使用 authFetch（自动带 Authorization + X-Client-Device，401 时清理并跳转）。
 * WebView / App 可设置 window.CLIENT_APP_VERSION；可选 window.buildClientDevicePayloadHook(base) 合并字段。
 * Cordova 壳在 UA 中追加 TaxPlatformCordovaApp（config AppendUserAgent），H5 可识别壳内环境。
 */
(function () {
  var LOGIN_PAGE = 'login.html';
  var ACTIVATE_PAGE = 'login.html?need_activate=1';
  var CLIENT_DEVICE_STORAGE_KEY = 'client_device_id';
  var INSTALL_GUIDE_REFERRAL_KEY = 'install_guide_referral';
  var SHARE_ATTR_KEY = 'share_attr_v1';
  var SHARE_LAND_ONCE_KEY = 'share_land_once_v1';
  var LANDING_AB_ASSIGNMENT_KEY = 'landing_bc_assignment_v1';
  var PURCHASE_ABC_ASSIGNMENT_KEY = 'purchase_abc_assignment_v1';
  var INSTALL_GUIDE_REFERRAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  var SHARE_ATTR_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  var SALES_CHANNEL_KEY = 'sales_channel_v1';
  var DISTRIBUTOR_APP_KEY = 'distributor_app_v1';
  var SALES_CHANNEL_TTL_MS = 15 * 60 * 1000;
  var SALES_CHANNEL_PERMANENT_SOURCES = {
    url: true,
    shell: true,
    distributor_app: true,
    agent_channel: true,
    install_packages: true,
    ua: true
  };
  var REGISTER_SOURCE_KEY = 'register_source_channel_v1';
  var REGISTER_SOURCE_LABELS = {
    douyin: '抖音',
    bilibili: 'B站',
    tieba: '百度贴吧',
    zhihu: '知乎',
    friend: '朋友介绍',
    github: 'GitHub'
  };

  /** 尽早占位：后半段初始化异常时，业务页仍可用带 Bearer 的请求（正常路径会被真实 authFetch 覆盖） */
  function bearerTokenFetch(url, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (!headers.Authorization && !headers.authorization) {
      var t = '';
      try {
        t = String(localStorage.getItem('token') || '').trim();
      } catch (eTok) {}
      if (t) headers.Authorization = 'Bearer ' + t;
    }
    return fetch(
      url,
      Object.assign({}, opts, {
        headers: headers,
        credentials: opts.credentials || 'same-origin'
      })
    );
  }
  try {
    if (typeof window.authFetch !== 'function') {
      window.authFetch = bearerTokenFetch;
    }
  } catch (eAuthStub) {}
  var PUBLIC_PAGES = {
    'index.html': true,
    'mine.html': true,
    'shouye.html': true,
    'bancha.html': true,
    'register.html': true,
    'login.html': true,
    'install_guide.html': true,
    'install-ios.html': true,
    'tutorial_video.html': true,
    'zhzh_jhm.html': true
  };
  var APP_STATUS_BAR_COLOR = '#1e6fff';
  /** 通用顶栏蓝（登录 WebClip 等） */
  var APP_TOP_BAR_BLUE = '#2c80f4';
  /** 首页顶栏蓝：官方 zdj-home 头图 pending-tasks-bg 顶缘均值 #4f90f3，状态栏/垫色/theme-color 统一 */
  var APP_SHOUYE_BAR_BLUE = '#4f90f3';
  var APP_SHOUYE_BAR_RGB = '79, 144, 243';
  /** Cordova 壳通过 config AppendUserAgent 追加；若 UA 未透传到 iframe，则用被嵌入状态兜底识别 */
  var CORDOVA_SHELL_UA_RE = /TaxPlatformCordovaApp\//i;
  /** Dynamic Island / 刘海机（16 Pro 等）安全区高度兜底；iframe 内 env 常为 0 */
  var IOS_DYNAMIC_ISLAND_INSET_PX = 59;

  function isCordovaTaxAppShell() {
    try {
      if (CORDOVA_SHELL_UA_RE.test(navigator.userAgent || '')) {
        return true;
      }
    } catch (eUa) {}
    try {
      if (window.cordova || window.PhoneGap) {
        return true;
      }
    } catch (eCv) {}
    try {
      return window.top !== window.self;
    } catch (e) {
      return true;
    }
  }

  var IN_APP_CLIENT_KEY = 'tax_platform_in_app_v1';

  /** 持久化 App 壳标记（Cordova iframe / 描述文件 WebClip / ?in_app=1） */
  function markInstalledAppClient(reason) {
    try {
      sessionStorage.setItem(IN_APP_CLIENT_KEY, reason || '1');
    } catch (e0) {}
    try {
      localStorage.setItem(IN_APP_CLIENT_KEY, reason || '1');
    } catch (e1) {}
    try {
      document.documentElement.classList.add('app-installed-client');
    } catch (e2) {}
  }

  function readInstalledAppClientFlag() {
    try {
      if (sessionStorage.getItem(IN_APP_CLIENT_KEY)) return true;
    } catch (e0) {}
    try {
      if (localStorage.getItem(IN_APP_CLIENT_KEY)) return true;
    } catch (e1) {}
    return false;
  }

  /**
   * 是否已在 App / 主屏 WebClip / 壳内 WebView 中运行。
   * 用于隐藏「下载 App」等仅浏览器需要的入口。
   */
  function isInstalledAppClient() {
    if (isCordovaTaxAppShell()) {
      markInstalledAppClient('cordova');
      return true;
    }
    if (isIosStandaloneApp()) {
      markInstalledAppClient('ios-standalone');
      return true;
    }
    try {
      var p = new URLSearchParams(window.location.search || '');
      if (p.get('in_app') === '1' || p.get('app') === '1' || p.get('from_app') === '1') {
        markInstalledAppClient('query');
        return true;
      }
    } catch (eQ) {}
    try {
      if (
        window.matchMedia &&
        (window.matchMedia('(display-mode: standalone)').matches ||
          window.matchMedia('(display-mode: fullscreen)').matches ||
          window.matchMedia('(display-mode: minimal-ui)').matches)
      ) {
        markInstalledAppClient('display-mode');
        return true;
      }
    } catch (eDm) {}
    if (readInstalledAppClientFlag()) {
      try {
        document.documentElement.classList.add('app-installed-client');
      } catch (eCls) {}
      return true;
    }
    return false;
  }

  /* 尽早标记，避免各页脚本先渲染下载入口 */
  try {
    isInstalledAppClient();
  } catch (eBootApp) {}

  /** 顶层 WKWebView 直接打开网址时 top===self 且无 Cordova UA，仍需避免蓝色安全区条盖住系统栏区域（仅 iOS 明显）。 */
  function isLikelyIOSViewportClient() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) {
      return true;
    }
    try {
      if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) {
        return true;
      }
    } catch (e) {}
    return false;
  }

  /** iOS 主屏图标 / 描述文件 WebClip 的 standalone 运行态（状态栏由页面自己铺色） */
  function isIosStandaloneApp() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    try {
      if (window.navigator.standalone === true) {
        return true;
      }
    } catch (e0) {}
    try {
      return !!(
        window.matchMedia &&
        (window.matchMedia('(display-mode: standalone)').matches ||
          window.matchMedia('(display-mode: fullscreen)').matches)
      );
    } catch (e1) {
      return false;
    }
  }

  /** 入口 / 登录页（WebClip 的启动文档或登录表单） */
  function isAppEntryLoginPage() {
    try {
      var p = String(window.location.pathname || '').split('/').pop() || '';
      return p === '' || p === 'index.html' || p === 'login.html';
    } catch (e) {
      return false;
    }
  }

  function isLikelyAndroidViewportClient() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function getAndroidMajorVersion() {
    var m = String(navigator.userAgent || '').match(/Android\s+(\d+)/i);
    return m ? parseInt(m[1], 10) || 0 : 0;
  }

  function isTallAndroidStatusBarClient() {
    var ua = navigator.userAgent || '';
    if (/PKB110|B60P01/i.test(ua) || /Xiaomi\s*14|23127PN|2201PN/i.test(ua)) {
      return true;
    }
    /* 国产 OEM / 三星 One UI / 折叠外屏：系统状态栏多为 WebView 外独立条，勿套 Android 15+ 的 56px */
    if (
      /Redmi|Xiaomi|Miui|HyperOS/i.test(ua) ||
      isRedmiK70Client() ||
      /HONOR|MagicOS|FLC-AN|FCP-AN|VER-AN|PGT-AN|PTP-AN|ANN-AN/i.test(ua) ||
      isOppoColorOsFamilyClient() ||
      isVivoOriginOsFamilyClient() ||
      isSamsungOneUiFamilyClient() ||
      isHuaweiHarmonyOsFamilyClient()
    ) {
      return false;
    }
    return getAndroidMajorVersion() >= 15;
  }

  /**
   * OPPO / OnePlus / realme / ColorOS（含 Find X9：CPH2797 / PLJ110；A58：PHJ110 等）。
   * ColorOS 上 Cordova WebView 顶缘多在系统状态栏下方，再叠 inset 会出空蓝带。
   */
  function isOppoColorOsFamilyClient() {
    var ua = navigator.userAgent || '';
    if (/OPPO|Oppo|ColorOS|HeyTap|OnePlus|realme/i.test(ua)) {
      return true;
    }
    if (/Find\s*X\s*9/i.test(ua) || /OPPO\s*A58|A58\s*5G/i.test(ua)) {
      return true;
    }
    if (
      /CPH2797|CPH2791|CPH2841|CPH2873|PLJ110|PLG110|PMA110|PME110|OPG07|PKB110|PJE110|PJD110|PHJ110/i.test(
        ua
      )
    ) {
      return true;
    }
    /* 其它 OPPO/一加常见 CPH 型号（须同时是 Android，避免误伤） */
    return /Android/i.test(ua) && /\bCPH\d{4}\b/i.test(ua);
  }

  /** OPPO A58 5G（PHJ110）：ColorOS 外置状态栏，首页勿再叠 40px 空蓝带 */
  function isOppoA58Client() {
    var ua = navigator.userAgent || '';
    return /PHJ110|OPPO\s*A58|A58\s*5G/i.test(ua);
  }

  function isOppoFindX9Client() {
    var ua = navigator.userAgent || '';
    return /CPH2797|CPH2791|CPH2841|CPH2873|PLJ110|PLG110|PMA110|PME110|OPG07|Find\s*X\s*9/i.test(
      ua
    );
  }

  /**
   * 一加 13（PJZ110 / CPH265x）：ColorOS 沉浸式 WebView，状态栏叠在页面上；
   * 不可套用 OPPO 族「外置黑条 → inset 0」，否则白顶栏「返回」压到时间。
   */
  function isOnePlus13Client() {
    var ua = navigator.userAgent || '';
    return /PJZ110|CPH2653|CPH2649|CPH2655|(?:OnePlus|一加)\s*13(?![a-zA-Z0-9])/i.test(ua);
  }

  /**
   * vivo / iQOO / OriginOS：状态栏处理同 OPPO/小米外置条。
   * 注意：多数机型 UA 仅有型号码（如 iQOO 15=V2505A / I2501），不含 vivo/iqoo 字样。
   */
  function isVivoOriginOsFamilyClient() {
    var ua = navigator.userAgent || '';
    if (/vivo|Vivo|OriginOS|iqoo|iQOO/i.test(ua) || isVivoX200ProLikeClient()) {
      return true;
    }
    if (!/Android/i.test(ua)) {
      return false;
    }
    /* 国行 vivo/iQOO：V####A；国际版常见 I####；避免误伤其它品牌 */
    if (/\bV\d{4}A\b/i.test(ua) || /\bI\d{4}\b/i.test(ua)) {
      return true;
    }
    /* iQOO 15 及近世代际显式型号 */
    return /V2505A|I2501|V2405A|V2405DA|V2413\b|V2419A|V2309A|V2241A|V2227A/i.test(ua);
  }

  /** iQOO 15（V2505A / I2501） */
  function isIqoo15Client() {
    var ua = navigator.userAgent || '';
    return /V2505A|I2501|iQOO\s*15(?![a-zA-Z0-9])/i.test(ua);
  }

  /**
   * 三星 One UI（含 Galaxy S24 Ultra=SM-S928*）：Cordova WebView 顶缘多在系统状态栏下方。
   * 若再套 Android 15「高顶栏 56px」或 iOS 式 bleed，我的页 e1 叠字会整体上移压到米色卡边缘。
   */
  function isSamsungOneUiFamilyClient() {
    var ua = navigator.userAgent || '';
    if (!/Android/i.test(ua)) {
      return false;
    }
    return /Samsung|SM-[A-Z]\d{3}|Galaxy/i.test(ua);
  }

  /** Galaxy S24 Ultra（SM-S9280 / SM-S928B 等） */
  function isSamsungS24UltraClient() {
    var ua = navigator.userAgent || '';
    return /SM-S928|Galaxy\s*S24\s*Ultra/i.test(ua);
  }

  /**
   * Hi nova（中国移动定制华为系，如 nova 11=MIZ-BD00）：UA 常无 Huawei 字样，仅型号码。
   */
  function isHiNovaFamilyClient() {
    var ua = navigator.userAgent || '';
    return /Hi\s*nova|hinova|HINOVA|MIZ-BD00|MIZ-AL00|MIZ-AN00|MIZ-BD|MIZ-AL|MIZ-AN|BON-AL00|NCO-AL00|GIA-AL00|NAM-AL00/i.test(
      ua
    );
  }

  /**
   * 华为 / 鸿蒙 / Hi nova：Cordova WebView 顶缘多在系统状态栏下方（或 env 误报 inset）。
   * 未识别时会落入通用 Android 24px，我的页 e1 叠字整体上移压米色卡。
   */
  function isHuaweiHarmonyOsFamilyClient() {
    var ua = navigator.userAgent || '';
    if (isHiNovaFamilyClient()) {
      return true;
    }
    if (/Huawei|HUAWEI|HarmonyOS|HMSCore|OpenHarmony/i.test(ua)) {
      return true;
    }
    if (!/Android/i.test(ua)) {
      return false;
    }
    /* 常见华为型号码（UA 无品牌时）：HBN/ADY/LIO/TAS/CLS…-AL/AN/LX */
    return /\b(?:HBN|ADY|HLY|LNA|MLA|CLS|TAS|LIO|ANA|ELS|NOH|BRA|ALT|JAD|BAL|ALN|FIN|DCO|BON|NCO|GIA|NAM|MIZ)-(?:AL|AN|LX|TL|L29|N29)/i.test(
      ua
    );
  }

  /**
   * 小米 15 Pro（haotian）：2410DPN6CC / 24101PNB7C。
   * Cordova 仍沉浸绘制，不能按普通小米「外置状态栏」清零顶距，否则收入纳税明细顶栏会顶进系统时间栏。
   */
  function isXiaomi15ProClient() {
    var ua = navigator.userAgent || '';
    return /2410DPN6CC|24101PNB7C|Xiaomi\s*15\s*Pro|Mi\s*15\s*Pro/i.test(ua);
  }

  /**
   * 小米 10 / 10 Pro / 10S / 10 Ultra（刘海屏）：M2001J2* / M2001J1* / M2102J2SC / M2007J*。
   * Cordova/MIUI 仍常沉浸压栏，不能按 mi-family「外置黑条」清零顶距，否则筛选页「返回/标题」顶进系统栏。
   */
  function isXiaomi10NotchClient() {
    var ua = navigator.userAgent || '';
    if (/Xiaomi\s*10|Mi\s*10(?!\s*T)|小米\s*10/i.test(ua) && !/Mi\s*10\s*T|Xiaomi\s*10\s*T/i.test(ua)) {
      return true;
    }
    return /M2001J2[CEGI]|M2001J1[CEG]|M2102J2SC|M2007J1SC|M2007J3SC|M2007J17C/i.test(ua);
  }

  /** 系统状态栏在 WebView 外：首页/顶栏勿再叠 statusbar 占位 */
  function isAndroidOuterStatusBarClient() {
    if (isOnePlus13Client()) {
      return false;
    }
    /* MIX Fold：Cordova 仍常沉浸占满，不能当外置黑条清零顶距 */
    if (isXiaomiMixFoldClient()) {
      return false;
    }
    /* 小米 15 Pro：同上，WebView 压在状态栏下 */
    if (isXiaomi15ProClient()) {
      return false;
    }
    /* 小米 10 刘海屏：同上 */
    if (isXiaomi10NotchClient()) {
      return false;
    }
    /* Mate 60 系：Harmony 壳 overlays=false 常失效，须保留顶距 */
    if (isHuaweiMate60Client()) {
      return false;
    }
    return (
      isXiaomiHyperOsFamilyClient() ||
      isOppoColorOsFamilyClient() ||
      isVivoOriginOsFamilyClient() ||
      isHonorFoldableOuterBarClient() ||
      isRedmiK70Client() ||
      isSamsungOneUiFamilyClient() ||
      isHuaweiHarmonyOsFamilyClient()
    );
  }

  /** 小米 13（2211133C 等） */
  function isXiaomi13Client() {
    var ua = navigator.userAgent || '';
    return /2211133C|2210132C|Xiaomi\s*13\b/i.test(ua);
  }

  /**
   * 小米 14：仅匹配明确型号（23127PN 等）。
   * 勿再把「任意 HyperOS / Android 14+」当成小米 14，否则 K70 至尊等会误套 72px 顶栏。
   */
  function isXiaomi14LikeClient() {
    var ua = navigator.userAgent || '';
    if (isXiaomi13Client() || isRedmiNote13ProClient() || isRedmiK70Client()) {
      return false;
    }
    if (/Redmi/i.test(ua)) {
      return false;
    }
    return /Xiaomi\s*14|23127PN|2201PN/i.test(ua);
  }

  /** 小米/红米/HyperOS 系：首页顶栏按「状态栏在 WebView 外」处理 */
  function isXiaomiHyperOsFamilyClient() {
    var ua = navigator.userAgent || '';
    return /Xiaomi|Miui|Redmi|HyperOS/i.test(ua) || isRedmiK70Client();
  }

  /**
   * 小米 MIX Fold 系列（含 Fold3=2308CPXD0C）：折叠内外屏 Cordova 常仍沉浸绘制，
   * 若按普通小米「外置状态栏」清零顶距，搜索条会顶进系统时间栏；宽/窄屏下服务卡也需单独缩放。
   */
  function isXiaomiMixFoldClient() {
    var ua = navigator.userAgent || '';
    if (/MIX\s*Fold|Mi\s*Mix\s*Fold|Xiaomi\s*Mix\s*Fold/i.test(ua)) {
      return true;
    }
    /* Fold2 22061218C / Fold3 2308CPXD0C / Fold4 24072PX77C·2405CPX3DC 等 */
    if (/22061218C|2308CPXD0C|2308MPH|24072PX77C|2405CPX3DC|2405CPX3DG|24072PX77G/i.test(ua)) {
      return true;
    }
    try {
      /* UA 无型号时：小米系 + 接近方屏/宽折叠内屏 */
      if (!isXiaomiHyperOsFamilyClient()) return false;
      var w = Math.min(screen.width || 0, screen.height || 0);
      var h = Math.max(screen.width || 0, screen.height || 0);
      if (w >= 600 && h > 0 && h / w < 1.45) return true;
      /* 外屏偏窄（Fold3 外屏 CSS 宽常 <360） */
      if (w > 0 && w <= 360 && h / w >= 2.2) return true;
    } catch (eFold) {}
    return false;
  }

  /**
   * Cordova 壳 + 小米 14（23127PN0CC 等）：系统状态栏为黑条、iframe 内 env 常为 0。
   * 仅匹配上报 UA，避免影响其它机型；与 app-android-xiaomi-14 叠加时以本类样式为准。
   */
  function isCordovaXiaomi23127Client() {
    var ua = navigator.userAgent || '';
    if (!CORDOVA_SHELL_UA_RE.test(ua)) {
      return false;
    }
    return /23127PN0CC|23127PN\b/i.test(ua);
  }

  /**
   * Cordova 壳 + 小米 10S（M2102J2SC）：我的页个人信息卡税号需单行完整展示。
   */
  function isCordovaXiaomiM2102Client() {
    var ua = navigator.userAgent || '';
    if (!CORDOVA_SHELL_UA_RE.test(ua)) {
      return false;
    }
    return /M2102J2SC/i.test(ua);
  }

  /**
   * 红米 Note 13 Pro（含 Pro 5G / Pro+）：我的页接缝 / 底栏漏蓝、「个人信息」挡眼睛。
   * 型号：2312DRA50C / 2312CRAD3C / 23090RA98C(Pro+) / 23117RA68G 等。
   */
  function isRedmiNote13ProClient() {
    var ua = navigator.userAgent || '';
    if (
      /2312DRA50[CGI]|2312CRAD3C|23117RA68G|2312FPCA6G|23090RA98C|23124RA7EO|2312DRAABC|2312CRNCCL/i.test(
        ua
      )
    ) {
      return true;
    }
    return /(?:Redmi|Xiaomi)[\s_-]*Note[\s_-]*13[\s_-]*Pro/i.test(ua);
  }

  /**
   * 红米 K70 系列（含 Pro / E / 至尊 Ultra）：系统状态栏多为独立黑条，勿再叠 24~72px。
   * 型号：23113RKC6C（K70）、2311DRK48C（K70E）、2407FPN8EG / 2407FRK8EC（K70 至尊）等。
   * UA 偶无型号时用 1440×3200 物理分辨率兜底。
   */
  function isRedmiK70Client() {
    var ua = navigator.userAgent || '';
    if (
      /23113RKC6[CG]|2311DRK48[CGI]|2407FPN8E[GR]|2407FRK8EC|XIG06|A402XM/i.test(ua)
    ) {
      return true;
    }
    if (/(?:Redmi|Xiaomi)[\s_-]*K70/i.test(ua)) {
      return true;
    }
    try {
      if (!/Android/i.test(ua)) {
        return false;
      }
      if (!/Xiaomi|Miui|Redmi|HyperOS/i.test(ua)) {
        return false;
      }
      var sw = window.screen && window.screen.width ? Number(window.screen.width) : 0;
      var sh = window.screen && window.screen.height ? Number(window.screen.height) : 0;
      var dpr = window.devicePixelRatio ? Number(window.devicePixelRatio) : 0;
      if (!sw || !sh || !dpr) {
        return false;
      }
      var pw = Math.round(Math.min(sw, sh) * dpr);
      var ph = Math.round(Math.max(sw, sh) * dpr);
      return pw >= 1400 && pw <= 1480 && ph >= 3100 && ph <= 3300;
    } catch (e) {
      return false;
    }
  }

  /**
   * Cordova 壳 + 小米 15 Pro（2410DPN6CC，Android 16）：WebView 内 env(safe-area-inset-bottom) 常为 0，
   * 底部胶囊导航与系统手势条重叠。仅匹配该机型 UA，不影响其它设备。
   */
  function isCordovaXiaomi2410Client() {
    var ua = navigator.userAgent || '';
    if (!CORDOVA_SHELL_UA_RE.test(ua)) {
      return false;
    }
    return isXiaomi15ProClient() || /2410DPN6CC/i.test(ua);
  }

  /** Redmi K80 等（25060RK16C，Android 16 Cordova）。仅按 UA 型号匹配。 */
  function isAndroid25060RK16CClient() {
    return /25060RK16C/i.test(navigator.userAgent || '');
  }

  /** vivo X200 Pro / X200 Pro mini（OriginOS 6 等，V2405A / V2413 / V2419A）。 */
  function isVivoX200ProLikeClient() {
    var ua = navigator.userAgent || '';
    return /V2405A|V2405DA|V2413\b|V2419A|vivo[\s_]*X200\s*Pro/i.test(ua);
  }

  /**
   * iPhone 16 Pro（非 Max）。UA 含型号时优先匹配；否则按 screen 逻辑像素 402×874（容差）识别。
   */
  /**
   * iPhone 11 Pro：收入纳税明细汇总与「工资薪金」等标题在 PingFang 下偏粗，单独降字重。
   * UA 含 iPhone12,3 或「iPhone 11 Pro」时精确匹配；否则按逻辑屏 375×812（容差）兜底。
   */
  function isIPhone11ProLikeClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    var ua = navigator.userAgent || '';
    if (/iPhone\s*11\s*Pro\s*Max|iPhone12,5/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*11\s*Pro\b|iPhone12,3\b/i.test(ua)) {
      return true;
    }
    try {
      var sw = window.screen && window.screen.width ? Number(window.screen.width) : 0;
      var sh = window.screen && window.screen.height ? Number(window.screen.height) : 0;
      if (!sw || !sh) {
        return false;
      }
      var shortSide = Math.min(sw, sh);
      var longSide = Math.max(sw, sh);
      return shortSide >= 372 && shortSide <= 378 && longSide >= 808 && longSide <= 816;
    } catch (e) {
      return false;
    }
  }

  function getIOSMajorVersion() {
    var m = String(navigator.userAgent || '').match(/OS (\d+)[_.]/i);
    return m ? parseInt(m[1], 10) : 0;
  }

  /** iPhone 17 / 17 Pro 等 6.3 寸档逻辑屏约 402×874（容差）。iPhone Air 为 420×912，勿混入。 */
  function isIPhone402x874Viewport() {
    try {
      var sw = window.screen && window.screen.width ? Number(window.screen.width) : 0;
      var sh = window.screen && window.screen.height ? Number(window.screen.height) : 0;
      if (!sw || !sh) {
        return false;
      }
      var shortSide = Math.min(sw, sh);
      var longSide = Math.max(sw, sh);
      return shortSide >= 399 && shortSide <= 405 && longSide >= 868 && longSide <= 878;
    } catch (e) {
      return false;
    }
  }

  /** iPhone 17 标准版等 6.1 寸档逻辑屏约 393×852（容差）。 */
  function isIPhone393x852Viewport() {
    try {
      var sw = window.screen && window.screen.width ? Number(window.screen.width) : 0;
      var sh = window.screen && window.screen.height ? Number(window.screen.height) : 0;
      if (!sw || !sh) {
        return false;
      }
      var shortSide = Math.min(sw, sh);
      var longSide = Math.max(sw, sh);
      return shortSide >= 390 && shortSide <= 396 && longSide >= 848 && longSide <= 856;
    } catch (e) {
      return false;
    }
  }

  /** iPhone 17 / 17 Pro Max 等 6.9 寸档逻辑屏约 440×956（容差）。 */
  function isIPhone440x956Viewport() {
    try {
      var sw = window.screen && window.screen.width ? Number(window.screen.width) : 0;
      var sh = window.screen && window.screen.height ? Number(window.screen.height) : 0;
      if (!sw || !sh) {
        return false;
      }
      var shortSide = Math.min(sw, sh);
      var longSide = Math.max(sw, sh);
      return shortSide >= 436 && shortSide <= 444 && longSide >= 948 && longSide <= 962;
    } catch (e) {
      return false;
    }
  }

  /**
   * iPhone 17 系列 6.3 寸（17 / 17 Pro，非 Max / 非 Air）：收入纳税明细顶栏「返回」「批量申诉」字号单独放大。
   * UA 含型号时优先；Safari 无型号时用 iOS 26+ 且 402×874 视口与 16 Pro 区分。Air 勿并入。
   */
  function isIPhone17ProLikeClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    var ua = navigator.userAgent || '';
    if (/iPhone\s*Air\b|iPhone18,4\b/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*17\s*Pro\s*Max|iPhone18,2|iPhone19,2/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*17(?:\s*Pro)?\b|iPhone18,1\b|iPhone18,3\b|iPhone19,1\b/i.test(ua)) {
      return true;
    }
    if (getIOSMajorVersion() >= 26 && (isIPhone393x852Viewport() || isIPhone402x874Viewport())) {
      return true;
    }
    return false;
  }

  /**
   * iPhone 12 Pro Max：收入纳税明细大屏下正文字号偏小，单独放大。
   * UA：iPhone13,4；逻辑屏约 428×926（容差）。
   * 13 Pro Max（iPhone14,3）同分辨率，UA 能区分时排除。
   */
  function isIPhone12ProMaxClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    if (isIPhone15PlusProMaxLikeClient()) {
      return false;
    }
    var ua = navigator.userAgent || '';
    if (/iPhone\s*13\s*Pro\s*Max|iPhone14,3\b/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*12\s*Pro\s*Max|iPhone13,4\b/i.test(ua)) {
      return true;
    }
    try {
      var sw = window.screen && window.screen.width ? Number(window.screen.width) : 0;
      var sh = window.screen && window.screen.height ? Number(window.screen.height) : 0;
      if (!sw || !sh) {
        return false;
      }
      var shortSide = Math.min(sw, sh);
      var longSide = Math.max(sw, sh);
      return shortSide >= 426 && shortSide <= 430 && longSide >= 922 && longSide <= 930;
    } catch (e) {
      return false;
    }
  }

  /**
   * iPhone 15 Plus / 15 Pro Max（430×932）：收入纳税明细滑动时列表勿透出状态栏。
   * UA：iPhone15,5 / iPhone16,1 / iPhone16,2 等。
   */
  function isIPhone15PlusProMaxLikeClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    if (isIPhone17ProMaxClient()) {
      return false;
    }
    var ua = navigator.userAgent || '';
    if (/iPhone\s*15\s*Pro\s*Max|iPhone\s*15\s*Plus|iPhone16,2\b|iPhone16,1\b|iPhone15,5\b/i.test(ua)) {
      return true;
    }
    try {
      var sw = window.screen && window.screen.width ? Number(window.screen.width) : 0;
      var sh = window.screen && window.screen.height ? Number(window.screen.height) : 0;
      if (!sw || !sh) {
        return false;
      }
      var shortSide = Math.min(sw, sh);
      var longSide = Math.max(sw, sh);
      return shortSide >= 428 && shortSide <= 432 && longSide >= 928 && longSide <= 936;
    } catch (e) {
      return false;
    }
  }

  /**
   * iPhone 17 Pro Max：收入纳税明细大屏下正文字号偏小，单独放大。
   * UA：iPhone18,2 / iPhone19,2（预留）；Safari 无型号时用 iOS 26+ 且 440×956 与 16 Pro Max 区分。
   */
  function isIPhone17ProMaxClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    var ua = navigator.userAgent || '';
    if (/iPhone\s*17\s*Pro\s*Max|iPhone18,2\b|iPhone19,2\b/i.test(ua)) {
      return true;
    }
    return getIOSMajorVersion() >= 26 && isIPhone440x956Viewport();
  }

  function isIPhoneProMaxLargeFontClient() {
    return (
      isIPhone12ProMaxClient() ||
      isIPhone15PlusProMaxLikeClient() ||
      isIPhone16ProMaxClient() ||
      isIPhone17ProMaxClient()
    );
  }

  /**
   * iPhone 14 Pro（393×852）。Safari UA 通常不暴露硬件型号，因此 iOS 26 以下
   * 同逻辑屏机型共用此排版档；若 UA 带 iPhone15,2 则直接精确匹配。
   */
  function isIPhone14ProLikeClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    var ua = navigator.userAgent || '';
    if (/iPhone\s*14\s*Pro\b|iPhone15,2\b/i.test(ua)) {
      return true;
    }
    if (getIOSMajorVersion() >= 26) {
      return false;
    }
    return isIPhone393x852Viewport();
  }

  /**
   * iPhone 14（6.1 寸，390×844）：收入纳税明细顶栏需铺满状态栏白底，避免列表文字透出；
   * 与 16 Pro 分档，避免误匹配 402×874。
   */
  function isIPhone14LikeClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    if (isIPhone16ProLikeClient() || isIPhone17ProLikeClient() || isIPhone11ProLikeClient()) {
      return false;
    }
    if (isIPhone12ProMaxClient() || isIPhone15PlusProMaxLikeClient() || isIPhone16ProMaxClient() || isIPhone17ProMaxClient()) {
      return false;
    }
    var ua = navigator.userAgent || '';
    if (/iPhone\s*14\s*Pro|iPhone\s*14\s*Plus|iPhone15,2|iPhone15,3|iPhone14,8/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*15\b|iPhone15,4/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*15\s*Plus|iPhone\s*15\s*Pro\s*Max|iPhone15,5|iPhone16,1|iPhone16,2/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*14\b|iPhone14,7\b/i.test(ua)) {
      return true;
    }
    try {
      var sw = window.screen && window.screen.width ? Number(window.screen.width) : 0;
      var sh = window.screen && window.screen.height ? Number(window.screen.height) : 0;
      if (!sw || !sh) {
        return false;
      }
      var shortSide = Math.min(sw, sh);
      var longSide = Math.max(sw, sh);
      if (shortSide >= 391 && shortSide <= 405) {
        return false;
      }
      return shortSide >= 388 && shortSide <= 392 && longSide >= 840 && longSide <= 848;
    } catch (e) {
      return false;
    }
  }

  function isIPhone16ProLikeClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    if (isIPhone17ProLikeClient()) {
      return false;
    }
    var ua = navigator.userAgent || '';
    if (/iPhone\s*16\s*Pro\s*Max|iPhone17,2/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*16\s*Pro\b|iPhone17,1\b/i.test(ua)) {
      return true;
    }
    if (getIOSMajorVersion() >= 26 && isIPhone402x874Viewport()) {
      return false;
    }
    return isIPhone402x874Viewport();
  }

  /**
   * iPhone 16 Pro Max（440×956，iPhone17,2）：收入纳税明细顶栏勿铺满状态栏，避免白底遮挡系统时间。
   * iOS 26+ 同尺寸归 17 Pro Max 档（见 isIPhone17ProMaxClient）。
   */
  function isIPhone16ProMaxClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    if (isIPhone17ProMaxClient()) {
      return false;
    }
    var ua = navigator.userAgent || '';
    if (/iPhone\s*16\s*Pro\s*Max|iPhone17,2\b/i.test(ua)) {
      return true;
    }
    return isIPhone440x956Viewport();
  }

  /** 荣耀 ANN-AN00（Android 15 / MagicOS）顶部安全区单独适配 */
  function isHonorAnnAn00Client() {
    return /ANN-AN00/i.test(navigator.userAgent || '');
  }

  /** 荣耀 Magic5 Pro（PGT-AN20 / Android 16 Cordova）首页顶栏与通知条单独适配 */
  function isHonorPgtAn20Client() {
    return /PGT-AN20/i.test(navigator.userAgent || '');
  }

  /** 荣耀 Magic7 等（PTP-AN00 / Android 16 Cordova）顶部安全区与首页通知条 */
  function isHonorPtpAn00Client() {
    return /PTP-AN00/i.test(navigator.userAgent || '');
  }

  /** 荣耀 Magic V3（FCP-AN10 / FCP-AN20） */
  function isHonorMagicV3Client() {
    return /FCP-AN10|FCP-AN20|Magic\s*V3(?!\s*s)/i.test(navigator.userAgent || '');
  }

  /** 荣耀 Magic Vs3（FLC-AN00 / FLC-AN10；折叠外屏状态栏多为 WebView 外独立条） */
  function isHonorMagicVs3Client() {
    return /FLC-AN00|FLC-AN10|Magic\s*Vs3|MagicVS3/i.test(navigator.userAgent || '');
  }

  /** 荣耀折叠机（V3 / Vs3）：系统状态栏独立，首页勿再叠 safe-area 蓝带 */
  function isHonorFoldableOuterBarClient() {
    return isHonorMagicV3Client() || isHonorMagicVs3Client();
  }

  function isHonorMagicAndroidClient() {
    return (
      isHonorPgtAn20Client() ||
      isHonorPtpAn00Client() ||
      isHonorMagicV3Client() ||
      isHonorMagicVs3Client()
    );
  }

  /**
   * 华为 Pura 70 / P70 系列（如 HBN-AL00）：系统录屏画布常宽于 WebView，右侧易露黑边。
   * 仅按 UA 型号匹配，避免影响其它华为机型。
   */
  function isHuaweiPura70LikeClient() {
    var ua = navigator.userAgent || '';
    if (!/Huawei|HUAWEI|HarmonyOS/i.test(ua)) {
      return false;
    }
    return /HBN-AL00|HBN-AL80|HBN-AL10|HBN-LX9|ADY-AL00|ADY-AL80|ADY-LX9|HLY-AL00|HLY-AL80|HLY-LX9|LNA-AL00|MLA-AL00|MLA-AL10|Pura\s*70|Pura70/i.test(
      ua
    );
  }

  /** 华为 CLS-AL00（Pura X 等，Android 12 Cordova）：收入纳税明细顶栏汇总区字号/问号单独适配 */
  function isHuaweiClsAl00Client() {
    return /CLS-AL00|HUAWEICLS-AL00/i.test(navigator.userAgent || '');
  }

  /** 华为 TAS-AN00（Mate 30/40 等，Android 12 Cordova）：消息页字号整体小两号；我的页个人信息卡姓名小两号 */
  function isHuaweiTasAn00Client() {
    return /TAS-AN00|HUAWEITAS-AN00/i.test(navigator.userAgent || '');
  }

  /**
   * 华为 Mate 30 Pro 5G（LIO-AN00 等）：Cordova 默认 overlaysWebView，白顶栏页会与系统时间/电量重叠。
   * 白顶栏页需 overlays=false + 黑状态栏，对齐「外置黑条」正常机型观感。
   */
  function isHuaweiLioAn00Client() {
    var ua = navigator.userAgent || '';
    if (!/Huawei|HUAWEI|HarmonyOS|HMSCore/i.test(ua) && !/LIO-/i.test(ua)) {
      return false;
    }
    return /LIO-AN00|LIO-AL00|LIO-TL00|LIO-L29|LIO-N29|LIO-AN00m|LIO-AN00P|Mate\s*30\s*Pro/i.test(
      ua
    );
  }

  /**
   * 华为 Mate 60 / Mate 60 Pro / Pro+（ALN-AL00 / ALN-AL10 / ALN-AL80 等）。
   * Harmony Cordova 常仍沉浸压栏，overlays=false 不可靠；不可按华为族「外置黑条」清零顶距，
   * 否则收入纳税明细「返回 / 标题 / 批量申诉」会顶进系统时间与电量栏。
   */
  function isHuaweiMate60Client() {
    var ua = navigator.userAgent || '';
    if (/Mate\s*60/i.test(ua)) {
      return true;
    }
    return /ALN-AL00|ALN-AL10|ALN-AL80|ALN-AN00|ALN-AL\d{2}|ALN-AN\d{2}|HUAWEIALN/i.test(ua);
  }

  function upsertMeta(name, content) {
    try {
      var el = document.querySelector('meta[name="' + name + '"]');
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('name', name);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    } catch (e) {}
  }

  /**
   * 状态栏样式：
   * - 蓝顶栏页（办查/待办/我的/首页/消息）：用 black-translucent，蓝头图顶入刘海，
   *   对齐原版个税 App（StatusBar overlays + lightContent + 蓝底），避免系统白条。
   * - 白顶栏页：iOS standalone 用 default（不透明白底 + 深色字）。
   * 静态 HTML 的 meta 也须写成 black-translucent，WebClip 常只认首屏解析值。
   */
  function setStatusBarStyleMeta(style) {
    try {
      var want = String(style || 'default');
      if (isIosStandaloneApp()) {
        var blueTop = '';
        try {
          blueTop = getImmersiveBlueTopColor() || '';
        } catch (eBlue) {}
        if (blueTop && want !== 'default') {
          upsertMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
          return;
        }
        upsertMeta('apple-mobile-web-app-status-bar-style', 'default');
        return;
      }
      upsertMeta('apple-mobile-web-app-status-bar-style', want);
    } catch (e) {}
  }

  function patchViewportFit() {
    try {
      var el = document.querySelector('meta[name="viewport"]');
      if (!el) {
        return;
      }
      var c = el.getAttribute('content') || '';
      if (c.indexOf('viewport-fit=cover') < 0) {
        el.setAttribute('content', c ? c + ', viewport-fit=cover' : 'width=device-width, initial-scale=1.0, viewport-fit=cover');
      }
    } catch (e) {}
  }

  /**
   * 蓝顶栏页顶色：首页 / 我的 / 待办 / 办查 / 消息（按 body 或路径）。
   * iOS standalone 下入口页同样按蓝顶处理：WebClip 启动文档决定整段会话的状态栏外观，
   * 若启动文档是白色不透明状态栏，后续页面无论怎么改 meta 都会一直露白条。
   */
  function getImmersiveBlueTopColor() {
    try {
      var body = document.body;
      if (body) {
        if (body.classList.contains('page-mine')) return '#1677ff';
        if (body.classList.contains('page-daiban') || body.classList.contains('page-bancha')) {
          return '#2b81f2';
        }
        if (body.classList.contains('page-message')) return '#1e8fff';
        if (body.classList.contains('page-shouye')) return APP_SHOUYE_BAR_BLUE;
      }
      var p = String(window.location.pathname || '').split('/').pop() || '';
      if (p === 'mine.html') return '#1677ff';
      if (p === 'daiban.html' || p === 'bancha.html') return '#2b81f2';
      if (p === 'message.html') return '#1e8fff';
      if (p === 'shouye.html') return APP_SHOUYE_BAR_BLUE;
      if (isAppEntryLoginPage() && isIosStandaloneApp()) return APP_TOP_BAR_BLUE;
    } catch (e) {}
    return '';
  }

  /**
   * iOS / Cordova iframe：测量或兜底写入 --app-shell-statusbar-top。
   * 壳内 iframe 的 env(safe-area-inset-top) 经常是 0，导致头图无法顶入、刘海区露白。
   * Android：切勿套用 iOS Dynamic Island 59px；env≈0 时按外置状态栏写 0。
   */
  function syncAppShellStatusbarTop() {
    try {
      if (!isLikelyIOSViewportClient() && !isCordovaTaxAppShell()) {
        return;
      }
      var measured = 0;
      try {
        if (document.body) {
          var probe = document.createElement('div');
          probe.setAttribute('data-safe-top-probe', '1');
          probe.style.cssText =
            'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;padding-top:env(safe-area-inset-top,0px);';
          document.body.appendChild(probe);
          measured = parseFloat(window.getComputedStyle(probe).paddingTop) || 0;
          if (probe.parentNode) probe.parentNode.removeChild(probe);
        }
      } catch (eProbe) {}
      if (isLikelyAndroidViewportClient()) {
        /*
         * 外置状态栏机型：WebView 已在系统栏下方，env 偶发仍 >0（OriginOS/One UI 等）。
         * 若按 measured 写入会二次上移，「我的」e1 叠字压到米色卡边。外置族一律 0。
         */
        if (
          isAndroidOuterStatusBarClient() ||
          isHuaweiPura70LikeClient() ||
          isHuaweiHarmonyOsFamilyClient()
        ) {
          document.documentElement.style.setProperty('--app-shell-statusbar-top', '0px');
        } else if (measured >= 20) {
          document.documentElement.style.setProperty(
            '--app-shell-statusbar-top',
            Math.round(measured) + 'px'
          );
        } else if (isXiaomi15ProClient()) {
          /* 小米 15 Pro：env 常 0，沉浸绘制需固定顶距 */
          document.documentElement.style.setProperty('--app-shell-statusbar-top', '40px');
        } else {
          /* 通用 Android Cordova：env 常 0；勿再写 24px 默认到我的页 e1（会叠字上移） */
          document.documentElement.style.setProperty('--app-shell-statusbar-top', '0px');
        }
        return;
      }
      var inset = measured;
      /*
       * WebClip / 主屏图标运行态里 env 是可信的：
       * translucent 时给出真实刘海高度，装机时被固化成不透明状态栏时则为 0。
       * 后者页面无法铺色，若再兜底 47/59px 只会在白色状态栏下多出一条蓝带。
       */
      if (measured < 20 && isIosStandaloneApp() && !isCordovaTaxAppShell()) {
        document.documentElement.style.setProperty('--app-shell-statusbar-top', '0px');
        return;
      }
      if (inset < 20) {
        /* 仅 iOS Cordova iframe / 异常 env：刘海与 Dynamic Island 用 59px */
        if (
          isCordovaTaxAppShell() ||
          isIPhone16ProLikeClient() ||
          isIPhone16ProMaxClient() ||
          isIPhone15PlusProMaxLikeClient() ||
          isIPhone17ProLikeClient() ||
          isIPhone17ProMaxClient()
        ) {
          inset = IOS_DYNAMIC_ISLAND_INSET_PX;
        } else if (isLikelyIOSViewportClient()) {
          inset = 47;
        }
      }
      if (inset > 0) {
        document.documentElement.style.setProperty('--app-shell-statusbar-top', inset + 'px');
      }
    } catch (e) {}
  }

  /** 通知 Cordova 父壳改 StatusBar（H5 在 https iframe 内无法直接碰 parent.StatusBar） */
  function requestShellStatusBar(opts) {
    opts = opts || {};
    try {
      var sb = null;
      try {
        if (window.StatusBar) sb = window.StatusBar;
      } catch (e0) {}
      if (!sb) {
        try {
          if (window.top && window.top !== window && window.top.StatusBar) {
            sb = window.top.StatusBar;
          }
        } catch (e1) {}
      }
      if (sb) {
        if (opts.overlays !== false && typeof sb.overlaysWebView === 'function') {
          sb.overlaysWebView(true);
        } else if (opts.overlays === false && typeof sb.overlaysWebView === 'function') {
          sb.overlaysWebView(false);
        }
        if (opts.style === 'default' && typeof sb.styleDefault === 'function') {
          sb.styleDefault();
        } else if (typeof sb.styleLightContent === 'function') {
          sb.styleLightContent();
        }
        if (opts.color && typeof sb.backgroundColorByHexString === 'function') {
          sb.backgroundColorByHexString(opts.color);
        }
        /* 即便能直接碰 StatusBar，也同步通知父壳改 html/body 底色，避免 iframe 外露白 */
      }
    } catch (eSb) {}
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          {
            source: 'tax-h5',
            type: 'status-bar',
            style: opts.style === 'default' ? 'default' : 'light',
            overlays: opts.overlays !== false,
            color: opts.color || '#00000000',
            /* 原版 uni APK：statusbar.background 同步铺到壳层，消除刘海白条 */
            paint_shell: opts.paint_shell !== false,
            shell_bg: opts.shell_bg || opts.color || ''
          },
          '*'
        );
      }
    } catch (eMsg) {}
  }

  /** Cordova / iOS：沉浸状态栏 + 浅色图标，避免白条（对齐原版 immersed + light）
   * topColor：仅状态栏/theme-color；shellBg：壳层与 iframe 外底色（默认浅灰，勿用顶栏蓝铺满，否则 iOS 底栏下露蓝）
   * 安卓 / 鸿蒙：系统栏为独立黑条，与 iOS「蓝顶 translucent + 头图顶入」区分，勿把顶栏蓝铺进 StatusBar。 */
  function applyImmersiveBlueStatusBar(topColor, shellBg) {
    if (!topColor) return;
    try {
      var pageBg = shellBg || '#f5f6fa';
      if (isLikelyAndroidViewportClient()) {
        if (pageBg === topColor || pageBg === '#1677ff' || pageBg === '#2b81f2' || pageBg === '#1e8fff') {
          pageBg = '#f5f6fa';
        }
        upsertMeta('theme-color', '#000000');
        upsertMeta('msapplication-navbutton-color', '#000000');
        setStatusBarStyleMeta('black');
        requestShellStatusBar({
          style: 'light',
          overlays: false,
          color: '#000000',
          paint_shell: true,
          shell_bg: pageBg
        });
        return;
      }
      upsertMeta('theme-color', topColor);
      upsertMeta('msapplication-navbutton-color', topColor);
      setStatusBarStyleMeta('black-translucent');
      requestShellStatusBar({
        style: 'light',
        overlays: true,
        color: topColor,
        paint_shell: true,
        shell_bg: pageBg
      });
    } catch (e) {}
  }

  /** 个人中心：状态栏/根背景与头图顶色对齐；头图顶入安全区，不再盖固色遮罩 */
  function applyMinePageChrome() {
    try {
      if (!document.body || !document.body.classList.contains('page-mine')) {
        return;
      }
      /* 原版 APK manifest：statusbar.background=#1677ff；头图顶行仍用横向渐变消除接缝 */
      var mineBlue = '#1677ff';
      var mineGrad =
        'linear-gradient(90deg,#2d4cf2 0%,#094ee9 12%,#0b56ed 25%,#0972e8 38%,#0c8ef0 50%,#0e9fee 63%,#30b1f2 75%,#64c3f3 88%,#97caf5 100%)';
      /* Mate60 冻结页仅安卓：顶条纯黑，与 iOS 蓝顶沉浸区分 */
      var htmlTopStrip = 'linear-gradient(#000000,#000000)';
      /* 覆盖 setupMobileStatusBar 注入的 html 白底 */
      try {
        var old = document.querySelector('style[data-mine-chrome]');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var st = document.createElement('style');
        st.setAttribute('data-mine-chrome', '1');
        st.textContent =
          /* 安卓/鸿蒙黑条 + 浅灰底；勿铺 iOS 式蓝顶渐变 */
          'html{background-color:#f5f6fa !important;background-image:' +
          htmlTopStrip +
          ' !important;background-size:100% var(--app-shell-statusbar-top,52px) !important;background-repeat:no-repeat !important;background-position:top center !important;' +
          /* html 给百分比高度基准；body 必须用 vh/dvh 撑满视口，否则短文档上 fixed 底栏会悬空 */
          'min-height:100% !important;height:100% !important;}' +
          'html body.page-mine{background-color:#f5f6fa !important;background-image:none !important;' +
          'min-height:100vh !important;min-height:100dvh !important;}' +
          'html.app-top-safe-shell body.page-mine::before,' +
          'html.app-ios-client.app-top-safe-shell body.page-mine::before,' +
          'html.app-ios-client.app-top-safe-shell body.page-mine .header-bg::after,' +
          'html.app-top-safe-shell body.page-mine .header-bg::after{display:none !important;content:none !important;}' +
          /* 安卓不 bleed；头图画布顶色仍用蓝，系统栏区域由 html 黑条承担 */
          'html.app-top-safe-shell body.page-mine .mine-e1-canvas,html.app-top-safe-shell body.page-mine .header-bg{padding-top:0 !important;background:' +
          mineGrad +
          ' !important;overflow:hidden !important;}' +
          'html.app-top-safe-shell body.page-mine .mine-e1-canvas > img,html.app-top-safe-shell body.page-mine .header-bg > img{margin-top:0 !important;display:block !important;width:100% !important;position:relative !important;z-index:1 !important;}' +
          /*
           * 叠层绝对定位相对 padding edge：top:0 与负 margin 上拉后的头图顶对齐。
           * 勿再写 top:-bleed，否则姓名/税号相对米色卡整体上移（Hi nova/华为/三星等均中招）。
           */
          'html.app-top-safe-shell body.page-mine .mine-e1-layer{top:0 !important;}' +
          /*
           * Android「我的」页 e1：默认禁止 bleed（含未识别 OEM）。
           * 一加 13 / MIX Fold 等真沉浸机型单独保留 inset。
           */
          'html.app-android-client.app-top-safe-shell body.page-mine{--mine-top-bleed:0px !important;}' +
          'html.app-android-client.app-top-safe-shell body.page-mine .mine-e1-canvas{padding-top:0 !important;}' +
          'html.app-android-client.app-top-safe-shell body.page-mine .mine-e1-canvas > img{margin-top:0 !important;}' +
          'html.app-android-client.app-top-safe-shell body.page-mine .mine-e1-layer{top:0 !important;}' +
          'html.app-android-oneplus-13.app-top-safe-shell body.page-mine,' +
          'html.app-android-xiaomi-mix-fold.app-top-safe-shell body.page-mine{--mine-top-bleed:var(--app-shell-statusbar-top,40px) !important;}' +
          'html.app-android-oneplus-13.app-top-safe-shell body.page-mine .mine-e1-canvas,' +
          'html.app-android-xiaomi-mix-fold.app-top-safe-shell body.page-mine .mine-e1-canvas{padding-top:var(--mine-top-bleed) !important;}' +
          'html.app-android-oneplus-13.app-top-safe-shell body.page-mine .mine-e1-canvas > img,' +
          'html.app-android-xiaomi-mix-fold.app-top-safe-shell body.page-mine .mine-e1-canvas > img{margin-top:calc(-1 * var(--mine-top-bleed)) !important;}' +
          /* 外置状态栏族：壳级 inset 也清零 */
          'html.app-android-vivo-family.app-top-safe-shell,' +
          'html.app-android-iqoo-15.app-top-safe-shell,' +
          'html.app-android-oppo-family.app-top-safe-shell,' +
          'html.app-android-mi-family.app-top-safe-shell,' +
          'html.app-android-redmi-k70.app-top-safe-shell,' +
          'html.app-android-samsung.app-top-safe-shell,' +
          'html.app-android-samsung-s24u.app-top-safe-shell,' +
          'html.app-android-huawei-harmony.app-top-safe-shell,' +
          'html.app-android-hinova.app-top-safe-shell,' +
          'html.app-android-honor-flc.app-top-safe-shell,' +
          'html.app-android-honor-fcp.app-top-safe-shell{--app-shell-statusbar-top:0px !important;}' +
          'html body.page-mine{--bottom-nav-bottom:var(--bottom-nav-gap,8px)!important;}' +
          'html body.page-mine > .bottom-nav,html body.page-mine > .bottom-nav.ios-device{' +
          'position:fixed!important;left:var(--bottom-nav-side,16px)!important;right:var(--bottom-nav-side,16px)!important;' +
          'bottom:var(--bottom-nav-bottom,8px)!important;top:auto!important;margin:0!important;z-index:10050!important;' +
          'transform:none!important;-webkit-transform:none!important;}' +
          /* iOS：禁止再抬 bottom / 叠 safe-area，与其它 TAB 同为 8px 浮起 */
          'html.app-ios-client body.page-mine{--bottom-nav-bottom:8px!important;--bottom-nav-gap:8px!important;}' +
          'html.app-ios-client body.page-mine > .bottom-nav,html.app-ios-client body.page-mine > .bottom-nav.ios-device{' +
          'bottom:8px!important;padding-top:10px!important;padding-bottom:10px!important;margin-bottom:0!important;}' +
          'html.app-ios-iphone16pro body.page-mine > .bottom-nav,html.app-ios-iphone16pro body.page-mine > .bottom-nav.ios-device,' +
          'html.app-ios-iphone16promax body.page-mine > .bottom-nav,html.app-ios-iphone16promax body.page-mine > .bottom-nav.ios-device{' +
          'bottom:2px!important;}';
        document.head.appendChild(st);
      } catch (eCss) {}
      try {
        /* 仅设变量默认值；具体 bottom 由 pinTabBottomNav 钉死，避免反复打回 8px */
        if (!document.documentElement.style.getPropertyValue('--bottom-nav-bottom')) {
          document.documentElement.style.setProperty('--bottom-nav-bottom', '8px');
          document.documentElement.style.setProperty('--bottom-nav-gap', '8px');
        }
      } catch (eVar) {}
      syncAppShellStatusbarTop();
      applyImmersiveBlueStatusBar(mineBlue);
      try {
        schedulePinTabBottomNav();
      } catch (ePin) {}
    } catch (e) {}
  }

  /** 待办 / 办&查：蓝底沉浸顶栏（对齐原版个税：透明状态栏 + 浅蓝图标 + 蓝头图顶入） */
  function applyDaibanBanchaPageChrome() {
    try {
      if (!document.body) return;
      var isDaiban = document.body.classList.contains('page-daiban');
      var isBancha = document.body.classList.contains('page-bancha');
      if (!isDaiban && !isBancha) return;
      var topBlue = '#2b81f2';
      try {
        var old = document.querySelector('style[data-daiban-bancha-chrome]');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var st = document.createElement('style');
        st.setAttribute('data-daiban-bancha-chrome', '1');
        /* html 底浅灰，仅顶部画状态栏高度蓝带，避免底栏下露蓝；头图 bleed 进刘海 */
        st.textContent =
          'html{background-color:#f5f6fa !important;background-image:linear-gradient(' +
          topBlue +
          ',' +
          topBlue +
          ') !important;background-size:100% var(--app-shell-statusbar-top,env(safe-area-inset-top,59px)) !important;background-repeat:no-repeat !important;background-position:top center !important;min-height:100% !important;height:100% !important;}' +
          'html body.page-daiban,html body.page-bancha{background-color:#f5f6fa !important;background-image:none !important;min-height:100vh !important;min-height:100dvh !important;}' +
          'html.app-top-safe-shell .daiban-header:not([data-header-mode="builtin"]),html.app-top-safe-shell .bancha-header:not([data-header-mode="builtin"]){padding-top:var(--app-shell-statusbar-top,env(safe-area-inset-top,0px)) !important;background:' +
          topBlue +
          ' !important;overflow:hidden !important;}' +
          'html.app-top-safe-shell .daiban-header:not([data-header-mode="builtin"]) > img,html.app-top-safe-shell .bancha-header:not([data-header-mode="builtin"]) > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,env(safe-area-inset-top,0px))) !important;display:block !important;width:100% !important;}' +
          'html.app-top-safe-shell .daiban-header[data-header-mode="builtin"],html.app-top-safe-shell .bancha-header[data-header-mode="builtin"]{padding-top:0 !important;}' +
          /* 默认头图截图层，内置头模式下必须隐藏 */
          'html body.page-daiban .daiban-header[data-header-mode="builtin"] > img,' +
          'html body.page-daiban .daiban-header-custom-img[hidden],' +
          'html body.page-bancha .bancha-header[data-header-mode="builtin"] > img,' +
          'html body.page-bancha .bancha-header-custom-img[hidden]{display:none !important;margin:0 !important;height:0 !important;width:0 !important;visibility:hidden !important;}' +
          'html.app-top-safe-shell body.page-daiban::before,html.app-top-safe-shell body.page-bancha::before{display:none !important;content:none !important;}' +
          'html.app-ios-client.app-top-safe-shell body.page-daiban::before,html.app-ios-client.app-top-safe-shell body.page-bancha::before,' +
          'html.app-ios-standalone-entry body.page-daiban::before,html.app-ios-standalone-entry body.page-bancha::before{content:"" !important;display:block !important;position:fixed !important;left:0 !important;right:0 !important;top:0 !important;height:var(--app-shell-statusbar-top,env(safe-area-inset-top,59px)) !important;background:' +
          topBlue +
          ' !important;z-index:40 !important;pointer-events:none !important;}' +
          /* iOS：底栏仅 8px 浮起，勿再叠加 safe-area（会整条上移留灰底） */
          'html.app-ios-client body.page-daiban,html.app-ios-client body.page-bancha{padding-bottom:0 !important;--bottom-nav-bottom:8px !important;--bottom-nav-gap:8px !important;}' +
          'html.app-ios-client body.page-daiban > .bottom-nav,html.app-ios-client body.page-bancha > .bottom-nav,' +
          'html.app-ios-client body.page-daiban > .bottom-nav.ios-device,html.app-ios-client body.page-bancha > .bottom-nav.ios-device{' +
          'bottom:8px !important;padding-top:10px !important;padding-bottom:10px !important;margin-bottom:0 !important;}' +
          'html body.page-daiban,html body.page-bancha{--bottom-nav-bottom:4px !important;--bottom-nav-gap:4px !important;--bottom-nav-clearance:calc(var(--bottom-nav-height,54px) + var(--bottom-nav-bottom,4px) + 16px) !important;}';
        document.head.appendChild(st);
      } catch (eCss) {}
      try {
        document.documentElement.classList.add('app-ios-blue-status');
      } catch (eCls) {}
      syncAppShellStatusbarTop();
      applyImmersiveBlueStatusBar(topBlue);
      try {
        schedulePinTabBottomNav();
      } catch (ePin) {}
    } catch (e) {}
  }

  /** 消息：蓝渐变顶栏铺进安全区；覆盖 iOS 默认白底状态栏 */
  function applyMessagePageChrome() {
    try {
      if (!document.body || !document.body.classList.contains('page-message')) {
        return;
      }
      var msgBlue = '#1e8fff';
      try {
        var old = document.querySelector('style[data-message-chrome]');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var st = document.createElement('style');
        st.setAttribute('data-message-chrome', '1');
        st.textContent =
          'html{background:' +
          msgBlue +
          ' !important;}' +
          'html body.page-message{background-color:#f5f6fa !important;background-image:linear-gradient(' +
          msgBlue +
          ',' +
          msgBlue +
          ');background-size:100% var(--app-shell-statusbar-top,env(safe-area-inset-top,48px));background-repeat:no-repeat;}' +
          'html.app-top-safe-shell body.page-message::before{display:none !important;content:none !important;}' +
          'html.app-ios-client.app-top-safe-shell body.page-message::before{content:"" !important;display:block !important;position:fixed !important;left:0 !important;right:0 !important;top:0 !important;height:var(--app-shell-statusbar-top,59px) !important;background:' +
          msgBlue +
          ' !important;z-index:40 !important;pointer-events:none !important;}' +
          'html.app-top-safe-shell .message-header-wrap{margin:0 !important;padding:0 !important;}' +
          'html.app-top-safe-shell .message-header-toolbar{padding-top:calc(14px + var(--app-shell-statusbar-top,env(safe-area-inset-top,0px))) !important;background:linear-gradient(180deg,#1e8fff 0%,#3d96ff 55%,#4da0ff 100%) !important;}';
        document.head.appendChild(st);
      } catch (eCss) {}
      syncAppShellStatusbarTop();
      applyImmersiveBlueStatusBar(msgBlue);
    } catch (e) {}
  }

  /** iOS 首页：状态栏与搜索顶栏同蓝（全机型统一，勿再按型号枚举） */
  function applyShouyePageChrome() {
    try {
      if (!document.body || !document.body.classList.contains('page-shouye')) {
        return;
      }
      try {
        document.documentElement.style.setProperty('--shouye-top-bar-rgb', APP_SHOUYE_BAR_RGB);
      } catch (eRgb) {}
      if (isLikelyIOSViewportClient()) {
        try {
          var old = document.querySelector('style[data-shouye-chrome]');
          if (old && old.parentNode) old.parentNode.removeChild(old);
          var st = document.createElement('style');
          st.setAttribute('data-shouye-chrome', '1');
          st.textContent =
            'html.app-ios-client{background-color:' +
            APP_SHOUYE_BAR_BLUE +
            ' !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;}' +
            'html.app-ios-client body.page-shouye{background:#f6f7fb !important;}' +
            'html.app-ios-client.app-top-safe-shell body.page-shouye::before{content:"" !important;position:fixed !important;left:0 !important;right:0 !important;top:0 !important;height:var(--app-shell-statusbar-top,env(safe-area-inset-top,48px)) !important;background-color:rgb(var(--shouye-top-bar-rgb,' +
            APP_SHOUYE_BAR_RGB +
            ')) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;z-index:998 !important;pointer-events:none !important;}' +
            'html.app-ios-client.app-top-safe-shell body.page-shouye .search-bar-wrapper,html.app-ios-client.app-top-safe-shell body.page-shouye .search-bar-wrapper.scrolled{background-color:rgb(var(--shouye-top-bar-rgb,' +
            APP_SHOUYE_BAR_RGB +
            ')) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;box-shadow:none !important;}';
          document.head.appendChild(st);
        } catch (eCss) {}
        syncAppShellStatusbarTop();
      }
      applyImmersiveBlueStatusBar(APP_SHOUYE_BAR_BLUE);
    } catch (e) {}
  }

  /**
   * iOS standalone（描述文件 WebClip / 添加到主屏）入口页：
   * 安全区铺 App 顶栏蓝，状态栏文字用浅色，避免整段会话被锁成白色不透明状态栏。
   * 浏览器内（非 standalone）不生效，登录页原样式不受影响。
   */
  function applyIosStandaloneEntryChrome() {
    try {
      if (!isIosStandaloneApp() || !isAppEntryLoginPage()) {
        return;
      }
      document.documentElement.classList.add('app-ios-standalone-entry');
      var old = document.querySelector('style[data-ios-standalone-entry]');
      if (old && old.parentNode) old.parentNode.removeChild(old);
      var st = document.createElement('style');
      st.setAttribute('data-ios-standalone-entry', '1');
      st.textContent =
        'html.app-ios-standalone-entry{background:' +
        APP_TOP_BAR_BLUE +
        ' !important;}' +
        'html.app-ios-standalone-entry body::before{content:"" !important;position:fixed !important;left:0 !important;right:0 !important;top:0 !important;height:var(--app-shell-statusbar-top,env(safe-area-inset-top,0px)) !important;background:' +
        APP_TOP_BAR_BLUE +
        ' !important;z-index:1000 !important;pointer-events:none !important;}';
      (document.head || document.documentElement).appendChild(st);
      syncAppShellStatusbarTop();
      applyImmersiveBlueStatusBar(APP_TOP_BAR_BLUE);
    } catch (e) {}
  }

  /** iPhone 14 / 16·17 Pro / Pro Max：白顶栏页状态栏与导航栏同色（覆盖全局蓝 theme-color） */
  function applyIPhone16ProPageChrome() {
    try {
      if (
        !document.documentElement.classList.contains('app-ios-iphone14') &&
        !document.documentElement.classList.contains('app-ios-iphone16pro') &&
        !document.documentElement.classList.contains('app-ios-iphone17pro') &&
        !document.documentElement.classList.contains('app-ios-iphone-promax-font') &&
        !document.documentElement.classList.contains('app-ios-iphone15promax') &&
        !document.documentElement.classList.contains('app-ios-iphone16promax')
      ) {
        return;
      }
      var body = document.body;
      if (
        !body ||
        (!body.classList.contains('page-shuiming') &&
          !body.classList.contains('page-shuiming-result'))
      ) {
        return;
      }
      upsertMeta('theme-color', '#ffffff');
      upsertMeta('msapplication-navbutton-color', '#ffffff');
      setStatusBarStyleMeta('default');
      /* Cordova iframe：白顶栏页使用深色状态栏文字，避免白底+浅色图标看不见时间/电量 */
      requestShellStatusBar({ style: 'default', overlays: true, color: '#00000000' });
    } catch (e) {}
  }

  /**
   * Android 收入纳税明细等白顶栏页：状态栏外置（overlays=false）+ 顶距清零。
   * 勿再叠 40px 占位，否则系统时间与「返回」之间会多出大块空白。
   * 例外：小米 15 Pro 等仍沉浸压栏，必须保留顶距，不能走外置清零。
   */
  function applyImmersiveNotchWhitePageChrome() {
    try {
      var root = document.documentElement;
      if (!root.classList.contains('app-android-client')) {
        return;
      }
      var body = document.body;
      var isWhitePage =
        body &&
        (body.classList.contains('page-shuiming') ||
          body.classList.contains('page-shuiming-result') ||
          body.classList.contains('page-xiangqing'));
      if (!isWhitePage) {
        return;
      }
      /* 小米 15 Pro / 小米 10 刘海 / Mate 60：WebView 仍叠在系统栏下，保留 40px 顶距 */
      var immersiveTopInsetClient =
        isXiaomi15ProClient() ||
        root.classList.contains('app-android-xiaomi-15pro') ||
        isXiaomi10NotchClient() ||
        root.classList.contains('app-android-xiaomi-10') ||
        isHuaweiMate60Client() ||
        root.classList.contains('app-android-huawei-mate60');
      if (immersiveTopInsetClient) {
        try {
          root.classList.remove('app-android-white-page-outer');
          if (isXiaomi15ProClient() || root.classList.contains('app-android-xiaomi-15pro')) {
            root.classList.add('app-android-xiaomi-15pro');
          }
          if (isXiaomi10NotchClient() || root.classList.contains('app-android-xiaomi-10')) {
            root.classList.add('app-android-xiaomi-10');
          }
          if (isHuaweiMate60Client() || root.classList.contains('app-android-huawei-mate60')) {
            root.classList.add('app-android-huawei-mate60');
          }
          root.style.setProperty('--app-shell-statusbar-top', '40px');
          root.style.setProperty('--android-status-inset', '40px');
          if (body) {
            body.style.setProperty('--app-shell-statusbar-top', '40px');
            body.style.setProperty('--android-status-inset', '40px');
          }
        } catch (e15) {}
        upsertMeta('theme-color', '#ffffff');
        upsertMeta('msapplication-navbutton-color', '#ffffff');
        setStatusBarStyleMeta('default');
        requestShellStatusBar({
          style: 'dark',
          overlays: true,
          color: '#00000000',
          paint_shell: true,
          shell_bg: '#f5f6fa'
        });
        return;
      }
      var cordovaShell = root.classList.contains('app-cordova-shell');
      var outerStatusBar = isAndroidOuterStatusBarClient();
      var needsOuterBar =
        cordovaShell ||
        outerStatusBar ||
        root.classList.contains('app-android-huawei-lio-an00') ||
        root.classList.contains('app-android-oneplus-13') ||
        isCordovaTaxAppShell();
      try {
        root.classList.add('app-android-white-page-outer');
        root.style.setProperty('--app-shell-statusbar-top', '0px');
        root.style.setProperty('--android-status-inset', '0px');
        body.style.setProperty('--app-shell-statusbar-top', '0px');
        body.style.setProperty('--android-status-inset', '0px');
      } catch (eInset) {}
      if (!needsOuterBar) {
        return;
      }
      upsertMeta('theme-color', '#000000');
      upsertMeta('msapplication-navbutton-color', '#000000');
      setStatusBarStyleMeta('black');
      requestShellStatusBar({
        style: 'light',
        overlays: false,
        color: '#000000',
        paint_shell: true,
        shell_bg: '#f5f6fa'
      });
    } catch (e) {}
  }

  /**
   * 底栏位置锁：Android / iOS 默认 8px 浮起（iOS 勿再叠 safe-area）；Cordova 2410=24px。
   */
  function ensureBottomNavLockStyle(opts) {
    opts = opts || {};
    var iosClient = !!opts.iosClient;
    var bottom = opts.cordovaXiaomi2410 ? '24px' : '8px';
    try {
      document.documentElement.style.setProperty('--bottom-nav-bottom', bottom);
      document.documentElement.style.setProperty('--bottom-nav-gap', bottom);
      if (opts.cordovaXiaomi2410) {
        document.documentElement.style.setProperty('--app-cordova-bottom-inset', '24px');
      }
    } catch (eVar) {}
    var existing = document.querySelector('style[data-app-bottom-nav-lock]');
    if (existing) {
      existing.parentNode && existing.parentNode.removeChild(existing);
    }
    var st = document.createElement('style');
    st.setAttribute('data-app-bottom-nav-lock', '1');
    /* iOS 规则必须写在通用 bottom 之后，否则会被 var(--bottom-nav-bottom) 盖掉 */
    var iosPad =
      'html.app-ios-client{--bottom-nav-bottom:8px !important;--bottom-nav-gap:8px !important;}' +
      'html.app-ios-client body.page-mine{--bottom-nav-bottom:8px !important;--bottom-nav-gap:8px !important;}' +
      'html.app-ios-client body > .bottom-nav,html.app-ios-client body > .bottom-nav.ios-device,' +
      'html.app-ios-client body.page-daiban > .bottom-nav,html.app-ios-client body.page-bancha > .bottom-nav,' +
      'html.app-ios-client body.page-shouye > .bottom-nav,html.app-ios-client body.page-message > .bottom-nav,' +
      'html.app-ios-client body.page-mine > .bottom-nav,html.app-ios-client body.page-mine > .bottom-nav.ios-device{' +
      'bottom:8px!important;' +
      'padding-top:10px!important;' +
      'padding-bottom:10px!important;' +
      'margin-bottom:0!important;' +
      '}';
    st.textContent =
      'html{--bottom-nav-bottom:' +
      bottom +
      ' !important;--bottom-nav-gap:' +
      bottom +
      ' !important;}' +
      'html body.page-mine{--bottom-nav-bottom:var(--bottom-nav-gap,' +
      bottom +
      ')!important;}' +
      'html body .bottom-nav,html body > .bottom-nav,' +
      'html body.page-shouye > .bottom-nav,' +
      'html body.page-daiban > .bottom-nav,html body.page-bancha > .bottom-nav,' +
      'html body.page-message > .bottom-nav,html body.page-mine > .bottom-nav,' +
      'html body.tax-app-shell > .bottom-nav,' +
      'html body .bottom-nav.ios-device{' +
      'position:fixed!important;' +
      'left:var(--bottom-nav-side,16px)!important;' +
      'right:var(--bottom-nav-side,16px)!important;' +
      'bottom:var(--bottom-nav-bottom,' +
      bottom +
      ')!important;' +
      'top:auto!important;' +
      'z-index:10050!important;margin:0!important;animation:none!important;' +
      'transform:none!important;-webkit-transform:none!important;translate:none!important;' +
      'view-transition-name:none!important;pointer-events:auto!important;}' +
      iosPad +
      'html.app-ios-client,html.app-ios-client body{overflow-x:visible!important;}';
    (document.head || document.documentElement).appendChild(st);
  }

  var bottomNavPinBound = false;
  var bottomNavPinTimer = 0;

  /**
   * 钉死底栏：始终挂在 body 下，仅用 position:fixed + bottom。
   * 禁止 translateY / visualViewport.scroll 纠偏——iOS 滚动时会把胶囊顶到页面中间或移出屏外。
   * iOS 勿把 safe-area 加进 bottom/padding，否则会整条上移留下大块灰底。
   */
  function pinTabBottomNav() {
    var nav = document.querySelector('.bottom-nav');
    if (!nav || !document.body) {
      return;
    }
    try {
      if (nav.parentNode !== document.body) {
        document.body.appendChild(nav);
      }
    } catch (eMove) {}

    try {
      if (isLikelyIOSViewportClient()) {
        nav.classList.add('ios-device');
      }
    } catch (eIos) {}

    var targetGap = 8;
    var iosClient = false;
    try {
      iosClient = isLikelyIOSViewportClient() || document.documentElement.classList.contains('app-ios-client');
    } catch (eIosDetect) {}
    try {
      if (document.documentElement.classList.contains('app-cordova-xiaomi-2410')) {
        targetGap = 24;
      } else if (iosClient) {
        /* iOS：与 Android 一样小幅浮起；16 Pro 我的页再贴底，避免相对其它 TAB 悬空 */
        targetGap = 8;
        try {
          if (
            document.body &&
            document.body.classList.contains('page-mine') &&
            (document.documentElement.classList.contains('app-ios-iphone16pro') ||
              document.documentElement.classList.contains('app-ios-iphone16promax'))
          ) {
            targetGap = 2;
          }
        } catch (e16) {}
      } else if (document.body && (document.body.classList.contains('page-daiban') || document.body.classList.contains('page-bancha'))) {
        targetGap = 4;
      } else {
        var cssGap = String(
          document.documentElement.style.getPropertyValue('--bottom-nav-bottom') ||
            getComputedStyle(document.documentElement).getPropertyValue('--bottom-nav-bottom') ||
            ''
        ).trim();
        if (cssGap.indexOf('px') !== -1) {
          var n = parseFloat(cssGap);
          if (!isNaN(n)) targetGap = Math.min(12, Math.max(0, n));
        }
      }
    } catch (eGap) {}

    try {
      var sidePx = '16px';
      try {
        if (window.matchMedia && window.matchMedia('(max-width: 360px)').matches) {
          sidePx = '12px';
        }
      } catch (eSide) {}
      nav.style.setProperty('position', 'fixed', 'important');
      nav.style.setProperty('left', sidePx, 'important');
      nav.style.setProperty('right', sidePx, 'important');
      nav.style.setProperty('top', 'auto', 'important');
      nav.style.setProperty('bottom', targetGap + 'px', 'important');
      nav.style.setProperty('margin', '0', 'important');
      nav.style.setProperty('margin-bottom', '0', 'important');
      if (iosClient) {
        nav.style.setProperty('padding-top', '10px', 'important');
        nav.style.setProperty('padding-bottom', '10px', 'important');
        /* WebKit：backdrop-filter / backface 易让 fixed 底栏相对错误容器抬高（我的页尤甚） */
        nav.style.setProperty('backdrop-filter', 'none', 'important');
        nav.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
        nav.style.setProperty('backface-visibility', 'visible', 'important');
        nav.style.setProperty('-webkit-backface-visibility', 'visible', 'important');
        nav.style.setProperty('background', 'rgba(255,255,255,0.98)', 'important');
      } else {
        nav.style.removeProperty('padding-bottom');
      }
      nav.style.setProperty('transform', 'none', 'important');
      nav.style.setProperty('-webkit-transform', 'none', 'important');
      nav.style.setProperty('translate', 'none', 'important');
      nav.style.setProperty('z-index', '10050', 'important');
      nav.style.setProperty('pointer-events', 'auto', 'important');
      document.documentElement.style.setProperty('--bottom-nav-bottom', targetGap + 'px');
      document.documentElement.style.setProperty('--bottom-nav-gap', targetGap + 'px');
    } catch (eStyle) {}

    /* iOS：若仍被 safe-area / 祖先定位抬高，按实测空隙下拉到约 8px */
    if (iosClient) {
      try {
        closeIosBottomNavExtraGap(nav, targetGap);
        requestAnimationFrame(function () {
          closeIosBottomNavExtraGap(nav, targetGap);
          requestAnimationFrame(function () {
            closeIosBottomNavExtraGap(nav, targetGap);
          });
        });
        setTimeout(function () {
          closeIosBottomNavExtraGap(nav, targetGap);
        }, 50);
        setTimeout(function () {
          closeIosBottomNavExtraGap(nav, targetGap);
        }, 200);
        setTimeout(function () {
          closeIosBottomNavExtraGap(nav, targetGap);
        }, 600);
      } catch (eClose) {}
    }
  }

  function closeIosBottomNavExtraGap(nav, wantGap) {
    if (!nav) return;
    wantGap = typeof wantGap === 'number' ? wantGap : 8;
    /* 只用视口高度，勿用 body.clientHeight（我的页 e1 画布很高会误判空隙） */
    var layoutH = 0;
    try {
      layoutH = Math.max(
        window.innerHeight || 0,
        document.documentElement ? document.documentElement.clientHeight || 0 : 0
      );
      if (window.visualViewport) {
        var vvBottom = Math.round(
          (window.visualViewport.height || 0) + (window.visualViewport.offsetTop || 0)
        );
        /* visualViewport 常更接近真实可见底边；取较大值避免低估 */
        if (vvBottom > layoutH) layoutH = vvBottom;
      }
    } catch (eH) {
      layoutH = window.innerHeight || 0;
    }
    if (!layoutH) return;
    var rect = nav.getBoundingClientRect();
    var gap = layoutH - rect.bottom;
    /* 允许 wantGap±6；明显偏大则下拉（我的页 iPhone 16 Pro 常见 50~80px 悬空） */
    if (!(gap > wantGap + 6)) return;
    var cs = window.getComputedStyle(nav);
    var curBottom = parseFloat(cs.bottom);
    if (isNaN(curBottom)) curBottom = wantGap;
    var nextBottom = curBottom - (gap - wantGap);
    /* 允许较大负值：fixed 相对错误容器时需用负 bottom 才能贴视口底 */
    if (nextBottom < -80) nextBottom = -80;
    nav.style.setProperty('bottom', Math.round(nextBottom) + 'px', 'important');
    nav.style.setProperty('padding-bottom', '10px', 'important');
    nav.style.setProperty('margin-bottom', '0', 'important');
    nav.style.setProperty('transform', 'none', 'important');
    nav.style.setProperty('-webkit-transform', 'none', 'important');
  }

  function schedulePinTabBottomNav() {
    if (bottomNavPinTimer) {
      clearTimeout(bottomNavPinTimer);
    }
    bottomNavPinTimer = setTimeout(function () {
      bottomNavPinTimer = 0;
      pinTabBottomNav();
    }, 16);
  }

  function bindTabBottomNavPin() {
    if (bottomNavPinBound) {
      schedulePinTabBottomNav();
      return;
    }
    bottomNavPinBound = true;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', schedulePinTabBottomNav);
    } else {
      schedulePinTabBottomNav();
    }
    window.addEventListener('pageshow', schedulePinTabBottomNav);
    window.addEventListener('orientationchange', function () {
      setTimeout(schedulePinTabBottomNav, 120);
    });
    window.addEventListener('resize', schedulePinTabBottomNav);
    /* 仅监听 visualViewport.resize；不要监听 scroll，否则滚动时会乱改底栏 */
    try {
      if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', schedulePinTabBottomNav);
      }
    } catch (eVv) {}
  }

  function lockAppSafeBottomInset(opts) {
    opts = opts || {};
    try {
      sessionStorage.removeItem('app_safe_bottom_px_v2');
      sessionStorage.removeItem('app_safe_bottom_px');
    } catch (e0) {}
    try {
      document.documentElement.style.removeProperty('--app-safe-bottom');
    } catch (e1) {}
    ensureBottomNavLockStyle(opts);
    bindTabBottomNavPin();
  }

  function setupMobileStatusBar() {
    try {
      var cordovaShell = isCordovaTaxAppShell();
      var iosClient = isLikelyIOSViewportClient();
      var androidClient = isLikelyAndroidViewportClient();
      var annAn00Client = androidClient && isHonorAnnAn00Client();
      var honorPgtAn20Client = androidClient && isHonorPgtAn20Client();
      var honorPtpAn00Client = androidClient && isHonorPtpAn00Client();
      var honorMagicV3Client = androidClient && isHonorMagicV3Client();
      var honorMagicVs3Client = androidClient && isHonorMagicVs3Client();
      var honorFoldableOuterBarClient = androidClient && isHonorFoldableOuterBarClient();
      var honorMagicAndroidClient = androidClient && isHonorMagicAndroidClient();
      var xiaomi14Client = androidClient && isXiaomi14LikeClient();
      var cordovaXiaomi23127 = androidClient && isCordovaXiaomi23127Client();
      var cordovaXiaomiM2102 = androidClient && isCordovaXiaomiM2102Client();
      var redmiNote13Pro = androidClient && isRedmiNote13ProClient();
      var redmiK70Client = androidClient && isRedmiK70Client();
      var xiaomiMixFoldClient = androidClient && isXiaomiMixFoldClient();
      var xiaomi15ProClient = androidClient && isXiaomi15ProClient();
      var xiaomi10NotchClient = androidClient && isXiaomi10NotchClient();
      var xiaomiHyperOsFamily =
        androidClient &&
        isXiaomiHyperOsFamilyClient() &&
        !xiaomiMixFoldClient &&
        !xiaomi15ProClient &&
        !xiaomi10NotchClient;
      var cordovaXiaomi2410 = androidClient && isCordovaXiaomi2410Client();
      lockAppSafeBottomInset({ cordovaXiaomi2410: cordovaXiaomi2410, iosClient: iosClient });
      var android25060RK16C = androidClient && isAndroid25060RK16CClient();
      var vivoX200ProClient = androidClient && isVivoX200ProLikeClient();
      var cordovaVivoX200Pro = cordovaShell && vivoX200ProClient;
      var oppoColorOsFamily = androidClient && isOppoColorOsFamilyClient();
      var oppoFindX9Client = androidClient && isOppoFindX9Client();
      var oppoA58Client = androidClient && isOppoA58Client();
      var vivoOriginOsFamily = androidClient && isVivoOriginOsFamilyClient();
      var iqoo15Client = androidClient && isIqoo15Client();
      var huaweiMate60Client = androidClient && isHuaweiMate60Client();
      var androidOuterStatusBar =
        androidClient &&
        isAndroidOuterStatusBarClient() &&
        !xiaomi14Client &&
        !xiaomiMixFoldClient &&
        !xiaomi15ProClient &&
        !xiaomi10NotchClient &&
        !huaweiMate60Client;
      var iosIPhone11Pro = iosClient && isIPhone11ProLikeClient();
      var iosIPhone17Pro = iosClient && isIPhone17ProLikeClient();
      var iosIPhone17ProMax = iosClient && isIPhone17ProMaxClient();
      var iosIPhone16ProMax = iosClient && isIPhone16ProMaxClient();
      var iosIPhone16Pro = iosClient && isIPhone16ProLikeClient();
      var iosIPhone14Pro = iosClient && isIPhone14ProLikeClient();
      var iosIPhone14 = iosClient && isIPhone14LikeClient();
      var iosIPhone15ProMax = iosClient && isIPhone15PlusProMaxLikeClient();
      var iosIPhone12ProMax = iosClient && isIPhone12ProMaxClient();
      var iosIPhoneProMaxFont = iosClient && isIPhoneProMaxLargeFontClient();
      var huaweiPura70Client = androidClient && isHuaweiPura70LikeClient();
      var cordovaHuaweiPura70 = cordovaShell && huaweiPura70Client;
      var huaweiClsAl00Client = androidClient && isHuaweiClsAl00Client();
      var huaweiTasAn00Client = androidClient && isHuaweiTasAn00Client();
      var huaweiLioAn00Client = androidClient && isHuaweiLioAn00Client();
      var onePlus13Client = androidClient && isOnePlus13Client();
      var samsungOneUiFamily = androidClient && isSamsungOneUiFamilyClient();
      var samsungS24UltraClient = androidClient && isSamsungS24UltraClient();
      var huaweiHarmonyFamily =
        androidClient && isHuaweiHarmonyOsFamilyClient() && !huaweiMate60Client;
      var hiNovaFamily = androidClient && isHiNovaFamilyClient();
      var tallAndroidStatusBar =
        androidClient &&
        !redmiK70Client &&
        !(xiaomiHyperOsFamily && !xiaomi14Client) &&
        !oppoColorOsFamily &&
        !vivoOriginOsFamily &&
        !samsungOneUiFamily &&
        !huaweiHarmonyFamily &&
        !huaweiMate60Client &&
        (isTallAndroidStatusBarClient() || xiaomi14Client);
      /*
       * 默认：Cordova / iOS / Android 用浅色根底，避免切页蓝闪。
       * 蓝顶栏页（我的/待办/办查/消息）：根底与顶色一致 + translucent，消除刘海白条。
       */
      var lightRootChrome = cordovaShell || iosClient || androidClient;
      var immersiveBlueTop = getImmersiveBlueTopColor();
      var rootChromeBg = cordovaXiaomi23127
        ? APP_STATUS_BAR_COLOR
        : immersiveBlueTop
          ? immersiveBlueTop
          : androidClient
            ? '#f5f6fa'
            : lightRootChrome
              ? '#ffffff'
              : APP_STATUS_BAR_COLOR;
      upsertMeta('theme-color', rootChromeBg);
      upsertMeta('msapplication-navbutton-color', rootChromeBg);
      upsertMeta('apple-mobile-web-app-capable', 'yes');
      upsertMeta('mobile-web-app-capable', 'yes');
      setStatusBarStyleMeta(
        immersiveBlueTop || !lightRootChrome ? 'black-translucent' : 'default'
      );
      (function ensureAppIconLinks() {
        function upsertLink(rel, href, attrs) {
          var sel = 'link[rel="' + rel + '"]';
          if (attrs && attrs.sizes) sel += '[sizes="' + attrs.sizes + '"]';
          if (attrs && attrs.media) sel += '[media="' + attrs.media + '"]';
          var el = document.head.querySelector(sel);
          if (!el) {
            el = document.createElement('link');
            el.setAttribute('rel', rel);
            document.head.appendChild(el);
          }
          el.setAttribute('href', href);
          if (attrs) {
            Object.keys(attrs).forEach(function (k) {
              el.setAttribute(k, attrs[k]);
            });
          }
        }
        upsertLink('apple-touch-icon', 'apple-touch-icon.png', { sizes: '180x180' });
        upsertLink('icon', 'icon-192.png', { type: 'image/png', sizes: '192x192' });
        upsertLink('icon', 'favicon-32.png', { type: 'image/png', sizes: '32x32' });
        /* iOS「添加到主屏幕」/ 描述文件 WebClip 启动图（静态 link 优先；页内覆盖兜底） */
        var startups = [
          {
            href: 'splash/startup-iphone-14-pro-max.png?v=20260731-webclip',
            media:
              '(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)'
          },
          {
            href: 'splash/startup-iphone-14-pro-max.png?v=20260731-webclip',
            media:
              '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)'
          },
          {
            href: 'splash/startup-iphone-14-pro.png?v=20260731-webclip',
            media:
              '(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3)'
          },
          {
            href: 'splash/startup-iphone-14-pro.png?v=20260731-webclip',
            media:
              '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)'
          },
          {
            href: 'splash/startup-iphone-13-pro-max.png?v=20260731-webclip',
            media:
              '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)'
          },
          {
            href: 'splash/startup-iphone-12-13.png?v=20260731-webclip',
            media:
              '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)'
          },
          {
            href: 'splash/startup-iphone-x.png?v=20260731-webclip',
            media:
              '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)'
          },
          {
            href: 'splash/startup-iphone-xs-max.png?v=20260731-webclip',
            media:
              '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)'
          },
          {
            href: 'splash/startup-iphone-xr.png?v=20260731-webclip',
            media:
              '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)'
          },
          {
            href: 'splash/startup-iphone-8-plus.png?v=20260731-webclip',
            media:
              '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)'
          },
          {
            href: 'splash/startup-iphone-8.png?v=20260731-webclip',
            media:
              '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)'
          },
          { href: 'splash_screen.png?v=20260731-webclip', media: '(orientation: portrait)' }
        ];
        startups.forEach(function (s) {
          upsertLink('apple-touch-startup-image', s.href, { media: s.media });
        });
      })();
      if (immersiveBlueTop) {
        applyImmersiveBlueStatusBar(immersiveBlueTop);
      }
      /*
       * 顶部与系统状态栏避让：
       * - Cordova / iframe：iframe 内 env(safe-area-inset-top) 常为 0，用固定 48px。
       * - Android：沉浸式 WebView 里 env 常为 0；Android 15+/PKB110 使用更高兜底，避免标题压进系统状态栏。
       * - iOS 顶层 WKWebView（直接打开网址）：需 env(safe-area-inset-top)，否则首页搜索条、待办图头等会与时间栏重合。
       */
      var useTopSafeInset = cordovaShell || iosClient || androidClient;
      var statusInsetCss = androidClient
        ? (xiaomiMixFoldClient
            ? '40px'
            : xiaomi15ProClient || xiaomi10NotchClient || huaweiMate60Client
            ? '40px'
            : cordovaHuaweiPura70
            ? '0px'
            : huaweiPura70Client
            ? '32px'
            : huaweiLioAn00Client
            ? '36px'
            : onePlus13Client
            ? '40px'
            : honorFoldableOuterBarClient
            ? '0px'
            : honorPtpAn00Client
            ? '44px'
            : honorPgtAn20Client
              ? '36px'
              : androidOuterStatusBar ||
                  redmiK70Client ||
                  samsungOneUiFamily ||
                  huaweiHarmonyFamily ||
                  (xiaomiHyperOsFamily && !xiaomi14Client) ||
                  (oppoColorOsFamily && !onePlus13Client) ||
                  vivoOriginOsFamily
                ? '0px'
                : annAn00Client
                  ? '32px'
                  : tallAndroidStatusBar
                    ? '56px'
                    : '24px')
        : cordovaShell
          ? iosClient
            ? IOS_DYNAMIC_ISLAND_INSET_PX + 'px'
            : '48px'
          : iosClient
            ? 'env(safe-area-inset-top, ' + IOS_DYNAMIC_ISLAND_INSET_PX + 'px)'
            : '';
      if (cordovaShell) {
        document.documentElement.classList.add('app-cordova-shell');
      }
      if (useTopSafeInset) {
        document.documentElement.classList.add('app-top-safe-shell');
      }
      if (androidClient) {
        document.documentElement.classList.add('app-android-client');
      }
      if (annAn00Client) {
        document.documentElement.classList.add('app-android-ann-an00');
      }
      if (honorPgtAn20Client) {
        document.documentElement.classList.add('app-android-honor-pgt-an20');
      }
      if (honorPtpAn00Client) {
        document.documentElement.classList.add('app-android-honor-ptp-an00');
      }
      if (honorMagicV3Client) {
        document.documentElement.classList.add('app-android-honor-fcp');
      }
      if (honorMagicVs3Client) {
        document.documentElement.classList.add('app-android-honor-flc');
      }
      if (honorMagicAndroidClient) {
        document.documentElement.classList.add('app-android-honor-magic');
      }
      if (androidClient && isXiaomi14LikeClient()) {
        document.documentElement.classList.add('app-android-xiaomi-14');
      }
      if (cordovaXiaomi23127) {
        document.documentElement.classList.add('app-cordova-xiaomi-23127');
      }
      if (cordovaXiaomiM2102) {
        document.documentElement.classList.add('app-cordova-xiaomi-m2102');
      }
      if (redmiNote13Pro) {
        document.documentElement.classList.add('app-android-redmi-note13-pro');
      }
      if (redmiK70Client) {
        document.documentElement.classList.add('app-android-redmi-k70');
      }
      if (xiaomiMixFoldClient) {
        document.documentElement.classList.add('app-android-xiaomi-mix-fold');
      }
      if (xiaomi15ProClient) {
        document.documentElement.classList.add('app-android-xiaomi-15pro');
      }
      if (xiaomi10NotchClient) {
        document.documentElement.classList.add('app-android-xiaomi-10');
      }
      if (xiaomiHyperOsFamily && !xiaomi14Client) {
        document.documentElement.classList.add('app-android-mi-family');
      }
      if (cordovaXiaomi2410) {
        document.documentElement.classList.add('app-cordova-xiaomi-2410');
      }
      if (android25060RK16C) {
        document.documentElement.classList.add('app-android-25060rk16c');
      }
      if (vivoX200ProClient) {
        document.documentElement.classList.add('app-android-vivo-x200pro');
      }
      if (cordovaVivoX200Pro) {
        document.documentElement.classList.add('app-cordova-vivo-x200pro');
      }
      if (oppoColorOsFamily) {
        document.documentElement.classList.add('app-android-oppo-family');
      }
      if (oppoFindX9Client) {
        document.documentElement.classList.add('app-android-oppo-find-x9');
      }
      if (oppoA58Client) {
        document.documentElement.classList.add('app-android-oppo-a58');
      }
      if (vivoOriginOsFamily) {
        document.documentElement.classList.add('app-android-vivo-family');
      }
      if (iqoo15Client) {
        document.documentElement.classList.add('app-android-iqoo-15');
      }
      if (iosClient) {
        document.documentElement.classList.add('app-ios-client');
      }
      if (iosIPhone11Pro) {
        document.documentElement.classList.add('app-ios-iphone11pro');
      }
      if (iosIPhone17Pro) {
        document.documentElement.classList.add('app-ios-iphone17pro');
        upsertMeta('theme-color', '#2c80f4');
        upsertMeta('msapplication-navbutton-color', '#2c80f4');
      }
      if (iosIPhone17ProMax) {
        document.documentElement.classList.add('app-ios-iphone17promax');
      }
      if (iosIPhone16Pro) {
        document.documentElement.classList.add('app-ios-iphone16pro');
        /* 仅首页默认对齐搜索顶栏蓝；蓝顶栏页由 page-chrome 再覆盖，避免整站被刷成首页色 */
        if (!immersiveBlueTop) {
          upsertMeta('theme-color', '#2c80f4');
          upsertMeta('msapplication-navbutton-color', '#2c80f4');
        }
      }
      if (iosIPhone14Pro) {
        document.documentElement.classList.add('app-ios-iphone14pro');
      }
      if (iosIPhone16ProMax) {
        document.documentElement.classList.add('app-ios-iphone16promax');
        if (!immersiveBlueTop) {
          upsertMeta('theme-color', '#2c80f4');
          upsertMeta('msapplication-navbutton-color', '#2c80f4');
        }
      }
      if (iosIPhone14) {
        document.documentElement.classList.add('app-ios-iphone14');
      }
      if (iosIPhone15ProMax) {
        document.documentElement.classList.add('app-ios-iphone15promax');
        /* 15 Pro Max 首页：状态栏须与搜索顶栏同蓝，避免白条接缝 */
        upsertMeta('theme-color', '#2c80f4');
        upsertMeta('msapplication-navbutton-color', '#2c80f4');
      }
      if (iosIPhone12ProMax) {
        document.documentElement.classList.add('app-ios-iphone12promax');
      }
      if (iosIPhoneProMaxFont) {
        document.documentElement.classList.add('app-ios-iphone-promax-font');
      }
      if (huaweiPura70Client) {
        document.documentElement.classList.add('app-huawei-pura70');
      }
      if (cordovaHuaweiPura70) {
        document.documentElement.classList.add('app-cordova-huawei-pura70');
      }
      if (huaweiClsAl00Client) {
        document.documentElement.classList.add('app-android-huawei-cls-al00');
      }
      if (huaweiTasAn00Client) {
        document.documentElement.classList.add('app-android-huawei-tas-an00');
      }
      if (huaweiLioAn00Client) {
        document.documentElement.classList.add('app-android-huawei-lio-an00');
      }
      if (huaweiMate60Client) {
        document.documentElement.classList.add('app-android-huawei-mate60');
      }
      if (huaweiHarmonyFamily) {
        document.documentElement.classList.add('app-android-huawei-harmony');
      }
      if (hiNovaFamily) {
        document.documentElement.classList.add('app-android-hinova');
      }
      if (onePlus13Client) {
        document.documentElement.classList.add('app-android-oneplus-13');
      }
      if (samsungOneUiFamily) {
        document.documentElement.classList.add('app-android-samsung');
      }
      if (samsungS24UltraClient) {
        document.documentElement.classList.add('app-android-samsung-s24u');
      }
      var style = document.createElement('style');
      var barFill =
        'body::before{content:"";position:fixed;left:0;right:0;top:0;height:env(safe-area-inset-top,0px);background:' +
        APP_STATUS_BAR_COLOR +
        ';z-index:2147483647;pointer-events:none;}';
      if (lightRootChrome) {
        barFill = '';
      }
      /*
       * 普通桌面浏览器保留旧的蓝色补条；Cordova / iOS / Android 不铺条，避免切页蓝闪或与白顶栏冲突。
       */
      style.textContent =
        'html{background:' +
        rootChromeBg +
        ';}' +
        (androidClient ? 'html.app-android-client,html.app-android-client body{background:#f5f6fa;}' : '') +
        barFill;
      document.head.appendChild(style);
      if (useTopSafeInset && statusInsetCss) {
        var shellExtra = document.createElement('style');
        shellExtra.setAttribute('data-app-top-safe-shell', '1');
        var topFixedHeaderRule = cordovaShell
          ? 'html.app-top-safe-shell .top-fixed .header{padding-top:calc(8px + env(safe-area-inset-top, 0px) + var(--app-shell-statusbar-top)) !important;}'
          : '';
        shellExtra.textContent =
          'html.app-top-safe-shell{--app-shell-statusbar-top:' +
          statusInsetCss +
          ';}' +
          'html.app-android-xiaomi-14.app-top-safe-shell{--app-shell-statusbar-top:72px !important;}' +
          'html.app-android-xiaomi-mix-fold.app-top-safe-shell{--app-shell-statusbar-top:40px !important;}' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-xiaomi-10.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-redmi-k70.app-top-safe-shell,html.app-android-mi-family.app-top-safe-shell,html.app-android-oppo-family.app-top-safe-shell,html.app-android-vivo-family.app-top-safe-shell,html.app-android-iqoo-15.app-top-safe-shell,html.app-android-samsung.app-top-safe-shell,html.app-android-samsung-s24u.app-top-safe-shell,html.app-android-huawei-harmony.app-top-safe-shell,html.app-android-hinova.app-top-safe-shell{--app-shell-statusbar-top:0px !important;}' +
          /* Mate 60 / 小米 10：压过族清零，保留沉浸顶距 */ +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell,' +
          'html.app-android-xiaomi-10.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          /* 首页顶距由下方 Android 统一规则接管，勿在此清零 */ +
          'html.app-android-client.app-top-safe-shell .page-root{--safe-top:var(--app-shell-statusbar-top) !important;}' +
          'html.app-android-client.app-top-safe-shell .top-fixed .header{top:0 !important;height:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;padding:var(--app-shell-statusbar-top) 16px 0 !important;z-index:120 !important;}' +
          'html.app-android-client.app-top-safe-shell .top-fixed .header .back-btn,html.app-android-client.app-top-safe-shell .top-fixed .header .header-right{top:var(--app-shell-statusbar-top) !important;height:var(--header-height,52px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-client.app-top-safe-shell .top-fixed .summary{top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-client.app-top-safe-shell .list{margin-top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;}' +
          /* 收入纳税明细：外置黑条机型勿叠顶距；Cordova 沉浸壳用 shell 顶距兜底（压状态栏时） */
          'html.app-android-client.app-top-safe-shell.app-android-oppo-family body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-vivo-family body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-mi-family body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-redmi-k70 body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-samsung body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-samsung-s24u body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-flc body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-fcp body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .page-root{--safe-top:0px !important;}' +
          'html.app-android-client.app-top-safe-shell.app-android-oppo-family body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-vivo-family body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-mi-family body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-redmi-k70 body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-flc body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-fcp body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header{top:0 !important;height:var(--header-height,48px) !important;min-height:var(--header-height,48px) !important;padding:8px 16px !important;box-sizing:border-box !important;z-index:120 !important;}' +
          'html.app-android-client.app-top-safe-shell.app-android-oppo-family body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-vivo-family body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-mi-family body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-redmi-k70 body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-flc body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-fcp body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-oppo-family body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-vivo-family body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-mi-family body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-redmi-k70 body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-flc body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-fcp body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .header-right{top:0 !important;height:var(--header-height,48px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-client.app-top-safe-shell.app-android-oppo-family body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-vivo-family body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-mi-family body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-redmi-k70 body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-flc body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-fcp body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .summary{top:var(--header-height,48px) !important;}' +
          'html.app-android-client.app-top-safe-shell.app-android-oppo-family body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-vivo-family body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-mi-family body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-redmi-k70 body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-flc body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-fcp body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .list{margin-top:var(--header-height,48px) !important;}' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .page-root{--safe-top:var(--app-shell-statusbar-top,48px) !important;}' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .header{top:0 !important;height:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,48px)) !important;min-height:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,48px)) !important;padding:var(--app-shell-statusbar-top,48px) 16px 0 !important;box-sizing:border-box !important;z-index:120 !important;background:#fff !important;}' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{top:var(--app-shell-statusbar-top,48px) !important;height:var(--header-height,48px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,48px)) !important;}' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .list{margin-top:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,48px)) !important;}' +
          'html.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed{height:0 !important;margin:0 !important;padding:0 !important;overflow:visible !important;}' +
          'html.app-top-safe-shell .search-bar-wrapper{padding-top:calc(6px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-top-safe-shell body.page-shouye .search-bar-wrapper{background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;box-shadow:none !important;}' +
          'html.app-top-safe-shell body.page-shouye .shouye-page{padding-top:var(--shouye-fixed-top-h,78px) !important;}' +
          'html.app-top-safe-shell body.page-shouye .shouye-header{margin-top:calc(-1 * var(--shouye-fixed-top-h,78px)) !important;padding-top:var(--shouye-fixed-top-h,78px) !important;background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;}' +
          'html.app-top-safe-shell body.page-shouye .shouye-banner-wrap .notice-bar{position:relative !important;top:auto !important;left:auto !important;right:auto !important;margin:2px 12px 14px !important;}' +
          /*
           * Android 首页统一：Cordova/沉浸 WebView 普遍仍会画到状态栏下，
           * 勿再按厂商清零顶距（否则搜索条吃进系统时间栏）。
           * Pura70 Cordova 壳已避让状态栏，排除在外。
           */
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye{--shouye-status-inset:40px;--app-shell-statusbar-top:var(--shouye-status-inset) !important;}' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye::before{content:"" !important;position:fixed !important;left:0 !important;right:0 !important;top:0 !important;height:var(--shouye-status-inset,40px) !important;background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;z-index:998 !important;pointer-events:none !important;}' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye .search-bar-wrapper{padding-top:var(--shouye-status-inset,40px) !important;background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;}' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye .shouye-page{padding-top:var(--shouye-fixed-top-h,92px) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell body:not(.page-shouye) .search-bar-wrapper{padding-top:calc(8px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-ann-an00.app-top-safe-shell .search-bar-wrapper{padding-top:calc(2px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-ann-an00.app-top-safe-shell body.page-shouye .shouye-page{padding-top:calc(53px + var(--app-shell-statusbar-top,0px)) !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell .search-bar-wrapper{padding-top:calc(8px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell body.page-shouye .search-bar-wrapper{background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell body.page-shouye .search-bar-wrapper.scrolled{background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;}' +
          'html.app-android-honor-pgt-an20.app-top-safe-shell{--app-shell-statusbar-top:36px !important;}' +
          'html.app-android-honor-ptp-an00.app-top-safe-shell{--app-shell-statusbar-top:44px !important;}' +
          'html.app-android-honor-ptp-an00.app-top-safe-shell body.page-shouye .shouye-page{padding-top:calc(54px + var(--app-shell-statusbar-top,44px)) !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell body.page-mine .header-bg{padding-top:var(--app-shell-statusbar-top,0px) !important;background:#2286ee !important;overflow:hidden !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell body.page-mine .header-bg > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,0px)) !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell .daiban-header:not([data-header-mode="builtin"]){padding-top:var(--app-shell-statusbar-top) !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell .daiban-header[data-header-mode="builtin"]{padding-top:0 !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell .daiban-header:not([data-header-mode="builtin"]) > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,0px)) !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell .bancha-header:not([data-header-mode="builtin"]){padding-top:var(--app-shell-statusbar-top) !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell .bancha-header[data-header-mode="builtin"]{padding-top:0 !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell .bancha-header:not([data-header-mode="builtin"]) > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,0px)) !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell .message-header-toolbar{padding-top:calc(12px + var(--app-shell-statusbar-top)) !important;}' +
          /* 荣耀折叠：非首页仍可按外置状态栏；首页走上方统一 Android 顶距 */
          'html.app-android-honor-flc.app-top-safe-shell:not(:has(body.page-shouye)),html.app-android-honor-fcp.app-top-safe-shell:not(:has(body.page-shouye)){--app-shell-statusbar-top:0px !important;}' +
          'html.app-android-honor-flc.app-top-safe-shell:not(:has(body.page-shouye)) .search-bar-wrapper,html.app-android-honor-fcp.app-top-safe-shell:not(:has(body.page-shouye)) .search-bar-wrapper{padding-top:0 !important;}' +
          'html.app-android-client.app-top-safe-shell body.page-shouye .search-bar-wrapper{box-shadow:none !important;border:0 !important;overflow:hidden !important;}' +
          'html.app-android-client.app-top-safe-shell body.page-shouye .search-bar-wrapper .sy-apk-ahead{margin-top:-1px !important;display:block !important;}' +
          'html.app-android-client.app-top-safe-shell:has(body.page-shouye){background-color:#f4f6f9 !important;background-image:linear-gradient(rgb(var(--shouye-top-bar-rgb,79, 144, 243)),rgb(var(--shouye-top-bar-rgb,79, 144, 243))) !important;background-size:100% var(--shouye-fixed-top-h,92px) !important;background-repeat:no-repeat !important;background-position:top center !important;}' +
          'html.app-android-honor-flc.app-top-safe-shell body.page-mine .header-bg,html.app-android-honor-fcp.app-top-safe-shell body.page-mine .header-bg{padding-top:0 !important;}' +
          'html.app-android-honor-flc.app-top-safe-shell body.page-mine .header-bg > img,html.app-android-honor-fcp.app-top-safe-shell body.page-mine .header-bg > img{margin-top:0 !important;}' +
          /* 荣耀折叠非首页：外置栏机型仍可能沉浸，顶距交给文末 Android 统一 inset，勿再写死 0 */
          'html.app-android-honor-flc.app-top-safe-shell .message-header-toolbar,html.app-android-honor-fcp.app-top-safe-shell .message-header-toolbar{padding-top:calc(12px + var(--app-shell-statusbar-top,0px)) !important;}' +
          /* 待办/办查：头图顶入安全区，兜底色与图顶取样一致 */
          'html.app-top-safe-shell .daiban-header:not([data-header-mode="builtin"]){padding-top:var(--app-shell-statusbar-top) !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-top-safe-shell .daiban-header[data-header-mode="builtin"]{padding-top:0 !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-top-safe-shell .daiban-header:not([data-header-mode="builtin"]) > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,0px)) !important;display:block !important;width:100% !important;}' +
          'html.app-top-safe-shell .bancha-header:not([data-header-mode="builtin"]){padding-top:var(--app-shell-statusbar-top) !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-top-safe-shell .bancha-header[data-header-mode="builtin"]{padding-top:0 !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-top-safe-shell .bancha-header:not([data-header-mode="builtin"]) > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,0px)) !important;display:block !important;width:100% !important;}' +
          'html.app-top-safe-shell body.page-daiban::before,html.app-top-safe-shell body.page-bancha::before{display:none !important;content:none !important;}' +
          'html.app-top-safe-shell .message-header-toolbar{padding-top:calc(14px + var(--app-shell-statusbar-top)) !important;padding-bottom:20px !important;padding-left:16px !important;padding-right:16px !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell .message-header-toolbar{padding-bottom:20px !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell .message-header-title{margin-bottom:18px !important;}' +
          'html.app-top-safe-shell body:not(.page-shuiming) > .header{padding-top:calc(14px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-top-safe-shell body.page-login .header{padding-top:calc(15px + var(--app-shell-statusbar-top)) !important;}' +
          /* Android 白顶栏页：高度随内容；顶距由统一 inset / 页级规则负责，勿写死 14px 顶到状态栏 */
          'html.app-android-client.app-top-safe-shell body > .header{height:auto !important;min-height:0 !important;padding-bottom:15px !important;}' +
          'html.app-android-client.app-top-safe-shell body.page-login .header{min-height:auto !important;padding-top:15px !important;}' +
          /* 收入纳税明细筛选页：固定顶栏；Android 顶距见文末统一 40px，勿在此清零 */
          'html.app-android-client.app-top-safe-shell body.page-shuiming > .header,' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming > .header,' +
          'html.app-android-honor-magic.app-top-safe-shell body.page-shuiming > .header,' +
          'html.app-android-honor-flc.app-top-safe-shell body.page-shuiming > .header,' +
          'html.app-android-honor-fcp.app-top-safe-shell body.page-shuiming > .header{' +
          'position:fixed !important;top:0 !important;left:0 !important;right:0 !important;' +
          'padding-top:calc(14px + var(--app-shell-statusbar-top,40px)) !important;padding-bottom:15px !important;box-sizing:border-box !important;}' +
          'html.app-android-client.app-top-safe-shell body.page-shuiming > .content,' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming > .content,' +
          'html.app-android-honor-magic.app-top-safe-shell body.page-shuiming > .content,' +
          'html.app-android-honor-flc.app-top-safe-shell body.page-shuiming > .content,' +
          'html.app-android-honor-fcp.app-top-safe-shell body.page-shuiming > .content{padding-top:calc(46px + var(--app-shell-statusbar-top,40px)) !important;}' +
          'html.app-top-safe-shell body.page-xiangqing{padding-top:calc(48px + var(--app-shell-statusbar-top)) !important;}' +
          /* 我的：头图顶入安全区，兜底色与 grdb.jpg 顶色一致 */
          'html.app-top-safe-shell body.page-mine .header-bg{padding-top:var(--app-shell-statusbar-top,0px) !important;background:#2286ee !important;overflow:hidden !important;}' +
          'html.app-top-safe-shell body.page-mine .header-bg > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,0px)) !important;display:block !important;width:100% !important;}' +
          'html.app-top-safe-shell body.page-mine::before{display:none !important;content:none !important;}' +
          /* iOS：非 Cordova 用真实 env；Cordova iframe env 常为 0，锁 59px；16 Pro 强制至少 59 */
          'html.app-ios-client.app-top-safe-shell:not(.app-cordova-shell){--app-shell-statusbar-top:env(safe-area-inset-top,59px) !important;--mine-ios-header-lift:0px;--mine-header-blue-top:#2286ee;}' +
          'html.app-cordova-shell.app-ios-client.app-top-safe-shell{--app-shell-statusbar-top:59px !important;--mine-ios-header-lift:0px;--mine-header-blue-top:#2286ee;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell,html.app-ios-iphone16promax.app-top-safe-shell,html.app-ios-iphone15promax.app-top-safe-shell{--app-shell-statusbar-top:max(59px,env(safe-area-inset-top,59px)) !important;}' +
          /* iOS 我的：头图顶入，禁用拼接伪元素 */
          'html.app-ios-client.app-top-safe-shell body.page-mine::before,html.app-ios-client.app-top-safe-shell body.page-mine .header-bg::after{display:none !important;content:none !important;}' +
          'html.app-ios-client.app-top-safe-shell body.page-mine .header-bg{position:relative;z-index:0 !important;padding-top:var(--app-shell-statusbar-top,0px) !important;overflow:hidden !important;background:#2286ee !important;}' +
          'html.app-ios-client.app-top-safe-shell body.page-mine .header-bg > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,0px)) !important;position:relative !important;z-index:1 !important;display:block !important;width:100% !important;}' +
          'html.app-ios-client.app-top-safe-shell body.page-mine .mine-activate-btn{top:calc(var(--mine-activate-btn-top-offset,66px) + var(--app-shell-statusbar-top,0px)) !important;}' +
          'html body.page-mine{--bottom-nav-bottom:var(--bottom-nav-gap,8px)!important;min-height:100vh!important;min-height:100dvh!important;}' +
          'html body.page-mine > .bottom-nav{bottom:var(--bottom-nav-bottom,8px)!important;top:auto!important;margin:0!important;transform:none!important;-webkit-transform:none!important;}' +
          'html.app-ios-client body.page-mine{--bottom-nav-bottom:8px!important;--bottom-nav-gap:8px!important;}' +
          'html.app-ios-client body.page-mine > .bottom-nav,html.app-ios-client body.page-mine > .bottom-nav.ios-device{bottom:8px!important;padding-top:10px!important;padding-bottom:10px!important;margin-bottom:0!important;top:auto!important;transform:none!important;-webkit-transform:none!important;}' +
          'html.app-ios-iphone16pro body.page-mine > .bottom-nav,html.app-ios-iphone16pro body.page-mine > .bottom-nav.ios-device,html.app-ios-iphone16promax body.page-mine > .bottom-nav,html.app-ios-iphone16promax body.page-mine > .bottom-nav.ios-device{bottom:2px!important;}' +
          'html.app-ios-client.app-top-safe-shell body.page-daiban::before,html.app-ios-client.app-top-safe-shell body.page-bancha::before{content:"" !important;display:block !important;position:fixed !important;left:0 !important;right:0 !important;top:0 !important;height:var(--app-shell-statusbar-top,59px) !important;background:#2b81f2 !important;z-index:40 !important;pointer-events:none !important;}' +
          'html.app-ios-client.app-top-safe-shell body.page-message::before{content:"" !important;display:block !important;position:fixed !important;left:0 !important;right:0 !important;top:0 !important;height:var(--app-shell-statusbar-top,59px) !important;background:#1e8fff !important;z-index:40 !important;pointer-events:none !important;}' +
          /* iPhone 12 Pro Max：待办/办查/消息/我的 用头图 bleed，取消固色垫带 */
          'html.app-ios-iphone12promax.app-top-safe-shell{--mine-ios-header-lift:0px !important;--app-shell-statusbar-top:env(safe-area-inset-top,0px) !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell body.page-daiban::before,html.app-ios-iphone12promax.app-top-safe-shell body.page-bancha::before{display:none !important;content:none !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell .daiban-header:not([data-header-mode="builtin"]),html.app-ios-iphone12promax.app-top-safe-shell .bancha-header:not([data-header-mode="builtin"]){padding-top:env(safe-area-inset-top,0px) !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell .daiban-header[data-header-mode="builtin"],html.app-ios-iphone12promax.app-top-safe-shell .bancha-header[data-header-mode="builtin"]{padding-top:0 !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell .daiban-header:not([data-header-mode="builtin"]) > img,html.app-ios-iphone12promax.app-top-safe-shell .bancha-header:not([data-header-mode="builtin"]) > img{margin-top:calc(-1 * env(safe-area-inset-top,0px)) !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell body.page-message::before{display:none !important;content:none !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell .message-header-toolbar{padding-top:calc(14px + env(safe-area-inset-top,0px)) !important;background:linear-gradient(180deg,#1e8fff 0%,#3d96ff 55%,#4da0ff 100%) !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell body.page-mine::before,html.app-ios-iphone12promax.app-top-safe-shell body.page-mine .header-bg::after{display:none !important;content:none !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell body.page-mine .header-bg{padding-top:env(safe-area-inset-top,0px) !important;background:#2286ee !important;overflow:hidden !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell body.page-mine .header-bg > img{margin-top:calc(-1 * env(safe-area-inset-top,0px)) !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell body.page-mine .mine-activate-btn{top:calc(var(--mine-activate-btn-top-offset,66px) + env(safe-area-inset-top,0px)) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-cordova-xiaomi-23127) body.page-mine .header-bg > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,0px)) !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell{--app-shell-statusbar-top:0px !important;--app-cordova-statusbar-chrome:40px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .search-bar-wrapper{padding-top:6px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shouye .shouye-banner-wrap .notice-bar{position:relative !important;top:auto !important;margin:2px 12px 14px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .bancha-header:not([data-header-mode="builtin"]){padding-top:var(--app-cordova-statusbar-chrome,40px) !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .bancha-header[data-header-mode="builtin"]{padding-top:0 !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .bancha-header:not([data-header-mode="builtin"]) > img{margin-top:calc(-1 * var(--app-cordova-statusbar-chrome,40px)) !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .daiban-header:not([data-header-mode="builtin"]){padding-top:var(--app-cordova-statusbar-chrome,40px) !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .daiban-header[data-header-mode="builtin"]{padding-top:0 !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .daiban-header:not([data-header-mode="builtin"]) > img{margin-top:calc(-1 * var(--app-cordova-statusbar-chrome,40px)) !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .message-header-toolbar{padding-top:calc(14px + var(--app-cordova-statusbar-chrome,40px)) !important;padding-bottom:20px !important;padding-left:16px !important;padding-right:16px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .header-bg{padding-top:var(--app-cordova-statusbar-chrome,40px) !important;background:#2286ee !important;overflow:hidden !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .header-bg > img{margin-top:calc(-1 * var(--app-cordova-statusbar-chrome,40px)) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-cordova-xiaomi-23127) body.page-mine .user-card{margin:-70px 16px 0 !important;border-radius:12px 12px 0 0 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .user-card{margin:-38px 16px 0 !important;border-radius:12px 12px 0 0 !important;padding:16px 14px 14px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .user-name{margin-bottom:4px !important;line-height:1.25 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .personal-info-btn{top:16px !important;}' +
          'html.app-cordova-xiaomi-m2102 body.page-mine .user-card{padding:12px 0 12px 12px !important;}' +
          'html.app-cordova-xiaomi-m2102 body.page-mine .user-name{font-size:12px !important;margin-bottom:4px !important;line-height:1.25 !important;}' +
          'html.app-android-huawei-tas-an00 body.page-mine .user-name{font-size:13px !important;line-height:1.35 !important;}' +
          'html.app-cordova-xiaomi-m2102 body.page-mine .user-id{font-size:10px !important;line-height:1.25 !important;word-break:normal !important;white-space:nowrap !important;flex-wrap:nowrap !important;gap:4px !important;}' +
          'html.app-cordova-xiaomi-m2102 body.page-mine #userTaxIdText{white-space:nowrap !important;letter-spacing:-0.02em !important;}' +
          'html.app-cordova-xiaomi-m2102 body.page-mine .personal-info-btn{font-size:10.5px !important;padding:4px 8px 4px 10px !important;}' +
          'html.app-cordova-xiaomi-m2102.app-top-safe-shell body.page-mine .mine-activate-btn{position:fixed !important;top:calc(var(--mine-activate-btn-top-offset,66px) + var(--app-shell-statusbar-top,48px)) !important;right:18px !important;z-index:500 !important;}' +
          /* 红米 Note 13 Pro：缩小个人信息按钮与税号字号，右侧留白避免挡住眼睛 */
          'html.app-android-redmi-note13-pro body.page-mine .user-card{padding:12px 88px 14px 14px !important;}' +
          'html.app-android-redmi-note13-pro body.page-mine .user-name{font-size:13px !important;margin-bottom:4px !important;line-height:1.25 !important;}' +
          'html.app-android-redmi-note13-pro body.page-mine .user-id{font-size:10.5px !important;line-height:1.25 !important;gap:3px !important;white-space:nowrap !important;flex-wrap:nowrap !important;}' +
          'html.app-android-redmi-note13-pro body.page-mine .user-tax-label,html.app-android-redmi-note13-pro body.page-mine .user-tax-value{font-size:10.5px !important;letter-spacing:-0.03em !important;}' +
          'html.app-android-redmi-note13-pro body.page-mine .mine-ov-eye.tax-eye-btn,html.app-android-redmi-note13-pro body.page-mine .mine-ov-eye.tax-eye-btn.reveal{width:calc(30 * var(--mine-rpx)) !important;height:calc(20 * var(--mine-rpx)) !important;flex-shrink:0 !important;}' +
          'html.app-android-redmi-note13-pro body.page-mine .mine-ov-eye.tax-eye-btn img{width:calc(30 * var(--mine-rpx)) !important;height:calc(20 * var(--mine-rpx)) !important;object-fit:contain !important;}' +
          'html.app-android-redmi-note13-pro body.page-mine .personal-info-btn{font-size:10px !important;padding:4px 8px 4px 10px !important;border-radius:16px 0 0 16px !important;}' +
          'html.app-android-redmi-note13-pro body.page-mine .personal-info-btn::after{font-size:10px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .mine-activate-btn{position:fixed !important;top:calc(var(--mine-activate-btn-top-offset,66px) + var(--app-cordova-statusbar-chrome,40px)) !important;right:18px !important;z-index:500 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .header-activate-btn{position:fixed !important;top:calc(10px + var(--app-cordova-statusbar-chrome,40px)) !important;right:12px !important;z-index:500 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .back-link{top:calc(10px + var(--app-cordova-statusbar-chrome,40px)) !important;}' +
          /* 收入纳税明细：小米 14 / 23127 壳已让出黑条状态栏，顶栏贴 WebView 顶，勿再加 chrome/inset */
          'html.app-android-xiaomi-14.app-top-safe-shell body.page-shuiming-result .page-root,html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .page-root{--safe-top:0px !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell body.page-shuiming-result .top-fixed .header,html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .top-fixed .header{height:var(--header-height,48px) !important;min-height:var(--header-height,48px) !important;padding:8px 16px !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-android-xiaomi-14.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{top:0 !important;height:var(--header-height,48px) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{top:var(--header-height,48px) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell body.page-shuiming-result .list,html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .list{margin-top:var(--header-height,48px) !important;}' +
          /* 华为 Pura 70：H5 横向铺满，录屏黑边改为页面灰底；个人中心主区贴边 */
          'html.app-huawei-pura70,html.app-huawei-pura70 body{width:100% !important;min-width:100% !important;max-width:none !important;margin:0 !important;background:#f5f6fa !important;overflow-x:hidden !important;}' +
          'html.app-huawei-pura70 body.page-mine .mine-stack,html.app-huawei-pura70 body.page-mine .header-bg,html.app-huawei-pura70 body.page-mine .content-wrapper{width:100vw !important;max-width:100vw !important;margin-left:calc(50% - 50vw) !important;margin-right:calc(50% - 50vw) !important;box-sizing:border-box !important;}' +
          'html.app-huawei-pura70 body.page-mine .user-card{margin-left:0 !important;margin-right:0 !important;border-radius:12px 12px 0 0 !important;}' +
          'html.app-huawei-pura70 body.page-mine .menu-list{margin-left:0 !important;margin-right:0 !important;border-radius:0 !important;}' +
          'html.app-huawei-pura70 body.page-mine .function-cards{margin-left:8px !important;margin-right:8px !important;gap:8px !important;background:transparent !important;box-shadow:none !important;padding:0 !important;}' +
          'html.app-huawei-pura70 body.page-mine .function-card{background:#fff !important;border-radius:12px !important;box-shadow:0 2px 8px rgba(0,0,0,0.04) !important;}' +
          'html.app-huawei-pura70.app-top-safe-shell body.page-mine .header-bg{padding-top:var(--app-shell-statusbar-top,0px) !important;}' +
          /* 华为 Pura 70 Cordova：壳已避开状态栏，顶栏贴 WebView 顶；高度由首页 JS 写入 --shouye-fixed-top-h */
          'html.app-cordova-huawei-pura70.app-top-safe-shell{--app-shell-statusbar-top:0px !important;--app-cordova-statusbar-chrome:0px !important;}' +
          'html.app-cordova-huawei-pura70.app-top-safe-shell body.page-shouye .search-bar-wrapper{padding-top:6px !important;padding-bottom:6px !important;background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;box-shadow:none !important;}' +
          'html.app-cordova-huawei-pura70.app-top-safe-shell body.page-shouye .shouye-page{padding-top:var(--shouye-fixed-top-h,52px) !important;}' +
          /* 华为 Pura 70 非 Cordova（浏览器调试） */
          'html.app-huawei-pura70.app-top-safe-shell:not(.app-cordova-huawei-pura70){--app-shell-statusbar-top:32px !important;}' +
          'html.app-huawei-pura70.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye .search-bar-wrapper{padding-top:calc(6px + var(--app-shell-statusbar-top)) !important;background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;box-shadow:none !important;}' +
          'html.app-huawei-pura70.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye .shouye-page{padding-top:calc(46px + var(--app-shell-statusbar-top,32px) + 6px) !important;}' +
          /* iOS 全机型首页：状态栏安全区铺蓝 + 搜索条同色，消除白边接缝（勿按型号枚举） */
          'html.app-ios-client.app-top-safe-shell body.page-shouye::before{content:"" !important;position:fixed !important;left:0 !important;right:0 !important;top:0 !important;height:var(--app-shell-statusbar-top,env(safe-area-inset-top,48px)) !important;background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;z-index:998 !important;pointer-events:none !important;}' +
          'html.app-ios-client.app-top-safe-shell body.page-shouye .search-bar-wrapper{padding-top:calc(6px + var(--app-shell-statusbar-top,env(safe-area-inset-top,48px))) !important;background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;box-shadow:none !important;}' +
          'html.app-ios-client.app-top-safe-shell body.page-shouye .search-bar-wrapper.scrolled{background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;}' +
          'html.app-ios-client.app-top-safe-shell:has(body.page-shouye){background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;}' +
          'html.app-ios-client.app-top-safe-shell body.page-shouye{background:#f6f7fb !important;}' +
          /* iPhone 16 Pro：收入纳税明细筛选页顶栏铺满安全区，避免状态栏下露灰/色差 */
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming > .header{position:fixed !important;top:0 !important;left:0 !important;right:0 !important;z-index:120 !important;background:#fff !important;border-bottom:1px solid #eee !important;padding-top:calc(14px + var(--app-shell-statusbar-top)) !important;padding-bottom:15px !important;box-sizing:border-box !important;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming > .content{padding-top:calc(46px + var(--app-shell-statusbar-top)) !important;}' +
          /* iPhone 16 Pro：收入纳税明细结果页顶栏+汇总区铺满安全区，状态栏与导航同为白底 */
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .page-root{--safe-top:var(--app-shell-statusbar-top) !important;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header{top:0 !important;height:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;padding:var(--app-shell-statusbar-top) 16px 0 !important;background:#fff !important;box-sizing:border-box !important;z-index:120 !important;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{top:var(--app-shell-statusbar-top) !important;height:var(--header-height,52px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;background:#fff !important;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .list{margin-top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;}' +
          /* iPhone 14：筛选页顶栏铺满安全区白底（同 16 Pro，避免 top 偏移露出空白） */
          'html.app-ios-iphone14.app-top-safe-shell body.page-shuiming > .header{position:fixed !important;top:0 !important;left:0 !important;right:0 !important;z-index:120 !important;background:#fff !important;border-bottom:1px solid #eee !important;padding-top:calc(14px + var(--app-shell-statusbar-top)) !important;padding-bottom:15px !important;box-sizing:border-box !important;}' +
          'html.app-ios-iphone14.app-top-safe-shell body.page-shuiming > .content{padding-top:calc(46px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-ios-iphone14.app-top-safe-shell body.page-shuiming-result::before{content:"" !important;position:fixed !important;top:0 !important;left:0 !important;right:0 !important;height:var(--app-shell-statusbar-top,env(safe-area-inset-top,48px)) !important;background:#fff !important;z-index:1 !important;pointer-events:none !important;}' +
          'html.app-ios-iphone14.app-top-safe-shell body.page-shuiming-result .page-root{--safe-top:var(--app-shell-statusbar-top) !important;z-index:auto !important;}' +
          'html.app-ios-iphone14.app-top-safe-shell body.page-shuiming-result .top-fixed .header{top:var(--app-shell-statusbar-top) !important;height:var(--header-height,52px) !important;padding:15px 16px !important;background:#fff !important;box-sizing:border-box !important;z-index:100 !important;}' +
          'html.app-ios-iphone14.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-ios-iphone14.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{top:auto !important;height:auto !important;display:flex !important;align-items:center !important;}' +
          'html.app-ios-iphone14.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;background:#fff !important;z-index:101 !important;}' +
          'html.app-ios-iphone14.app-top-safe-shell body.page-shuiming-result .list{margin-top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;}' +
          /* iPhone 15 Plus / 15 Pro Max / 16 Pro Max：筛选页顶栏铺满安全区白底（同 16 Pro） */
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming > .header,html.app-ios-iphone16promax.app-top-safe-shell body.page-shuiming > .header{position:fixed !important;top:0 !important;left:0 !important;right:0 !important;z-index:120 !important;background:#fff !important;border-bottom:1px solid #eee !important;padding-top:calc(14px + var(--app-shell-statusbar-top)) !important;padding-bottom:15px !important;box-sizing:border-box !important;}' +
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming > .content,html.app-ios-iphone16promax.app-top-safe-shell body.page-shuiming > .content{padding-top:calc(46px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result::before,html.app-ios-iphone16promax.app-top-safe-shell body.page-shuiming-result::before{content:"" !important;position:fixed !important;top:0 !important;left:0 !important;right:0 !important;height:var(--app-shell-statusbar-top,env(safe-area-inset-top,48px)) !important;background:#fff !important;z-index:122 !important;pointer-events:none !important;}' +
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result .page-root,html.app-ios-iphone16promax.app-top-safe-shell body.page-shuiming-result .page-root{--safe-top:var(--app-shell-statusbar-top) !important;z-index:auto !important;}' +
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result .top-fixed,html.app-ios-iphone16promax.app-top-safe-shell body.page-shuiming-result .top-fixed{position:relative !important;z-index:auto !important;}' +
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result .top-fixed .header,html.app-ios-iphone16promax.app-top-safe-shell body.page-shuiming-result .top-fixed .header{top:var(--app-shell-statusbar-top) !important;height:var(--header-height,52px) !important;padding:15px 16px !important;background:#fff !important;box-sizing:border-box !important;z-index:120 !important;}' +
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,html.app-ios-iphone16promax.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-ios-iphone16promax.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{top:auto !important;height:auto !important;display:flex !important;align-items:center !important;}' +
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,html.app-ios-iphone16promax.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;background:#fff !important;z-index:121 !important;}' +
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result .list,html.app-ios-iphone16promax.app-top-safe-shell body.page-shuiming-result .list{margin-top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;}' +
          /* iPhone 17 Pro：收入纳税明细结果页顶栏与安全区（同 16 Pro）+ 左右操作字号 */
          'html.app-ios-iphone17pro.app-top-safe-shell body.page-shuiming > .header{position:fixed !important;top:0 !important;left:0 !important;right:0 !important;z-index:120 !important;background:#fff !important;border-bottom:1px solid #eee !important;padding-top:calc(14px + var(--app-shell-statusbar-top)) !important;padding-bottom:15px !important;box-sizing:border-box !important;}' +
          'html.app-ios-iphone17pro.app-top-safe-shell body.page-shuiming > .content{padding-top:calc(46px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-ios-iphone17pro.app-top-safe-shell body.page-shuiming-result .page-root{--safe-top:var(--app-shell-statusbar-top) !important;}' +
          'html.app-ios-iphone17pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header{top:0 !important;height:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;padding:var(--app-shell-statusbar-top) 16px 0 !important;background:#fff !important;box-sizing:border-box !important;z-index:120 !important;}' +
          'html.app-ios-iphone17pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-ios-iphone17pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{top:var(--app-shell-statusbar-top) !important;height:var(--header-height,52px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-ios-iphone17pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn{font-size:18px !important;}' +
          'html.app-ios-iphone17pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{font-size:17px !important;}' +
          'html.app-ios-iphone17pro.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;background:#fff !important;}' +
          'html.app-ios-iphone17pro.app-top-safe-shell body.page-shuiming-result .list{margin-top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;}' +
          /* iPhone 12/17 Pro Max：收入纳税明细顶栏安全区 + 正文字号（见 shuiming_result.html） */
          'html.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming > .header{position:fixed !important;top:0 !important;left:0 !important;right:0 !important;z-index:120 !important;background:#fff !important;border-bottom:1px solid #eee !important;padding-top:calc(14px + var(--app-shell-statusbar-top)) !important;padding-bottom:15px !important;box-sizing:border-box !important;}' +
          'html.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming > .content{padding-top:calc(46px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming-result .page-root{--safe-top:var(--app-shell-statusbar-top) !important;}' +
          'html.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming-result .top-fixed .header{top:0 !important;height:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;padding:var(--app-shell-statusbar-top) 16px 0 !important;background:#fff !important;box-sizing:border-box !important;z-index:120 !important;}' +
          'html.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{top:var(--app-shell-statusbar-top) !important;height:var(--header-height,52px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn{font-size:18px !important;}' +
          'html.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{font-size:17px !important;}' +
          'html.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;background:#fff !important;}' +
          'html.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming-result .list{margin-top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;}' +
          /* 浏览器/非 Cordova：收入纳税明细结果页顶栏仅用真实 safe-area，去掉固定 24/48px 占位 */
          'html.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .page-root{--safe-top:env(safe-area-inset-top,0px) !important;}' +
          'html.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result::before{content:none !important;display:none !important;height:0 !important;}' +
          'html.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header{top:0 !important;height:calc(var(--header-height,48px) + env(safe-area-inset-top,0px)) !important;padding:calc(8px + env(safe-area-inset-top,0px)) 16px 8px !important;box-sizing:border-box !important;align-items:center !important;}' +
          'html.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .back-btn,html.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .header-right{top:auto !important;height:auto !important;position:absolute !important;display:flex !important;align-items:center !important;}' +
          'html.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,48px) + env(safe-area-inset-top,0px)) !important;}' +
          'html.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .list{margin-top:calc(var(--header-height,48px) + env(safe-area-inset-top,0px)) !important;}' +
          /* 收入纳税明细筛选页：顶栏统一贴顶；浏览器仅用真实 safe-area（覆盖各机型 48px 兜底） */
          'html.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming > .header{position:fixed !important;top:0 !important;left:0 !important;right:0 !important;z-index:120 !important;background:#fff !important;border-bottom:1px solid #eee !important;padding-top:calc(14px + env(safe-area-inset-top,0px)) !important;padding-bottom:15px !important;padding-left:16px !important;padding-right:16px !important;box-sizing:border-box !important;min-height:0 !important;height:auto !important;}' +
          'html.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming > .content{padding-top:calc(46px + env(safe-area-inset-top,0px)) !important;}' +
          'html.app-cordova-shell.app-top-safe-shell body.page-shuiming > .header{position:fixed !important;top:0 !important;left:0 !important;right:0 !important;z-index:120 !important;background:#fff !important;border-bottom:1px solid #eee !important;padding-top:calc(14px + var(--app-shell-statusbar-top,48px)) !important;padding-bottom:15px !important;padding-left:16px !important;padding-right:16px !important;box-sizing:border-box !important;min-height:0 !important;height:auto !important;}' +
          'html.app-cordova-shell.app-top-safe-shell body.page-shuiming > .content{padding-top:calc(46px + var(--app-shell-statusbar-top,48px)) !important;}' +
          /* 一加 13 首页：沉浸蓝顶栏仍须顶距（白顶栏页由 applyImmersiveNotchWhitePageChrome overlays=false 走系统黑条） */
          'html.app-android-oneplus-13.app-top-safe-shell body.page-shouye .search-bar-wrapper{padding-top:calc(6px + var(--app-shell-statusbar-top,40px)) !important;}' +
          'html.app-android-oneplus-13.app-top-safe-shell body.page-shouye .shouye-page{padding-top:calc(var(--shouye-fixed-top-h,52px) + var(--app-shell-statusbar-top,40px)) !important;}' +
          /* 压过后续机型特例：Android 首页统一顶距（Pura70 Cordova 除外） */
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye{--shouye-status-inset:40px;--app-shell-statusbar-top:var(--shouye-status-inset) !important;}' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye::before{content:"" !important;position:fixed !important;left:0 !important;right:0 !important;top:0 !important;height:var(--shouye-status-inset,40px) !important;background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;z-index:998 !important;pointer-events:none !important;}' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye .search-bar-wrapper{padding-top:var(--shouye-status-inset,40px) !important;background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;box-shadow:none !important;}' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye .shouye-page{padding-top:var(--shouye-fixed-top-h,92px) !important;}' +
          /*
           * OPPO/ColorOS（含 A58 PHJ110）外置状态栏：WebView 已在系统栏下方，
           * 首页勿再强制 40px，否则搜索条上方大块空蓝（一加 13 沉浸除外）。
           */
          'html.app-android-oppo-family.app-top-safe-shell:not(.app-android-oneplus-13) body.page-shouye,' +
          'html.app-android-oppo-a58.app-top-safe-shell body.page-shouye{' +
          '--shouye-status-inset:6px;--app-shell-statusbar-top:6px !important;}' +
          'html.app-android-oppo-family.app-top-safe-shell:not(.app-android-oneplus-13) body.page-shouye::before,' +
          'html.app-android-oppo-a58.app-top-safe-shell body.page-shouye::before{' +
          'height:6px !important;}' +
          'html.app-android-oppo-family.app-top-safe-shell:not(.app-android-oneplus-13) body.page-shouye .search-bar-wrapper,' +
          'html.app-android-oppo-a58.app-top-safe-shell body.page-shouye .search-bar-wrapper{' +
          'padding-top:6px !important;}' +
          'html.app-android-oppo-family.app-top-safe-shell:not(.app-android-oneplus-13) body.page-shouye .shouye-page,' +
          'html.app-android-oppo-a58.app-top-safe-shell body.page-shouye .shouye-page{' +
          'padding-top:var(--shouye-fixed-top-h,58px) !important;}' +
          /*
           * Android 待办/办&查/消息：与首页同理强制 40px，避免沉浸 WebView 顶进系统时间。
           * 收入纳税明细 / 详情白顶栏页改走 overlays=false 外置状态栏（见 applyImmersiveNotchWhitePageChrome），
           * 勿再叠 40px，否则状态栏与「返回」之间大块留白。
           */
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-daiban,' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-bancha,' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-message{' +
          '--android-status-inset:40px;--app-shell-statusbar-top:var(--android-status-inset) !important;}' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-daiban .daiban-header:not([data-header-mode="builtin"]),' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-bancha .bancha-header:not([data-header-mode="builtin"]){' +
          'padding-top:var(--android-status-inset,40px) !important;}' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-daiban .daiban-header[data-header-mode="builtin"],' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-bancha .bancha-header[data-header-mode="builtin"]{' +
          'padding-top:0 !important;}' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-daiban .daiban-header:not([data-header-mode="builtin"]) > img,' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-bancha .bancha-header:not([data-header-mode="builtin"]) > img{' +
          'margin-top:calc(-1 * var(--android-status-inset,40px)) !important;}' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-message .message-header-toolbar{' +
          'padding-top:calc(14px + var(--android-status-inset,40px)) !important;}' +
          /* 白顶栏纳税页：外置状态栏 / overlays=false 后顶距清零 */
          'html.app-android-white-page-outer.app-top-safe-shell body.page-shuiming > .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming > .header{' +
          'padding-top:14px !important;padding-bottom:15px !important;}' +
          'html.app-android-white-page-outer.app-top-safe-shell body.page-shuiming > .content,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming > .content{' +
          'padding-top:46px !important;}' +
          'html.app-android-white-page-outer.app-top-safe-shell body.page-xiangqing,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-xiangqing{' +
          'padding-top:48px !important;}' +
          'html.app-android-white-page-outer.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .page-root,' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .page-root{' +
          '--safe-top:0px !important;--android-status-inset:0px !important;--app-shell-statusbar-top:0px !important;}' +
          'html.app-android-white-page-outer.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header,' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header{' +
          'top:0 !important;height:var(--header-height,48px) !important;min-height:var(--header-height,48px) !important;' +
          'padding:8px 16px !important;box-sizing:border-box !important;z-index:120 !important;}' +
          'html.app-android-white-page-outer.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-white-page-outer.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .header-right{' +
          'top:0 !important;height:var(--header-height,48px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-white-page-outer.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .summary,' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .summary{' +
          'top:var(--header-height,48px) !important;}' +
          'html.app-android-white-page-outer.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .list,' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .list{' +
          'margin-top:var(--header-height,48px) !important;}' +
          /*
           * 小米 15 Pro / Mate 60：沉浸压栏，须压过 mi-family / harmony / white-page-outer 清零规则。
           */
          'html.app-android-xiaomi-15pro.app-top-safe-shell,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer{' +
          '--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .page-root,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .page-root,' +
          'html.app-cordova-shell.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-cordova-shell.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60,.app-android-xiaomi-10 body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro:not(.app-cordova-shell) body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60,.app-android-xiaomi-10:not(.app-cordova-shell) body.page-shuiming-result .page-root{' +
          '--safe-top:var(--app-shell-statusbar-top,40px) !important;--android-status-inset:40px !important;--app-shell-statusbar-top:40px !important;}' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header,' +
          'html.app-cordova-shell.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-cordova-shell.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60,.app-android-xiaomi-10 body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60,.app-android-xiaomi-10:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header{' +
          'top:0 !important;height:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;' +
          'min-height:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;' +
          'padding:var(--app-shell-statusbar-top,40px) 16px 0 !important;box-sizing:border-box !important;z-index:120 !important;background:#fff !important;}' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60,.app-android-xiaomi-10 body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60,.app-android-xiaomi-10 body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60,.app-android-xiaomi-10:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60,.app-android-xiaomi-10:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .header-right{' +
          'top:var(--app-shell-statusbar-top,40px) !important;height:var(--header-height,48px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60,.app-android-xiaomi-10 body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60,.app-android-xiaomi-10:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .summary{' +
          'top:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;}' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .list,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60,.app-android-xiaomi-10 body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro:not(.app-cordova-shell) body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60,.app-android-xiaomi-10:not(.app-cordova-shell) body.page-shuiming-result .list{' +
          'margin-top:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;}' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming > .header,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming > .header,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming > .header,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming > .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro body.page-shuiming > .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60,.app-android-xiaomi-10 body.page-shuiming > .header{' +
          'padding-top:calc(14px + var(--app-shell-statusbar-top,40px)) !important;padding-bottom:15px !important;}' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming > .content,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming > .content,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming > .content,' +
          'html.app-android-huawei-mate60,.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming > .content,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro body.page-shuiming > .content,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60,.app-android-xiaomi-10 body.page-shuiming > .content{' +
          'padding-top:calc(46px + var(--app-shell-statusbar-top,40px)) !important;}' +
          topFixedHeaderRule;
        document.head.appendChild(shellExtra);
      }
    } catch (e) {}
    patchViewportFit();
    setTimeout(patchViewportFit, 0);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', patchViewportFit);
    }
  }

  /**
   * 描述文件 WebClip /「添加到主屏幕」冷启动：系统常不展示 apple-touch-startup-image，
   * 用 html::before 页内启动图兜底（与 splash_screen.png 一致）。站内跳转有同域 referrer 则跳过。
   */
  function showIosWebClipLaunchSplash() {
    try {
      if (isCordovaTaxAppShell()) return;
      var ua = navigator.userAgent || '';
      if (!/iPhone|iPad|iPod/i.test(ua)) return;
      var standalone = false;
      try {
        standalone = window.navigator.standalone === true;
      } catch (e0) {}
      if (!standalone) {
        try {
          standalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            window.matchMedia('(display-mode: fullscreen)').matches;
        } catch (e1) {}
      }
      if (!standalone) return;
      try {
        if (sessionStorage.getItem('ios_webclip_splash_v1') === '1') return;
      } catch (e2) {}
      var ref = '';
      try {
        ref = String(document.referrer || '');
      } catch (e3) {}
      if (ref) {
        try {
          if (ref.indexOf(location.host) >= 0) return;
        } catch (e4) {}
      }
      try {
        sessionStorage.setItem('ios_webclip_splash_v1', '1');
      } catch (e5) {}
      var SPLASH_MS = 1800;
      var src = '/splash_screen.png?v=20260731-webclip';
      var style = document.createElement('style');
      style.setAttribute('data-ios-webclip-splash', '1');
      style.textContent =
        'html.ios-webclip-launching,html.ios-webclip-launching body{background:#fff!important;}' +
        'html.ios-webclip-launching::before{content:"";position:fixed;inset:0;z-index:2147483646;' +
        'background:#fff url(' +
        src +
        ') center center / cover no-repeat;pointer-events:none;}';
      (document.head || document.documentElement).appendChild(style);
      document.documentElement.classList.add('ios-webclip-launching');
      var link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = src;
      (document.head || document.documentElement).appendChild(link);
      function hide() {
        try {
          document.documentElement.classList.remove('ios-webclip-launching');
        } catch (e6) {}
        try {
          if (style && style.parentNode) style.parentNode.removeChild(style);
        } catch (e7) {}
      }
      setTimeout(hide, SPLASH_MS);
    } catch (e) {}
  }

  /**
   * iOS 顶栏排查：仅显式开启时可用（?ios_diag=1 或 localStorage.ios_topbar_diag=1）。
   * 旧版左上角连点会在弱网下连点返回时误弹黑屏诊断框，生产默认关闭。
   */
  function isIosTopBarDiagnosticsEnabled() {
    try {
      if (/(?:^|[?&])ios_diag=1(?:&|$)/.test(String(location.search || ''))) return true;
    } catch (eQ) {}
    try {
      if (window.localStorage && localStorage.getItem('ios_topbar_diag') === '1') return true;
    } catch (eL) {}
    return false;
  }

  function bindIosTopBarDiagnostics() {
    try {
      if (!isLikelyIOSViewportClient()) return;
      if (!isIosTopBarDiagnosticsEnabled()) return;
      var taps = [];
      var onTap = function (x, y, target) {
        if (x > 160 || y > 160) {
          taps = [];
          return;
        }
        /* 返回/链接上的连点不算，避免弱网狂点返回误开诊断 */
        try {
          if (target && target.closest && target.closest('a, button, .back-btn, [role="button"]')) {
            taps = [];
            return;
          }
        } catch (eT) {}
        var now = Date.now();
        taps = taps.filter(function (v) {
          return now - v < 3000;
        });
        taps.push(now);
        if (taps.length < 8) return;
        taps = [];
        showIosTopBarDiagnostics();
      };
      document.addEventListener(
        'touchend',
        function (ev) {
          try {
            var t = ev.changedTouches && ev.changedTouches[0];
            if (t) onTap(t.clientX, t.clientY, ev.target);
          } catch (e0) {}
        },
        true
      );
      document.addEventListener(
        'click',
        function (ev) {
          try {
            if (ev.pointerType === 'touch') return;
            onTap(ev.clientX, ev.clientY, ev.target);
          } catch (e1) {}
        },
        true
      );
    } catch (e) {}
  }

  function showIosTopBarDiagnostics() {
    var probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);';
    document.body.appendChild(probe);
    var probeCs = window.getComputedStyle(probe);
    var safeTop = parseFloat(probeCs.paddingTop) || 0;
    var safeBottom = parseFloat(probeCs.paddingBottom) || 0;
    if (probe.parentNode) probe.parentNode.removeChild(probe);
    /* 底栏定位诊断：fixed 元素贴的是布局视口，若被祖先 transform/filter 劫持会整体偏高 */
    var navInfo = '(no .bottom-nav)';
    try {
      var navEl = document.querySelector('.bottom-nav');
      if (navEl) {
        var navCs = window.getComputedStyle(navEl);
        var navRect = navEl.getBoundingClientRect();
        navInfo =
          navCs.position +
          ' bottom=' +
          navCs.bottom +
          ' rect.bottom=' +
          Math.round(navRect.bottom) +
          ' parent=' +
          (navEl.parentNode ? navEl.parentNode.nodeName.toLowerCase() : '?');
      }
    } catch (eNav) {}
    /* 找出把 fixed 定位劫持掉的祖先（transform/filter/perspective/will-change/contain） */
    var fixedBreaker = 'none';
    try {
      var node = document.querySelector('.bottom-nav');
      while (node && node !== document.documentElement) {
        node = node.parentElement;
        if (!node) break;
        var cs2 = window.getComputedStyle(node);
        if (
          (cs2.transform && cs2.transform !== 'none') ||
          (cs2.filter && cs2.filter !== 'none') ||
          (cs2.perspective && cs2.perspective !== 'none') ||
          (cs2.backdropFilter && cs2.backdropFilter !== 'none') ||
          (cs2.contain && cs2.contain !== 'none') ||
          (cs2.willChange && cs2.willChange !== 'auto')
        ) {
          fixedBreaker =
            node.nodeName.toLowerCase() +
            '.' +
            (node.className || '').toString().slice(0, 30) +
            ' [' +
            cs2.transform +
            '|' +
            cs2.filter +
            '|' +
            cs2.contain +
            '|' +
            cs2.willChange +
            ']';
          break;
        }
      }
    } catch (eBreak) {}
    function metaOf(name) {
      var el = document.querySelector('meta[name="' + name + '"]');
      return el ? el.getAttribute('content') : '(none)';
    }
    var standalone = false;
    try {
      standalone = window.navigator.standalone === true;
    } catch (e1) {}
    var vvNow = window.visualViewport;
    var lines = [
      '★ screen.height: ' + (screen && screen.height),
      '★ innerHeight: ' + window.innerHeight,
      '★ doc.clientHeight: ' + document.documentElement.clientHeight,
      '★ visualViewport h: ' + (vvNow ? Math.round(vvNow.height) : '(none)'),
      '★ safe top / bottom: ' + safeTop + ' / ' + safeBottom,
      '★ bottom-nav: ' + navInfo,
      '───────────────',
      'page: ' + (String(location.pathname).split('/').pop() || 'index.html'),
      'navigator.standalone: ' + standalone,
      'display-mode standalone: ' +
        !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches),
      'safe-area-inset-top: ' + safeTop + 'px',
      '--app-shell-statusbar-top: ' +
        (getComputedStyle(document.documentElement).getPropertyValue('--app-shell-statusbar-top') ||
          '(unset)'),
      'status-bar-style: ' + metaOf('apple-mobile-web-app-status-bar-style'),
      'theme-color: ' + metaOf('theme-color'),
      'web-app-capable: ' + metaOf('apple-mobile-web-app-capable'),
      'safe-area-inset-bottom: ' + safeBottom + 'px',
      'innerHeight/screen: ' + window.innerHeight + ' / ' + (screen && screen.height),
      'doc.clientHeight: ' + document.documentElement.clientHeight,
      'visualViewport h/offsetTop: ' +
        (window.visualViewport
          ? Math.round(window.visualViewport.height) + ' / ' + Math.round(window.visualViewport.offsetTop)
          : '(none)'),
      'devicePixelRatio: ' + window.devicePixelRatio,
      'bottom-nav: ' + navInfo,
      'fixed-breaker ancestor: ' + fixedBreaker,
      'screen.height: ' + (screen && screen.height),
      '--bottom-nav-bottom: ' +
        (getComputedStyle(document.documentElement).getPropertyValue('--bottom-nav-bottom') || '(unset)'),
      'html.class: ' + document.documentElement.className,
      'auth.js: 20260803-no-ios-diag'
    ];
    var box = document.createElement('div');
    box.style.cssText =
      'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.86);color:#fff;' +
      'font:13px/1.7 -apple-system,monospace;padding:80px 18px 24px;overflow:auto;';
    box.textContent = lines.join('\n');
    box.style.whiteSpace = 'pre-wrap';
    var btn = document.createElement('button');
    btn.textContent = '关闭';
    btn.style.cssText =
      'margin-top:18px;padding:10px 22px;border:0;border-radius:8px;background:#2c80f4;color:#fff;font-size:15px;';
    btn.addEventListener('click', function () {
      if (box.parentNode) box.parentNode.removeChild(box);
    });
    box.appendChild(btn);
    document.body.appendChild(box);
  }

  showIosWebClipLaunchSplash();
  setupMobileStatusBar();
  syncAppShellStatusbarTop();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindIosTopBarDiagnostics);
  } else {
    bindIosTopBarDiagnostics();
  }
  applyMinePageChrome();
  applyDaibanBanchaPageChrome();
  applyMessagePageChrome();
  applyShouyePageChrome();
  applyIosStandaloneEntryChrome();
  applyIPhone16ProPageChrome();
  applyImmersiveNotchWhitePageChrome();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      syncAppShellStatusbarTop();
      applyMinePageChrome();
      applyDaibanBanchaPageChrome();
      applyMessagePageChrome();
      applyShouyePageChrome();
      applyIosStandaloneEntryChrome();
      applyIPhone16ProPageChrome();
      applyImmersiveNotchWhitePageChrome();
    });
  } else {
    setTimeout(syncAppShellStatusbarTop, 0);
  }
  window.addEventListener('orientationchange', function () {
    setTimeout(syncAppShellStatusbarTop, 50);
  });
  window.addEventListener('resize', function () {
    setTimeout(syncAppShellStatusbarTop, 50);
  });
  window.addEventListener('pageshow', function () {
    setTimeout(function () {
      refreshImmersiveBluePageChrome();
    }, 0);
  });
  /* Cordova StatusBar 插件常在 deviceready 后才可用，再刷一次蓝顶栏页 */
  function refreshImmersiveBluePageChrome() {
    syncAppShellStatusbarTop();
    applyMinePageChrome();
    applyDaibanBanchaPageChrome();
    applyMessagePageChrome();
    applyShouyePageChrome();
    applyIosStandaloneEntryChrome();
    applyIPhone16ProPageChrome();
    applyImmersiveNotchWhitePageChrome();
  }
  document.addEventListener('deviceready', refreshImmersiveBluePageChrome, false);
  try {
    if (window.top && window.top !== window) {
      window.top.document.addEventListener('deviceready', refreshImmersiveBluePageChrome, false);
    }
  } catch (eTopReady) {}
  /* theme-loader 异步写入 CSS 变量后，再刷一次首页顶栏蓝，避免 StatusBar 与垫色两截 */
  window.addEventListener('mineUiConfig', function () {
    try {
      if (document.body && document.body.classList.contains('page-shouye')) {
        applyShouyePageChrome();
      }
    } catch (eMineUi) {}
  });

  function currentPageName() {
    var p = window.location.pathname || '';
    var i = p.lastIndexOf('/');
    var name = (i >= 0 ? p.slice(i + 1) : p) || '';
    if (!name) {
      return 'index.html';
    }
    return name;
  }

  function isNajiluVerifyView() {
    if (currentPageName() !== 'najilu.html') {
      return false;
    }
    try {
      return new URLSearchParams(window.location.search).get('view') === 'verify';
    } catch (e) {
      return false;
    }
  }

  function isForgotPwdFromLoginPage() {
    if (currentPageName() !== 'xiugaimima.html') {
      return false;
    }
    try {
      return new URLSearchParams(window.location.search).get('from') === 'login';
    } catch (e) {
      return false;
    }
  }

  function isPublicPage() {
    /* 首页 / 办&查 / 我的：未登录可浏览；其它业务页跳登录 */
    return !!PUBLIC_PAGES[currentPageName()] || isNajiluVerifyView() || isForgotPwdFromLoginPage();
  }

  function sanitizeLoginNext(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return '';
    try {
      s = decodeURIComponent(s);
    } catch (eDec) {}
    s = s.replace(/^\/+/, '');
    if (s.indexOf('://') >= 0 || s.indexOf('//') === 0) return '';
    if (!/^[a-z0-9_\-]+\.html([?#][^\s]*)?$/i.test(s)) return '';
    s = s.split('#')[0];
    /* 登录回跳禁止直达支付页 */
    var pageOnly = String(s).split('?')[0].toLowerCase();
    if (pageOnly === 'purchase.html') return '';
    return s;
  }

  function getLoginNextTarget() {
    try {
      return sanitizeLoginNext(new URLSearchParams(window.location.search).get('next'));
    } catch (e) {
      return '';
    }
  }

  function buildLoginPageUrl(nextPage, extras) {
    var next = sanitizeLoginNext(nextPage);
    var u;
    try {
      u = new URL(LOGIN_PAGE, window.location.href);
    } catch (e0) {
      return LOGIN_PAGE;
    }
    if (next) u.searchParams.set('next', next);
    if (extras && typeof extras === 'object') {
      Object.keys(extras).forEach(function (k) {
        if (extras[k] != null && String(extras[k]) !== '') {
          u.searchParams.set(k, String(extras[k]));
        }
      });
    }
    return appendSalesChannelToUrl(u.pathname + u.search + u.hash);
  }

  function isActivationPage() {
    if (currentPageName() !== 'login.html' && currentPageName() !== 'index.html') {
      return false;
    }
    try {
      return new URLSearchParams(window.location.search).get('need_activate') === '1';
    } catch (e) {
      return false;
    }
  }

  function isAccountActive() {
    try {
      return localStorage.getItem('account_active') === '1';
    } catch (e) {
      return false;
    }
  }

  function getToken() {
    try {
      return localStorage.getItem('token') || '';
    } catch (e) {
      return '';
    }
  }

  function randomClientDeviceId() {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var a = new Uint8Array(16);
      crypto.getRandomValues(a);
      var h = '';
      for (var i = 0; i < a.length; i++) {
        h += a[i].toString(16).padStart(2, '0');
      }
      return 'web_' + h;
    }
    return 'web_' + Math.random().toString(36).slice(2) + '_' + Date.now().toString(36);
  }

  function sanitizeSalesChannelId(raw) {
    var s = String(raw || '').trim().toLowerCase();
    if (!s || s.length > 64) {
      return '';
    }
    if (!/^[a-z0-9_-]+$/.test(s)) {
      return '';
    }
    return s;
  }

  function initSalesChannelFromUrl() {
    try {
      var p = new URLSearchParams(window.location.search);
      var ch = sanitizeSalesChannelId(p.get('ch') || p.get('channel') || '');
      if (!ch) {
        try {
          var ua = String(navigator.userAgent || '');
          var m = ua.match(/TaxPlatformDistributor\/([a-zA-Z0-9_-]{1,64})/);
          if (m) ch = sanitizeSalesChannelId(m[1]);
        } catch (eUa) {}
      }
      if (!ch) {
        return;
      }
      var permanent = false;
      try {
        if (isCordovaTaxAppShell() || isDistributorApp()) permanent = true;
        if (/TaxPlatformDistributor\//i.test(String(navigator.userAgent || ''))) permanent = true;
      } catch (eP) {}
      localStorage.setItem(
        SALES_CHANNEL_KEY,
        JSON.stringify({
          ch: ch,
          at: Date.now(),
          source: permanent ? 'shell' : 'url',
          permanent: !!permanent
        })
      );
    } catch (e) {}
  }

  function isSalesChannelStickyRecordValid(o) {
    if (!o || !o.ch) return false;
    if (o.permanent === true) return true;
    if (o.source && SALES_CHANNEL_PERMANENT_SOURCES[String(o.source)]) {
      try {
        if (isCordovaTaxAppShell() || isDistributorApp()) return true;
      } catch (e0) {}
    }
    if (Date.now() - Number(o.at) > SALES_CHANNEL_TTL_MS) return false;
    return true;
  }

  /** 校验注册来源渠道 key（与注册页下拉一致，不含 other） */
  function sanitizeRegisterSourceChannel(raw) {
    var s = String(raw != null ? raw : '')
      .trim()
      .toLowerCase();
    if (!s || !REGISTER_SOURCE_LABELS[s]) {
      return '';
    }
    return s;
  }

  function registerSourceChannelLabel(key) {
    var k = sanitizeRegisterSourceChannel(key);
    return k ? REGISTER_SOURCE_LABELS[k] : '';
  }

  /**
   * 从 URL ?src= / ?rs= 捕获注册来源并写入 localStorage。
   * URL 显式带合法 src 时覆盖已存值；非法参数忽略。
   */
  function captureRegisterSourceFromUrl() {
    try {
      var p = new URLSearchParams(window.location.search || '');
      var fromUrl = sanitizeRegisterSourceChannel(p.get('src') || p.get('rs') || '');
      if (!fromUrl) {
        return getRegisterSourceChannel();
      }
      localStorage.setItem(
        REGISTER_SOURCE_KEY,
        JSON.stringify({
          src: fromUrl,
          at: Date.now(),
          source: 'url'
        })
      );
      return fromUrl;
    } catch (e) {
      return '';
    }
  }

  function getRegisterSourceChannel() {
    try {
      var p = new URLSearchParams(window.location.search || '');
      var urlSrc = sanitizeRegisterSourceChannel(p.get('src') || p.get('rs') || '');
      if (urlSrc) {
        return urlSrc;
      }
      var raw = localStorage.getItem(REGISTER_SOURCE_KEY);
      if (!raw) {
        return '';
      }
      var o = JSON.parse(raw);
      if (!o || !o.src) {
        return '';
      }
      return sanitizeRegisterSourceChannel(o.src);
    } catch (e) {
      return '';
    }
  }

  function clearRegisterSourceChannel() {
    try {
      localStorage.removeItem(REGISTER_SOURCE_KEY);
    } catch (e) {}
  }

  function initDistributorAppFromUrl() {
    try {
      var p = new URLSearchParams(window.location.search);
      if (p.get('distributor_app') === '1' || p.get('distributor') === '1') {
        localStorage.setItem(
          DISTRIBUTOR_APP_KEY,
          JSON.stringify({
            at: Date.now()
          })
        );
        return;
      }
      /* 新代理包：只带 ch=、不带 distributor_app → 允许注册，清掉旧禁注册标记 */
      if (
        isCordovaTaxAppShell() &&
        (p.get('ch') || p.get('channel') || p.get('sales_ch') || p.get('allow_register') === '1')
      ) {
        localStorage.removeItem(DISTRIBUTOR_APP_KEY);
      }
    } catch (e) {}
  }

  function isDistributorApp() {
    try {
      var p = new URLSearchParams(window.location.search);
      if (p.get('distributor_app') === '1' || p.get('distributor') === '1') {
        return true;
      }
      if (p.get('distributor_app') === '0' || p.get('allow_register') === '1') {
        return false;
      }
      return !!localStorage.getItem(DISTRIBUTOR_APP_KEY);
    } catch (e) {
      return false;
    }
  }

  /** 代理版 App 允许 App 内自助注册（旧 distributor_app 禁注册门禁已关闭） */
  function isInAppRegisterDisabled() {
    return false;
  }

  /** 注册时绑定代理渠道：优先 URL；安装页 / App 壳可沿用本地已存渠道 */
  function getRegisterSalesChannel(fromInstallGuide) {
    try {
      var p = new URLSearchParams(window.location.search);
      var urlCh = sanitizeSalesChannelId(p.get('ch') || p.get('channel') || '');
      if (urlCh) {
        return urlCh;
      }
      var allowStored =
        !!fromInstallGuide ||
        isCordovaTaxAppShell() ||
        isDistributorApp();
      if (!allowStored) {
        return '';
      }
      var raw = localStorage.getItem(SALES_CHANNEL_KEY);
      if (!raw) {
        return '';
      }
      var o = JSON.parse(raw);
      if (!o || !o.ch) {
        return '';
      }
      if (!isSalesChannelStickyRecordValid(o)) {
        return '';
      }
      /* 专属渠道依赖安装页/壳写入的 ch；不得因 source=install_packages/server_resolve 丢掉 */
      return sanitizeSalesChannelId(o.ch);
    } catch (e) {
      return '';
    }
  }

  function getSalesChannel() {
    try {
      var raw = localStorage.getItem(SALES_CHANNEL_KEY);
      if (!raw) {
        return '';
      }
      var o = JSON.parse(raw);
      if (!o || !o.ch) {
        return '';
      }
      if (!isSalesChannelStickyRecordValid(o)) {
        localStorage.removeItem(SALES_CHANNEL_KEY);
        return '';
      }
      return sanitizeSalesChannelId(o.ch);
    } catch (e) {
      return '';
    }
  }

  function getPublicInstallPackagesUrl() {
    // 已登录用户不带 localStorage 推广渠道，由服务端按账号 sales_promo_channel 判断
    if (getToken()) {
      return '/api/public/install-packages';
    }
    var ch = getSalesChannel();
    if (ch) {
      return '/api/public/install-packages?sales_ch=' + encodeURIComponent(ch);
    }
    return '/api/public/install-packages';
  }

  /** C 端已下线闲鱼购买入口；保留空实现以免旧调用报错 */
  function applyXianyuPurchaseVisibility() {
    [
      'btnXianyuPurchase',
      'btnMineActivateXianyu',
      'btnConsultActivateXianyu',
      'btnConsultProductsXianyu',
      'btnPurchaseXianyu',
      'cardConsultXianyu'
    ].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (el.tagName === 'BUTTON' || el.tagName === 'A') {
        el.style.display = 'none';
        el.hidden = true;
      } else {
        el.hidden = true;
        el.style.display = 'none';
      }
    });
  }

  function persistSalesChannelAttribution(sourcePage) {
    var ch = getSalesChannel();
    if (!ch) {
      return Promise.resolve();
    }
    var headers = { 'Content-Type': 'application/json' };
    if (typeof getClientDeviceHeaders === 'function') {
      Object.assign(headers, getClientDeviceHeaders());
    }
    return fetch('/api/public/sales-channel-attribution', {
      method: 'POST',
      credentials: 'same-origin',
      headers: headers,
      body: JSON.stringify({
        sales_ch: ch,
        source_page: sourcePage != null ? String(sourcePage).substring(0, 128) : ''
      })
    }).catch(function () {});
  }

  function resolveSalesChannelFromServer() {
    if (getSalesChannel()) {
      return Promise.resolve(getSalesChannel());
    }
    var headers = {};
    if (typeof getClientDeviceHeaders === 'function') {
      headers = getClientDeviceHeaders();
    }
    return fetch('/api/public/resolve-sales-channel', { credentials: 'same-origin', headers: headers })
      .then(function (r) {
        return window.authParseJson(r);
      })
      .then(function (body) {
        if (body && body.code === 200 && body.data) {
          applyChannelForcedPricingAbc(body.data);
          if (body.data.sales_ch) {
            var ch = sanitizeSalesChannelId(body.data.sales_ch);
            if (ch) {
              if (!getToken()) {
                try {
                  localStorage.setItem(
                    SALES_CHANNEL_KEY,
                    JSON.stringify({
                      ch: ch,
                      at: Date.now(),
                      source: 'server_resolve'
                    })
                  );
                } catch (e) {}
              }
              return ch;
            }
          }
        }
        return '';
      })
      .catch(function () {
        return '';
      });
  }

  function appendSalesChannelToUrl(url) {
    var ch = getSalesChannel();
    if (!ch || !url) {
      return url;
    }
    try {
      var u = new URL(url, window.location.href);
      if (!u.searchParams.get('ch') && !u.searchParams.get('channel')) {
        u.searchParams.set('ch', ch);
      }
      return u.pathname + u.search + u.hash;
    } catch (e) {
      if (url.indexOf('ch=') >= 0 || url.indexOf('channel=') >= 0) {
        return url;
      }
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + 'ch=' + encodeURIComponent(ch);
    }
  }

  function resolvePublicOrigin() {
    try {
      if (typeof window.sitePublicOrigin === 'function') {
        var o = String(window.sitePublicOrigin() || '').replace(/\/+$/, '');
        if (o) return o;
      }
    } catch (e0) {}
    try {
      return String(window.location.origin || '').replace(/\/+$/, '');
    } catch (e1) {
      return '';
    }
  }

  /**
   * 构建可分享的绝对 HTTPS 链接。
   * 页面分享不带代理渠道 ch（避免把 abc 等渠道带给好友）。
   * page: 'shouye.html' | 'mine.html' …
   * extras: { guest:'1', from:'share', … }
   */
  function buildShareUrl(page, extras) {
    var origin = resolvePublicOrigin();
    var path = String(page || 'shouye.html').replace(/^\/+/, '');
    if (!/^[a-z0-9_\-]+\.html$/i.test(path.split('?')[0])) {
      path = 'shouye.html';
    }
    var base = origin || String(window.location.origin || '');
    var u;
    try {
      u = new URL(path, base + '/');
    } catch (eUrl) {
      u = null;
    }
    if (!u) {
      return (base ? base : '') + '/' + path;
    }
    if (extras && typeof extras === 'object') {
      Object.keys(extras).forEach(function (k) {
        var key = String(k || '').toLowerCase();
        /* 分享链接禁止写入渠道参数 */
        if (key === 'ch' || key === 'channel' || key === 'sales_ch') return;
        if (extras[k] != null && String(extras[k]) !== '') {
          u.searchParams.set(k, String(extras[k]));
        }
      });
    }
    u.searchParams.delete('ch');
    u.searchParams.delete('channel');
    u.searchParams.delete('sales_ch');
    return u.href;
  }

  function copyTextToClipboard(text) {
    var t = String(text || '');
    if (!t) return Promise.resolve(false);
    if (typeof window.copyTextRobust === 'function') {
      return window.copyTextRobust(t).then(
        function () {
          return true;
        },
        function () {
          return false;
        }
      );
    }
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(t).then(
        function () {
          return true;
        },
        function () {
          return fallbackCopy(t).then(function (ok) {
            return ok ? true : tryCordovaClipboard(t);
          });
        }
      );
    }
    return fallbackCopy(t).then(function (ok) {
      return ok ? true : tryCordovaClipboard(t);
    });

    function fallbackCopy(s) {
      return new Promise(function (resolve) {
        try {
          var ta = document.createElement('textarea');
          ta.value = s;
          ta.setAttribute('readonly', '');
          ta.style.cssText =
            'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:none;opacity:0;';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          if (typeof ta.setSelectionRange === 'function') ta.setSelectionRange(0, s.length);
          var ok = document.execCommand('copy');
          document.body.removeChild(ta);
          resolve(!!ok);
        } catch (e) {
          resolve(false);
        }
      });
    }

    function tryCordovaClipboard(s) {
      try {
        var clip =
          (window.cordova && window.cordova.plugins && window.cordova.plugins.clipboard) ||
          (window.plugins && window.plugins.clipboard) ||
          null;
        if (!clip || typeof clip.copy !== 'function') return Promise.resolve(false);
        return new Promise(function (resolve) {
          try {
            clip.copy(
              s,
              function () {
                resolve(true);
              },
              function () {
                resolve(false);
              }
            );
          } catch (e) {
            resolve(false);
          }
        });
      } catch (e2) {
        return Promise.resolve(false);
      }
    }
  }

  /**
   * 分享页面链接：优先系统分享面板（安卓把链接放进 text，兼容微信等），失败再 Intent/复制。
   * opts: { page, query, url, title, text, track }
   */
  /** 分享默认落地：游客首页 + 打开注册 CTA（landing_ab=c） */
  var DEFAULT_SHARE_LAND_QUERY = {
    guest: '1',
    from: 'share',
    landing_ab: 'c',
    sv: 'sim1'
  };

  function sharePageLink(opts) {
    opts = opts || {};
    var url =
      opts.url ||
      buildShareUrl(opts.page || 'shouye.html', opts.query || DEFAULT_SHARE_LAND_QUERY);
    var title = opts.title || '个税记录演示';
    var text = opts.text || '打开即可体验收入明细与纳税记录（演示）';
    var pageKey = String(opts.page || '').replace(/\.html$/i, '') || 'share';
    var isAndroid = /Android/i.test(navigator.userAgent || '');
    var shareBody = String(text || '').trim();
    if (shareBody && shareBody.indexOf(url) < 0) {
      shareBody = shareBody + '\n' + url;
    } else if (!shareBody) {
      shareBody = url;
    }

    function track(action) {
      var meta = { page: pageKey, url: url, method: action };
      try {
        if (typeof window.trackUserAction === 'function') {
          window.trackUserAction(action, meta);
          return;
        }
      } catch (e0) {}
      try {
        if (typeof window.trackPublicAction === 'function') {
          window.trackPublicAction(action, meta);
        }
      } catch (e1) {}
    }

    function toast(msg) {
      try {
        if (typeof window.showToast === 'function') {
          window.showToast(msg);
          return;
        }
      } catch (eT) {}
      try {
        alert(msg);
      } catch (eA) {}
    }

    function copyFallback() {
      return copyTextToClipboard(url).then(function (ok) {
        track('track_share_copy');
        toast(ok ? '链接已复制，可粘贴到微信发给好友' : '复制失败，请长按手动复制链接');
        return { method: 'copy', url: url, ok: !!ok };
      });
    }

    /** Cordova 社交通用插件（若壳内已装） */
    function tryCordovaSocialShare() {
      try {
        var plugin =
          (window.plugins && window.plugins.socialsharing) ||
          (navigator && navigator.share && navigator.share.socialsharing) ||
          null;
        var shareFn =
          plugin && typeof plugin.share === 'function'
            ? plugin.share.bind(plugin)
            : typeof window.socialsharing !== 'undefined' &&
                window.socialsharing &&
                typeof window.socialsharing.share === 'function'
              ? window.socialsharing.share.bind(window.socialsharing)
              : null;
        if (!shareFn) return false;
        shareFn(shareBody, title, null, url);
        track(opts.track || 'track_share_native');
        return true;
      } catch (ePlugin) {
        return false;
      }
    }

    /** 安卓 WebView 无 Web Share 时，用系统 SEND Intent 拉起分享面板 */
    function tryAndroidShareIntent() {
      if (!isAndroid) return false;
      var intent =
        'intent:#Intent;action=android.intent.action.SEND;type=text/plain;' +
        'S.android.intent.extra.SUBJECT=' +
        encodeURIComponent(title) +
        ';S.android.intent.extra.TEXT=' +
        encodeURIComponent(shareBody) +
        ';end';
      /* 1) 隐藏 a.click：Cordova 对 location.href 的 intent 常拦截 */
      try {
        var a = document.createElement('a');
        a.href = intent;
        a.style.cssText = 'display:none;position:fixed;left:-9999px;';
        a.setAttribute('rel', 'noopener');
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          try {
            a.parentNode && a.parentNode.removeChild(a);
          } catch (eRm) {}
        }, 800);
        track(opts.track || 'track_share_native');
        return true;
      } catch (eA) {}
      /* 2) iframe */
      try {
        var iframe = document.createElement('iframe');
        iframe.style.cssText = 'display:none;width:0;height:0;border:0;';
        iframe.src = intent;
        document.body.appendChild(iframe);
        setTimeout(function () {
          try {
            iframe.parentNode && iframe.parentNode.removeChild(iframe);
          } catch (eRm2) {}
        }, 1500);
        track(opts.track || 'track_share_native');
        return true;
      } catch (eIframe) {}
      /* 3) 最后再试 location */
      try {
        window.location.href = intent;
        track(opts.track || 'track_share_native');
        return true;
      } catch (eIntent) {
        return false;
      }
    }

    function doNativeShare() {
      /* 安卓：链接放进 text，单独 url 字段易被部分 App（如微信）丢掉 */
      var payload = isAndroid
        ? { title: title, text: shareBody }
        : { title: title, text: text, url: url };
      return navigator.share(payload).then(function () {
        track(opts.track || 'track_share_native');
        return { method: 'native', url: url };
      });
    }

    if (tryCordovaSocialShare()) {
      return Promise.resolve({ method: 'cordova', url: url });
    }
    if (typeof navigator.share === 'function') {
      return doNativeShare().catch(function (err) {
        if (err && err.name === 'AbortError') {
          return { method: 'abort', url: url };
        }
        /* NotAllowedError / DataError：安卓再试 Intent，再复制 */
        if (isAndroid && tryAndroidShareIntent()) {
          return { method: 'intent', url: url };
        }
        return copyFallback();
      });
    }
    if (isAndroid && tryAndroidShareIntent()) {
      return Promise.resolve({ method: 'intent', url: url });
    }
    return copyFallback();
  }

  var MINE_SHARE_DONE_KEY = 'mine_share_done_v1';
  var MINE_SHARE_PENDING_KEY = 'mine_share_pending_v1';
  var BILI_ANDROID_PACKAGES = ['tv.danmaku.bili', 'com.bilibili.app.in'];
  /** B 站分享固定跳转/分享目标（短链） */
  var BILIBILI_SHARE_URL = 'https://b23.tv/EiRdMqm';

  function isMineShareDone() {
    try {
      return localStorage.getItem(MINE_SHARE_DONE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function markMineSharePending() {
    try {
      localStorage.setItem(MINE_SHARE_PENDING_KEY, '1');
    } catch (e) {}
  }

  function markMineShareCompleted() {
    try {
      localStorage.setItem(MINE_SHARE_DONE_KEY, '1');
      localStorage.removeItem(MINE_SHARE_PENDING_KEY);
    } catch (e) {}
    try {
      document.documentElement.classList.add('mine-share-done');
    } catch (eCls) {}
  }

  function finalizeMineShareIfPending() {
    try {
      if (localStorage.getItem(MINE_SHARE_PENDING_KEY) !== '1') return false;
      localStorage.removeItem(MINE_SHARE_PENDING_KEY);
    } catch (e) {
      return false;
    }
    markMineShareCompleted();
    return true;
  }

  try {
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) finalizeMineShareIfPending();
    });
    window.addEventListener('pageshow', function () {
      finalizeMineShareIfPending();
    });
  } catch (eBindShare) {}

  /**
   * 分享到 B 站：默认跳转并分享固定短链 https://b23.tv/EiRdMqm
   * 安卓优先拉起 B 站 App 发送；同时打开短链进入对应内容。
   * opts 可传 url/title/text/package 覆盖默认。
   */
  function shareToBilibili(opts) {
    opts = opts || {};
    var url = String(opts.url || BILIBILI_SHARE_URL || '').trim() || BILIBILI_SHARE_URL;
    var title = opts.title || '个税记录演示';
    var text = opts.text || '打开即可体验收入明细与纳税记录（演示）';
    var shareBody = String(text || '').trim();
    if (shareBody && shareBody.indexOf(url) < 0) {
      shareBody = shareBody + '\n' + url;
    } else if (!shareBody) {
      shareBody = url;
    }
    var ua = navigator.userAgent || '';
    var isAndroid = /Android/i.test(ua);
    var isIOS = /iPhone|iPad|iPod/i.test(ua);

    function track(action, extra) {
      var meta = Object.assign({ page: 'bilibili', url: url, method: action }, extra || {});
      try {
        if (typeof window.trackUserAction === 'function') {
          window.trackUserAction(opts.track || action, meta);
          return;
        }
      } catch (e0) {}
      try {
        if (typeof window.trackPublicAction === 'function') {
          window.trackPublicAction(opts.track || action, meta);
        }
      } catch (e1) {}
    }

    function toast(msg) {
      try {
        if (typeof window.showToast === 'function') {
          window.showToast(msg);
          return;
        }
      } catch (eT) {}
      try {
        alert(msg);
      } catch (eA) {}
    }

    /** 跳转到 B 站短链（Universal Link / App 内打开） */
    function openBilibiliTarget() {
      try {
        var open = document.createElement('a');
        open.href = url;
        open.target = '_blank';
        open.rel = 'noopener noreferrer';
        open.style.cssText = 'display:none;position:fixed;left:-9999px;';
        document.body.appendChild(open);
        open.click();
        setTimeout(function () {
          try {
            open.parentNode && open.parentNode.removeChild(open);
          } catch (eRm) {}
        }, 800);
        return true;
      } catch (eOpen) {
        try {
          window.open(url, '_blank', 'noopener');
          return true;
        } catch (eWin) {
          return false;
        }
      }
    }

    function copyThenHint() {
      return copyTextToClipboard(shareBody).then(function (ok) {
        track('track_share_bilibili_copy');
        openBilibiliTarget();
        toast(
          ok
            ? '已复制并跳转 B 站。请在 B 站完成分享；返回本应用后即可继续。'
            : '跳转 B 站中。若未自动打开，请手动访问：\n' + url
        );
        return { method: 'copy', url: url, ok: !!ok, target: 'bilibili' };
      });
    }

    function tryAndroidBiliIntent(pkg) {
      if (!isAndroid || !pkg) return false;
      var intent =
        'intent:#Intent;action=android.intent.action.SEND;type=text/plain;' +
        'package=' +
        pkg +
        ';' +
        'S.android.intent.extra.SUBJECT=' +
        encodeURIComponent(title) +
        ';S.android.intent.extra.TEXT=' +
        encodeURIComponent(shareBody) +
        ';end';
      try {
        var a = document.createElement('a');
        a.href = intent;
        a.style.cssText = 'display:none;position:fixed;left:-9999px;';
        a.setAttribute('rel', 'noopener');
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          try {
            a.parentNode && a.parentNode.removeChild(a);
          } catch (eRm) {}
        }, 800);
        track('track_share_bilibili_intent', { package: pkg });
        return true;
      } catch (eA) {
        return false;
      }
    }

    /** 安卓：用 VIEW intent 打开短链，优先进 B 站 App */
    function tryAndroidOpenB23(pkg) {
      if (!isAndroid) return false;
      var intent =
        'intent://b23.tv/' +
        String(url).replace(/^https?:\/\/b23\.tv\//i, '') +
        '#Intent;scheme=https;package=' +
        (pkg || 'tv.danmaku.bili') +
        ';S.browser_fallback_url=' +
        encodeURIComponent(url) +
        ';end';
      try {
        var a = document.createElement('a');
        a.href = intent;
        a.style.cssText = 'display:none;position:fixed;left:-9999px;';
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          try {
            a.parentNode && a.parentNode.removeChild(a);
          } catch (eRm) {}
        }, 800);
        track('track_share_bilibili_open', { package: pkg || 'tv.danmaku.bili' });
        return true;
      } catch (eV) {
        return false;
      }
    }

    markMineSharePending();

    if (isAndroid) {
      var pkgs = opts.package ? [String(opts.package)] : BILI_ANDROID_PACKAGES.slice();
      var i;
      var sent = false;
      for (i = 0; i < pkgs.length; i++) {
        if (tryAndroidBiliIntent(pkgs[i])) {
          sent = true;
          /* 同步打开短链内容页，方便「跳转 B 站」 */
          tryAndroidOpenB23(pkgs[i]);
          return Promise.resolve({
            method: 'intent',
            url: url,
            target: 'bilibili',
            package: pkgs[i]
          });
        }
      }
      if (!sent) {
        if (tryAndroidOpenB23(pkgs[0])) {
          return copyTextToClipboard(shareBody).then(function (ok) {
            toast(ok ? '已复制链接并打开 B 站' : '已尝试打开 B 站：\n' + url);
            return { method: 'open', url: url, ok: !!ok, target: 'bilibili' };
          });
        }
      }
      return copyThenHint();
    }

    if (isIOS) {
      return copyTextToClipboard(shareBody).then(function (ok) {
        track('track_share_bilibili_copy');
        openBilibiliTarget();
        toast(
          ok
            ? '已复制并跳转 B 站。请在 B 站完成分享后返回本应用。'
            : '请打开 B 站访问：\n' + url
        );
        return { method: 'copy', url: url, ok: !!ok, target: 'bilibili' };
      });
    }

    return copyThenHint();
  }

  /** 一键生成前：未分享且尚无个税记录则拦截 */
  function ensureBilibiliShareBeforeTaxGenerate() {
    finalizeMineShareIfPending();
    if (isMineShareDone()) return true;
    try {
      var n = Number(localStorage.getItem('tax_record_count') || '0');
      if (n > 0) return true;
    } catch (eN) {}
    var goShare = false;
    try {
      goShare = window.confirm(
        '一键生成个税记录前，请先分享到 B 站。\n\n点「确定」立即分享。'
      );
    } catch (eC) {
      goShare = true;
    }
    if (goShare) {
      shareToBilibili({
        url: BILIBILI_SHARE_URL,
        title: '个税记录演示',
        text: '个税记录演示：打开即可体验收入明细与纳税记录',
        track: 'track_share_bilibili_gate'
      }).then(function (result) {
        if (result && result.method && result.method !== 'abort') {
          if (result.method === 'intent') return;
          markMineShareCompleted();
        }
      });
    }
    return false;
  }

  /* 尽早挂到 window：后半段若因 Map 等环境差异中断，分享仍可用 */
  try {
    window.buildShareUrl = buildShareUrl;
    window.sharePageLink = sharePageLink;
    window.shareToBilibili = shareToBilibili;
    window.BILIBILI_SHARE_URL = BILIBILI_SHARE_URL;
    window.isMineShareDone = isMineShareDone;
    window.markMineShareCompleted = markMineShareCompleted;
    window.markMineSharePending = markMineSharePending;
    window.finalizeMineShareIfPending = finalizeMineShareIfPending;
    window.ensureBilibiliShareBeforeTaxGenerate = ensureBilibiliShareBeforeTaxGenerate;
    window.DEFAULT_SHARE_LAND_QUERY = DEFAULT_SHARE_LAND_QUERY;
    window.copyTextToClipboard = copyTextToClipboard;
  } catch (eShareEarly) {}

  function fetchPublicInstallPackages() {
    var url = getPublicInstallPackagesUrl();
    var opts = { credentials: 'same-origin' };
    return getToken() && typeof authFetch === 'function'
      ? authFetch(url, opts)
      : fetch(url, opts);
  }

  var INSTALL_PACKAGES_CACHE_KEY = 'public_install_packages_v1';
  var INSTALL_PACKAGES_CACHE_TTL_MS = 5 * 60 * 1000;
  var _installPackagesMemory = null;
  var _installPackagesInFlight = null;

  function readInstallPackagesCache() {
    if (
      _installPackagesMemory &&
      _installPackagesMemory.t &&
      Date.now() - _installPackagesMemory.t < INSTALL_PACKAGES_CACHE_TTL_MS &&
      _installPackagesMemory.data
    ) {
      return _installPackagesMemory.data;
    }
    try {
      var raw = sessionStorage.getItem(INSTALL_PACKAGES_CACHE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.t || !o.data || Date.now() - Number(o.t) > INSTALL_PACKAGES_CACHE_TTL_MS) {
        return null;
      }
      _installPackagesMemory = { t: Number(o.t), data: o.data };
      return o.data;
    } catch (e) {
      return null;
    }
  }

  function writeInstallPackagesCache(data) {
    if (!data || typeof data !== 'object') return;
    var packed = { t: Date.now(), data: data };
    _installPackagesMemory = packed;
    try {
      sessionStorage.setItem(INSTALL_PACKAGES_CACHE_KEY, JSON.stringify(packed));
    } catch (e) {}
  }

  function getCachedPublicInstallPackages() {
    return readInstallPackagesCache();
  }

  function buildWpaQqAddUrl(qqRaw) {
    var qq = String(qqRaw || '').trim();
    if (!/^\d{5,12}$/.test(qq)) {
      return '';
    }
    return (
      'https://wpa.qq.com/msgrd?v=3&uin=' +
      encodeURIComponent(qq) +
      '&site=qq&menu=yes'
    );
  }

  function resolveSupportQqAddUrl(pkg) {
    var data = pkg && typeof pkg === 'object' ? pkg : getCachedPublicInstallPackages();
    if (data) {
      var url = data.qq_add_url != null ? String(data.qq_add_url).trim() : '';
      if (url && /^https?:\/\//i.test(url)) {
        return url;
      }
      var agent = data.sales_agent && typeof data.sales_agent === 'object' ? data.sales_agent : null;
      var fromAgent = agent ? buildWpaQqAddUrl(agent.qq) : '';
      if (fromAgent) {
        return fromAgent;
      }
    }
    return '';
  }

  function openSupportQqAddUrl(url) {
    var href = url != null ? String(url).trim() : '';
    if (!href) {
      return false;
    }
    try {
      if (window.cordova && window.cordova.InAppBrowser && typeof window.cordova.InAppBrowser.open === 'function') {
        window.cordova.InAppBrowser.open(href, '_system');
        return true;
      }
    } catch (e0) {}
    try {
      if (typeof window.openTaxPlatformExternal === 'function') {
        window.openTaxPlatformExternal(href);
        return true;
      }
    } catch (e1) {}
    try {
      var opened = window.open(href, '_blank', 'noopener');
      if (opened) {
        return true;
      }
    } catch (e2) {}
    try {
      window.location.href = href;
      return true;
    } catch (e3) {
      return false;
    }
  }

  function injectPaymentFailDialogStyles() {
    if (document.getElementById('pay-create-fail-dialog-style')) {
      return;
    }
    var style = document.createElement('style');
    style.id = 'pay-create-fail-dialog-style';
    style.textContent =
      '.pay-create-fail-root{position:fixed;inset:0;z-index:10080;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;}' +
      '.pay-create-fail-mask{position:absolute;inset:0;background:rgba(0,0,0,.45);}' +
      '.pay-create-fail-panel{position:relative;width:100%;max-width:320px;background:#fff;border-radius:12px;padding:20px 16px 14px;box-shadow:0 8px 28px rgba(0,0,0,.18);}' +
      '.pay-create-fail-title{font-size:17px;font-weight:600;color:#333;margin:0 0 10px;line-height:1.35;}' +
      '.pay-create-fail-msg{font-size:14px;color:#666;line-height:1.55;margin:0 0 16px;word-break:break-word;}' +
      '.pay-create-fail-actions{display:flex;flex-direction:column;gap:10px;}' +
      '.pay-create-fail-btn{width:100%;min-height:44px;padding:10px 14px;border-radius:8px;font-size:15px;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent;}' +
      '.pay-create-fail-btn-primary{background:#1e6fff;color:#fff;font-weight:600;}' +
      '.pay-create-fail-btn-secondary{background:#f0f0f0;color:#666;}';
    document.head.appendChild(style);
  }

  function showPaymentCreateFailDialog(opts) {
    opts = opts || {};
    var message =
      opts.message != null && String(opts.message).trim()
        ? String(opts.message).trim()
        : '创建支付订单失败，请稍后重试或添加客服协助处理';
    var source = opts.source != null ? String(opts.source).substring(0, 48) : 'pay_create';
    var existing = document.getElementById('pay-create-fail-dialog');
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
    injectPaymentFailDialogStyles();

    function renderDialog(qqUrl) {
      var root = document.createElement('div');
      root.id = 'pay-create-fail-dialog';
      root.className = 'pay-create-fail-root';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      var hasQq = !!qqUrl;
      root.innerHTML =
        '<div class="pay-create-fail-mask" data-action="close"></div>' +
        '<div class="pay-create-fail-panel">' +
        '<p class="pay-create-fail-title">支付订单创建失败</p>' +
        '<p class="pay-create-fail-msg"></p>' +
        '<div class="pay-create-fail-actions">' +
        (hasQq
          ? '<button type="button" class="pay-create-fail-btn pay-create-fail-btn-primary" data-action="qq">添加客服QQ</button>'
          : '') +
        '<button type="button" class="pay-create-fail-btn pay-create-fail-btn-secondary" data-action="close">我知道了</button>' +
        '</div></div>';
      var msgEl = root.querySelector('.pay-create-fail-msg');
      if (msgEl) {
        msgEl.textContent = hasQq
          ? message + '。可添加客服QQ协助处理。'
          : message + '。请稍后重试；如需协助请联系平台客服。';
      }
      document.body.appendChild(root);

      function closeDialog() {
        if (root.parentNode) {
          root.parentNode.removeChild(root);
        }
      }

      root.addEventListener('click', function (e) {
        var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
        if (!el) {
          return;
        }
        var action = el.getAttribute('data-action');
        if (action === 'qq') {
          try {
            if (typeof trackUserAction === 'function') {
              trackUserAction('track_qq_add_click', {
                page: currentPageName(),
                source: source,
                from: 'pay_create_fail'
              });
            } else if (typeof trackPublicAction === 'function') {
              trackPublicAction('track_qq_add_click', {
                page: currentPageName(),
                source: source,
                from: 'pay_create_fail'
              });
            }
          } catch (eTrack) {}
          openSupportQqAddUrl(qqUrl);
          closeDialog();
          return;
        }
        if (action === 'close') {
          closeDialog();
        }
      });
    }

    var cachedUrl = resolveSupportQqAddUrl();
    if (cachedUrl) {
      renderDialog(cachedUrl);
      return;
    }
    refreshPublicInstallPackagesUi({ force: true })
      .then(function (data) {
        renderDialog(resolveSupportQqAddUrl(data));
      })
      .catch(function () {
        renderDialog('');
      });
  }

  function refreshPublicInstallPackagesUi(opts) {
    opts = opts || {};
    if (!opts.force) {
      var cached = readInstallPackagesCache();
      if (cached) {
        applyXianyuPurchaseVisibility(cached);
        return Promise.resolve(cached);
      }
    }
    if (_installPackagesInFlight && !opts.force) {
      return _installPackagesInFlight;
    }
    var req = fetchPublicInstallPackages();
    _installPackagesInFlight = req
      .then(function (r) {
        return window.authParseJson(r);
      })
      .then(function (body) {
        var data = body && body.code === 200 && body.data ? body.data : null;
        if (data && data.sales_channel && !getToken() && !getSalesChannel()) {
          try {
            localStorage.setItem(
              SALES_CHANNEL_KEY,
              JSON.stringify({
                ch: sanitizeSalesChannelId(data.sales_channel),
                at: Date.now(),
                source: 'install_packages',
                permanent: true
              })
            );
          } catch (e) {}
        }
        if (data) {
          writeInstallPackagesCache(data);
          applyChannelForcedPricingAbc(data);
        }
        applyXianyuPurchaseVisibility(data);
        return data;
      })
      .catch(function () {
        applyXianyuPurchaseVisibility(null);
        return null;
      })
      .then(function (data) {
        _installPackagesInFlight = null;
        return data;
      });
    return _installPackagesInFlight;
  }

  initSalesChannelFromUrl();
  initDistributorAppFromUrl();
  captureRegisterSourceFromUrl();

  (function bootstrapSalesChannel() {
    var path = (window.location && window.location.pathname) || '';
    var deferPackages =
      /consult\.html/i.test(path) || /shuiming\.html/i.test(path) || /xiangqing\.html/i.test(path);
    function loadPackages() {
      refreshPublicInstallPackagesUi();
    }
    function afterChannel() {
      if (deferPackages) {
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(loadPackages, { timeout: 4000 });
        } else {
          setTimeout(loadPackages, 2200);
        }
      } else {
        loadPackages();
      }
    }
    var ch = getSalesChannel();
    if (ch) {
      persistSalesChannelAttribution(window.location.pathname || 'direct');
      afterChannel();
      return;
    }
    resolveSalesChannelFromServer().then(function (resolved) {
      if (resolved) {
        persistSalesChannelAttribution('server_resolve');
      }
      afterChannel();
    });
  })();

  function markInstallGuideReferral(source) {
    try {
      localStorage.setItem(
        INSTALL_GUIDE_REFERRAL_KEY,
        JSON.stringify({
          at: Date.now(),
          source: source ? String(source).substring(0, 32) : 'install_guide'
        })
      );
    } catch (e) {}
  }

  function hasInstallGuideReferral() {
    try {
      var raw = localStorage.getItem(INSTALL_GUIDE_REFERRAL_KEY);
      if (!raw) {
        return false;
      }
      var o = JSON.parse(raw);
      if (!o || !o.at) {
        return false;
      }
      if (Date.now() - Number(o.at) > INSTALL_GUIDE_REFERRAL_TTL_MS) {
        localStorage.removeItem(INSTALL_GUIDE_REFERRAL_KEY);
        return false;
      }
      return true;
    } catch (e2) {
      return false;
    }
  }

  /** 分享链归因（主站流量，不带代理 ch；TTL 7 天） */
  function markShareAttribution(source, landPage) {
    try {
      localStorage.setItem(
        SHARE_ATTR_KEY,
        JSON.stringify({
          at: Date.now(),
          source: source ? String(source).substring(0, 32) : 'share',
          land_page: landPage ? String(landPage).substring(0, 64) : ''
        })
      );
    } catch (e) {}
  }

  function hasShareAttribution() {
    try {
      var raw = localStorage.getItem(SHARE_ATTR_KEY);
      if (!raw) return false;
      var o = JSON.parse(raw);
      if (!o || !o.at) return false;
      if (Date.now() - Number(o.at) > SHARE_ATTR_TTL_MS) {
        localStorage.removeItem(SHARE_ATTR_KEY);
        return false;
      }
      return true;
    } catch (e2) {
      return false;
    }
  }

  function clearShareAttribution() {
    try {
      localStorage.removeItem(SHARE_ATTR_KEY);
    } catch (e) {}
  }

  function getShareAttribution() {
    try {
      if (!hasShareAttribution()) return null;
      var raw = localStorage.getItem(SHARE_ATTR_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function trackSharePublic(action, meta) {
    try {
      if (typeof firePublicTrack === 'function') {
        firePublicTrack(action, '/event/' + sanitizeTrackKey(action), meta || {});
        return;
      }
    } catch (e0) {}
    try {
      if (typeof window.trackPublicAction === 'function') {
        window.trackPublicAction(action, meta || {});
      }
    } catch (e1) {}
  }

  /** 从分享会话进入下载/安装引导时上报（同会话只报一次） */
  function trackShareDownloadClick(source) {
    if (!hasShareAttribution()) return false;
    try {
      if (sessionStorage.getItem('share_download_once_v1') === '1') return false;
      sessionStorage.setItem('share_download_once_v1', '1');
    } catch (eOnce) {}
    trackSharePublic('track_share_download_click', {
      page: currentPageName(),
      source: source ? String(source).substring(0, 32) : 'download'
    });
    return true;
  }

  /** URL 含 from=share 时写入归因并上报打开（同页会话去重） */
  function bootstrapShareAttributionFromUrl() {
    var fromShare = false;
    try {
      var sp = new URLSearchParams(window.location.search || '');
      fromShare = String(sp.get('from') || '').toLowerCase() === 'share';
    } catch (eQ) {}
    if (!fromShare) return;
    var page = currentPageName();
    markShareAttribution('url_param', page);
    try {
      var onceKey = SHARE_LAND_ONCE_KEY + ':' + page;
      if (sessionStorage.getItem(onceKey) === '1') return;
      sessionStorage.setItem(onceKey, '1');
    } catch (eS) {}
    trackSharePublic('track_share_land', { page: page, from: 'share' });
  }

  function clearInstallGuideReferral() {
    try {
      localStorage.removeItem(INSTALL_GUIDE_REFERRAL_KEY);
    } catch (e) {}
  }

  function consumeInstallGuideReferral() {
    var ok = hasInstallGuideReferral();
    if (ok) {
      clearInstallGuideReferral();
    }
    return ok;
  }

  function getOrCreateClientDeviceId() {
    try {
      var v = localStorage.getItem(CLIENT_DEVICE_STORAGE_KEY);
      if (v && String(v).length >= 8) {
        return String(v).substring(0, 128);
      }
      var id = randomClientDeviceId();
      localStorage.setItem(CLIENT_DEVICE_STORAGE_KEY, id);
      return id;
    } catch (e) {
      return 'web_sess_' + String(Date.now());
    }
  }

  function getLandingAbAssignment() {
    try {
      var raw = localStorage.getItem(LANDING_AB_ASSIGNMENT_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || (parsed.variant !== 'b' && parsed.variant !== 'c')) {
        return null;
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function getPurchaseAbcAssignment() {
    try {
      var raw = localStorage.getItem(PURCHASE_ABC_ASSIGNMENT_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed) return null;
      var v = String(parsed.variant || '')
        .trim()
        .toLowerCase();
      try {
        if (typeof v.normalize === 'function') v = v.normalize('NFKC').toLowerCase();
      } catch (eNfkc) {}
      if (v !== 'a' && v !== 'b' && v !== 'c') {
        return null;
      }
      if (parsed.variant !== v) {
        parsed.variant = v;
        try {
          localStorage.setItem(PURCHASE_ABC_ASSIGNMENT_KEY, JSON.stringify(parsed));
        } catch (eFix) {}
      }
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function getPurchaseAbcVariant() {
    var assignment = getPurchaseAbcAssignment();
    return assignment ? assignment.variant : '';
  }

  function setPurchaseAbcAssignment(variant, source) {
    var v = String(variant || '').trim();
    try {
      if (typeof v.normalize === 'function') v = v.normalize('NFKC');
    } catch (eNfkc) {}
    v = v.toLowerCase();
    /* 历史 C（仅激活码）已下线，统一归一为 B（多档支付宝） */
    if (v === 'c') v = 'b';
    if (v !== 'a' && v !== 'b') return null;
    var existing = getPurchaseAbcAssignment();
    var src = String(source || 'allocation').substring(0, 32);
    /* 服务端/管理端结果允许覆盖本地 sticky（尤其是误锁的 C） */
    var allowOverwrite =
      src === 'server_offer' ||
      src === 'admin_force' ||
      src === 'agent_channel' ||
      src.indexOf('server_') === 0;
    if (existing && existing.variant === v) {
      return existing;
    }
    /* sticky：已有不同方案时默认不覆盖 */
    if (existing && existing.variant && !allowOverwrite) {
      return existing;
    }
    var next = {
      experiment: 'purchase_abc_v1',
      variant: v,
      assigned_at: Date.now(),
      source: src
    };
    try {
      localStorage.setItem(PURCHASE_ABC_ASSIGNMENT_KEY, JSON.stringify(next));
    } catch (e) {}
    /* 落地实验仅保留 B 支路 */
    setLandingAbAssignment('b', 'from_purchase_abc');
    return next;
  }

  /** 代理专属渠道等场景：强制覆盖本地 sticky */
  function forcePurchaseAbcAssignment(variant, source) {
    var v = String(variant || '').trim();
    try {
      if (typeof v.normalize === 'function') v = v.normalize('NFKC');
    } catch (eNfkc) {}
    v = v.toLowerCase();
    if (v === 'c') v = 'b';
    if (v !== 'a' && v !== 'b') return null;
    var next = {
      experiment: 'purchase_abc_v1',
      variant: v,
      assigned_at: Date.now(),
      source: String(source || 'agent_channel').substring(0, 32)
    };
    try {
      localStorage.setItem(PURCHASE_ABC_ASSIGNMENT_KEY, JSON.stringify(next));
    } catch (e) {}
    setLandingAbAssignment('b', 'from_purchase_abc_force');
    return next;
  }

  function applyChannelForcedPricingAbc(data) {
    var abc = '';
    if (data) {
      abc = String(data.force_pricing_abc || data.default_pricing_abc || '')
        .trim()
        .toLowerCase();
      /* hide_self_serve / code_only 只影响购买页显隐，不改写 A/B 支付方案 */
    }
    /*
     * 已登录用户：安装包接口若未带回 sales_channel（账号未绑代理渠道），
     * 不得把本地 sticky 强行写成 C（同 IP 测过代理链时曾误伤 A 方案支付宝）。
     */
    if (getToken()) {
      var sc = data && data.sales_channel != null ? String(data.sales_channel).trim() : '';
      if (!sc && (abc === '' || abc === 'b')) {
        try {
          var prevLogged = getPurchaseAbcAssignment();
          if (prevLogged && prevLogged.source === 'agent_channel') {
            localStorage.removeItem(PURCHASE_ABC_ASSIGNMENT_KEY);
          }
        } catch (eClearLogged) {}
        return null;
      }
    }
    /* 仅服务端明确返回 a|b 时强制；空=跟随后台增长配置，并清掉旧渠道锁定 */
    if (abc !== 'a' && abc !== 'b') {
      try {
        var prev = getPurchaseAbcAssignment();
        if (prev && prev.source === 'agent_channel') {
          localStorage.removeItem(PURCHASE_ABC_ASSIGNMENT_KEY);
        }
      } catch (eClear) {}
      return null;
    }
    return forcePurchaseAbcAssignment(abc, 'agent_channel');
  }

  function clearInvalidPurchaseAbcCSticky() {
    try {
      var a = getPurchaseAbcAssignment();
      if (!a || a.variant !== 'c') return false;
      var src = String(a.source || '');
      if (src === 'admin_force') return false;
      /* agent_channel 由 applyChannelForcedPricingAbc 维护；其余本地 C 作废，改由服务端分流 */
      if (src === 'agent_channel') return false;
      localStorage.removeItem(PURCHASE_ABC_ASSIGNMENT_KEY);
      return true;
    } catch (e) {
      return false;
    }
  }

  function migratePurchaseAbcFromLanding() {
    clearInvalidPurchaseAbcCSticky();
    if (getPurchaseAbcAssignment()) return getPurchaseAbcAssignment();
    /* 落地 C 不再迁入支付 C；支付方案由增长后台 / 渠道强制决定 */
    return null;
  }

  function allocatePurchaseAbcFromPercents(seed, aPercent, bPercent, cPercent) {
    var a = Math.max(0, Math.min(100, parseInt(aPercent, 10) || 0));
    var b = Math.max(0, Math.min(100, parseInt(bPercent, 10) || 0));
    var c = Math.max(0, Math.min(100, parseInt(cPercent, 10) || 0));
    var sum = a + b + c;
    if (sum !== 100 && sum > 0) {
      a = Math.round((a * 100) / sum);
      b = Math.round((b * 100) / sum);
      c = 100 - a - b;
      if (c < 0) {
        b = Math.max(0, b + c);
        c = 0;
      }
    } else if (sum <= 0) {
      a = 100;
      b = 0;
      c = 0;
    }
    var h = 2166136261;
    var s = 'purchase_abc|' + String(seed || 'guest');
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    var bucket = (h >>> 0) % 100;
    if (bucket < a) return 'a';
    return 'b';
  }

  function getLandingAbVariant() {
    migratePurchaseAbcFromLanding();
    var purchase = getPurchaseAbcAssignment();
    if (purchase) {
      return purchase.variant === 'a' ? 'a' : 'b';
    }
    var assignment = getLandingAbAssignment();
    return assignment ? assignment.variant : '';
  }

  function setLandingAbAssignment(variant, source) {
    var v = String(variant || '').toLowerCase();
    if (v !== 'b') return null;
    var existing = getLandingAbAssignment();
    if (existing && existing.variant === v) {
      return existing;
    }
    var next = {
      experiment: 'landing_bc_v1',
      variant: v,
      assigned_at: Date.now(),
      source: String(source || 'allocation').substring(0, 32)
    };
    try {
      localStorage.setItem(LANDING_AB_ASSIGNMENT_KEY, JSON.stringify(next));
    } catch (e) {}
    return next;
  }

  function buildClientDevicePayload() {
    var tz = '';
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (e) {}
    var appVer = '';
    try {
      if (typeof window !== 'undefined' && window.CLIENT_APP_VERSION != null) {
        appVer = String(window.CLIENT_APP_VERSION);
      }
    } catch (e2) {}
    var payload = {
      client_id: getOrCreateClientDeviceId(),
      source: 'web',
      platform: typeof navigator !== 'undefined' ? String(navigator.platform || '') : '',
      user_agent: typeof navigator !== 'undefined' ? String(navigator.userAgent || '').substring(0, 400) : '',
      language: typeof navigator !== 'undefined' ? String(navigator.language || '') : '',
      screen: typeof screen !== 'undefined' ? screen.width + 'x' + screen.height : '',
      dpr: typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1,
      timezone: tz.substring(0, 64),
      app_version: appVer.substring(0, 64)
    };
    if (typeof window !== 'undefined' && typeof window.buildClientDevicePayloadHook === 'function') {
      try {
        var patch = window.buildClientDevicePayloadHook(Object.assign({}, payload));
        if (patch && typeof patch === 'object') {
          Object.assign(payload, patch);
        }
      } catch (e3) {}
    }
    return payload;
  }

  function getClientDeviceHeaders() {
    try {
      var payload = buildClientDevicePayload();
      var j = JSON.stringify(payload);
      if (j.length > 8192) {
        j = JSON.stringify({
          client_id: payload.client_id,
          source: payload.source,
          user_agent: payload.user_agent
        });
      }
      var headers = { 'X-Client-Device': j };
      var abc = getPurchaseAbcVariant();
      if (abc) {
        headers['X-Purchase-Abc'] = abc;
      }
      return headers;
    } catch (e) {
      return {};
    }
  }

  function authHeaders() {
    var h = Object.assign({ 'Content-Type': 'application/json' }, getClientDeviceHeaders());
    var t = getToken();
    if (t) {
      h['Authorization'] = 'Bearer ' + t;
    }
    var salesCh = getSalesChannel();
    if (salesCh) {
      h['X-Sales-Channel'] = salesCh;
    }
    return h;
  }

  function clearSession() {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user_id');
      localStorage.removeItem('userName');
      localStorage.removeItem('real_name');
      localStorage.removeItem('tax_id');
      localStorage.removeItem('employer_count');
      localStorage.removeItem('family_count');
      localStorage.removeItem('bank_card_count');
      localStorage.removeItem('gender');
      localStorage.removeItem('account_active');
      localStorage.removeItem('is_test_account');
      localStorage.removeItem('landing_guest_v1');
      localStorage.removeItem('wm_cache');
      localStorage.removeItem('wm_cache_time');
    } catch (e) {}
  }

  var API_PERF_SLOW_MS = 3000;
  var AUTH_FETCH_TIMEOUT_MS = 15000;
  var _apiPerfLastReportAt = 0;
  var _authGetInFlight = new Map();
  var _authGetShortCache = new Map();
  var AUTH_GET_SHORT_CACHE_MS = 20000;
  var _trackQueue = [];
  var _trackFlushTimer = null;
  var _pageBootAt = Date.now();
  var TRACK_BOOT_QUIET_MS = 2800;

  function authGetCacheKey(url) {
    return String(url || '');
  }

  function isShortCacheableGetUrl(url) {
    var u = String(url || '');
    if (u.indexOf('/api/public/install-packages') >= 0) return true;
    if (/[?&]action=records(?:&|$)/.test(u) && /(?:^|\/)api\/tax(?:\.php)?(?:\?|$)/.test(u)) {
      return true;
    }
    if (
      /[?&]action=(?:summary|employers)(?:&|$)/.test(u) &&
      /(?:^|\/)api\/user(?:\.php)?(?:\?|$)/.test(u)
    ) {
      return true;
    }
    return false;
  }

  function readAuthGetShortCache(url) {
    var key = authGetCacheKey(url);
    var hit = _authGetShortCache.get(key);
    if (!hit || Date.now() - hit.t > AUTH_GET_SHORT_CACHE_MS) {
      if (hit) _authGetShortCache.delete(key);
      return null;
    }
    return new Response(hit.body, {
      status: hit.status || 200,
      statusText: hit.statusText || 'OK',
      headers: hit.headers || { 'Content-Type': 'application/json' }
    });
  }

  function writeAuthGetShortCache(url, res, bodyText) {
    if (!isShortCacheableGetUrl(url) || !res || res.status !== 200) return;
    try {
      _authGetShortCache.set(authGetCacheKey(url), {
        t: Date.now(),
        status: res.status,
        statusText: res.statusText,
        headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
        body: bodyText
      });
      if (_authGetShortCache.size > 40) {
        _authGetShortCache.clear();
      }
    } catch (e) {}
  }

  function invalidateAuthGetShortCache() {
    _authGetShortCache.clear();
  }

  function scheduleTrackFlush() {
    if (_trackFlushTimer) return;
    _trackFlushTimer = setTimeout(function () {
      _trackFlushTimer = null;
      flushTrackQueue();
    }, 400);
  }

  function flushTrackQueue() {
    if (!_trackQueue.length) return;
    if (_authGetInFlight.size > 0 || Date.now() - _pageBootAt < TRACK_BOOT_QUIET_MS) {
      scheduleTrackFlush();
      return;
    }
    var jobs = _trackQueue.splice(0, _trackQueue.length);
    var i = 0;
    function next() {
      if (i >= jobs.length) return;
      try {
        jobs[i++]();
      } catch (e) {}
      if (i < jobs.length) {
        setTimeout(next, 80);
      }
    }
    next();
  }

  function runTrackWhenIdle(fn) {
    if (typeof fn !== 'function') return;
    if (_authGetInFlight.size > 0 || Date.now() - _pageBootAt < TRACK_BOOT_QUIET_MS) {
      _trackQueue.push(fn);
      scheduleTrackFlush();
      return;
    }
    fn();
  }

  function extractApiActionHint(url, opts) {
    var action = '';
    try {
      var u = String(url || '');
      var qIdx = u.indexOf('?');
      if (qIdx >= 0) {
        var qs = u.slice(qIdx + 1);
        var parts = qs.split('&');
        for (var i = 0; i < parts.length; i++) {
          var kv = parts[i].split('=');
          if (decodeURIComponent(kv[0] || '') === 'action') {
            action = decodeURIComponent(kv[1] || '').trim();
            break;
          }
        }
      }
    } catch (eQ) {}
    if (!action && opts && opts.body != null) {
      try {
        var raw = opts.body;
        if (typeof raw === 'string' && raw.charAt(0) === '{') {
          var j = JSON.parse(raw);
          if (j && j.action != null) action = String(j.action).trim();
        }
      } catch (eB) {}
    }
    if (action.length > 80) action = action.substring(0, 80);
    return action;
  }

  function authParseJson(r, fallbackMsg) {
    if (typeof r.text !== 'function') {
      return Promise.resolve(r.json ? r.json() : {}).catch(function () {
        throw new Error((fallbackMsg || '接口返回无法解析') + '（HTTP ' + r.status + '）');
      });
    }
    return r.text().then(function (text) {
      var s = String(text == null ? '' : text).trim();
      if (!s) {
        throw new Error((fallbackMsg || '服务器无响应') + '（HTTP ' + r.status + '）');
      }
      try {
        return JSON.parse(s);
      } catch (e0) {
        if (s.charAt(0) === '<') {
          throw new Error('服务暂时不可用，请稍后重试（HTTP ' + r.status + '）');
        }
        throw new Error((fallbackMsg || '接口返回无法解析') + '（HTTP ' + r.status + '）');
      }
    });
  }

  function authFetch(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, authHeaders(), opts.headers || {});
    var method = String(opts.method || 'GET').toUpperCase();
    var coalesceKey = null;
    if (method === 'GET') {
      coalesceKey = String(url || '');
      var existing = _authGetInFlight.get(coalesceKey);
      if (existing) {
        return existing;
      }
      if (isShortCacheableGetUrl(url) && !opts.cacheBust) {
        var cachedRes = readAuthGetShortCache(url);
        if (cachedRes) {
          try {
            cachedRes.__perfNetMs = 0;
            cachedRes.__perfRoute = '';
            cachedRes.__fromShortCache = true;
          } catch (eC) {}
          return Promise.resolve(cachedRes);
        }
      }
    } else if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
      invalidateAuthGetShortCache();
    }
    var reqStart =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    var pathHint = String(url || '').split('?')[0];
    var actionHint = extractApiActionHint(url, opts);
    var routeHint = actionHint ? pathHint + '#' + actionHint : pathHint;
    var controller = null;
    var timeoutId = null;
    var fetchOpts = opts;
    var timeoutMs =
      opts.timeoutMs != null && isFinite(Number(opts.timeoutMs))
        ? Math.max(1000, Math.min(Math.round(Number(opts.timeoutMs)), 120000))
        : AUTH_FETCH_TIMEOUT_MS;
    if (typeof AbortController === 'function' && !opts.signal) {
      controller = new AbortController();
      fetchOpts = Object.assign({}, opts, { signal: controller.signal });
      timeoutId = setTimeout(function () {
        try {
          controller.abort();
        } catch (eAbort) {}
      }, timeoutMs);
    }
    var p = fetch(url, fetchOpts)
      .then(function (r) {
        var reqEnd =
          typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();
        var netMs = Math.max(0, Math.round(reqEnd - reqStart));
        try {
          r.__perfNetMs = netMs;
          r.__perfRoute = routeHint;
        } catch (ePerf) {}
        if (netMs >= API_PERF_SLOW_MS) {
          reportApiPerf({
            route_key: routeHint,
            method: method,
            action: actionHint || undefined,
            net_ms: netMs,
            render_ms: 0,
            total_ms: netMs,
            http_status: r.status
          });
        }
        if (method === 'GET' && isShortCacheableGetUrl(url) && r.status === 200) {
          return r
            .clone()
            .text()
            .then(function (text) {
              writeAuthGetShortCache(url, r, text);
              return r;
            })
            .catch(function () {
              return r;
            });
        }
        if (r.status === 401) {
          return r.text().then(function (text) {
            var sentAuth = '';
            try {
              var hdrs = opts.headers || {};
              if (typeof hdrs.get === 'function') {
                sentAuth = String(hdrs.get('Authorization') || hdrs.get('authorization') || '').trim();
              } else {
                sentAuth = String(hdrs.Authorization || hdrs.authorization || '').trim();
              }
            } catch (eHdr) {}
            var j = null;
            try {
              j = JSON.parse(text);
            } catch (e) {}
            /* 未带 Bearer 的 401 不得清会话，避免并发裸请求误杀刚登录的 token */
            if (!sentAuth) {
              return Promise.reject(new Error('unauthorized'));
            }
            clearSession();
            if (j && j.banned) {
              try {
                alert('账号已被封禁');
              } catch (e2) {}
            } else if (j && j.activation_expired) {
              try {
                alert('试用已过期，请重新登录');
              } catch (eExp) {}
            } else if (j && j.session_revoked) {
              try {
                alert('登录已失效，请重新登录');
              } catch (e3) {}
            }
            window.location.href = LOGIN_PAGE;
            return Promise.reject(new Error('unauthorized'));
          });
        }
        if (r.status === 403) {
          return r.text().then(function (text) {
            var j = null;
            try {
              j = JSON.parse(text);
            } catch (e) {}
            if (j && j.banned) {
              clearSession();
              try {
                alert('账号已被封禁');
              } catch (e4) {}
              window.location.href = LOGIN_PAGE;
              return Promise.reject(new Error('banned'));
            }
            if (j && j.need_activation) {
              try {
                localStorage.setItem('account_active', '0');
              } catch (e2) {}
              var err = new Error('need_activation');
              err.need_activation = true;
              return Promise.reject(err);
            }
            return Promise.reject(new Error('forbidden'));
          });
        }
        return r;
      })
      .catch(function (err) {
        var reqEnd =
          typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();
        var netMs = Math.max(0, Math.round(reqEnd - reqStart));
        var aborted =
          (err && err.name === 'AbortError') ||
          (controller && controller.signal && controller.signal.aborted);
        if (aborted || netMs >= API_PERF_SLOW_MS) {
          reportApiPerf({
            route_key: routeHint,
            method: method,
            action: actionHint || undefined,
            net_ms: netMs,
            render_ms: 0,
            total_ms: netMs,
            http_status: aborted ? 408 : 0
          });
        }
        if (aborted) {
          var timeoutErr = new Error('network_timeout');
          timeoutErr.timeout = true;
          timeoutErr.route = routeHint;
          return Promise.reject(timeoutErr);
        }
        return Promise.reject(err);
      })
      .finally(function () {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      });
    if (coalesceKey) {
      var shared = p.finally(function () {
        if (_authGetInFlight.get(coalesceKey) === shared) {
          _authGetInFlight.delete(coalesceKey);
        }
        scheduleTrackFlush();
      });
      _authGetInFlight.set(coalesceKey, shared);
      return shared;
    }
    return p;
  }

  /* 尽早挂到 window：避免 IIFE 后半段初始化异常时，业务页裸调 authFetch 报 ReferenceError */
  try {
    window.authGetToken = getToken;
    window.authHeaders = authHeaders;
    window.authFetch = authFetch;
    window.authParseJson = authParseJson;
    window.authClearSession = clearSession;
  } catch (eEarlyAuthExport) {}

  function detectNetType() {
    try {
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      if (c && c.effectiveType) return String(c.effectiveType).substring(0, 32);
      if (c && c.type) return String(c.type).substring(0, 32);
    } catch (e) {}
    return '';
  }

  function detectViewport() {
    try {
      var w = window.innerWidth || 0;
      var h = window.innerHeight || 0;
      return String(w) + 'x' + String(h);
    } catch (e2) {
      return '';
    }
  }

  /**
   * 上报接口/渲染耗时（仅总耗时或网络耗时 ≥ 3s 写入异常明细）。
   * meta: { route_key, method, action, net_ms, render_ms, total_ms, item_count, page_path, http_status }
   */
  function reportApiPerf(meta) {
    try {
      var m = meta && typeof meta === 'object' ? meta : {};
      var netMs = Math.max(0, Math.round(Number(m.net_ms) || 0));
      var renderMs = Math.max(0, Math.round(Number(m.render_ms) || 0));
      var totalMs = Math.max(0, Math.round(Number(m.total_ms) || netMs + renderMs));
      if (totalMs < API_PERF_SLOW_MS && netMs < API_PERF_SLOW_MS) return;
      var now = Date.now();
      if (now - _apiPerfLastReportAt < 800) return;
      _apiPerfLastReportAt = now;
      var routeKey = String(m.route_key || m.route || m.url || '').substring(0, 240);
      var action = m.action != null ? String(m.action).trim() : '';
      if (action && routeKey && routeKey.indexOf('#') < 0) {
        routeKey = (routeKey + '#' + action).substring(0, 240);
      }
      var payload = {
        route_key: routeKey,
        method: m.method != null ? String(m.method).toUpperCase().substring(0, 16) : undefined,
        action: action || undefined,
        net_ms: netMs,
        render_ms: renderMs,
        total_ms: totalMs,
        item_count: m.item_count != null ? m.item_count : m.comment_count,
        page_path: m.page_path || (window.location && window.location.pathname) || '',
        viewport: m.viewport || detectViewport(),
        net_type: m.net_type || detectNetType(),
        http_status: m.http_status,
        client_id: typeof getOrCreateClientDeviceId === 'function' ? getOrCreateClientDeviceId() : ''
      };
      if (!payload.route_key) return;
    } catch (e) {}
  }

  /**
   * 测量：网络耗时 + 渲染耗时（适配列表/评论类页面）。
   * fetchPromise: Promise<Response> 或已带 __perfNetMs 的 Response
   * renderFn: 同步渲染函数，返回条数（可选）
   */
  function measureFetchAndRender(fetchPromise, renderFn, meta) {
    var base = meta && typeof meta === 'object' ? meta : {};
    var t0 =
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();
    return Promise.resolve(fetchPromise).then(function (resOrData) {
      var netMs =
        resOrData && resOrData.__perfNetMs != null
          ? Number(resOrData.__perfNetMs)
          : Math.max(
              0,
              Math.round(
                ((typeof performance !== 'undefined' && performance.now
                  ? performance.now()
                  : Date.now()) -
                  t0)
              )
            );
      var renderStart =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now();
      var itemCount = 0;
      if (typeof renderFn === 'function') {
        var out = renderFn(resOrData);
        if (typeof out === 'number' && isFinite(out)) itemCount = out;
      }
      var renderEnd =
        typeof performance !== 'undefined' && typeof performance.now === 'function'
          ? performance.now()
          : Date.now();
      var renderMs = Math.max(0, Math.round(renderEnd - renderStart));
      var total = netMs + renderMs;
      reportApiPerf(
        Object.assign({}, base, {
          net_ms: netMs,
          render_ms: renderMs,
          total_ms: total,
          item_count: base.item_count != null ? base.item_count : itemCount
        })
      );
      return {
        result: resOrData,
        net_ms: netMs,
        render_ms: renderMs,
        total_ms: total
      };
    });
  }

  function hasUserToken() {
    return !!getToken();
  }

  function sanitizeTrackKey(raw) {
    var s = String(raw || '').toLowerCase();
    s = s.replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
    if (!s) s = 'unknown';
    return s.substring(0, 80);
  }

  /** 不得进入埋点路径 / track_jump 键名的查询参数（避免账号、手机号等进入聚合键） */
  var TRACK_QUERY_PARAM_DENY =
    /^(user_id|userid|username|phone|mobile|tel|token|access_token|refresh_token|authorization|pwd|password|secret|code_challenge)$/i;

  function stripSensitiveSearchParams(searchParams) {
    if (!searchParams || typeof searchParams.forEach !== 'function') return '';
    var pairs = [];
    try {
      searchParams.forEach(function (value, key) {
        if (TRACK_QUERY_PARAM_DENY.test(String(key))) return;
        var v = String(value == null ? '' : value).trim();
        if (!v) return;
        pairs.push({ k: String(key), v: v });
      });
    } catch (e) {}
    if (!pairs.length) return '';
    pairs.sort(function (a, b) {
      return String(a.k).localeCompare(String(b.k));
    });
    return (
      '?' +
      pairs
        .map(function (p) {
          return encodeURIComponent(p.k) + '=' + encodeURIComponent(p.v);
        })
        .join('&')
    );
  }

  function normalizeTrackPath(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';
    var base = '';
    try {
      base =
        typeof window !== 'undefined' && window.location && window.location.href
          ? window.location.href
          : 'http://localhost/';
    } catch (e0) {
      base = 'http://localhost/';
    }
    try {
      var u = /^https?:\/\//i.test(s) ? new URL(s) : new URL(s, base);
      var path = u.pathname || '';
      s = path + stripSensitiveSearchParams(u.searchParams);
    } catch (e) {
      var qi = s.indexOf('?');
      var hi = s.indexOf('#');
      var cut = s.length;
      if (hi >= 0) cut = Math.min(cut, hi);
      if (qi >= 0) cut = Math.min(cut, qi);
      s = s.substring(0, cut);
    }
    if (!s) return '';
    if (s.charAt(0) !== '/') s = '/' + s;
    s = s.replace(/\/+/g, '/');
    if (s.length > 255) s = s.substring(0, 255);
    return s;
  }

  function fireTrack(action, pagePath, meta) {
    if (!hasUserToken()) return;
    var act = sanitizeTrackKey(action);
    var payload = { action: act };
    if (meta && typeof meta === 'object') payload.meta = meta;
    var headers = Object.assign({}, authHeaders(), {
      'X-Page-Path': normalizeTrackPath(pagePath || '/event/' + act)
    });
    runTrackWhenIdle(function () {
      fetch('api/user', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function () {});
    });
  }

  /** 未登录也可上报（注册页等），走 auth.php#track_* */
  function firePublicTrack(action, pagePath, meta) {
    var act = sanitizeTrackKey(action);
    if (!/^track_[a-z0-9_]{1,80}$/.test(act)) return;
    var payload = { action: act };
    var publicMeta = meta && typeof meta === 'object' ? Object.assign({}, meta) : {};
    var landingVariant = getLandingAbVariant();
    if (landingVariant && !publicMeta.landing_variant) {
      publicMeta.landing_variant = landingVariant;
    }
    if (Object.keys(publicMeta).length) payload.meta = publicMeta;
    var headers = { 'Content-Type': 'application/json' };
    if (typeof getClientDeviceHeaders === 'function') {
      headers = Object.assign(headers, getClientDeviceHeaders());
    }
    headers['X-Page-Path'] = normalizeTrackPath(pagePath || '/event/' + act);
    runTrackWhenIdle(function () {
      fetch('api/auth', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function () {});
    });
  }

  window.isCordovaTaxAppShell = isCordovaTaxAppShell;
  window.isIosStandaloneApp = isIosStandaloneApp;
  window.isInstalledAppClient = isInstalledAppClient;
  window.markInstalledAppClient = markInstalledAppClient;
  window.authGetToken = getToken;
  window.authHeaders = authHeaders;
  window.authFetch = authFetch;
  window.authParseJson = authParseJson;
  window.authClearSession = clearSession;
  window.reportApiPerf = reportApiPerf;
  window.measureFetchAndRender = measureFetchAndRender;
  window.getClientDeviceHeaders = getClientDeviceHeaders;
  window.buildClientDevicePayload = buildClientDevicePayload;
  window.getOrCreateClientDeviceId = getOrCreateClientDeviceId;
  window.getLandingAbAssignment = getLandingAbAssignment;
  window.getLandingAbVariant = getLandingAbVariant;
  window.setLandingAbAssignment = setLandingAbAssignment;
  window.getPurchaseAbcAssignment = getPurchaseAbcAssignment;
  window.getPurchaseAbcVariant = getPurchaseAbcVariant;
  window.setPurchaseAbcAssignment = setPurchaseAbcAssignment;
  window.forcePurchaseAbcAssignment = forcePurchaseAbcAssignment;
  window.applyChannelForcedPricingAbc = applyChannelForcedPricingAbc;
  window.migratePurchaseAbcFromLanding = migratePurchaseAbcFromLanding;
  window.allocatePurchaseAbcFromPercents = allocatePurchaseAbcFromPercents;
  window.markInstallGuideReferral = markInstallGuideReferral;
  window.hasInstallGuideReferral = hasInstallGuideReferral;
  window.clearInstallGuideReferral = clearInstallGuideReferral;
  window.consumeInstallGuideReferral = consumeInstallGuideReferral;
  window.markShareAttribution = markShareAttribution;
  window.hasShareAttribution = hasShareAttribution;
  window.clearShareAttribution = clearShareAttribution;
  window.getShareAttribution = getShareAttribution;
  window.trackShareDownloadClick = trackShareDownloadClick;
  window.getSalesChannel = getSalesChannel;
  window.getRegisterSalesChannel = getRegisterSalesChannel;
  window.captureRegisterSourceFromUrl = captureRegisterSourceFromUrl;
  window.getRegisterSourceChannel = getRegisterSourceChannel;
  window.clearRegisterSourceChannel = clearRegisterSourceChannel;
  window.registerSourceChannelLabel = registerSourceChannelLabel;
  window.getPublicInstallPackagesUrl = getPublicInstallPackagesUrl;
  window.isDistributorApp = isDistributorApp;
  window.isInAppRegisterDisabled = isInAppRegisterDisabled;
  window.applyXianyuPurchaseVisibility = applyXianyuPurchaseVisibility;
  window.persistSalesChannelAttribution = persistSalesChannelAttribution;
  window.resolveSalesChannelFromServer = resolveSalesChannelFromServer;
  window.appendSalesChannelToUrl = appendSalesChannelToUrl;
  window.buildShareUrl = buildShareUrl;
  window.sharePageLink = sharePageLink;
  window.shareToBilibili = shareToBilibili;
  window.BILIBILI_SHARE_URL = BILIBILI_SHARE_URL;
  window.isMineShareDone = isMineShareDone;
  window.markMineShareCompleted = markMineShareCompleted;
  window.markMineSharePending = markMineSharePending;
  window.finalizeMineShareIfPending = finalizeMineShareIfPending;
  window.ensureBilibiliShareBeforeTaxGenerate = ensureBilibiliShareBeforeTaxGenerate;
  window.DEFAULT_SHARE_LAND_QUERY = DEFAULT_SHARE_LAND_QUERY;
  window.copyTextToClipboard = copyTextToClipboard;
  window.sanitizeLoginNext = sanitizeLoginNext;
  window.getLoginNextTarget = getLoginNextTarget;
  window.buildLoginPageUrl = buildLoginPageUrl;
  window.refreshPublicInstallPackagesUi = refreshPublicInstallPackagesUi;
  window.getCachedPublicInstallPackages = getCachedPublicInstallPackages;
  window.fetchPublicInstallPackages = fetchPublicInstallPackages;
  window.resolveSupportQqAddUrl = resolveSupportQqAddUrl;
  window.openSupportQqAddUrl = openSupportQqAddUrl;
  window.showPaymentCreateFailDialog = showPaymentCreateFailDialog;
  window.trackUserAction = function (action, meta) {
    fireTrack(action, '/event/' + sanitizeTrackKey(action), meta || {});
  };
  window.trackPublicAction = function (action, meta) {
    firePublicTrack(action, '/event/' + sanitizeTrackKey(action), meta || {});
  };
  try {
    bootstrapShareAttributionFromUrl();
  } catch (eShareBoot) {}

  (function injectToastDuration() {
    if (typeof window.TOAST_DURATION_MS === 'number') return;
    if (document.querySelector('script[data-toast-duration]')) return;
    var s = document.createElement('script');
    s.src = '/js/toast-duration.js?v=20260529-toast-3s';
    s.setAttribute('data-toast-duration', '1');
    s.async = true;
    document.head.appendChild(s);
  })();

  (function injectConversionGuide() {
    if (currentPageName() === 'admin_panel.html') return;
    /* 公开页未登录不注入；已登录即使在公开页也注入 */
    if (isPublicPage() && !getToken()) return;
    /* 明细/计算等只读页不注入转化引导，减少约 60KB JS 解析与执行 */
    var skipCg = {
      'xiangqing.html': true,
      'shuikuanjisuan.html': true,
      'shenbao_jilu_detail.html': true,
      'shenbao_income_detail.html': true
    };
    if (skipCg[currentPageName()]) return;
    if (!getToken()) return;
    if (document.querySelector('script[data-conversion-guide]')) return;
    var s = document.createElement('script');
    s.src = '/js/conversion-guide.js?v=20260905-no-home-refund';
    s.setAttribute('data-conversion-guide', '1');
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  })();

  (function injectPageLoadingAssets() {
    if (isPublicPage() && !getToken()) {
      return;
    }
    var page = currentPageName();
    if (page === 'admin_panel.html') {
      return;
    }
    var primaryTabPages = {
      'shouye.html': true,
      'daiban.html': true,
      'bancha.html': true,
      'message.html': true,
      'mine.html': true,
      'mine_mate60_aug12.html': true
    };
    var isPrimaryTab = !!primaryTabPages[page];
    window.__pageLoadingQueue = window.__pageLoadingQueue || [];
    if (typeof window.showPageLoading !== 'function') {
      window.showPageLoading = function () {
        window.__pageLoadingQueue.push(['show']);
      };
      window.hidePageLoading = function () {
        window.__pageLoadingQueue.push(['hide']);
      };
      window.forceHidePageLoading = function () {
        window.__pageLoadingQueue.push(['force']);
      };
    }
    /* 底栏主 Tab（含 Mate60 冻结「我的」）不预入队 show */
    if (!isPrimaryTab) {
      window.__pageLoadingQueue.push(['show']);
    }
    if (!document.querySelector('script[data-app-page-loading-js]')) {
      var s = document.createElement('script');
      s.src = '/js/page-loading.js?v=20260903-mate60pay';
      s.setAttribute('data-app-page-loading-js', '1');
      s.async = false;
      document.head.appendChild(s);
    }
  })();

  (function injectFastNav() {
    if (isPublicPage() && !getToken()) return;
    if (currentPageName() === 'admin_panel.html') return;
    if (document.querySelector('script[data-fast-nav-js]')) return;
    var s = document.createElement('script');
    s.src = '/js/fast-nav.js?v=20260811-bfcache-hide';
    s.setAttribute('data-fast-nav-js', '1');
    s.async = true;
    document.head.appendChild(s);
  })();

  (function injectMessageBadge() {
    function run() {
      if (isPublicPage() && !getToken()) return;
      if (currentPageName() === 'admin_panel.html') return;
      if (!document.querySelector('.bottom-nav')) return;
      if (document.querySelector('script[data-message-badge-js]')) return;
      var s = document.createElement('script');
      s.src = '/js/message-badge.js?v=20260807-msg-badge';
      s.setAttribute('data-message-badge-js', '1');
      s.async = true;
      document.head.appendChild(s);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
  })();

  if (!isPublicPage()) {
    if (!getToken()) {
      var curPage = currentPageName();
      var loginExtras = {};
      try {
        if (new URLSearchParams(window.location.search).get('from') === 'share') {
          loginExtras.from = 'share';
        }
      } catch (eFrom) {}
      window.location.replace(buildLoginPageUrl(curPage, loginExtras));
      return;
    }
    if (isActivationPage()) {
      if (isAccountActive()) {
        window.location.replace('shouye.html');
      }
      return;
    }
    /* 未激活也可浏览业务页，在个人中心（consult）等处激活 */
  } else {
    var page = currentPageName();
    if ((page === 'index.html' || page === 'login.html') && getToken()) {
      var nextTarget = getLoginNextTarget();
      if (nextTarget) {
        window.location.replace(appendSalesChannelToUrl(nextTarget));
        return;
      }
      if (isAccountActive()) {
        window.location.replace('shouye.html');
      } else {
        if ((page === 'login.html' || page === 'index.html') && isActivationPage()) {
          return;
        }
        window.location.replace('shouye.html');
      }
    }
    /* 未登录访问入口 index：交给 index.html 脚本跳到首页；此处兜底 */
    if (page === 'index.html' && !getToken() && !isActivationPage()) {
      try {
        var qs = window.location.search || '';
        var hs = window.location.hash || '';
        window.location.replace('shouye.html' + qs + hs);
      } catch (eIdx) {
        window.location.replace('shouye.html');
      }
    }
  }

  (function applyDistributorAppUi() {
    if (!isInAppRegisterDisabled()) {
      return;
    }
    if (currentPageName() === 'register.html') {
      window.location.replace('login.html');
      return;
    }
    function hideRegisterEntry() {
      document.querySelectorAll('a.register-btn, a[href*="register.html"]').forEach(function (el) {
        el.style.display = 'none';
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', hideRegisterEntry);
    } else {
      hideRegisterEntry();
    }
  })();

  /** App 壳首次打开：补齐下载→打开漏斗的 C 段（localStorage 去重，按 client_id 上报） */
  (function appShellFirstOpenTrack() {
    if (!isCordovaTaxAppShell()) {
      return;
    }
    if (currentPageName() === 'admin_panel.html') {
      return;
    }
    var KEY = 'app_shell_first_open_v1';
    try {
      if (localStorage.getItem(KEY) === '1') {
        return;
      }
      localStorage.setItem(KEY, '1');
    } catch (e0) {
      return;
    }
    function fireFirstOpen() {
      if (typeof trackPublicAction !== 'function') {
        return;
      }
      trackPublicAction('track_app_first_open', {
        page: currentPageName(),
        logged_in: !!getToken(),
        shell: 'cordova'
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fireFirstOpen);
    } else {
      fireFirstOpen();
    }
  })();

  (function appShellRegisterPrompt() {
    if (!isCordovaTaxAppShell()) {
      return;
    }
    if (isInAppRegisterDisabled()) {
      return;
    }
    if (getToken()) {
      return;
    }
    if (currentPageName() === 'admin_panel.html' || currentPageName() === 'register.html') {
      return;
    }
    var KEY = 'app_shell_register_prompt_v1';
    try {
      if (localStorage.getItem(KEY) === '1') {
        return;
      }
    } catch (e0) {
      return;
    }

    function markPromptSeen() {
      try {
        localStorage.setItem(KEY, '1');
      } catch (e1) {}
    }

    function injectPromptStyles() {
      if (document.getElementById('app-shell-register-prompt-style')) {
        return;
      }
      var style = document.createElement('style');
      style.id = 'app-shell-register-prompt-style';
      style.textContent =
        '.app-shell-register-root{position:fixed;inset:0;z-index:10060;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;}' +
        '.app-shell-register-mask{position:absolute;inset:0;background:rgba(0,0,0,.45);}' +
        '.app-shell-register-panel{position:relative;width:100%;max-width:320px;background:#fff;border-radius:12px;padding:20px 16px 14px;box-shadow:0 8px 28px rgba(0,0,0,.18);}' +
        '.app-shell-register-title{font-size:17px;font-weight:600;color:#333;margin:0 0 10px;line-height:1.35;}' +
        '.app-shell-register-msg{font-size:14px;color:#666;line-height:1.55;margin:0 0 16px;}' +
        '.app-shell-register-actions{display:flex;flex-direction:column;gap:10px;}' +
        '.app-shell-register-btn{width:100%;min-height:44px;padding:10px 14px;border-radius:8px;font-size:15px;border:none;cursor:pointer;-webkit-tap-highlight-color:transparent;}' +
        '.app-shell-register-btn-primary{background:#1e6fff;color:#fff;font-weight:600;}' +
        '.app-shell-register-btn-secondary{background:#f0f0f0;color:#666;}';
      document.head.appendChild(style);
    }

    function showPrompt() {
      injectPromptStyles();
      var root = document.createElement('div');
      root.className = 'app-shell-register-root';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      var hadGuestHint = false;
      try {
        hadGuestHint =
          localStorage.getItem('landing_guest_v1') === '1' ||
          sessionStorage.getItem('landing_bc_entry_v1') != null;
      } catch (eHint) {}
      root.innerHTML =
        '<div class="app-shell-register-mask" data-action="later"></div>' +
        '<div class="app-shell-register-panel">' +
        '<p class="app-shell-register-title">' +
        (hadGuestHint ? '注册并同步游客资料' : '安装成功，先注册账号') +
        '</p>' +
        '<p class="app-shell-register-msg">' +
        (hadGuestHint
          ? '注册后可将网页游客体验中填写的个税与资料同步到本账号，再输入激活码即可正式使用。'
          : '注册账号后，输入激活码即可保存个税演示数据；同一设备上的游客体验资料也会自动合并。') +
        '</p>' +
        '<div class="app-shell-register-actions">' +
        '<button type="button" class="app-shell-register-btn app-shell-register-btn-primary" data-action="register">立即注册</button>' +
        '<button type="button" class="app-shell-register-btn app-shell-register-btn-secondary" data-action="later">稍后再说</button>' +
        '</div></div>';
      document.body.appendChild(root);

      function closePrompt() {
        if (root.parentNode) {
          root.parentNode.removeChild(root);
        }
      }

      root.addEventListener('click', function (e) {
        var el = e.target.closest('[data-action]');
        if (!el) {
          return;
        }
        var action = el.getAttribute('data-action');
        markPromptSeen();
        if (action === 'register') {
          if (typeof markInstallGuideReferral === 'function') {
            markInstallGuideReferral('app_shell_first_open');
          }
          if (typeof trackPublicAction === 'function') {
            trackPublicAction('track_install_app_shell_register_prompt_ok', { page: currentPageName() });
          }
          closePrompt();
          var regUrl = 'register.html?from=install_guide';
          try {
            var ch =
              typeof getSalesChannel === 'function' ? String(getSalesChannel() || '').trim() : '';
            if (ch) {
              regUrl += '&ch=' + encodeURIComponent(ch);
            }
          } catch (eCh) {}
          window.location.href = regUrl;
          return;
        }
        if (action === 'later') {
          if (typeof trackPublicAction === 'function') {
            trackPublicAction('track_install_app_shell_register_prompt_later', { page: currentPageName() });
          }
          closePrompt();
        }
      });

      if (typeof trackPublicAction === 'function') {
        trackPublicAction('track_install_app_shell_register_prompt_show', { page: currentPageName() });
      }
    }

    function schedulePrompt() {
      setTimeout(showPrompt, 500);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', schedulePrompt);
    } else {
      schedulePrompt();
    }
  })();

  (function loadBackArrowAssets() {
    var v = '20260525-jt';
    try {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/css/back-arrow.css?v=' + v;
      document.head.appendChild(link);
    } catch (e) {}
    try {
      var s = document.createElement('script');
      s.src = '/js/back-arrow.js?v=' + v;
      document.head.appendChild(s);
    } catch (e) {}
  })();
})();
