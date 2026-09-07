/**
 * 登录态与 C 端壳：JWT 存 localStorage.token；未登录访问受保护页面时跳转登录页。
 *
 * 架构分工：
 * - auth-boot.js：同步优先（首屏门禁、公开页判断、立刻要用的轻量 API / 安全区 class）；
 * - 本文件 defer：设备/OEM CSS、顶栏与 safe-area、渠道归因、authFetch 全量实现、脚本注入。
 *
 * 动态注入（见文末 IIFE；部分带 email-reg 等版本戳，以实际 ?v= 为准）：
 * conversion-guide.js、fast-nav.js、page-loading.js、page-perf.js、tab-shell.js、message-badge.js。
 *
 * 受保护接口请使用 authFetch（自动带 Authorization + X-Client-Device，401 时清理并跳转）。
 * WebView / App 可设置 window.CLIENT_APP_VERSION；可选 window.buildClientDevicePayloadHook(base) 合并字段。
 * Cordova 壳在 UA 中追加 TaxPlatformCordovaApp（config AppendUserAgent），H5 可识别壳内环境。
 *
 * Mate60「我的」冻结页走独立分叉 auth-mate60-aug12.js，勿假定本文件在该页运行。
 */
(function () {
  // === 常量 / early authFetch 占位 ===
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
  /** 渠道包 / 壳内归因来源：不过期 */
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

  function isFormDataBody(body) {
    try {
      return typeof FormData !== 'undefined' && !!body && body instanceof FormData;
    } catch (eFd) {
      return false;
    }
  }

  /**
   * 合并鉴权头。FormData 必须由浏览器带 multipart boundary，
   * 若写死 application/json，服务端会把 ------WebKitFormBoundary 当 JSON 解析失败。
   */
  function mergeAuthRequestHeaders(baseHeaders, opts) {
    opts = opts || {};
    var headers = Object.assign({}, baseHeaders || {}, opts.headers || {});
    if (isFormDataBody(opts.body)) {
      delete headers['Content-Type'];
      delete headers['content-type'];
    }
    return headers;
  }

  /** 尽早占位：后半段初始化异常时，业务页仍可用带 Bearer 的请求（正常路径会被真实 authFetch 覆盖） */
  function bearerTokenFetch(url, opts) {
    opts = opts || {};
    var headers = mergeAuthRequestHeaders(
      isFormDataBody(opts.body) ? {} : { 'Content-Type': 'application/json' },
      opts
    );
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
    'zhzh_jhm.html': true,
    'refund_ad.html': true,
    'douyin_yuefu_ad.html': true,
    'gjj_extract_ad.html': true,
    'sousuo.html': true,
    'zixun.html': true,
    'jingshi.html': true,
    'face_login.html': true,
    'scan.html': true,
    'zhongdian_fuwu.html': true
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

  // === Viewport / 壳内 / Cordova 检测 ===
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
    var ua = '';
    try {
      ua = String(navigator.userAgent || '');
    } catch (e) {}
    if (/iPhone|iPad|iPod/i.test(ua)) {
      return false;
    }
    if (/Android/i.test(ua)) {
      return true;
    }
    /* 鸿蒙 Next / 华为壳 UA 常无 Android，首页搜索会落到 padding:0 顶进状态栏 */
    if (/HarmonyOS|OpenHarmony|ArkWeb|HMSCore|HUAWEI|Huawei/i.test(ua)) {
      return true;
    }
    return isHuaweiMate60Client();
  }

  /** 首帧前只打安全区 class，避免等大段 OEM 样式时顶栏先歪 */
  function markViewportChromeClasses() {
    try {
      var root = document.documentElement;
      var ua = '';
      try {
        ua = String(navigator.userAgent || '');
      } catch (eUa) {}
      try {
        ua += ' ' + String(localStorage.getItem('tax_device_model_v1') || '');
      } catch (eModel) {}
      try {
        ua += ' ' + String(localStorage.getItem('tax_device_ua_v1') || '');
      } catch (eStoredUa) {}
      var ios =
        /iPhone|iPad|iPod/i.test(ua) ||
        (typeof navigator.platform === 'string' &&
          navigator.platform === 'MacIntel' &&
          navigator.maxTouchPoints > 1);
      var android =
        !ios &&
        (/Android/i.test(ua) ||
          /HarmonyOS|OpenHarmony|ArkWeb|HMSCore|HUAWEI|Huawei/i.test(ua) ||
          /Mate\s*60|ALN-AL/i.test(ua));
      if (android) {
        root.classList.add('app-android-client');
        root.classList.add('app-top-safe-shell');
      }
      if (ios) {
        root.classList.add('app-ios-client');
        root.classList.add('app-top-safe-shell');
      }
    } catch (eMark) {}
  }
  try {
    window.markViewportChromeClasses = markViewportChromeClasses;
  } catch (eExposeMark) {}

  // === OEM / 机型识别与 html class ===
  // 下列 isXxxClient 供顶栏/safe-area 与 setupMobileStatusBar 打 html class（华为/小米/vivo/iPhone 等）
  function getAndroidMajorVersion() {
    var m = String(navigator.userAgent || '').match(/Android\s+(\d+)/i);
    return m ? parseInt(m[1], 10) || 0 : 0;
  }

  function isTallAndroidStatusBarClient() {
    var ua = navigator.userAgent || '';
    if (/PKB110|B60P01/i.test(ua)) {
      return true;
    }
    /* 小米 14 改走外置黑条，勿再当「高状态栏」叠 56/72px */
    if (/Xiaomi\s*14|23127PN|2201PN/i.test(ua)) {
      return false;
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
      /CPH2797|CPH2791|CPH2841|CPH2873|PLJ110|PLG110|PMA110|PME110|OPG07|PKB110|PJE110|PJD110|PHJ110|PHP110/i.test(
        ua
      )
    ) {
      return true;
    }
    if (isOnePlusAce2VClient()) {
      return true;
    }
    if (isOppoK9xClient()) {
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

  /**
   * OPPO Reno10 5G（国行 PHW110 / 海外 CPH2531、CPH2525）。ColorOS 15 WebView 仍压在系统栏下，
   * 不可套用 OPPO 族「外置黑条 → inset 0」，否则顶栏返回/标题贴到系统时间。
   * 勿匹配 Reno10 Pro（PHV110）/ Reno10 Pro+（PHU110）。
   */
  function isOppoReno10Client() {
    var ua = clientUaBlob();
    if (/PHW110|CPH2531|CPH2525/i.test(ua)) {
      return true;
    }
    if (/Reno\s*10\s*Pro/i.test(ua)) {
      return false;
    }
    return /(?:OPPO\s*)?Reno\s*10\s*5G/i.test(ua);
  }

  /**
   * OPPO K9x（国行 PGCM10）：ColorOS 11.x 上 Cordova WebView 仍沉浸绘制、压在系统状态栏下，
   * env(safe-area-inset-top) 常为 0。不可套用 OPPO 族「外置黑条 → inset 0」，
   * 否则收入纳税明细顶栏「返回/标题」会顶进系统时间/信号栏（顶部 UI 重合）。
   * 勿匹配 K9（PEUM00）/ K9 Pro（PEXM00）/ K9s（PEPM00）。
   */
  function isOppoK9xClient() {
    var ua = clientUaBlob();
    return /PGCM10|\bK9x\b/i.test(ua);
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
   * 一加 12（国行 PJD110 / 海外 CPH2573·CPH2581·CPH2583）。ColorOS 16 WebView 仍压在系统栏下，
   * 不可套用 OPPO 族「外置黑条 → inset 0」，否则「收入纳税明细」返回/标题压到时间。
   * 勿匹配 12R（PJF110 / CPH2585 等）。
   */
  function isOnePlus12Client() {
    var ua = clientUaBlob();
    if (/PJD110|CPH2573|CPH2581|CPH2583/i.test(ua)) {
      return true;
    }
    if (/12R|12[\s_-]*R/i.test(ua)) {
      return false;
    }
    return /(?:OnePlus|一加)[\s_-]*12(?![A-Za-z0-9])/i.test(ua);
  }

  /**
   * 一加 Ace Pro（PGP110 / 海外 10T=CPH241x）。ColorOS 15 WebView 仍压在系统栏下，
   * 不可套用 OPPO 族「外置黑条 → inset 0」，否则「收入纳税明细」返回压到时间。
   * 勿匹配 Ace 2 Pro（PJA110）/ Ace 2（PHK110）/ Ace 2V（PHP110）。
   */
  function isOnePlusAceProClient() {
    var ua = clientUaBlob();
    if (/PGP110|CPH2413|CPH2415|CPH2417/i.test(ua)) {
      return true;
    }
    return /(?:OnePlus|一加)[\s_-]*Ace[\s_-]*Pro(?![\s_-]*2)/i.test(ua);
  }

  /**
   * 一加 Ace 2 Pro（PJA110）。ColorOS WebView 仍压在系统栏下，
   * 不可套用 OPPO 族「外置黑条 → inset 0」，否则「收入纳税明细」标题压到时间。
   * 勿匹配 Ace 2（PHK110）/ Ace 2V（PHP110）；Ace 2V 见 isOnePlusAce2VClient。
   */
  function isOnePlusAce2ProClient() {
    var ua = navigator.userAgent || '';
    if (/PJA110/i.test(ua)) {
      return true;
    }
    return /(?:OnePlus|一加)\s*Ace\s*2\s*Pro/i.test(ua);
  }

  /**
   * 一加 Ace 2V（PHP110）。白顶栏页 WebView 仍压在系统栏下，须留 40px；
   * 首页系统栏保持黑色，勿套沉浸蓝条。勿匹配 Ace 2 Pro（PJA110）/ Ace 2（PHK110）。
   */
  function isOnePlusAce2VClient() {
    var ua = clientUaBlob();
    if (/PHP110/i.test(ua)) {
      return true;
    }
    return /(?:OnePlus|一加)\s*Ace\s*2\s*V/i.test(ua);
  }

  /**
   * 一加 Ace 6（PLQ110）。ColorOS 16 WebView 仍压在系统栏下，
   * 不可套用 OPPO 族「外置黑条 → inset 0」，否则「收入纳税明细」返回/批量申诉压到时间。
   * 勿匹配 Ace 6 Pro。
   */
  function isOnePlusAce6Client() {
    var ua = clientUaBlob();
    if (/PLQ110/i.test(ua)) {
      return true;
    }
    return /(?:OnePlus|一加)[\s_-]*Ace[\s_-]*6(?![\s_-]*Pro)(?!\d)/i.test(ua);
  }

  /** 一加 12 / Ace Pro / Ace 2 Pro / Ace 2V / Ace 6 / Reno10 5G / OPPO K9x：ColorOS 沉浸压栏，白顶栏须留 40px */
  function isOnePlusAce2ImmersiveTopClient() {
    return (
      isOnePlus12Client() ||
      isOnePlusAceProClient() ||
      isOnePlusAce2ProClient() ||
      isOnePlusAce2VClient() ||
      isOnePlusAce6Client() ||
      isOppoReno10Client() ||
      isOppoK9xClient()
    );
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
    /* iQOO 13/15 及近世代际显式型号 */
    return /V2505A|I2501|V2408A|I2401|V2405A|V2405DA|V2413\b|V2419A|V2309A|V2241A|V2227A/i.test(ua);
  }

  /**
   * iQOO 13（国行 V2408A / 国际 I2401 / PD2408）：OriginOS Cordova WebView
   * 仍压在系统状态栏下，勿按 vivo 族「外置黑条」清零顶距，
   * 否则纳税明细「返回/批量申诉」会与系统时间重叠。
   */
  function isIqoo13Client() {
    var ua = clientUaBlob();
    return /V2408A|V2408BA|V2408GA|\bV2408\b|I2401\b|PD2408\b|iQOO\s*13(?![a-zA-Z0-9])/i.test(ua);
  }

  function isIqooMineTailPhone() {
    var root = typeof document !== 'undefined' ? document.documentElement : null;
    return (
      isIqoo13Client() ||
      isIqoo15Client() ||
      !!(root && (root.classList.contains('app-android-iqoo-13') || root.classList.contains('app-android-iqoo-15')))
    );
  }

  /**
   * iQOO 15（国行 V2505A / 国际 I2501 / PD2505）：OriginOS 6 Cordova WebView
   * 仍压在系统状态栏下，勿按 vivo 族「外置黑条」清零顶距，
   * 否则纳税明细「返回/批量申诉」会与系统时间重叠。
   */
  function isIqoo15Client() {
    var ua = clientUaBlob();
    return /V2505A|I2501\b|PD2505\b|iQOO\s*15(?![a-zA-Z0-9])/i.test(ua);
  }

  /**
   * 魅族 20 Pro（国行 M391Q / 早期 M2392；UA 常含 MZ-MEIZU 20 Pro）：
   * Flyme Cordova WebView 仍压在系统状态栏下，env(safe-area) 常为 0。
   * 勿按通用 Android 清零顶距，否则纳税明细「返回/批量申诉」会与系统时间/信号重叠。
   * 勿匹配标准版魅族 20（M381Q）。
   */
  function isMeizu20ProClient() {
    var ua = clientUaBlob();
    if (/M391Q|M2392\b/i.test(ua)) {
      return true;
    }
    return /(?:MZ-)?MEIZU[\s_-]*20[\s_-]*Pro|魅族[\s_-]*20[\s_-]*Pro/i.test(ua);
  }

  /**
   * iQOO Neo8 标准版（国行 V2301A / PD2301）：OriginOS Cordova WebView 仍压在系统栏下，
   * 勿按 vivo 族「外置黑条」清零顶距，否则纳税明细「返回」会与系统时间重叠。
   * 勿匹配 Neo8 Pro（V2302A / V2307A）。
   */
  function isIqooNeo8Client() {
    var ua = clientUaBlob();
    if (/V2301A|V2301B|PD2301\b/i.test(ua)) {
      return true;
    }
    return /iQOO\s*Neo\s*8(?!\s*Pro)/i.test(ua);
  }

  /**
   * iQOO Neo8 Pro（国行 V2302A / 另码 V2307A）：Cordova WebView 仍压在系统状态栏下，
   * 勿按 vivo 族「外置黑条」清零顶距，否则消息页「消息」、纳税明细「返回」会与系统时间重叠。
   */
  function isIqooNeo8ProClient() {
    var ua = clientUaBlob();
    if (/V2302A|V2302B|PD2302|V2307A\b/i.test(ua)) {
      return true;
    }
    return /iQOO\s*Neo\s*8\s*Pro|IQOO\s*Neo\s*8\s*Pro/i.test(ua);
  }

  /**
   * vivo X300 Pro（国行 V2502A / 卫通 V2502DA / 国际 V2514）：OriginOS 6 Cordova
   * WebView 仍压在系统状态栏下，勿按 vivo 族「外置黑条」清零顶距，否则「申诉」压到系统图标。
   * 勿匹配标准版 X300（V2509A 等）。
   */
  function isVivoX300ProLikeClient() {
    var ua = clientUaBlob();
    if (/V2502A|V2502DA|V2514\b|PD2502/i.test(ua)) {
      return true;
    }
    return /vivo[\s_-]*X300\s*Pro/i.test(ua);
  }

  /**
   * vivo S50 Pro mini（国行 V2527A）：OriginOS 6 Cordova WebView 仍压在系统状态栏下，
   * 勿按 vivo 族「外置黑条」清零顶距，否则纳税明细「返回」会与系统时间重叠。
   * Cordova device.model 常为「S50 Pro mini」（无 vivo 前缀），须单独匹配。
   * 勿匹配 S50 / S50 Pro（无 mini）。
   */
  function isVivoS50ProMiniClient() {
    var ua = clientUaBlob();
    if (/V2527A|V2527DA|V2527B|PD2527[A-Z]?|\bV2527\b/i.test(ua)) {
      return true;
    }
    return /(?:vivo[\s_-]*)?S50[\s_-]*Pro[\s_-]*[Mm]ini|S50Promini/i.test(ua);
  }

  /**
   * vivo X90（国行 V2241A / 国际 V2241EA）：OriginOS Cordova WebView 仍压在系统状态栏下，
   * 勿按 vivo 族「外置黑条」清零顶距，否则纳税明细「返回/申诉」会与系统时间、信号重叠。
   * 勿匹配 X90 Pro / X90 Pro+ / X90s（V2242A / V2227A 等）。
   */
  function isVivoX90Client() {
    var ua = clientUaBlob();
    if (/V2241A|V2241EA|PD2241\b/i.test(ua)) {
      return true;
    }
    return /(?:vivo[\s_-]*)?X90\b(?![\s_-]*(?:Pro|[sS]|Plus|\+))/i.test(ua);
  }

  /** vivo 族沉浸压栏机（Neo8 / Neo8 Pro / X200 Pro / mini / X300 Pro / S50 Pro mini / X90 / iQOO 13/15）：白顶栏须留 40px */
  function isVivoImmersiveTopClient() {
    return (
      isIqooNeo8Client() ||
      isIqooNeo8ProClient() ||
      isVivoX200ProLikeClient() ||
      isVivoX300ProLikeClient() ||
      isVivoS50ProMiniClient() ||
      isVivoX90Client() ||
      isIqoo13Client() ||
      isIqoo15Client()
    );
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
    var ua = clientUaBlob();
    return /Hi\s*nova|hinova|HINOVA|FIO-BD00|PHB-AN00|MIZ-BD00|MIZ-AL00|MIZ-AN00|MIZ-BD|MIZ-AL|MIZ-AN|BON-AL00|NCO-AL00|GIA-AL00|NAM-AL00/i.test(
      ua
    );
  }

  /**
   * Hi nova 9 SE（入网型号 FIO-BD00，系统/固件也可能上报 PHB-AN00）。
   * 该机白顶栏实际为沉浸式 WebView，不能沿用 Hi nova 族的外置状态栏清零规则。
   */
  function isHiNova9SeClient() {
    var ua = clientUaBlob();
    return /FIO-BD00|PHB-AN00|Hi\s*nova[\s_-]*9[\s_-]*SE|hinova[\s_-]*9[\s_-]*se/i.test(ua);
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
   * 小米 15（dada）：24129PN74C / 24129PN74G。
   * HyperOS 2 Cordova 仍沉浸压栏，不能按 mi-family「外置状态栏」清零顶距，
   * 否则收入纳税明细「返回 / 批量申诉」会顶进系统时间栏。不含 15 Pro / Ultra。
   */
  function isXiaomi15Client() {
    var ua = clientUaBlob();
    if (isXiaomi15ProClient()) return false;
    if (/25019PNF3|Xiaomi\s*15\s*Ultra|Mi\s*15\s*Ultra/i.test(ua)) return false;
    if (/24129PN74/i.test(ua)) return true;
    return /(?:Xiaomi|Mi|小米)[\s_-]*15(?![\s_-]*(?:Pro|Ultra|S))/i.test(ua);
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

  /**
   * 红米 K70 至尊版 / Ultra（2407FPN8EG / 2407FRK8EC 等）。
   * Cordova 仍常沉浸压栏，不能按 K70 族「外置黑条」清零顶距。
   */
  function isRedmiK70UltraClient() {
    var ua = navigator.userAgent || '';
    if (/2407FPN8E[GR]|2407FRK8EC|XIG06|A402XM/i.test(ua)) {
      return true;
    }
    return /(?:Redmi|Xiaomi)[\s_-]*K70[\s_-]*(?:至尊|Ultra)/i.test(ua);
  }

  /**
   * 红米 12C / POCO C55（水滴刘海）：22120RN86* / 22126RN91Y / 2212ARNC4L。
   * HyperOS 上 Cordova 仍叠系统栏，不能按 mi-family 清零顶距。
   */
  function isRedmi12CClient() {
    var ua = navigator.userAgent || '';
    if (/22120RN86[CGHI]|22126RN91Y|2212ARNC4L|22127PC95[GHI]/i.test(ua)) {
      return true;
    }
    return /(?:Redmi|POCO)[\s_-]*12C|POCO\s*C55/i.test(ua);
  }

  /**
   * Redmi Note 11 5G（21091116* / 22041216*）：HyperOS Cordova 仍压状态栏，白顶栏须 40px。
   */
  function isRedmiNote115GClient() {
    var ua = navigator.userAgent || '';
    if (/21091116|22041216/i.test(ua)) {
      return true;
    }
    return /(?:Redmi|REDMI)[\s_-]*Note[\s_-]*11(?![\s_-]*(?:Pro|T|SE|4G))/i.test(ua);
  }

  /** 小米/红米：WebView 仍压在状态栏/刘海下，白顶栏须留 40px */
  function isXiaomiImmersiveTopClient() {
    return (
      isXiaomi13Client() ||
      isXiaomi13ProClient() ||
      isXiaomi14ProClient() ||
      isXiaomi15ProClient() ||
      isXiaomi15Client() ||
      isXiaomi10NotchClient() ||
      isRedmiK70UltraClient() ||
      isRedmi12CClient() ||
      isRedmiNote115GClient() ||
      isRedmiK80ProClient() ||
      isAndroid25060RK16CClient()
    );
  }

  /** 系统状态栏在 WebView 外：首页/顶栏勿再叠 statusbar 占位 */
  function isAndroidOuterStatusBarClient() {
    if (
      isOnePlus13Client() ||
      isOnePlus12Client() ||
      isOnePlusAce2ProClient() ||
      isOnePlusAceProClient() ||
      isOnePlusAce6Client()
    ) {
      return false;
    }
    /* MIX Fold：Cordova 仍常沉浸占满，不能当外置黑条清零顶距 */
    if (isXiaomiMixFoldClient()) {
      return false;
    }
    /* 小米 15 Pro / 10 刘海 / K70 至尊 / 12C：WebView 压在状态栏下 */
    if (isXiaomiImmersiveTopClient()) {
      return false;
    }
    /* iQOO Neo8 / Neo8 Pro / iQOO 15 / vivo X200 Pro / mini / X300 Pro / S50 Pro mini：Cordova 沉浸，白顶栏须留顶距 */
    if (isVivoImmersiveTopClient()) {
      return false;
    }
    /* 魅族 20 Pro：Flyme Cordova 沉浸压栏，白顶栏须留顶距 */
    if (isMeizu20ProClient()) {
      return false;
    }
    /* Mate 30 / 30 Pro / 30E Pro / 60 / 70 / nova 13：Harmony 壳 overlays=false 常失效，须保留顶距 */
    if (
      isHuaweiMate30Client() ||
      isHuaweiLioAn00Client() ||
      isHuaweiMate60Client() ||
      isHuaweiMate70Client() ||
      isHuaweiNova13Client()
    ) {
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

  /** 收入纳税明细 / 筛选 / 详情：白顶栏页（按 body class 或路径） */
  function isAndroidWhiteStatusPage() {
    try {
      var body = document.body;
      if (body) {
        if (
          body.classList.contains('page-shuiming') ||
          body.classList.contains('page-shuiming-result') ||
          body.classList.contains('page-xiangqing')
        ) {
          return true;
        }
      }
    } catch (eBody) {}
    try {
      var p = String(window.location.pathname || '').split('/').pop() || '';
      return p === 'shuiming.html' || p === 'shuiming_result.html' || p === 'xiangqing.html';
    } catch (ePath) {}
    return false;
  }

  /**
   * 已核实「系统栏在 WebView 外」的白顶栏机：再叠 40px 会空出一条白带。
   * 仅这些走清零；其余 App 内 Android 白顶栏默认按沉浸压栏留顶距。
   */
  function isAndroidVerifiedOuterWhitePageClient() {
    return (
      isOppoA58Client() ||
      isOppoFindX9Client() ||
      isHonorFoldableOuterBarClient() ||
      isSamsungOneUiFamilyClient() ||
      isHuaweiPura70LikeClient() ||
      isXiaomi14LikeClient()
    );
  }

  /**
   * App 壳内 Android 白顶栏：默认沉浸 40px。
   * 不再按 ColorOS / OriginOS / HyperOS / Harmony 族名清零——新机未进 allowlist 就会把标题压进系统时间。
   * 首页 / 我的仍走各自规则，本函数不改变蓝顶页。
   */
  function isAndroidWhitePageImmersiveDefaultClient() {
    if (!isLikelyAndroidViewportClient()) {
      return false;
    }
    if (!isAndroidWhiteStatusPage()) {
      return false;
    }
    if (!isCordovaTaxAppShell() && !readInstalledAppClientFlag()) {
      return false;
    }
    if (isAndroidVerifiedOuterWhitePageClient()) {
      return false;
    }
    return true;
  }

  /** 小米 13（2211133C 等，不含 13 Pro）。HyperOS Cordova 仍压白状态栏，收入纳税明细须留 40px。 */
  function isXiaomi13Client() {
    var ua = clientUaBlob();
    if (isXiaomi13ProClient()) {
      return false;
    }
    return /2211133[CGI]|(?:Xiaomi|Mi|小米)[\s_-]*13\b/i.test(ua);
  }

  var DEVICE_MODEL_STORE = 'tax_device_model_v1';
  var DEVICE_UA_STORE = 'tax_device_ua_v1';

  function persistDeviceModelHint(raw) {
    var m = String(raw || '').trim();
    if (!m || m.length > 80) {
      return false;
    }
    try {
      var prev = String(localStorage.getItem(DEVICE_MODEL_STORE) || '');
      if (m !== prev) {
        localStorage.setItem(DEVICE_MODEL_STORE, m);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  function rememberCordovaDeviceModel() {
    try {
      var m = '';
      if (window.device && window.device.model) {
        m = String(window.device.model).trim();
      }
      if (!m && window.top && window.top !== window && window.top.device && window.top.device.model) {
        m = String(window.top.device.model).trim();
      }
      if (m) {
        persistDeviceModelHint(m);
      }
    } catch (e) {}
  }

  /** Chromium / 部分 ArkWeb：UA 无 ALN-AL10 时，用 Client Hints 补型号 */
  function hydrateDeviceModelHints(onDone) {
    var done = typeof onDone === 'function' ? onDone : function () {};
    rememberCordovaDeviceModel();
    try {
      var uad = navigator.userAgentData;
      if (!uad || typeof uad.getHighEntropyValues !== 'function') {
        done(false);
        return;
      }
      uad
        .getHighEntropyValues(['model', 'platform', 'platformVersion', 'uaFullVersion'])
        .then(function (hint) {
          var changed = false;
          try {
            var model = String((hint && hint.model) || '').trim();
            if (model) {
              changed = persistDeviceModelHint(model) || changed;
            }
          } catch (eHint) {}
          done(changed);
        })
        .catch(function () {
          done(false);
        });
    } catch (e0) {
      done(false);
    }
  }

  /** UA + Cordova device.model（壳内 UA 常无型号码） */
  function clientUaBlob() {
    var blob = '';
    try {
      blob += String(navigator.userAgent || '');
    } catch (e0) {}
    try {
      blob += ' ' + String(localStorage.getItem(DEVICE_MODEL_STORE) || '');
    } catch (eLs) {}
    try {
      blob += ' ' + String(localStorage.getItem(DEVICE_UA_STORE) || '');
    } catch (eUa) {}
    try {
      if (window.device && window.device.model) {
        blob += ' ' + String(window.device.model);
      }
    } catch (e1) {}
    try {
      if (window.top && window.top !== window && window.top.device && window.top.device.model) {
        blob += ' ' + String(window.top.device.model);
      }
    } catch (e2) {}
    rememberCordovaDeviceModel();
    return blob;
  }

  /**
   * 小米 13 Pro（2210132C / 2210132G）：HyperOS Cordova WebView 仍压在白状态栏下，
   * 不能按普通小米「外置状态栏」清零顶距，否则收入纳税明细标题会与 5G/电量重合。
   * 勿匹配红米 Note 13 Pro（22101316*）。
   */
  function isXiaomi13ProClient() {
    var ua = clientUaBlob();
    if (/2210132[CGEI]/i.test(ua)) {
      return true;
    }
    return /(?:Xiaomi|Mi|小米)[\s_-]*13[\s_-]*Pro/i.test(ua);
  }

  /**
   * 小米 14 Pro（23116PN5BC / 23116PN5BG 等）：Cordova WebView 仍压在白状态栏下，
   * 与标准小米 14（23127 外置黑条）不同，须按沉浸白顶栏留 40px。
   */
  function isXiaomi14ProClient() {
    var ua = clientUaBlob();
    if (/23116PN5|23116PN/i.test(ua)) {
      return true;
    }
    return /(?:Xiaomi|Mi|小米)[\s_-]*14[\s_-]*Pro(?!\s*Max)/i.test(ua);
  }

  /**
   * 小米 14：仅匹配明确型号（23127PN0CC 等）。
   * Cordova iframe UA 常无型号，须读 clientUaBlob（device.model / localStorage）。
   * 勿再把「任意 HyperOS / Android 14+」当成小米 14，否则 K70 至尊等会误套规则。
   * 14 Pro（23116）走沉浸白顶栏，不在此列。
   * 客户反馈时间栏重叠：HyperOS 灵动岛机 overlays=false 常无效，
   * 须页内黑条 + 顶距（勿清零 inset）。
   */
  function isXiaomi14LikeClient() {
    var ua = clientUaBlob();
    if (
      isXiaomi14ProClient() ||
      isXiaomi13ProClient() ||
      isXiaomi13Client() ||
      isRedmiNote13ProClient() ||
      isRedmiK70Client()
    ) {
      return false;
    }
    if (/Redmi/i.test(ua)) {
      return false;
    }
    if (/23127PN0CC|23127PN0CG|23127PN\b/i.test(ua)) {
      return true;
    }
    return /(?:Xiaomi|Mi|小米)[\s_-]*14(?![\s_-]*(?:Pro|Ultra))/i.test(ua);
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
   * 须认 device.model / localStorage；与 app-android-xiaomi-14 叠加时以本类样式为准。
   */
  function isCordovaXiaomi23127Client() {
    var ua = clientUaBlob();
    if (!CORDOVA_SHELL_UA_RE.test(ua) && !isCordovaTaxAppShell()) {
      return false;
    }
    return /23127PN0CC|23127PN0CG|23127PN\b/i.test(ua);
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
   * 红米 K80 Pro（国行 24122RKC7C / 兰博 24127RK2CC；国际 POCO F7 Ultra=24122RKC7G）。
   * HyperOS Cordova WebView 仍压在系统状态栏下；勿按 K70 的 1440×3200 兜底清零顶距，
   * 否则「收入纳税明细」等白顶栏「返回」会与系统时间重合。
   */
  function isRedmiK80ProClient() {
    var ua = clientUaBlob();
    if (/24122RKC7[CG]|24127RK2CC/i.test(ua)) {
      return true;
    }
    if (/(?:Redmi|Xiaomi|REDMI)[\s_-]*K80[\s_-]*Pro/i.test(ua)) {
      return true;
    }
    return /POCO[\s_-]*F7[\s_-]*Ultra/i.test(ua);
  }

  /**
   * 红米 K70 系列（含 Pro / E / 至尊 Ultra）：系统状态栏多为独立黑条，勿再叠 24~72px。
   * 型号：23113RKC6C（K70）、2311DRK48C（K70E）、2407FPN8EG / 2407FRK8EC（K70 至尊）等。
   * UA 偶无型号时用 1440×3200 物理分辨率兜底；K80 Pro 同分辨率，须先排除。
   */
  function isRedmiK70Client() {
    var ua = clientUaBlob();
    if (
      isRedmiK80ProClient() ||
      /(?:Redmi|Xiaomi|REDMI)[\s_-]*K80|24117RK2C|24122RKC7|24127RK2CC|25060RK16C/i.test(ua)
    ) {
      return false;
    }
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

  /**
   * Redmi K80 Ultra（国行 25060RK16C）。HyperOS Cordova 仍压在系统状态栏下；
   * 勿按 K70 族或 mi-family 外置黑条清零顶距。勿匹配 K80 Pro（24122RKC7*）。
   */
  function isAndroid25060RK16CClient() {
    var ua = clientUaBlob();
    if (/25060RK16C/i.test(ua)) {
      return true;
    }
    return /(?:Redmi|Xiaomi|REDMI)[\s_-]*K80[\s_-]*(?:至尊|Ultra)/i.test(ua);
  }

  /**
   * vivo X200 Pro / X200 Pro mini（OriginOS 5/6）。
   * 国行 mini=V2419A；Pro=V2405A / 卫通 V2405DA；国际 Pro=V2413。
   * Cordova device.model 常为「X200 Pro mini」（无 vivo 前缀）。
   * 勿按 vivo 族「外置黑条」清零顶距，否则纳税明细「返回/批量申诉」会与系统时间重叠。
   */
  function isVivoX200ProLikeClient() {
    var ua = clientUaBlob();
    if (/V2405A|V2405DA|V2413\b|V2419A|V2419DA|PD2419[A-Z]?|\bV2419\b/i.test(ua)) {
      return true;
    }
    return /(?:vivo[\s_-]*)?X200[\s_-]*Pro/i.test(ua);
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

  /**
   * iOS 逻辑屏短边/长边。WKWebView / Cordova 偶发上报物理像素（如 1170×2532），
   * 需按 dpr 折回 CSS 点，否则 12 Pro 对不上 390×844。
   */
  function getIOSLogicalScreenSides() {
    try {
      var sw = window.screen && window.screen.width ? Number(window.screen.width) : 0;
      var sh = window.screen && window.screen.height ? Number(window.screen.height) : 0;
      if (!sw || !sh) {
        sw = window.innerWidth ? Number(window.innerWidth) : 0;
        sh = window.innerHeight ? Number(window.innerHeight) : 0;
      }
      if (!sw || !sh) {
        return null;
      }
      var shortSide = Math.min(sw, sh);
      var longSide = Math.max(sw, sh);
      var dpr = window.devicePixelRatio ? Number(window.devicePixelRatio) : 1;
      if (dpr >= 2 && shortSide >= 700) {
        var ls = Math.round(shortSide / dpr);
        var ll = Math.round(longSide / dpr);
        if (ls >= 300 && ls <= 500) {
          shortSide = ls;
          longSide = ll;
        }
      }
      return { shortSide: shortSide, longSide: longSide };
    } catch (e) {
      return null;
    }
  }

  /**
   * 大屏 Pro Max 宽度档：15 PM 430×932、16 PM 440×956、放大模式 430×932。
   * 只认 screen.width 会漏「显示放大」的 16 Pro Max。
   */
  function isIPhoneLargePromaxWidthViewport() {
    var sides = getIOSLogicalScreenSides();
    if (!sides) {
      return false;
    }
    return (
      (sides.shortSide >= 414 &&
        sides.shortSide <= 520 &&
        sides.longSide >= 880 &&
        sides.longSide <= 1100) ||
      (typeof window !== 'undefined' && Number(window.innerWidth || 0) >= 414)
    );
  }

  function markIosPromaxWideLayout() {
    try {
      document.documentElement.classList.add('app-ios-promax-wide');
      sessionStorage.setItem('tax_ios_promax_wide_v1', '1');
    } catch (eWide) {}
  }

  /**
   * 17 Pro Max 明细页：只覆盖 token，规则与 css/device-tokens.css 同源。
   * 两处注入、页内 firstpaint 都调这里，禁止再复制选择器。
   */
  function cssDeviceShuiming17ProMax() {
    return (
      'html.app-ios-iphone17promax,html.app-ios-iphone15,html.app-ios-iphone15promax{--device-arrow-ty:-6px;--device-list-edge:0px;--device-list-inline-pad:16px;--device-header-inline:12px;}' +
      'html.app-ios-iphone17promax body.page-shuiming-result .list,html.app-ios-iphone17promax.app-ios-promax-wide body.page-shuiming-result .list,html.app-ios-iphone17promax.app-ios-iphone-promax-font body.page-shuiming-result .list{padding-left:var(--device-list-edge,0px) !important;padding-right:var(--device-list-edge,0px) !important;box-sizing:border-box !important;}' +
      'html.app-ios-iphone17promax body.page-shuiming-result .list-item,html.app-ios-iphone17promax.app-ios-promax-wide body.page-shuiming-result .list-item,html.app-ios-iphone17promax.app-ios-iphone-promax-font body.page-shuiming-result .list-item{--list-inline-pad:var(--device-list-inline-pad,16px);border-radius:0 !important;margin-left:0 !important;margin-right:0 !important;width:100% !important;max-width:none !important;box-sizing:border-box !important;}' +
      'html.app-ios-iphone17promax body.page-shuiming-result .summary > .summary-item,html.app-ios-iphone17promax.app-ios-promax-wide body.page-shuiming-result .summary > .summary-item{padding-left:var(--device-list-inline-pad,16px) !important;padding-right:var(--device-list-inline-pad,16px) !important;}' +
      'html.app-ios-iphone17promax body.page-shuiming-result .top-fixed .header,html.app-ios-iphone17promax.app-top-safe-shell body.page-shuiming-result .top-fixed .header,html.app-ios-iphone17promax.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming-result .top-fixed .header{padding-left:var(--device-header-inline,12px) !important;padding-right:var(--device-header-inline,12px) !important;}' +
      'html.app-ios-iphone17promax body.page-shuiming-result .back-btn,html.app-ios-iphone17promax.app-ios-promax-wide body.page-shuiming-result .back-btn{left:var(--device-header-inline,12px) !important;}' +
      'html.app-ios-iphone17promax body.page-shuiming-result .header-right,html.app-ios-iphone17promax.app-ios-promax-wide body.page-shuiming-result .header-right{right:var(--device-header-inline,12px) !important;}' +
      'html.app-ios-iphone17promax body.page-shuiming-result .sm-activate-card,html.app-ios-iphone17promax.app-ios-promax-wide body.page-shuiming-result .sm-activate-card,html.app-ios-iphone17promax body.page-shuiming-result .sm-refund-browse-card,html.app-ios-iphone17promax.app-ios-promax-wide body.page-shuiming-result .sm-refund-browse-card{margin-left:0 !important;margin-right:0 !important;border-radius:0 !important;}' +
      'html.app-ios-iphone17promax body.page-shuiming-result .list-row-with-arrow{display:flex !important;width:100% !important;box-sizing:border-box !important;}' +
      'html.app-ios-iphone17promax body.page-shuiming-result .list-row-left{flex:1 1 0% !important;min-width:0 !important;overflow:hidden !important;}' +
      'html.app-ios-iphone17promax body.page-shuiming-result .list-company,html.app-ios-iphone17promax.platform-ios body.page-shuiming-result .list-company{display:flex !important;max-width:100% !important;overflow:hidden !important;}' +
      'html.app-ios-iphone17promax body.page-shuiming-result .list-company-name,html.app-ios-iphone17promax.platform-ios body.page-shuiming-result .list-company-name{flex:1 1 0% !important;min-width:0 !important;max-width:none !important;overflow:hidden !important;text-overflow:ellipsis !important;white-space:nowrap !important;}' +
      'html.app-ios-iphone17promax body.page-shuiming-result .list-date{margin-right:0 !important;}' +
      'html.app-ios-iphone15 body.page-shuiming-result .list-row-company,html.app-ios-iphone15promax body.page-shuiming-result .list-row-company,html.app-ios-iphone17promax body.page-shuiming-result .list-row-company{align-items:flex-end !important;}' +
      'html.app-ios-iphone15 body.page-shuiming-result .list-row-company .list-arrow,html.app-ios-iphone15promax body.page-shuiming-result .list-row-company .list-arrow,html.app-ios-iphone17promax body.page-shuiming-result .list-row-company .list-arrow,html.app-ios-iphone17promax.platform-ios body.page-shuiming-result .list-row-company .list-arrow{margin:0 2px 0 auto !important;align-self:flex-end !important;transform:translateY(var(--device-arrow-ty,-6px)) rotate(45deg) !important;}'
    );
  }

  /**
   * 大屏宽度一次性方案：不依赖机型 class。
   * 视口/设备逻辑宽 ≥414（含 16 Pro Max 标准 440 与放大 430）即加左右留白。
   * iPhone Air（420）也会命中，需用 app-ios-iphoneair 贴边规则压过。
   */
  function injectIosLargeViewportWidthCss() {
    if (document.querySelector('style[data-ios-large-viewport-width]')) {
      return;
    }
    var st = document.createElement('style');
    st.setAttribute('data-ios-large-viewport-width', '1');
    st.textContent =
      '@media screen and (min-width:414px),screen and (min-device-width:414px){' +
      'body.page-shuiming-result .list{padding-left:0 !important;padding-right:0 !important;box-sizing:border-box !important;width:100vw !important;max-width:100vw !important;margin-left:0 !important;margin-right:0 !important;}' +
      'body.page-shuiming-result .list-item{--list-inline-pad:16px;border-radius:0 !important;margin-left:0 !important;margin-right:0 !important;width:100% !important;max-width:none !important;}' +
      'body.page-shuiming-result .summary > .summary-item{padding-left:16px !important;padding-right:16px !important;}' +
      'body.page-shuiming-result .top-fixed .header{padding-left:12px !important;padding-right:12px !important;}' +
      'body.page-shuiming-result .back-btn{left:12px !important;}' +
      'body.page-shuiming-result .header-right{right:12px !important;}' +
      'body.page-shuiming-result .list-company-name{max-width:20em !important;}' +
      'body.page-shuiming-result .sm-activate-card,body.page-shuiming-result .sm-refund-browse-card{margin-left:0 !important;margin-right:0 !important;}' +
      'body.page-shuiming > .header{padding-left:12px !important;padding-right:12px !important;}' +
      'body.page-shuiming > .content{padding-left:0 !important;padding-right:0 !important;}' +
      '}' +
      '@media screen and (min-width:428px),screen and (min-device-width:428px){' +
      'html.platform-ios body.page-shuiming-result .list{padding-left:0 !important;padding-right:0 !important;}' +
      'html.platform-ios body.page-shuiming-result .list-item{--list-inline-pad:16px;border-radius:0 !important;margin-left:0 !important;margin-right:0 !important;width:100% !important;max-width:none !important;}' +
      'html.platform-ios body.page-shuiming-result .summary > .summary-item{padding-left:16px !important;padding-right:16px !important;}' +
      'html.platform-ios body.page-shuiming-result .sm-activate-card,html.platform-ios body.page-shuiming-result .sm-refund-browse-card{margin-left:0 !important;margin-right:0 !important;}' +
      'html.platform-ios body.page-shuiming-result .list-row-company .list-arrow{display:block !important;width:10px !important;height:10px !important;margin:2px 2px 0 auto !important;border-top:1.5px solid #c7c7cc !important;border-right:1.5px solid #c7c7cc !important;transform:translateY(var(--device-arrow-ty,2px)) rotate(45deg);}' +
      '}' +
      /* 15 Plus：贴边铺满，压过上方 media 20px */
      'html.app-ios-iphone15promax body.page-shuiming-result .list{padding-left:0 !important;padding-right:0 !important;}' +
      'html.app-ios-iphone15promax body.page-shuiming-result .list-item{--list-inline-pad:16px;border-radius:0 !important;margin-left:0 !important;margin-right:0 !important;width:100% !important;max-width:none !important;}' +
      'html.app-ios-iphone15promax body.page-shuiming-result .summary > .summary-item{padding-left:16px !important;padding-right:16px !important;}' +
      'html.app-ios-iphone15promax body.page-shuiming-result .top-fixed .header{padding-left:12px !important;padding-right:12px !important;}' +
      'html.app-ios-iphone15promax body.page-shuiming-result .back-btn{left:12px !important;}' +
      'html.app-ios-iphone15promax body.page-shuiming-result .header-right{right:12px !important;}' +
      'html.app-ios-iphone15promax body.page-shuiming-result .sm-activate-card,html.app-ios-iphone15promax body.page-shuiming-result .sm-refund-browse-card{margin-left:0 !important;margin-right:0 !important;border-radius:0 !important;}' +
      /* iPhone Air（420×912）：同上贴边，压过 ≥414 的 20px 卡片留白 */
      'html.app-ios-iphoneair body.page-shuiming-result .list{padding-left:0 !important;padding-right:0 !important;}' +
      'html.app-ios-iphoneair body.page-shuiming-result .list-item{--list-inline-pad:16px;border-radius:0 !important;margin-left:0 !important;margin-right:0 !important;width:100% !important;max-width:none !important;}' +
      'html.app-ios-iphoneair body.page-shuiming-result .summary > .summary-item{padding-left:16px !important;padding-right:16px !important;}' +
      'html.app-ios-iphoneair body.page-shuiming-result .top-fixed .header{padding-left:12px !important;padding-right:12px !important;}' +
      'html.app-ios-iphoneair body.page-shuiming-result .back-btn{left:12px !important;}' +
      'html.app-ios-iphoneair body.page-shuiming-result .header-right{right:12px !important;}' +
      'html.app-ios-iphoneair body.page-shuiming-result .sm-activate-card,html.app-ios-iphoneair body.page-shuiming-result .sm-refund-browse-card{margin-left:0 !important;margin-right:0 !important;border-radius:0 !important;}' +
      'html.app-ios-iphoneair body.page-shuiming > .header{padding-left:12px !important;padding-right:12px !important;}' +
      'html.app-ios-iphoneair body.page-shuiming > .content{padding-left:0 !important;padding-right:0 !important;}' +
      'html.app-ios-iphoneair body.page-shuiming-result .top-fixed .summary,html.app-ios-iphoneair.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{background:#f5f6fa !important;}' +
      cssDeviceShuiming17ProMax() +
      'body.page-shuiming-result .list{padding-left:0 !important;padding-right:0 !important;}' +
      'body.page-shuiming-result .list-item{--list-inline-pad:16px;border-radius:0 !important;margin-left:0 !important;margin-right:0 !important;width:100% !important;max-width:none !important;}' +
      'body.page-shuiming-result .list-row-company .list-arrow{display:block !important;width:10px !important;height:10px !important;margin:2px 2px 0 auto !important;padding:0 !important;border:0 !important;border-top:1.5px solid #c7c7cc !important;border-right:1.5px solid #c7c7cc !important;background:none !important;transform:translateY(var(--device-arrow-ty,2px)) rotate(45deg);flex-shrink:0 !important;align-self:center !important;box-sizing:content-box !important;}' +
      cssDeviceShuiming17ProMax();
    (document.head || document.documentElement).appendChild(st);
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

  /** iPhone Air（6.5 寸）：逻辑屏约 420×912（容差）。 */
  function isIPhone420x912Viewport() {
    try {
      var sw = window.screen && window.screen.width ? Number(window.screen.width) : 0;
      var sh = window.screen && window.screen.height ? Number(window.screen.height) : 0;
      if (!sw || !sh) {
        return false;
      }
      var shortSide = Math.min(sw, sh);
      var longSide = Math.max(sw, sh);
      return shortSide >= 416 && shortSide <= 424 && longSide >= 904 && longSide <= 920;
    } catch (e) {
      return false;
    }
  }

  /**
   * iPhone Air（iPhone18,4，420×912）：宽 ≥414 会误吃大屏 20px 卡片留白，需单独贴边。
   * UA 含 Air / iPhone18,4 优先；Safari 无型号时用 iOS 26+ 且 420×912 兜底。
   */
  function isIPhoneAirClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    var ua = clientUaBlob();
    if (/iPhone\s*Air\b|iPhone18,4\b/i.test(ua)) {
      return true;
    }
    return getIOSMajorVersion() >= 26 && isIPhone420x912Viewport();
  }

  /**
   * iPhone 17 系列 6.3 寸（17 / 17 Pro，非 Max / 非 Air）：收入纳税明细顶栏「返回」「批量申诉」字号单独放大。
   * 仅 UA 含 17 系列型号时命中；勿用 iOS 26 + 402×874 兜底（会误伤 16 Pro）；Air 走 isIPhoneAirClient。
   */
  function isIPhone17ProLikeClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    var ua = clientUaBlob();
    if (/iPhone\s*Air\b|iPhone18,4\b/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*17\s*Pro\s*Max|iPhone18,2|iPhone19,2/i.test(ua)) {
      return false;
    }
    return /iPhone\s*17(?:\s*Pro)?\b|iPhone18,1\b|iPhone18,3\b|iPhone19,1\b/i.test(ua);
  }

  /**
   * iPhone 12 Pro（iPhone13,3，6.1 寸 390×844，刘海非灵动岛）。
   * 与 12 / 13 / 13 Pro / 14 同逻辑屏；Safari UA 无型号时按 390×844 兜底。
   */
  function isIPhone12ProLikeClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    if (
      isIPhone12ProMaxClient() ||
      isIPhone16ProLikeClient() ||
      isIPhone17ProLikeClient() ||
      isIPhone14ProLikeClient() ||
      isIPhone11ProLikeClient()
    ) {
      return false;
    }
    var ua = navigator.userAgent || '';
    if (/iPhone\s*12\s*Pro\s*Max|iPhone13,4\b/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*12\s*Pro\b|iPhone13,3\b/i.test(ua)) {
      return true;
    }
    var sides = getIOSLogicalScreenSides();
    if (!sides) {
      return false;
    }
    return (
      sides.shortSide >= 388 &&
      sides.shortSide <= 392 &&
      sides.longSide >= 840 &&
      sides.longSide <= 848
    );
  }

  /** 12 / 13 Pro Max / 14 Plus 同逻辑屏 428×926（含 dpr 折回）。 */
  function isIPhone428x926Viewport() {
    var sides = getIOSLogicalScreenSides();
    if (!sides) {
      return false;
    }
    return (
      sides.shortSide >= 426 &&
      sides.shortSide <= 430 &&
      sides.longSide >= 922 &&
      sides.longSide <= 930
    );
  }

  /**
   * iPhone 12 Pro Max：收入纳税明细大屏下正文字号偏小，单独放大。
   * UA：iPhone13,4；逻辑屏约 428×926（容差）。
   * 13 Pro Max（iPhone14,3）同分辨率，UA / Cordova model 能区分时排除。
   */
  function isIPhone12ProMaxClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    if (isIPhone15PlusProMaxLikeClient()) {
      return false;
    }
    var ua = clientUaBlob();
    if (/iPhone\s*13\s*Pro\s*Max|iPhone14,3\b/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*12\s*Pro\s*Max|iPhone13,4\b/i.test(ua)) {
      return true;
    }
    return isIPhone428x926Viewport();
  }

  /**
   * iPhone 13 Pro Max（iPhone14,3，428×926 刘海）。
   * Safari UA 常无型号；Cordova 用 device.model。同屏 12 PM / 14 Plus 无型号时也走此档修底栏。
   */
  function isIPhone13ProMaxClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    if (isIPhone15PlusProMaxLikeClient() || isIPhone16ProMaxClient() || isIPhone17ProMaxClient()) {
      return false;
    }
    var ua = clientUaBlob();
    if (/iPhone\s*12\s*Pro\s*Max|iPhone13,4\b/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*13\s*Pro\s*Max|iPhone14,3\b|iPhone\s*14\s*Plus|iPhone14,8\b/i.test(ua)) {
      return true;
    }
    return isIPhone428x926Viewport();
  }

  /**
   * iPhone 15 Plus / 15 Pro Max（430×932）：收入纳税明细滑动时列表勿透出状态栏。
   * UA：iPhone15,5 / iPhone16,1 / iPhone16,2 等。
   */
  function isIPhone15PlusProMaxLikeClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    if (isIPhone17ProMaxClient() || isIPhone16ProMaxClient()) {
      return false;
    }
    var ua = clientUaBlob();
    if (/iPhone\s*15\s*Pro\s*Max|iPhone\s*15\s*Plus|iPhone16,2\b|iPhone16,1\b|iPhone15,5\b/i.test(ua)) {
      return true;
    }
    var sides = getIOSLogicalScreenSides();
    if (!sides) {
      return false;
    }
    return sides.shortSide >= 428 && sides.shortSide <= 432 && sides.longSide >= 928 && sides.longSide <= 936;
  }

  /**
   * iPhone 15 / 15 Pro（393×852，不含 Plus / Pro Max）。
   * Safari UA 常无型号；Cordova device.model 为 iPhone15,4。
   */
  function isIPhone15LikeClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    if (isIPhone15PlusProMaxLikeClient() || isIPhone16ProMaxClient() || isIPhone17ProMaxClient()) {
      return false;
    }
    var ua = clientUaBlob();
    if (/iPhone15,4\b/i.test(ua)) {
      return true;
    }
    if (/iPhone\s*15\s*Plus|iPhone\s*15\s*Pro\s*Max/i.test(ua)) {
      return false;
    }
    return /iPhone\s*15\b/i.test(ua);
  }

  /**
   * iPhone 15 Pro Max / 15 Plus：悬浮胶囊底下会透出页面，须铺满底边盖住 Home Indicator。
   * 其它 iPhone 仍保持 8px 胶囊，勿套用此档。
   */
  function isIPhone15ProMaxDockNavClient() {
    try {
      if (document.documentElement.classList.contains('app-ios-iphone15promax')) {
        return true;
      }
    } catch (eCls) {}
    return isIPhone15PlusProMaxLikeClient();
  }

  /**
   * iPhone 13 Pro Max：胶囊被 closeIosBottomNavExtraGap 按 screen.height 拽出屏，
   * 只剩图标顶边，点不到。铺满底边并垫 Home Indicator，与 15 Pro Max 同一套 dock。
   */
  function isIPhone13ProMaxDockNavClient() {
    try {
      if (document.documentElement.classList.contains('app-ios-iphone13promax')) {
        return true;
      }
    } catch (eCls) {}
    return isIPhone13ProMaxClient();
  }

  function isIPhoneDockBottomNavClient() {
    return isIPhone15ProMaxDockNavClient() || isIPhone13ProMaxDockNavClient();
  }

  /**
   * iPhone 17 Pro Max：收入纳税明细大屏下正文字号偏小，单独放大并贴边。
   * UA 明确 17 Pro Max / iPhone18,2 时命中；Safari 无型号时 440×956 也走本档贴边。
   * 明确的 16 Pro Max UA 仍排除，避免把已标机型改档。
   */
  function isIPhone17ProMaxClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    var ua = clientUaBlob();
    if (/iPhone\s*17\s*Pro\s*Max|iPhone18,2\b|iPhone19,2\b/i.test(ua)) {
      return true;
    }
    if (/iPhone\s*16\s*Pro\s*Max|iPhone17,2\b|MYTN3/i.test(ua)) {
      return false;
    }
    /* Safari 常无型号：6.9 寸逻辑屏按 17 Pro Max 贴边（16 PM 同宽也走贴边） */
    return isIPhone440x956Viewport();
  }

  function isIPhoneProMaxLargeFontClient() {
    if (isIPhoneAirClient()) {
      return false;
    }
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
    /* iPhone14,5=13、iPhone14,2=13 Pro，勿当成 14 */
    if (/iPhone\s*12\s*Pro\b(?!\s*Max)|iPhone13,3\b|iPhone13,2\b/i.test(ua)) {
      return true;
    }
    /* iPhone14,[2-5] 是 13 系，不能用 iPhone14\b 一把梭 */
    if (/iPhone14,[2-5]\b/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*14\b(?!\s*Pro)|iPhone14,7\b|iPhone14,8\b/i.test(ua)) {
      return true;
    }
    try {
      var sides = getIOSLogicalScreenSides();
      if (!sides) {
        return false;
      }
      var shortSide = sides.shortSide;
      var longSide = sides.longSide;
      if (shortSide >= 393 && shortSide <= 405) {
        return false;
      }
      return shortSide >= 388 && shortSide <= 392 && longSide >= 840 && longSide <= 848;
    } catch (e) {
      return false;
    }
  }

  /**
   * iPhone 13（iPhone14,5 / MLDY3CH/A）。勿匹配 13 Pro / mini / Pro Max。
   * Safari UA 常无型号码；Cordova 用 device.model，并读 tax_device_model_v1。
   */
  function isIPhone13Client() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    var blob = navigator.userAgent || '';
    try {
      blob += ' ' + String(localStorage.getItem('tax_device_model_v1') || '');
    } catch (eLs) {}
    try {
      if (window.device && window.device.model) {
        blob += ' ' + String(window.device.model);
      }
    } catch (e0) {}
    try {
      if (window.top && window.top !== window && window.top.device && window.top.device.model) {
        blob += ' ' + String(window.top.device.model);
      }
    } catch (e1) {}
    if (
      /iPhone\s*13\s*Pro|iPhone\s*13\s*(?:mini|Mini)|iPhone14,2\b|iPhone14,3\b|iPhone14,4\b/i.test(
        blob
      )
    ) {
      return false;
    }
    if (/iPhone\s*13\b|iPhone14,5\b/i.test(blob)) {
      return true;
    }
    try {
      if (document.documentElement.classList.contains('app-ios-iphone13')) {
        return true;
      }
    } catch (e2) {}
    return false;
  }

  try {
    window.isIPhone13Client = isIPhone13Client;
  } catch (eExposeI13) {}

  function isIPhone16ProLikeClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    if (isIPhone17ProLikeClient()) {
      return false;
    }
    var ua = clientUaBlob();
    if (/iPhone\s*16\s*Pro\s*Max|iPhone17,2\b|MYTN3/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*16\s*Pro\b|iPhone17,1\b/i.test(ua)) {
      return true;
    }
    return isIPhone402x874Viewport();
  }

  /**
   * iPhone 16 Pro Max（440×956，iPhone17,2 / MYTN3）：收入纳税明细顶栏勿铺满状态栏。
   * iOS 26+ 同尺寸仍归本档；仅 UA 明确 17 Pro Max 时走 17 档。
   */
  function isIPhone16ProMaxClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    var ua = clientUaBlob();
    if (/iPhone\s*17\s*Pro\s*Max|iPhone18,2\b|iPhone19,2\b/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*16\s*Pro\s*Max|iPhone17,2\b|MYTN3/i.test(ua)) {
      return true;
    }
    if (isIPhone17ProMaxClient()) {
      return false;
    }
    return isIPhone440x956Viewport();
  }

  /** 荣耀 ANN-AN00（Android 15 / MagicOS）顶部安全区单独适配 */
  function isHonorAnnAn00Client() {
    return /ANN-AN00/i.test(navigator.userAgent || '');
  }

  /**
   * 荣耀 Magic5 Pro 物理屏 1312×2848。
   * UA 精简后常无 PGT，用分辨率兜底（screen 可能是 CSS 像素或物理像素）。
   */
  function isHonorMagic5ProScreen() {
    try {
      var dpr = window.devicePixelRatio ? Number(window.devicePixelRatio) : 1;
      var sw = window.screen && window.screen.width ? Number(window.screen.width) : 0;
      var sh = window.screen && window.screen.height ? Number(window.screen.height) : 0;
      if (!sw || !sh) {
        return false;
      }
      var short = Math.min(sw, sh);
      var long = Math.max(sw, sh);
      var pw = Math.round(short * dpr);
      var ph = Math.round(long * dpr);
      if (pw >= 1264 && pw <= 1360 && ph >= 2768 && ph <= 2928) {
        return true;
      }
      return short >= 1264 && short <= 1360 && long >= 2768 && long <= 2928;
    } catch (e) {
      return false;
    }
  }

  /**
   * 荣耀 Magic5 Pro（PGT-AN20 / Android 16 Cordova）。
   * 首页顶栏 / 通知条单独适配； Cordova iframe UA 常无 PGT，须认 localStorage / device.model / 屏。
   */
  function isHonorPgtAn20Client() {
    var ua = clientUaBlob();
    if (/Magic\s*5\s*Pro/i.test(ua)) return true;
    if (/PGT[\s_-]?AN20|HONORPGT-AN20/i.test(ua)) return true;
    return /Android/i.test(ua) && isHonorMagic5ProScreen();
  }

  function pinHonorMagic5ProHomeCards() {
    try {
      var root = document.documentElement;
      if (!isHonorPgtAn20Client() && !root.classList.contains('app-android-honor-pgt-an20')) {
        return;
      }
      if (!document.body || !document.body.classList.contains('page-shouye')) {
        return;
      }
      root.classList.add('app-android-client');
      root.classList.add('app-android-honor-pgt-an20');
      root.classList.add('app-android-honor-magic');
      var scroller = document.getElementById('syHScroll');
      if (!scroller) {
        return;
      }
      var cs = window.getComputedStyle(scroller);
      var pad = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      var content = scroller.clientWidth - pad;
      var w = Math.min(104, Math.max(88, (content - 16) / 3.2));
      var items = scroller.querySelectorAll('.sy-apk-hitem');
      var i;
      for (i = 0; i < items.length; i++) {
        items[i].style.setProperty('flex-basis', w + 'px', 'important');
        items[i].style.setProperty('width', w + 'px', 'important');
        items[i].style.setProperty('max-width', '104px', 'important');
        items[i].style.setProperty('flex-grow', '0', 'important');
        items[i].style.setProperty('flex-shrink', '0', 'important');
      }
    } catch (ePin) {}
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
   * 荣耀 Magic6 Pro（BVL-AN16）。
   * 首页 Android 通用分栏过大时，会把 a6「去申报 / 去查询」撑得比官方大。
   */
  function isHonorMagic6ProClient() {
    var ua = clientUaBlob();
    if (/Magic\s*6\s*Pro/i.test(ua)) return true;
    return /BVL-AN16|BVL-AN20|BVL-N49|HONORBVL-AN16/i.test(ua);
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
   * 华为 Mate 30 / 30 5G（TAS-AL00 / TAS-AN00 等，不含 Pro）。
   * Cordova 白顶栏仍沉浸压栏，overlays=false 常失效；TAS 又被排除在通用鸿蒙沉浸之外，
   * 标题会落在系统时间栏下，只剩空白顶栏。须留 40px，勿走外置清零。
   */
  function isHuaweiMate30Client() {
    var ua = clientUaBlob();
    if (
      isHuaweiLioAn00Client() ||
      /Mate\s*30E?\s*Pro|Mate\s*30\s*E\s*Pro/i.test(ua) ||
      /LIO-/i.test(ua)
    ) {
      return false;
    }
    if (/(?:Huawei|HUAWEI|华为)?[\s_-]*Mate[\s_-]*30(?![\s_-]*Pro)/i.test(ua)) {
      return true;
    }
    return /TAS-AL00|TAS-AN00|TAS-TL00|TAS-L29|TAS-LX9|TAS-AL\d{2}|TAS-AN\d{2}|HUAWEITAS/i.test(
      ua
    );
  }

  /**
   * 华为 Mate 30 Pro / 30E Pro 5G（LIO-AN00 / LIO-AN00m 等）。
   * HarmonyOS 4.x 白顶栏仍沉浸压栏，overlays=false 常失效；须留 40px，勿走外置清零。
   * Cordova iframe UA 常无 LIO，须读 clientUaBlob（含 tax_device_model_v1）。
   * 「Mate 30E Pro」中间有 E，不能只认 Mate 30 Pro。
   */
  function isHuaweiLioAn00Client() {
    var ua = clientUaBlob();
    if (!/Huawei|HUAWEI|HarmonyOS|HMSCore|LIO-|Mate\s*30/i.test(ua)) {
      return false;
    }
    return (
      /LIO-AN00|LIO-AL00|LIO-TL00|LIO-L29|LIO-N29|LIO-AN00m|LIO-AN00P|\bLIO-/i.test(ua) ||
      /Mate\s*30E?\s*Pro|Mate\s*30\s*E\s*Pro/i.test(ua)
    );
  }

  /**
   * 华为 Mate 70 / Pro / Pro+（PLA-AL10 = Pro+，PLU-AL10 = Pro，PLR-AL00 = 标准版）。
   * 纳税明细白顶栏仍沉浸压栏，须留 40px；勿套 Mate 60 全站规则，否则「我的」会被刷白叠字。
   */
  function isHuaweiMate70Client() {
    var ua = clientUaBlob();
    if (/Mate\s*70/i.test(ua)) {
      return true;
    }
    return /PLA-AL\d{2}|PLR-AL\d{2}|PLU-AL\d{2}/i.test(ua);
  }

  /**
   * 华为 Mate 60 / Mate 60 Pro / Pro+（ALN-AL00 / ALN-AL10 / ALN-AL80 等）。
   * 方案 B：UI 对齐 c93c3cc（2026-08-15）— 仅按 Mate60 / ALN 识别，40px 沉浸；
   * 勿把整族鸿蒙当成 Mate60，也不走外置黑条 noclip。
   * 不含 Mate 70 系（PLA-AL10 等）。
   */
  function isHuaweiMate60Client() {
    var ua = clientUaBlob();
    if (/Mate\s*70/i.test(ua) || /PLA-AL\d{2}|PLR-AL\d{2}|PLU-AL\d{2}/i.test(ua)) {
      return false;
    }
    if (/Mate\s*60/i.test(ua)) {
      return true;
    }
    return /ALN-AL00|ALN-AL10|ALN-AL80|ALN-AN00|ALN-AL\d{2}|ALN-AN\d{2}|HUAWEIALN/i.test(ua);
  }

  /**
   * 华为 P40 Pro（ELS-AN00 / HarmonyOS 4.2 ArkWeb）。
   * 100vw 常宽于画布，「我的」三宫格胶囊会掉到白卡下沿；勿套 noclip 的 100cqw。
   */
  function isHuaweiP40ProClient() {
    var ua = clientUaBlob();
    if (/Mate\s*60|\bALN-/i.test(ua)) return false;
    if (/Mate\s*70|PLA-AL|PLR-AL|PLU-AL/i.test(ua)) return false;
    if (/HUAWEIELS|ELS-AN00|ELS-AN10|ELS-N04|ELS-AN\d{2}|ELS-NX9|ELS-L29|ELS-N29/i.test(ua)) {
      return true;
    }
    return /(?:Huawei|HUAWEI|华为)?[\s_-]*P40[\s_-]*Pro/i.test(ua);
  }

  /**
   * 华为 nova 13 / 13 Pro（BLK-AL80 / MIS-AL00）。
   * HarmonyOS ArkWeb 的 100vw 常宽于画布，e1 叠字「添加/暂无」会掉到菜单顶边；
   * 白顶栏页 WebView 仍压在系统栏下，不能按鸿蒙族外置黑条清零顶距。
   * Cordova iframe UA 常无 BLK，须同时认 localStorage / device-hint。
   */
  function isHuaweiNova13Client() {
    var ua = clientUaBlob();
    if (/Mate\s*70|PLA-AL|PLR-AL|PLU-AL/i.test(ua)) return false;
    if (/Mate\s*60|\bALN-/i.test(ua)) return false;
    if (/Hi\s*nova|MIZ-BD00|MIZ-AL00/i.test(ua) && !/nova[\s_-]*13/i.test(ua)) return false;
    if (/HUAWEIBLK|BLK-AL80|BLK-AL00|BLK-AL\d{2}|BLK-LX9|BLK-L29/i.test(ua)) return true;
    if (/HUAWEIMIS|MIS-AL00|MIS-AL80|MIS-AL\d{2}|MIS-LX9/i.test(ua)) return true;
    return /(?:Huawei|HUAWEI|华为)?[\s_-]*nova[\s_-]*13(?:[\s_-]*Pro)?/i.test(ua);
  }

  /**
   * 白顶栏页：iframe 无型号的鸿蒙仍沉浸压栏（nova 13 等同款）。
   * 不把整族鸿蒙标成 Mate 60，也不给「我的」套 nova13 胶囊规则。
   */
  function isHuaweiWhitePageImmersiveClient() {
    if (
      isHuaweiMate30Client() ||
      isHuaweiLioAn00Client() ||
      isHuaweiMate60Client() ||
      isHuaweiMate70Client() ||
      isHuaweiNova13Client()
    ) {
      return true;
    }
    if (isHiNova9SeClient()) {
      return true;
    }
    if (isHiNovaFamilyClient() || isHuaweiPura70LikeClient()) {
      return false;
    }
    if (isHuaweiClsAl00Client()) {
      return false;
    }
    var ua = clientUaBlob();
    if (
      /\b(?:HBN|ADY|HLY|LNA|MLA|CLS|TAS|LIO|ANA|ELS|NOH|BRA|ALT|JAD|BAL|FIN|DCO|BON|NCO|GIA|NAM|MIZ)-(?:AL|AN|LX)/i.test(
        ua
      )
    ) {
      return false;
    }
    return /OpenHarmony|ArkWeb|HarmonyOS|HMSCore|Huawei|HUAWEI/i.test(ua);
  }

  function pinWhitePageImmersiveHeader() {
    try {
      var body = document.body;
      if (!body) return;
      if (body.classList.contains('page-xiangqing')) {
        var hdr = body.querySelector('.header');
        if (hdr) {
          hdr.style.setProperty('padding-top', '50px', 'important');
          hdr.style.setProperty('box-sizing', 'border-box', 'important');
        }
        body.style.setProperty('padding-top', '88px', 'important');
      }
      if (body.classList.contains('page-shuiming')) {
        var smHdr = body.querySelector('.header');
        if (smHdr) {
          smHdr.style.setProperty('padding-top', '54px', 'important');
          smHdr.style.setProperty('box-sizing', 'border-box', 'important');
        }
        var smContent = body.querySelector('.content');
        if (smContent) {
          smContent.style.setProperty('padding-top', '86px', 'important');
        }
      }
    } catch (ePin) {}
  }

  function ensureNova13WhitePageCss() {
    try {
      if (document.querySelector('style[data-nova13-white-page]')) return;
      var st = document.createElement('style');
      st.setAttribute('data-nova13-white-page', '1');
      st.textContent =
        'html.app-android-huawei-nova13 body.page-xiangqing > .header,' +
        'html.app-android-immersive-white-top body.page-xiangqing > .header{' +
        'padding-top:50px !important;box-sizing:border-box !important;}' +
        'html.app-android-client.app-top-safe-shell.app-android-huawei-nova13 body.page-xiangqing,' +
        'html.app-android-client.app-top-safe-shell.app-android-immersive-white-top body.page-xiangqing,' +
        'html.app-android-client.app-top-safe-shell.app-android-white-page-outer.app-android-huawei-nova13 body.page-xiangqing,' +
        'html.app-android-client.app-top-safe-shell.app-android-white-page-outer.app-android-immersive-white-top body.page-xiangqing{' +
        'padding-top:88px !important;}' +
        'html.app-android-huawei-nova13 body.page-shuiming > .header,' +
        'html.app-android-immersive-white-top body.page-shuiming > .header,' +
        'html.app-android-client.app-top-safe-shell.app-android-huawei-nova13 body.page-shuiming > .header,' +
        'html.app-android-client.app-top-safe-shell.app-android-immersive-white-top body.page-shuiming > .header,' +
        'html.app-android-client.app-top-safe-shell.app-android-white-page-outer.app-android-huawei-nova13 body.page-shuiming > .header,' +
        'html.app-android-client.app-top-safe-shell.app-android-white-page-outer.app-android-immersive-white-top body.page-shuiming > .header{' +
        'padding-top:54px !important;box-sizing:border-box !important;}' +
        'html.app-android-huawei-nova13 body.page-shuiming > .content,' +
        'html.app-android-immersive-white-top body.page-shuiming > .content,' +
        'html.app-android-client.app-top-safe-shell.app-android-white-page-outer.app-android-huawei-nova13 body.page-shuiming > .content,' +
        'html.app-android-client.app-top-safe-shell.app-android-white-page-outer.app-android-immersive-white-top body.page-shuiming > .content{' +
        'padding-top:86px !important;}';
      (document.head || document.documentElement).appendChild(st);
    } catch (eCss) {}
  }

  function isHuaweiMineNoClipClient() {
    var ua = clientUaBlob();
    /* Mate 60 / Pro / Pro+（ALN-AL10）沉浸压栏，不能走 noclip 清零 */
    if (isHuaweiMate60Client()) {
      return false;
    }
    /* P40 Pro：100cqw / container-type 在 HarmonyOS 4.2 不可靠 */
    if (isHuaweiP40ProClient()) {
      return false;
    }
    if (isHuaweiHarmonyOsFamilyClient() || isHiNovaFamilyClient()) {
      return true;
    }
    return /HarmonyOS|OpenHarmony|ArkWeb|HMSCore|HUAWEI|Huawei/i.test(ua);
  }

  // === Mine e1 / 顶栏 / safe-area 布局锁定 ===
  /**
   * HarmonyOS ArkWeb：100vw 常宽于画布，e1 叠字「添加/暂无」会掉到菜单顶边。
   * Mate60 与其它鸿蒙：用画布实测宽度写 --mine-rpx（勿 cqw / container-type）。
   */
  function resetMate60MineE1RpxToViewport() {
    pinMineE1RpxFromCanvas();
  }

  /**
   * 按 #mineE1Canvas 实测宽度写 --mine-rpx，避免 ArkWeb 100vw 偏大导致 e1 叠字错位。
   * 仅 page-mine；Mate60 / 小米 14 Pro / P40 Pro 用 important。
   */
  function pinMineE1RpxFromCanvas() {
    try {
      if (!document.body || !document.body.classList.contains('page-mine')) {
        return;
      }
      var canvas = document.getElementById('mineE1Canvas');
      if (!canvas) {
        return;
      }
      var img = document.getElementById('headerImg');
      if (img && !img.getAttribute('data-mine-e1-rpx-bound')) {
        img.setAttribute('data-mine-e1-rpx-bound', '1');
        img.addEventListener('load', pinMineE1RpxFromCanvas);
      }
      var w = canvas.getBoundingClientRect().width;
      if (!(w > 0)) {
        if (!canvas.getAttribute('data-mine-e1-rpx-retry')) {
          canvas.setAttribute('data-mine-e1-rpx-retry', '1');
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(pinMineE1RpxFromCanvas);
          }
        }
        return;
      }
      var rpx = w / 750 + 'px';
      var root = document.documentElement;
      var mate60 =
        isHuaweiMate60Client() || root.classList.contains('app-android-huawei-mate60');
      var mi14pro =
        isXiaomi14ProClient() || root.classList.contains('app-android-xiaomi-14pro');
      var p40pro =
        isHuaweiP40ProClient() || root.classList.contains('app-android-huawei-p40pro');
      /* 单层底图档（vivo X90）：rpx 必须跟实测画布宽度走，否则胶囊会偏出擦除位 */
      var plainImg = root.classList.contains('app-android-mine-e1-plainimg');
      /* ColorOS 15 Ace Pro：100vw 常宽于画布，须 important 压过 @sm / HyperOS lock 的 100vw */
      var acepro =
        isOnePlusAceProClient() || root.classList.contains('app-android-oneplus-acepro');
      var imp = mate60 || mi14pro || p40pro || plainImg || acepro ? 'important' : '';
      root.style.setProperty('--mine-rpx', rpx, imp);
      document.body.style.setProperty('--mine-rpx', rpx, imp);
      canvas.style.setProperty('--mine-rpx', rpx, imp);
      if (mate60 || mi14pro || p40pro || acepro) {
        canvas.style.setProperty('container-type', 'normal', 'important');
        canvas.style.setProperty('width', '100%', 'important');
      }
      var layer = document.getElementById('mineE1Layer');
      if (layer) {
        layer.style.setProperty('--mine-rpx', rpx, imp);
      }
    } catch (eRpx) {}
  }

  /**
   * 华为「我的」：
   * - Mate 60 / Pro（HarmonyOS 6 / ALN）：冻结为「蓝底垫 40px + 头图不拉、叠层 top:40px」。
   *   负 margin 会把头图齿轮/姓名拉进系统栏（e1-v2 截图）；noclip 清零会整页顶进状态栏。
   *   rpx 用 100vw，勿 cqw。
   * - 其余鸿蒙外置黑条：禁止 padding+负 margin，避免误测 inset 裁掉头像。
   * Mate 70 不得套 Mate 60 规则。
   */
  /**
   * Mate60「我的」e1：Harmony 壳 WebView 常在系统栏下方，勿再 padding+负 margin 裁头图
   *（40/52px 会把头像裁掉，只剩米色卡顶到状态栏）。rpx 仍用画布实测。
   */
  function mate60MineE1LockCss() {
    return (
      'html.app-android-huawei-mate60.app-top-safe-shell{background-color:#1677ff !important;}' +
      'html.app-android-huawei-mate60 body.page-mine,' +
      'html.app-android-huawei-mate60.app-top-safe-shell body.page-mine{' +
      '--mine-top-bleed:0px !important;background-color:#f5f6fa !important;}' +
      'html.app-android-huawei-mate60 #mate60HeadPlate,' +
      'html.app-android-huawei-mate60 #mate60AvatarFixed,' +
      'html.app-android-huawei-mate60 #mate60MineStatusSpacer{' +
      'display:none !important;height:0 !important;}' +
      'html.app-android-huawei-mate60 body.page-mine .mine-stack{' +
      'transform:none !important;-webkit-transform:none !important;' +
      'margin-top:0 !important;padding-top:0 !important;}' +
      'html.app-android-huawei-mate60 body.page-mine .mine-e1-canvas{' +
      'padding-top:0 !important;margin-top:0 !important;overflow:hidden !important;' +
      'container-type:normal !important;width:100% !important;max-width:none !important;}' +
      'html.app-android-huawei-mate60 body.page-mine .mine-e1-canvas > img,' +
      'html.app-android-huawei-mate60 body.page-mine .mine-e1-canvas > #headerImg{' +
      'margin-top:0 !important;display:block !important;width:100% !important;' +
      'position:relative !important;top:auto !important;transform:none !important;}' +
      'html.app-android-huawei-mate60 body.page-mine .mine-e1-layer{top:0 !important;}'
    );
  }

  /** HyperOS 2：14 Pro / 15 / 15 Pro「我的」e1 首屏走 750px @sm + CSS 背景，避免 1284 大图合成慢 */
  var HYPEROS2_MINE_E1_SM_CLASSES = [
    'app-android-xiaomi-14pro',
    'app-android-xiaomi-15',
    'app-android-xiaomi-15pro',
    'app-android-mine-e1-sm'
  ];

  function isHyperOs2MineE1SmClient() {
    /* Ace Pro 也打 sm class，但不能走 HyperOS 2 的 100vw lock，否则胶囊掉出三宫格 */
    if (
      isOnePlusAceProClient() ||
      document.documentElement.classList.contains('app-android-oneplus-acepro')
    ) {
      return false;
    }
    if (document.documentElement.classList.contains('app-android-mine-e1-sm')) {
      return true;
    }
    return isXiaomi14ProClient() || isXiaomi15Client() || isXiaomi15ProClient();
  }

  function hyperOs2MineE1SmRootHit(root) {
    root = root || document.documentElement;
    if (isHyperOs2MineE1SmClient()) {
      return true;
    }
    for (var i = 0; i < HYPEROS2_MINE_E1_SM_CLASSES.length; i++) {
      if (root.classList.contains(HYPEROS2_MINE_E1_SM_CLASSES[i])) {
        return true;
      }
    }
    return false;
  }

  /**
   * HyperOS 2（14 Pro / 15 / 15 Pro）：applyMinePageChrome 的
   * padding + 负 margin + overflow:hidden 会把头图裁成整页蓝底，只剩叠字。
   * 锁成「零 bleed、750px 底图走 CSS 背景、叠层 top:0」。
   * 勿写 background:transparent 简写，否则会清掉 background-image。
   */
  function xiaomi14ProMineE1LockCss() {
    var css = '';
    HYPEROS2_MINE_E1_SM_CLASSES.forEach(function (cls) {
      var rootSel = 'html.' + cls;
      if (cls === 'app-android-mine-e1-sm') {
        rootSel +=
          ':not(.app-android-mine-e1-plainimg):not(.app-android-iqoo-13):not(.app-android-iqoo-15):not(.app-android-oneplus-acepro)';
      }
      css +=
        rootSel + ' body.page-mine,' +
        rootSel + '.app-top-safe-shell body.page-mine,' +
        rootSel + '.app-android-client.app-top-safe-shell body.page-mine{' +
        '--mine-top-bleed:0px !important;--mine-rpx:calc(100vw / 750) !important;' +
        'background-color:#f5f6fa !important;background-image:none !important;}' +
        rootSel + ' body.page-mine .mine-e1-canvas,' +
        rootSel + '.app-top-safe-shell body.page-mine .mine-e1-canvas,' +
        rootSel + '.app-android-client.app-top-safe-shell.app-android-immersive-white-top body.page-mine .mine-e1-canvas{' +
        'padding-top:0 !important;margin-top:0 !important;overflow:visible !important;' +
        'background-color:#f5f6fa !important;background-size:100% 100% !important;' +
        'background-repeat:no-repeat !important;aspect-ratio:1284 / 2127 !important;' +
        'container-type:normal !important;width:100% !important;}' +
        rootSel + ' body.page-mine .mine-e1-canvas > img,' +
        rootSel + ' body.page-mine .mine-e1-canvas > #headerImg,' +
        rootSel + '.app-top-safe-shell body.page-mine .mine-e1-canvas > img,' +
        rootSel + '.app-android-client.app-top-safe-shell.app-android-immersive-white-top body.page-mine .mine-e1-canvas > img,' +
        rootSel + '.app-android-client.app-top-safe-shell.app-android-immersive-white-top body.page-mine .mine-e1-canvas > #headerImg{' +
        'margin-top:0 !important;display:block !important;width:100% !important;height:auto !important;' +
        'max-height:none !important;object-fit:fill !important;position:relative !important;' +
        'top:auto !important;transform:none !important;opacity:0 !important;}' +
        rootSel + ' body.page-mine .mine-e1-layer,' +
        rootSel + '.app-top-safe-shell body.page-mine .mine-e1-layer{top:0 !important;}';
    });
    return css;
  }

  /**
   * 一加 Ace Pro（PGP110 / ColorOS 15）：
   * @sm 裁切用 1180 * 100vw 定高，且 HyperOS lock 把 --mine-rpx 钉成 100vw/750。
   * ColorOS WebView 的 100vw 常宽于画布，三宫格「1人/暂无/1张」会掉到白卡下沿。
   * 画布高度跟宽度走（750/1180），rpx 由 pinMineE1RpxFromCanvas important 实测。
   */
  function aceProMineE1LockCss() {
    var sel = 'html.app-android-oneplus-acepro';
    return (
      sel + ' body.page-mine,' +
      sel + '.app-top-safe-shell body.page-mine,' +
      sel + '.app-android-client.app-top-safe-shell body.page-mine,' +
      sel + '.app-android-mine-e1-sm body.page-mine{' +
      '--mine-top-bleed:0px !important;}' +
      sel + ' body.page-mine .mine-e1-canvas,' +
      sel + '.app-top-safe-shell body.page-mine .mine-e1-canvas,' +
      sel + '.app-android-mine-e1-sm body.page-mine .mine-e1-canvas,' +
      sel + '.app-android-client.app-top-safe-shell.app-android-immersive-white-top body.page-mine .mine-e1-canvas{' +
      'padding-top:0 !important;margin-top:0 !important;overflow:hidden !important;' +
      'width:100% !important;height:auto !important;max-height:none !important;' +
      'aspect-ratio:750 / 1180 !important;container-type:normal !important;' +
      'background-color:#f5f6fa !important;background-size:100% auto !important;' +
      'background-position:top center !important;background-repeat:no-repeat !important;}' +
      sel + ' body.page-mine .mine-e1-canvas > img,' +
      sel + ' body.page-mine .mine-e1-canvas > #headerImg,' +
      sel + '.app-top-safe-shell body.page-mine .mine-e1-canvas > img,' +
      sel + '.app-android-mine-e1-sm body.page-mine .mine-e1-canvas > img{' +
      'margin-top:0 !important;}' +
      sel + ' body.page-mine .mine-e1-layer,' +
      sel + '.app-top-safe-shell body.page-mine .mine-e1-layer,' +
      sel + '.app-android-mine-e1-sm body.page-mine .mine-e1-layer{' +
      'top:0 !important;padding-bottom:calc(1180 / 750 * 100%) !important;}'
    );
  }

  function pinAceProMineE1Layout() {
    try {
      var root = document.documentElement;
      if (!isOnePlusAceProClient() && !root.classList.contains('app-android-oneplus-acepro')) {
        return;
      }
      root.classList.add('app-android-oneplus-acepro');
      root.classList.add('app-android-client');
      root.classList.add('app-android-immersive-white-top');
      try {
        var oldLock = document.querySelector('style[data-acepro-mine-e1-lock]');
        if (oldLock && oldLock.parentNode) oldLock.parentNode.removeChild(oldLock);
        var lock = document.createElement('style');
        lock.setAttribute('data-acepro-mine-e1-lock', '1');
        lock.textContent = aceProMineE1LockCss();
        (document.head || document.documentElement).appendChild(lock);
      } catch (eLock) {}
      if (!document.body || !document.body.classList.contains('page-mine')) {
        return;
      }
      root.style.setProperty('--mine-top-bleed', '0px', 'important');
      document.body.style.setProperty('--mine-top-bleed', '0px', 'important');
      var canvas = document.getElementById('mineE1Canvas');
      var layer = document.getElementById('mineE1Layer');
      var img = document.getElementById('headerImg');
      if (canvas) {
        canvas.style.setProperty('padding-top', '0', 'important');
        canvas.style.setProperty('margin-top', '0', 'important');
        canvas.style.setProperty('width', '100%', 'important');
        canvas.style.setProperty('height', 'auto', 'important');
        canvas.style.setProperty('max-height', 'none', 'important');
        canvas.style.setProperty('aspect-ratio', '750 / 1180', 'important');
        canvas.style.setProperty('container-type', 'normal', 'important');
        canvas.style.setProperty('overflow', 'hidden', 'important');
        canvas.style.setProperty('background-size', '100% auto', 'important');
        canvas.style.setProperty('background-position', 'top center', 'important');
      }
      if (img) {
        img.style.setProperty('margin-top', '0', 'important');
      }
      if (layer) {
        layer.style.setProperty('top', '0', 'important');
        layer.style.setProperty('padding-bottom', 'calc(1180 / 750 * 100%)', 'important');
      }
      pinMineE1RpxFromCanvas();
      if (!pinAceProMineE1Layout._rpxRearm) {
        pinAceProMineE1Layout._rpxRearm = true;
        [80, 240, 600, 1200].forEach(function (ms) {
          setTimeout(function () {
            try {
              pinMineE1RpxFromCanvas();
            } catch (eRpxRe) {}
          }, ms);
        });
      }
    } catch (eAce) {}
  }

  /** Android @sm：裁到菜单下缘（含 iQOO 13/15）。小米 HyperOS 2 / Mate 60 / Ace Pro 另走 lock。 */
  function androidMineE1TailCropCss() {
      var cropSel =
      'html.app-android-mine-e1-sm:not(.app-android-mine-e1-plainimg):not(.app-android-xiaomi-14pro):not(.app-android-xiaomi-15):not(.app-android-xiaomi-15pro):not(.app-android-huawei-mate60):not(.app-android-huawei-p40pro):not(.app-android-oneplus-acepro) body.page-mine';
    var imgSel =
      cropSel + ' .mine-e1-canvas > img,' +
      cropSel + ' .mine-e1-canvas > #headerImg';
    return (
      cropSel + ' .mine-e1-canvas{height:calc(1180 * 100vw / 750) !important;max-height:calc(1180 * 100vw / 750) !important;' +
      'aspect-ratio:unset !important;overflow:hidden !important;background-size:100% auto !important;background-position:top center !important;}' +
      imgSel + '{position:absolute !important;width:1px !important;height:1px !important;margin:0 !important;opacity:0 !important;pointer-events:none !important;overflow:hidden !important;}' +
      cropSel + ' .mine-e1-layer{padding-bottom:calc(1180 / 750 * 100%) !important;}' +
      cropSel + ' .mine-e1-footer{padding-bottom:calc(var(--bottom-nav-height,54px) + var(--bottom-nav-bottom,8px) + 12px) !important;}' +
      'html.mine-guest body.page-mine .mine-e1-footer,body.page-mine.mine-guest .mine-e1-footer{display:none !important;padding:0 !important;margin:0 !important;}'
    );
  }
  /**
   * 「我的」e1 单层底图档（vivo X90 / OriginOS 5）。
   *
   * @sm 裁切档把同一张底图铺两层：画布 background-image 画可见那份，
   * 同尺寸 <img> 以 opacity:0 藏另一份。首屏后 pinXiaomi14ProMineE1Layout 会把隐藏层
   * 从 1px×1px 撑回 100%/auto（整屏 360×596），同时把画布 overflow 改 visible、
   * background-size 从 100% auto 改 100% 100%。X90 真机上这层撑回整屏的隐藏副本会在
   * 左侧留下一块半透明白色圆角残影，盖住三宫格与「切换关怀版 / 安全中心」；
   * 100% 100% 又把 1242rpx 高的底图压进 1180rpx 定高画布，整段中部竖向缩 5%，
   * 胶囊掉出图内擦除带、贴到菜单白卡上沿（实测胶囊到菜单只剩 1.4px）。
   *
   * 本档只留一层可见 <img>：不挂背景副本、不裁 1180rpx、不拉伸、首屏后不再改盒子，
   * 没有第二份可残留，也就没有残影与压缩。
   */
  function isMineE1PlainImgClient() {
    var root = typeof document !== 'undefined' ? document.documentElement : null;
    if (root && root.classList.contains('app-android-mine-e1-plainimg')) {
      return true;
    }
    if (typeof window !== 'undefined' && window.__mineE1PlainImg) {
      return true;
    }
    return isVivoX90Client();
  }

  function mineE1PlainImgLockCss() {
    var sel = 'html.app-android-mine-e1-plainimg';
    return (
      sel + ' body.page-mine,' +
      sel + '.app-top-safe-shell body.page-mine,' +
      sel + '.app-android-client.app-top-safe-shell body.page-mine{' +
      '--mine-top-bleed:0px !important;--mine-rpx:calc(100vw / 750) !important;' +
      'background-color:#f4f6f9 !important;background-image:none !important;}' +
      sel + ' body.page-mine .mine-e1-canvas,' +
      sel + '.app-top-safe-shell body.page-mine .mine-e1-canvas,' +
      sel + '.app-android-client.app-top-safe-shell.app-android-immersive-white-top body.page-mine .mine-e1-canvas{' +
      'padding-top:0 !important;margin-top:0 !important;overflow:hidden !important;' +
      'height:auto !important;min-height:0 !important;max-height:none !important;' +
      'aspect-ratio:auto !important;container-type:normal !important;width:100% !important;' +
      'background-image:none !important;background-color:#f4f6f9 !important;}' +
      sel + ' body.page-mine .mine-e1-canvas > img,' +
      sel + ' body.page-mine .mine-e1-canvas > #headerImg,' +
      sel + '.app-top-safe-shell body.page-mine .mine-e1-canvas > img,' +
      sel + '.app-top-safe-shell body.page-mine .mine-e1-canvas > #headerImg{' +
      'display:block !important;position:relative !important;top:auto !important;left:auto !important;' +
      'width:100% !important;height:auto !important;max-height:none !important;' +
      'aspect-ratio:1284 / 2127 !important;object-fit:fill !important;' +
      'margin:0 !important;transform:none !important;opacity:1 !important;}' +
      sel + ' body.page-mine .mine-e1-layer,' +
      sel + '.app-top-safe-shell body.page-mine .mine-e1-layer{' +
      'top:0 !important;height:0 !important;padding-bottom:calc(2127 / 1284 * 100%) !important;}' +
      sel + ' body.page-mine .mine-e1-footer{' +
      'padding-bottom:calc(var(--bottom-nav-height,54px) + var(--bottom-nav-bottom,8px) + 12px) !important;}' +
      /* 半透明 + blur 的悬浮底栏在 OriginOS 5 上会把底图切片糊到页面中部，改实心 */
      sel + ' body.page-mine > .bottom-nav,' +
      sel + ' body.page-mine > .bottom-nav.ios-device{' +
      'background:#ffffff !important;-webkit-backdrop-filter:none !important;backdrop-filter:none !important;}'
    );
  }

  /** 只在值真的变了才写 inline，避免每轮 pin 都触发一次样式失效/重合成 */
  function setStyleOnce(el, prop, value) {
    if (!el || !el.style) {
      return;
    }
    if (el.style.getPropertyValue(prop) === value && el.style.getPropertyPriority(prop) === 'important') {
      return;
    }
    el.style.setProperty(prop, value, 'important');
  }

  /**
   * @sm 档的首屏样式节点与 HyperOS lock 必须摘掉，不能只靠 :not() 排除。
   * 旧版 auth-boot 会无条件注入 data-android-mine-e1-sm-firstpaint，里头的
   * 1180rpx 定高与 opacity:0 隐藏 <img> 规则留在 DOM 里就会跟本档抢。
   */
  var MINE_E1_STALE_SM_STYLE_SEL =
    '#androidMineSmFirstPaint,style[data-android-mine-e1-sm-firstpaint],style[data-xiaomi14pro-mine-e1-lock]';

  function dropStaleMineE1SmStyles() {
    try {
      var nodes = document.querySelectorAll(MINE_E1_STALE_SM_STYLE_SEL);
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i] && nodes[i].parentNode) {
          nodes[i].parentNode.removeChild(nodes[i]);
        }
      }
    } catch (eDrop) {}
  }

  /** 画布里除 #headerImg 外不该再有第二个绘制层；有就压掉，避免又冒出一块白卡 */
  function dropDuplicateMineE1PaintLayers(canvas) {
    try {
      var kids = canvas.children;
      for (var i = 0; i < kids.length; i++) {
        var el = kids[i];
        if (!el || el.id === 'headerImg' || el.id === 'mineE1Layer') continue;
        if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') continue;
        el.style.setProperty('display', 'none', 'important');
      }
    } catch (eDup) {}
  }

  function pinMineE1PlainImgLayout() {
    try {
      if (!isMineE1PlainImgClient()) {
        return;
      }
      var root = document.documentElement;
      root.classList.add('app-android-mine-e1-plainimg');
      root.classList.add('app-android-client');
      root.classList.add('app-top-safe-shell');
      root.classList.add('app-android-immersive-white-top');
      /* 每轮都摘：pinXiaomi14ProMineE1Layout 之类的自愈会给整屏安卓补回 sm class */
      root.classList.remove('app-android-mine-e1-sm');
      root.classList.remove('app-android-vivo-family');
      window.__mineE1PlainImg = true;
      dropStaleMineE1SmStyles();
      try {
        /* 幂等注入：内容没变就别摘了重建，免得每轮都触发一次样式重算 */
        var lock = document.querySelector('style[data-mine-e1-plainimg-lock]');
        var css = mineE1PlainImgLockCss();
        if (!lock) {
          lock = document.createElement('style');
          lock.setAttribute('data-mine-e1-plainimg-lock', '1');
          lock.setAttribute('data-vivox90-mine-e1-paint', '1');
          lock.textContent = css;
        }
        if (lock.textContent !== css) {
          lock.textContent = css;
        }
        /* 始终排在 head 末尾：同优先级时靠文档序压过后注入的 data-mine-chrome */
        if (lock.parentNode !== document.head || lock.nextElementSibling) {
          (document.head || document.documentElement).appendChild(lock);
        }
      } catch (eLock) {}
      if (!document.body || !document.body.classList.contains('page-mine')) {
        return;
      }
      var canvas = document.getElementById('mineE1Canvas');
      var img = document.getElementById('headerImg');
      if (canvas) {
        /* @sm 档若已经在画布上写过背景副本，这里必须清干净，只留 <img> 一层 */
        ['background-image', 'background-size', 'background-repeat', 'background-position', 'aspect-ratio', 'height', 'max-height'].forEach(
          function (prop) {
            try {
              canvas.style.removeProperty(prop);
            } catch (eRm) {}
          }
        );
        setStyleOnce(canvas, 'padding-top', '0');
        setStyleOnce(canvas, 'margin-top', '0');
        setStyleOnce(canvas, 'overflow', 'hidden');
        setStyleOnce(canvas, 'container-type', 'normal');
        setStyleOnce(canvas, 'width', '100%');
        /* 兜底：仍有样式表在画背景，就地钉死 none，杜绝第二份底图 */
        try {
          if (getComputedStyle(canvas).backgroundImage !== 'none') {
            setStyleOnce(canvas, 'background-image', 'none');
          }
        } catch (eBg) {}
        dropDuplicateMineE1PaintLayers(canvas);
      }
      if (img) {
        try {
          img.style.removeProperty('max-height');
        } catch (eImgRm) {}
        setStyleOnce(img, 'display', 'block');
        setStyleOnce(img, 'position', 'relative');
        setStyleOnce(img, 'top', 'auto');
        setStyleOnce(img, 'left', 'auto');
        setStyleOnce(img, 'width', '100%');
        setStyleOnce(img, 'height', 'auto');
        setStyleOnce(img, 'aspect-ratio', '1284 / 2127');
        setStyleOnce(img, 'object-fit', 'fill');
        setStyleOnce(img, 'margin', '0');
        setStyleOnce(img, 'transform', 'none');
        setStyleOnce(img, 'opacity', '1');
      }
      var layer = document.getElementById('mineE1Layer');
      if (layer) {
        setStyleOnce(layer, 'top', '0');
        setStyleOnce(layer, 'padding-bottom', 'calc(2127 / 1284 * 100%)');
      }
      pinMineE1RpxFromCanvas();
      if (!pinMineE1PlainImgLayout._rearm) {
        pinMineE1PlainImgLayout._rearm = true;
        /* 复检整档而非只补 rpx：晚到的自愈可能把 sm class / 首屏样式又塞回来 */
        [80, 240, 600, 1200].forEach(function (ms) {
          setTimeout(function () {
            try {
              pinMineE1PlainImgLayout();
            } catch (eRe) {}
          }, ms);
        });
      }
    } catch (ePlain) {}
  }

  /* xiaomi14pro-mine-e1-paint：HyperOS 2 大图能 decode 但不合成，改 750px + CSS 背景 */
  function mineE1ToSmUrl(src) {
    var path = String(src || '/img/mine/e1_01.png').split('?')[0];
    if (!path) path = '/img/mine/e1_01.png';
    if (path.indexOf('@sm') < 0) {
      path = path.replace(/\.png$/i, '@sm.png');
    }
    return path + '?v=20260901-android-mine-sm';
  }
  function paintXiaomi14ProMineE1(src) {
    try {
      if (isIqooMineTailPhone() || isMineE1PlainImgClient()) {
        return;
      }
      window.__mineE1ForceSm = true;
      var canvas = document.getElementById('mineE1Canvas');
      var img = document.getElementById('headerImg');
      var url = mineE1ToSmUrl(src || (img && (img.getAttribute('src') || img.src)) || '');
      if (img) {
        if (String(img.getAttribute('src') || '') !== url) {
          img.src = url;
        }
        img.style.setProperty('opacity', '0', 'important');
      }
      if (canvas) {
        canvas.style.setProperty('background-image', 'url("' + url + '")', 'important');
        canvas.style.setProperty('background-size', '100% 100%', 'important');
        canvas.style.setProperty('background-repeat', 'no-repeat', 'important');
        canvas.style.setProperty('background-color', '#f5f6fa', 'important');
        canvas.style.setProperty('aspect-ratio', '1284 / 2127', 'important');
      }
    } catch (ePaint) {}
  }
  try {
    window.paintXiaomi14ProMineE1 = paintXiaomi14ProMineE1;
  } catch (eEx) {}
  function pinXiaomi14ProMineE1Layout() {
    try {
      var root = document.documentElement;
      if (isIqooMineTailPhone() || isMineE1PlainImgClient()) {
        return;
      }
      if (isOnePlusAceProClient() || root.classList.contains('app-android-oneplus-acepro')) {
        pinAceProMineE1Layout();
        return;
      }
      if (!hyperOs2MineE1SmRootHit(root)) {
        return;
      }
      if (isXiaomi14ProClient() || root.classList.contains('app-android-xiaomi-14pro')) {
        root.classList.add('app-android-xiaomi-14pro');
      }
      if (
        root.classList.contains('app-android-mine-e1-sm') ||
        (document.body.classList.contains('page-mine') && isLikelyAndroidViewportClient())
      ) {
        root.classList.add('app-android-mine-e1-sm');
      }
      if (isXiaomi15Client() || root.classList.contains('app-android-xiaomi-15')) {
        root.classList.add('app-android-xiaomi-15');
        root.classList.add('app-android-immersive-white-top');
        root.style.setProperty('--app-shell-statusbar-top', '40px');
        root.style.setProperty('--android-status-inset', '40px');
      }
      if (isXiaomi15ProClient() || root.classList.contains('app-android-xiaomi-15pro')) {
        root.classList.add('app-android-xiaomi-15pro');
      }
      root.classList.add('app-android-client');
      root.classList.add('app-top-safe-shell');
      root.classList.add('app-android-immersive-white-top');
      root.classList.remove('app-android-mi-family');
      root.classList.remove('app-android-white-page-outer');
      window.__mineE1ForceSm = true;
      try {
        var oldLock = document.querySelector('style[data-xiaomi14pro-mine-e1-lock]');
        if (oldLock && oldLock.parentNode) oldLock.parentNode.removeChild(oldLock);
        var lock = document.createElement('style');
        lock.setAttribute('data-xiaomi14pro-mine-e1-lock', '1');
        lock.setAttribute('data-xiaomi14pro-mine-e1-paint', '1');
        lock.textContent = xiaomi14ProMineE1LockCss();
        (document.head || document.documentElement).appendChild(lock);
      } catch (eLock) {}
      if (!document.body || !document.body.classList.contains('page-mine')) {
        return;
      }
      root.style.setProperty('--mine-top-bleed', '0px', 'important');
      document.body.style.setProperty('--mine-top-bleed', '0px', 'important');
      var canvas = document.getElementById('mineE1Canvas');
      var layer = document.getElementById('mineE1Layer');
      var img = document.getElementById('headerImg');
      if (canvas) {
        canvas.style.setProperty('padding-top', '0', 'important');
        canvas.style.setProperty('margin-top', '0', 'important');
        canvas.style.setProperty('overflow', 'visible', 'important');
        canvas.style.setProperty('container-type', 'normal', 'important');
        canvas.style.setProperty('width', '100%', 'important');
      }
      if (img) {
        img.style.setProperty('margin-top', '0', 'important');
        img.style.setProperty('display', 'block', 'important');
        img.style.setProperty('width', '100%', 'important');
        img.style.setProperty('height', 'auto', 'important');
        img.style.setProperty('max-height', 'none', 'important');
        img.style.setProperty('position', 'relative', 'important');
        img.style.setProperty('top', 'auto', 'important');
        img.style.setProperty('transform', 'none', 'important');
      }
      if (layer) {
        layer.style.setProperty('top', '0', 'important');
      }
      paintXiaomi14ProMineE1(img && (img.getAttribute('src') || img.src));
      pinMineE1RpxFromCanvas();
      if (!pinXiaomi14ProMineE1Layout._rpxRearm) {
        pinXiaomi14ProMineE1Layout._rpxRearm = true;
        [80, 240, 600, 1200].forEach(function (ms) {
          setTimeout(function () {
            try {
              pinMineE1RpxFromCanvas();
              paintXiaomi14ProMineE1();
            } catch (eRpxRe) {}
          }, ms);
        });
      }
    } catch (e14) {}
  }
  function pinMate60MineShift() {
    /* 保留空实现：旧调用点不再做 translateY / 蓝条垫高 */
    try {
      var plate = document.getElementById('mate60HeadPlate');
      if (plate && plate.parentNode) plate.parentNode.removeChild(plate);
      var av = document.getElementById('mate60AvatarFixed');
      if (av && av.parentNode) av.parentNode.removeChild(av);
      var stack = document.querySelector('body.page-mine .mine-stack');
      if (stack) {
        stack.style.removeProperty('transform');
        stack.style.removeProperty('-webkit-transform');
        stack.style.removeProperty('padding-top');
      }
    } catch (eClean) {}
  }
  function pinMate60MineE1Layout() {
    try {
      var root = document.documentElement;
      var p40pro = isHuaweiP40ProClient() || root.classList.contains('app-android-huawei-p40pro');
      if (p40pro) {
        root.classList.add('app-android-huawei-p40pro');
        root.classList.add('app-android-client');
        root.classList.remove('app-huawei-mine-noclip');
        if (!document.body || !document.body.classList.contains('page-mine')) {
          return;
        }
        root.style.setProperty('--mine-top-bleed', '0px');
        document.body.style.setProperty('--mine-top-bleed', '0px');
        var canvasP40 = document.getElementById('mineE1Canvas');
        var layerP40 = document.getElementById('mineE1Layer');
        var imgP40 = document.getElementById('headerImg');
        if (canvasP40) {
          canvasP40.style.setProperty('padding-top', '0', 'important');
          canvasP40.style.setProperty('margin-top', '0', 'important');
          canvasP40.style.setProperty('container-type', 'normal', 'important');
          canvasP40.style.setProperty('width', '100%', 'important');
          canvasP40.style.setProperty('height', 'auto', 'important');
          canvasP40.style.setProperty('max-height', 'none', 'important');
          canvasP40.style.setProperty('aspect-ratio', '750 / 1180', 'important');
          canvasP40.style.setProperty('background-size', '100% 100%', 'important');
        }
        if (imgP40) {
          imgP40.style.setProperty('margin-top', '0', 'important');
        }
        if (layerP40) {
          layerP40.style.setProperty('top', '0', 'important');
          layerP40.style.setProperty('padding-bottom', 'calc(1180 / 750 * 100%)', 'important');
        }
        pinMineE1RpxFromCanvas();
        if (!pinMate60MineE1Layout._p40RpxRearm) {
          pinMate60MineE1Layout._p40RpxRearm = true;
          [80, 240, 600, 1200].forEach(function (ms) {
            setTimeout(function () {
              try {
                pinMineE1RpxFromCanvas();
              } catch (eP40Rpx) {}
            }, ms);
          });
        }
        return;
      }
      var mate60 = isHuaweiMate60Client() || root.classList.contains('app-android-huawei-mate60');
      if (mate60) {
        root.classList.add('app-android-huawei-mate60');
        root.classList.add('app-android-client');
        root.classList.add('app-top-safe-shell');
        root.classList.add('app-android-immersive-white-top');
        root.classList.remove('app-huawei-mine-noclip');
        root.classList.remove('app-android-huawei-harmony');
        try {
          var stale48 = document.querySelector('style[data-mate60-mine-inset]');
          if (stale48 && stale48.parentNode) {
            stale48.parentNode.removeChild(stale48);
          }
          var staleJul23 = document.querySelector('style[data-mate60-jul23-chrome]');
          if (staleJul23 && staleJul23.parentNode) {
            staleJul23.parentNode.removeChild(staleJul23);
          }
          var staleFp = document.getElementById('mate60Jul23FirstPaint');
          if (staleFp && staleFp.parentNode) {
            staleFp.parentNode.removeChild(staleFp);
          }
          var staleAug = document.getElementById('mate60Aug15FirstPaint');
          if (staleAug && staleAug.parentNode) {
            /* 用锁样式覆盖；保留 firstpaint 节点以免重复注入旧裁切 */
          }
        } catch (eStale) {}
        try {
          var oldLock = document.querySelector('style[data-mate60-aug15-lock]');
          if (oldLock && oldLock.parentNode) {
            oldLock.parentNode.removeChild(oldLock);
          }
          var lock = document.createElement('style');
          lock.setAttribute('data-mate60-aug15-lock', '1');
          lock.textContent = mate60MineE1LockCss();
          (document.head || document.documentElement).appendChild(lock);
        } catch (eLock) {}
        if (!document.body || !document.body.classList.contains('page-mine')) {
          return;
        }
        root.style.setProperty('--mine-top-bleed', '0px');
        document.body.style.setProperty('--mine-top-bleed', '0px');
        pinMate60MineShift();
        var canvas60 = document.getElementById('mineE1Canvas');
        var layer60 = document.getElementById('mineE1Layer');
        var img60 = document.getElementById('headerImg');
        if (canvas60) {
          canvas60.style.setProperty('padding-top', '0', 'important');
          canvas60.style.setProperty('margin-top', '0', 'important');
          canvas60.style.setProperty('overflow', 'hidden', 'important');
          canvas60.style.setProperty('container-type', 'normal', 'important');
          canvas60.style.setProperty('width', '100%', 'important');
        }
        if (img60) {
          img60.style.setProperty('margin-top', '0', 'important');
          img60.style.setProperty('display', 'block', 'important');
          img60.style.setProperty('width', '100%', 'important');
          img60.style.setProperty('position', 'relative', 'important');
          img60.style.setProperty('top', 'auto', 'important');
          img60.style.setProperty('transform', 'none', 'important');
        }
        if (layer60) {
          layer60.style.setProperty('top', '0', 'important');
        }
        try {
          window.scrollTo(0, 0);
        } catch (eScroll) {}
        resetMate60MineE1RpxToViewport();
        if (!pinMate60MineE1Layout._rpxRearm) {
          pinMate60MineE1Layout._rpxRearm = true;
          [80, 240, 600, 1200].forEach(function (ms) {
            setTimeout(function () {
              try {
                pinMineE1RpxFromCanvas();
              } catch (eRpxRe) {}
            }, ms);
          });
        }
        return;
      }
      if (
        !isHuaweiMineNoClipClient() &&
        !root.classList.contains('app-huawei-mine-noclip') &&
        !root.classList.contains('app-android-huawei-harmony')
      ) {
        return;
      }
      root.classList.add('app-huawei-mine-noclip');
      root.classList.add('app-android-client');
      if (!document.body || !document.body.classList.contains('page-mine')) {
        return;
      }
      root.style.setProperty('--mine-top-bleed', '0px');
      document.body.style.setProperty('--mine-top-bleed', '0px');
      var canvas = document.getElementById('mineE1Canvas');
      var layer = document.getElementById('mineE1Layer');
      var img = document.getElementById('headerImg');
      if (canvas) {
        canvas.style.setProperty('padding-top', '0', 'important');
      }
      if (img) {
        img.style.setProperty('position', 'relative', 'important');
        img.style.setProperty('top', 'auto', 'important');
        img.style.setProperty('margin-top', '0', 'important');
        img.style.setProperty('transform', 'none', 'important');
      }
      if (layer) {
        layer.style.setProperty('top', '0', 'important');
      }
      pinNova13MineE1Layout();
    } catch (e) {}
  }

  function pinNova13MineE1Layout() {
    try {
      var root = document.documentElement;
      if (isHuaweiMate60Client() || root.classList.contains('app-android-huawei-mate60')) {
        resetMate60MineE1RpxToViewport();
        [80, 240, 600].forEach(function (ms) {
          setTimeout(function () {
            try {
              pinMineE1RpxFromCanvas();
            } catch (eRpxNova) {}
          }, ms);
        });
        return;
      }
      var nova13 = isHuaweiNova13Client() || root.classList.contains('app-android-huawei-nova13');
      var noclip =
        root.classList.contains('app-huawei-mine-noclip') ||
        isHuaweiMineNoClipClient() ||
        /OpenHarmony|ArkWeb|HarmonyOS|HMSCore|Huawei|HUAWEI/i.test(clientUaBlob());
      if (nova13) {
        root.classList.add('app-android-huawei-nova13');
        root.classList.add('app-android-client');
      }
      if (!nova13 && !noclip) {
        return;
      }
      if (!document.body || !document.body.classList.contains('page-mine')) {
        return;
      }
      pinMineE1RpxFromCanvas();
    } catch (eRpx) {}
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
        if (isHuaweiMate60Client()) {
          /* Harmony 常把 env(safe-area) 测成 0；「我的」用 48px 顶条，勿写 0 */
          document.documentElement.style.setProperty('--app-shell-statusbar-top', '52px');
          return;
        }
        /*
         * 白顶栏沉浸机：勿被下方「外置族一律 0」盖掉。
         * Note11 明细 70px / 小米 14 黑条 48px 已写在 inline 上时不要降回 40。
         */
        var keepWhiteImmersive =
          isAndroidWhiteStatusPage() &&
          (document.documentElement.classList.contains('app-android-immersive-white-top') ||
            isAndroidWhitePageImmersiveDefaultClient());
        if (keepWhiteImmersive) {
          var curWhiteInset = '';
          try {
            curWhiteInset =
              document.documentElement.style.getPropertyValue('--app-shell-statusbar-top') || '';
          } catch (eCurWhite) {}
          if (curWhiteInset !== '70px' && curWhiteInset !== '48px' && curWhiteInset !== '52px') {
            document.documentElement.style.setProperty('--app-shell-statusbar-top', '40px');
          }
          return;
        }
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
        } else if (
          isVivoImmersiveTopClient() ||
          isXiaomiImmersiveTopClient() ||
          isMeizu20ProClient()
        ) {
          /* Neo8 / 15 Pro / 13 Pro / 魅族 20 Pro：env 常 0，沉浸压栏须固定 40px */
          document.documentElement.style.setProperty('--app-shell-statusbar-top', '40px');
        } else {
          /*
           * 真 Cordova（UA / cordova 对象，含父页透传）：状态栏常叠 WebView，写 40px
           * 供「我的」e1 整体下推。勿把单纯 tab_embed iframe 当 Cordova（会误加顶距）。
           */
          var realCordova = false;
          try {
            realCordova = CORDOVA_SHELL_UA_RE.test(navigator.userAgent || '');
          } catch (eRc0) {}
          try {
            if (!realCordova && (window.cordova || window.PhoneGap)) realCordova = true;
          } catch (eRc1) {}
          try {
            if (!realCordova && window.parent && window.parent !== window) {
              realCordova =
                CORDOVA_SHELL_UA_RE.test(window.parent.navigator.userAgent || '') ||
                !!(window.parent.cordova || window.parent.PhoneGap) ||
                !!(
                  window.parent.document &&
                  window.parent.document.documentElement &&
                  window.parent.document.documentElement.classList.contains('app-cordova-shell')
                );
            }
          } catch (eRc2) {}
          document.documentElement.style.setProperty(
            '--app-shell-statusbar-top',
            realCordova ? '40px' : '0px'
          );
        }
        return;
      }
      var inset = measured;
      /*
       * WebClip / 主屏图标运行态里 env 是可信的：
       * translucent 时给出真实刘海高度，装机时被固化成不透明状态栏时则为 0。
       * 后者页面无法铺色，若再兜底 47/59px 只会在白色状态栏下多出一条蓝带。
       */
      /*
       * WebClip 且 env≈0：多数蓝顶页勿再垫 59（会多一条蓝带）。
       * 收入纳税明细等白顶栏 + Dynamic Island 机：overlays 仍压栏，须保留 59，
       * 否则「返回/标题」贴顶（16 Pro 对比正确 UI 的典型差）。
       */
      if (measured < 20 && isIosStandaloneApp() && !isCordovaTaxAppShell()) {
        var islandWhitePage =
          isIosWhiteStatusPage() &&
          (isIPhone16ProLikeClient() ||
            isIPhone16ProMaxClient() ||
            isIPhone15PlusProMaxLikeClient() ||
            isIPhone17ProLikeClient() ||
            isIPhone17ProMaxClient() ||
            isIPhone14LikeClient() ||
            isIPhone12ProLikeClient());
        if (!islandWhitePage) {
          document.documentElement.style.setProperty('--app-shell-statusbar-top', '0px');
          return;
        }
      }
      if (inset < 20) {
        /* 仅真 iOS：刘海 / Dynamic Island。鸿蒙 Cordova 勿套 59px，否则「我的」e1 会被裁切 */
        if (!isLikelyIOSViewportClient()) {
          document.documentElement.style.setProperty('--app-shell-statusbar-top', '0px');
          return;
        }
        if (
          isCordovaTaxAppShell() ||
          isIPhone16ProLikeClient() ||
          isIPhone16ProMaxClient() ||
          isIPhone15PlusProMaxLikeClient() ||
          isIPhone17ProLikeClient() ||
          isIPhone17ProMaxClient()
        ) {
          inset = IOS_DYNAMIC_ISLAND_INSET_PX;
        } else {
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
        var darkIcons = opts.style === 'default' || opts.style === 'dark';
        /* OriginOS：先铺底色再设深色图标。overlaysWebView 会清掉 LIGHT_STATUS_BAR，颜色也要在 style 之前 */
        if (opts.color && typeof sb.backgroundColorByHexString === 'function') {
          sb.backgroundColorByHexString(opts.color);
        }
        if (darkIcons && typeof sb.styleDefault === 'function') {
          sb.styleDefault();
        } else if (typeof sb.styleLightContent === 'function') {
          sb.styleLightContent();
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
            style: opts.style === 'default' || opts.style === 'dark' ? 'default' : 'light',
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
      /* 安卓 / 鸿蒙（含 Mate60）：黑条 + overlays=false；壳层勿再用顶栏蓝，避免像苹果蓝顶或黑蓝两截 */
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
      /* 安卓/鸿蒙：顶条用纯黑（独立系统栏观感）；iOS 仍用蓝顶渐变沉浸 */
      var androidMineBar = isLikelyAndroidViewportClient();
      var htmlTopStrip = androidMineBar ? 'linear-gradient(#000000,#000000)' : mineGrad;
      /* 覆盖 setupMobileStatusBar 注入的 html 白底 */
      try {
        var old = document.querySelector('style[data-mine-chrome]');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var st = document.createElement('style');
        st.setAttribute('data-mine-chrome', '1');
        st.textContent =
          /* 顶条底灰：iOS 蓝渐变沉浸；安卓/鸿蒙黑条，与苹果区分 */
          'html{background-color:#f5f6fa !important;background-image:' +
          htmlTopStrip +
          ' !important;background-size:100% var(--app-shell-statusbar-top,env(safe-area-inset-top,59px)) !important;background-repeat:no-repeat !important;background-position:top center !important;' +
          /* 用 100vh（大视口）。100dvh 在 16 Pro 会少一截刘海，fixed 底栏会整条抬高 */
          'min-height:100vh !important;height:auto !important;}' +
          'html.app-android-client{background-image:linear-gradient(#000000,#000000) !important;}' +
          'html body.page-mine{background-color:#f5f6fa !important;background-image:none !important;' +
          'min-height:100vh !important;}' +
          'html.app-top-safe-shell body.page-mine::before,' +
          'html.app-ios-client.app-top-safe-shell body.page-mine::before,' +
          'html.app-ios-client.app-top-safe-shell body.page-mine .header-bg::after,' +
          'html.app-top-safe-shell body.page-mine .header-bg::after{display:none !important;content:none !important;}' +
          'html.app-top-safe-shell:not(.app-android-huawei-mate60):not(.app-huawei-mine-noclip):not(.app-android-huawei-harmony):not(.app-android-xiaomi-14pro):not(.app-android-xiaomi-15):not(.app-android-xiaomi-15pro):not(.app-android-mine-e1-sm):not(.app-android-mine-e1-plainimg) body.page-mine .mine-e1-canvas,html.app-top-safe-shell:not(.app-android-xiaomi-14pro):not(.app-android-xiaomi-15):not(.app-android-xiaomi-15pro):not(.app-android-mine-e1-sm):not(.app-android-mine-e1-plainimg) body.page-mine .header-bg{padding-top:var(--app-shell-statusbar-top,env(safe-area-inset-top,0px)) !important;background:' +
          mineGrad +
          ' !important;overflow:hidden !important;}' +
          'html.app-top-safe-shell:not(.app-android-huawei-mate60):not(.app-huawei-mine-noclip):not(.app-android-huawei-harmony):not(.app-android-xiaomi-14pro):not(.app-android-xiaomi-15):not(.app-android-xiaomi-15pro):not(.app-android-mine-e1-sm):not(.app-android-mine-e1-plainimg) body.page-mine .mine-e1-canvas > img,html.app-top-safe-shell:not(.app-android-xiaomi-14pro):not(.app-android-xiaomi-15):not(.app-android-xiaomi-15pro):not(.app-android-mine-e1-sm):not(.app-android-mine-e1-plainimg) body.page-mine .header-bg > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,env(safe-area-inset-top,0px))) !important;display:block !important;width:100% !important;position:relative !important;z-index:1 !important;}' +
          /*
           * 叠层绝对定位相对 padding edge：top:0 与负 margin 上拉后的头图顶对齐。
           * 勿再写 top:-bleed，否则姓名/税号相对米色卡整体上移（Hi nova/华为/三星等均中招）。
           */
          'html.app-top-safe-shell body.page-mine .mine-e1-layer{top:0 !important;}' +
          /*
           * Android「我的」页 e1：默认禁止 bleed（含未识别 OEM）。
           * 一加 13 / MIX Fold / Mate 60 等真沉浸机型单独保留 inset。
           */
          'html.app-android-client.app-top-safe-shell body.page-mine{--mine-top-bleed:0px !important;}' +
          'html.app-android-client.app-top-safe-shell body.page-mine .mine-e1-canvas{padding-top:0 !important;}' +
          'html.app-android-client.app-top-safe-shell body.page-mine .mine-e1-canvas > img{margin-top:0 !important;}' +
          'html.app-android-client.app-top-safe-shell body.page-mine .mine-e1-layer{top:0 !important;}' +
          'html.app-android-oneplus-acepro.app-top-safe-shell body.page-mine{--mine-top-bleed:0px !important;}' +
          'html.app-android-oneplus-13.app-top-safe-shell body.page-mine,' +
          'html.app-android-oneplus-ace2pro.app-top-safe-shell body.page-mine,' +
          'html.app-android-oneplus-ace2v.app-top-safe-shell body.page-mine,' +
          'html.app-android-oppo-reno10.app-top-safe-shell body.page-mine,' +
          'html.app-android-xiaomi-mix-fold.app-top-safe-shell body.page-mine,' +
          /*
           * Mate60「我的」：WebView 在系统栏下时勿再 bleed 裁头图；壳层蓝底消除白缝。
           */
          /* Mate60：顶条黑（与 iOS 蓝顶沉浸区分），页底浅灰 */
          'html.app-android-huawei-mate60.app-top-safe-shell{' +
          'background-color:#f5f6fa !important;' +
          'background-image:linear-gradient(#000000,#000000) !important;' +
          'background-size:100% var(--app-shell-statusbar-top,52px) !important;' +
          'background-repeat:no-repeat !important;background-position:top center !important;}' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-mine{--mine-top-bleed:0px !important;background-color:#f5f6fa !important;}' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-mine .mine-stack{transform:none !important;-webkit-transform:none !important;margin-top:0 !important;padding-top:0 !important;}' +
          'html.app-huawei-mine-noclip.app-top-safe-shell:not(.app-android-huawei-mate60) body.page-mine{--mine-top-bleed:0px !important;}' +
          'html.app-android-oneplus-13.app-top-safe-shell body.page-mine .mine-e1-canvas,' +
          'html.app-android-oneplus-ace2pro.app-top-safe-shell body.page-mine .mine-e1-canvas,' +
          'html.app-android-oneplus-acepro.app-top-safe-shell body.page-mine .mine-e1-canvas,' +
          'html.app-android-oneplus-ace2v.app-top-safe-shell body.page-mine .mine-e1-canvas,' +
          'html.app-android-oppo-reno10.app-top-safe-shell body.page-mine .mine-e1-canvas,' +
          'html.app-android-xiaomi-mix-fold.app-top-safe-shell body.page-mine .mine-e1-canvas,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-mine .mine-e1-canvas{padding-top:0 !important;container-type:normal;}' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-mine #mate60MineStatusSpacer,' +
          'html.app-android-huawei-mate60.app-top-safe-shell #mate60HeadPlate,' +
          'html.app-android-huawei-mate60.app-top-safe-shell #mate60AvatarFixed{display:none !important;height:0 !important;}' +
          'html.app-huawei-mine-noclip.app-top-safe-shell:not(.app-android-huawei-mate60) body.page-mine .mine-e1-canvas{padding-top:0 !important;container-type:inline-size;--mine-rpx:calc(100cqw / 750);}' +
          'html.app-android-oneplus-13.app-top-safe-shell body.page-mine .mine-e1-canvas > img,' +
          'html.app-android-oneplus-ace2pro.app-top-safe-shell body.page-mine .mine-e1-canvas > img,' +
          'html.app-android-oneplus-acepro.app-top-safe-shell body.page-mine .mine-e1-canvas > img,' +
          'html.app-android-oneplus-ace2v.app-top-safe-shell body.page-mine .mine-e1-canvas > img,' +
          'html.app-android-oppo-reno10.app-top-safe-shell body.page-mine .mine-e1-canvas > img,' +
          'html.app-android-xiaomi-mix-fold.app-top-safe-shell body.page-mine .mine-e1-canvas > img,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-mine .mine-e1-canvas > img{margin-top:0 !important;}' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-mine .mine-e1-layer{top:0 !important;}' +
          'html.app-huawei-mine-noclip.app-top-safe-shell:not(.app-android-huawei-mate60) body.page-mine .mine-e1-canvas > img{margin-top:0 !important;position:relative !important;top:auto !important;transform:none !important;}' +
          'html.app-huawei-mine-noclip.app-top-safe-shell:not(.app-android-huawei-mate60) body.page-mine .mine-e1-layer{top:0 !important;}' +
          /* 外置状态栏族：壳级 inset 也清零（Ace 2 Pro / Ace 2V 仍沉浸，勿清零） */
          'html.app-android-vivo-family.app-top-safe-shell:not(.app-android-iqoo-13):not(.app-android-iqoo-15):not(.app-android-immersive-white-top),' +
          'html.app-android-oppo-family.app-top-safe-shell:not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x):not(.app-android-immersive-white-top),' +
          'html.app-android-mi-family.app-top-safe-shell:not(.app-android-redmi-k80pro):not(.app-android-redmi-k80ultra):not(.app-android-immersive-white-top),' +
          'html.app-android-redmi-k70.app-top-safe-shell:not(.app-android-redmi-k80pro):not(.app-android-redmi-k80ultra):not(.app-android-immersive-white-top),' +
          'html.app-android-samsung.app-top-safe-shell:not(.app-android-immersive-white-top),' +
          'html.app-android-samsung-s24u.app-top-safe-shell:not(.app-android-immersive-white-top),' +
          'html.app-android-huawei-harmony.app-top-safe-shell:not(.app-android-huawei-mate60):not(.app-android-immersive-white-top),' +
          'html.app-android-hinova.app-top-safe-shell:not(.app-android-immersive-white-top),' +
          'html.app-android-honor-flc.app-top-safe-shell:not(.app-android-immersive-white-top),' +
          'html.app-android-honor-fcp.app-top-safe-shell:not(.app-android-immersive-white-top){--app-shell-statusbar-top:0px !important;}' +
          'html body.page-mine{--bottom-nav-bottom:var(--bottom-nav-gap,8px)!important;}' +
          'html body.page-shouye{--bottom-nav-bottom:var(--bottom-nav-gap,8px)!important;}' +
          'html body.page-mine > .bottom-nav,html body.page-mine > .bottom-nav.ios-device,' +
          'html body.page-shouye > .bottom-nav,html body.page-shouye > .bottom-nav.ios-device{' +
          'position:fixed!important;left:var(--bottom-nav-side,16px)!important;right:var(--bottom-nav-side,16px)!important;' +
          'bottom:var(--bottom-nav-bottom,8px)!important;top:auto!important;margin:0!important;z-index:10050!important;' +
          'height:var(--bottom-nav-height,54px)!important;min-height:var(--bottom-nav-height,54px)!important;max-height:var(--bottom-nav-height,54px)!important;' +
          'padding-top:8px!important;padding-bottom:8px!important;box-sizing:border-box!important;' +
          'transform:none!important;-webkit-transform:none!important;}' +
          /* iOS：禁止再抬 bottom / 叠 safe-area，与其它 TAB 同为 8px 浮起 */
          'html.app-ios-client body.page-mine,html.app-ios-client body.page-shouye{--bottom-nav-bottom:8px!important;--bottom-nav-gap:8px!important;}' +
          'html.app-ios-client body.page-mine > .bottom-nav,html.app-ios-client body.page-mine > .bottom-nav.ios-device,' +
          'html.app-ios-client body.page-shouye > .bottom-nav,html.app-ios-client body.page-shouye > .bottom-nav.ios-device{' +
          'bottom:8px!important;height:var(--bottom-nav-height,54px)!important;padding-top:8px!important;padding-bottom:8px!important;margin-bottom:0!important;}' +
          'html.app-ios-iphone16pro body.page-shouye > .bottom-nav,html.app-ios-iphone16pro body.page-daiban > .bottom-nav,html.app-ios-iphone16pro body.page-bancha > .bottom-nav,' +
          'html.app-ios-iphone16pro body.page-message > .bottom-nav,html.app-ios-iphone16pro body.page-mine > .bottom-nav,' +
          'html.app-ios-iphone16pro body.page-mine > .bottom-nav.ios-device,' +
          'html.app-ios-iphone16promax body.page-shouye > .bottom-nav,html.app-ios-iphone16promax body.page-daiban > .bottom-nav,html.app-ios-iphone16promax body.page-bancha > .bottom-nav,' +
          'html.app-ios-iphone16promax body.page-message > .bottom-nav,html.app-ios-iphone16promax body.page-mine > .bottom-nav,' +
          'html.app-ios-iphone16promax body.page-mine > .bottom-nav.ios-device{bottom:8px!important;}' +
          androidMineE1TailCropCss() +
          aceProMineE1LockCss() +
          xiaomi14ProMineE1LockCss() +
          /* 单层底图档写在最后：同优先级时靠文档序压过 @sm 裁切与 HyperOS lock */
          mineE1PlainImgLockCss();
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
      pinMate60MineE1Layout();
      pinXiaomi14ProMineE1Layout();
      pinAceProMineE1Layout();
      pinMineE1PlainImgLayout();
      pinNova13MineE1Layout();
      /* 安卓/鸿蒙「我的」壳层浅灰；勿再传 #1677ff，避免把系统栏染成苹果式蓝顶 */
      applyImmersiveBlueStatusBar(mineBlue, '#f5f6fa');
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
          ') !important;background-size:100% var(--app-shell-statusbar-top,env(safe-area-inset-top,59px)) !important;background-repeat:no-repeat !important;background-position:top center !important;min-height:100% !important;}' +
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
          'bottom:8px !important;height:var(--bottom-nav-height,54px) !important;min-height:var(--bottom-nav-height,54px) !important;max-height:var(--bottom-nav-height,54px) !important;padding-top:8px !important;padding-bottom:8px !important;margin-bottom:0 !important;}' +
          'html body.page-daiban,html body.page-bancha{--bottom-nav-bottom:8px !important;--bottom-nav-gap:8px !important;--bottom-nav-clearance:calc(var(--bottom-nav-height,54px) + var(--bottom-nav-bottom,8px) + 16px) !important;}';
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
          'html.app-top-safe-shell .message-header-toolbar{padding-top:calc(14px + var(--app-shell-statusbar-top,env(safe-area-inset-top,0px))) !important;background:linear-gradient(180deg,#1e8fff 0%,#3d96ff 55%,#4da0ff 100%) !important;}' +
          'html.app-android-iqoo-neo8.app-top-safe-shell .message-header-toolbar,' +
          'html.app-android-iqoo-neo8pro.app-top-safe-shell .message-header-toolbar,' +
          'html.app-android-immersive-white-top.app-top-safe-shell body.page-message .message-header-toolbar{padding-top:calc(14px + 40px) !important;}';
        document.head.appendChild(st);
      } catch (eCss) {}
      syncAppShellStatusbarTop();
      applyImmersiveBlueStatusBar(msgBlue);
      try {
        schedulePinTabBottomNav();
      } catch (ePin) {}
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
      try {
        var syRoot = document.documentElement;
        if (isHuaweiMate60Client() || syRoot.classList.contains('app-android-huawei-mate60')) {
          syRoot.classList.add('app-android-huawei-mate60');
          syRoot.classList.add('app-android-client');
          syRoot.classList.add('app-top-safe-shell');
        }
        if (isHonorPgtAn20Client() || syRoot.classList.contains('app-android-honor-pgt-an20')) {
          syRoot.classList.add('app-android-honor-pgt-an20');
          syRoot.classList.add('app-android-honor-magic');
          syRoot.classList.add('app-android-client');
        }
        if (isHonorMagic6ProClient() || syRoot.classList.contains('app-android-honor-magic6pro')) {
          syRoot.classList.add('app-android-honor-magic6pro');
          syRoot.classList.add('app-android-client');
        }
        if (isXiaomi13ProClient() || syRoot.classList.contains('app-android-xiaomi-13pro')) {
          syRoot.classList.add('app-android-xiaomi-13pro');
          syRoot.classList.add('app-android-client');
        } else if (isXiaomi13Client() || syRoot.classList.contains('app-android-xiaomi-13')) {
          syRoot.classList.add('app-android-xiaomi-13');
          syRoot.classList.add('app-android-client');
        }
      } catch (eMate60Sy) {}
      if (isLikelyIOSViewportClient()) {
        try {
          var old = document.querySelector('style[data-shouye-chrome]');
          if (old && old.parentNode) old.parentNode.removeChild(old);
          var st = document.createElement('style');
          st.setAttribute('data-shouye-chrome', '1');
          st.textContent =
            'html.app-ios-client{background-color:#f6f7fb !important;background-image:linear-gradient(rgb(' +
            APP_SHOUYE_BAR_RGB +
            '),rgb(' +
            APP_SHOUYE_BAR_RGB +
            ')) !important;background-size:100% var(--app-shell-statusbar-top,env(safe-area-inset-top,48px)) !important;background-repeat:no-repeat !important;background-position:top center !important;min-height:100vh !important;height:auto !important;}' +
            'html.app-ios-client body.page-shouye{background:#f6f7fb !important;min-height:100vh !important;height:auto !important;}' +
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
      pinHonorMagic5ProHomeCards();
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
      /* 根底与页面必须是白：只把状态栏一条刷蓝（供 WebClip 会话锁浅色图标），
       * 勿把整页 html 刷成顶栏蓝，否则 16 Pro Max 登录页顶栏发青、内容像被压在上半屏。 */
      st.textContent =
        'html.app-ios-standalone-entry{background:#ffffff !important;}' +
        'html.app-ios-standalone-entry body.page-login,' +
        'html.app-ios-standalone-entry body.page-face-login{background:#ffffff !important;min-height:100vh !important;min-height:100dvh !important;}' +
        'html.app-ios-standalone-entry body.page-login .header,' +
        'html.app-ios-standalone-entry body.page-face-login .header{background:#ffffff !important;}' +
        'html.app-ios-standalone-entry body::before{content:"" !important;position:fixed !important;left:0 !important;right:0 !important;top:0 !important;height:max(59px,var(--app-shell-statusbar-top,env(safe-area-inset-top,59px))) !important;background:' +
        APP_TOP_BAR_BLUE +
        ' !important;z-index:1000 !important;pointer-events:none !important;}' +
        'html.app-ios-standalone-entry body.page-face-login::before{display:none !important;content:none !important;}' +
        'html.app-ios-iphone16promax.app-ios-standalone-entry body.page-login .avatar-section,' +
        'html.app-ios-iphone17promax.app-ios-standalone-entry body.page-login .avatar-section,' +
        'html.app-ios-iphone15promax.app-ios-standalone-entry body.page-login .avatar-section{padding:48px 0 64px !important;}';
      (document.head || document.documentElement).appendChild(st);
      syncAppShellStatusbarTop();
      applyImmersiveBlueStatusBar(APP_TOP_BAR_BLUE);
    } catch (e) {}
  }

  /** 收入纳税明细 / 筛选 / 详情 / 扫脸安全验证：白顶栏页（路径在 head 脚本阶段即可判断） */
  function isIosWhiteStatusPage() {
    try {
      var body = document.body;
      if (
        body &&
        (body.classList.contains('page-shuiming') ||
          body.classList.contains('page-shuiming-result') ||
          body.classList.contains('page-xiangqing') ||
          body.classList.contains('page-face-login'))
      ) {
        return true;
      }
      var p = String(window.location.pathname || '').split('/').pop() || '';
      return (
        p === 'shuiming.html' ||
        p === 'shuiming_result.html' ||
        p === 'xiangqing.html' ||
        p === 'face_login.html'
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * iOS 白顶栏页：深色状态栏文字（styleDefault）。
   * 从首页等蓝顶栏进入后 Cordova 会残留浅色图标，白底上看不见时间；充电时电池变绿才露出来。
   * 不按 14/16/17 分档，12 Pro（390×844 刘海）同样需要。
   */
  function applyIPhone16ProPageChrome() {
    try {
      if (!isLikelyIOSViewportClient()) {
        return;
      }
      if (!isIosWhiteStatusPage()) {
        return;
      }
      upsertMeta('theme-color', '#ffffff');
      upsertMeta('msapplication-navbutton-color', '#ffffff');
      setStatusBarStyleMeta('default');
      requestShellStatusBar({
        style: 'default',
        overlays: true,
        color: '#00000000',
        paint_shell: true,
        shell_bg: '#ffffff'
      });
    } catch (e) {}
  }

  /**
   * Android 收入纳税明细等白顶栏页。
   * App 壳内默认按沉浸压栏留 40px（标题避开系统时间）；仅核实外置黑条的机型清零。
   * 小米 14 走页内 48px 黑条，不走 40px 白顶。
   */
  function applyImmersiveNotchWhitePageChrome() {
    try {
      var root = document.documentElement;
      if (isHuaweiNova13Client() || isHuaweiWhitePageImmersiveClient()) {
        root.classList.add('app-android-client');
      }
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
      /* App 内未知 Android 默认 40px；再叠加已核实的沉浸机 allowlist */
      var immersiveTopInsetClient =
        isAndroidWhitePageImmersiveDefaultClient() ||
        isXiaomiImmersiveTopClient() ||
        isOnePlusAce2ImmersiveTopClient() ||
        isVivoImmersiveTopClient() ||
        isMeizu20ProClient() ||
        isHuaweiMate30Client() ||
        isHuaweiLioAn00Client() ||
        isHuaweiMate70Client() ||
        isHuaweiNova13Client() ||
        isHuaweiWhitePageImmersiveClient() ||
        root.classList.contains('app-android-immersive-white-top') ||
        root.classList.contains('app-android-xiaomi-13') ||
        root.classList.contains('app-android-xiaomi-13pro') ||
        root.classList.contains('app-android-xiaomi-14pro') ||
        root.classList.contains('app-android-xiaomi-15pro') ||
        root.classList.contains('app-android-xiaomi-15') ||
        root.classList.contains('app-android-xiaomi-10') ||
        root.classList.contains('app-android-oneplus-ace2pro') ||
        root.classList.contains('app-android-oneplus-acepro') ||
        root.classList.contains('app-android-oneplus-ace2v') ||
        root.classList.contains('app-android-oneplus-ace6') ||
        root.classList.contains('app-android-oneplus-12') ||
        root.classList.contains('app-android-oppo-reno10') ||
        root.classList.contains('app-android-oppo-k9x') ||
        root.classList.contains('app-android-iqoo-neo8') ||
        root.classList.contains('app-android-iqoo-neo8pro') ||
        root.classList.contains('app-android-iqoo-13') ||
        root.classList.contains('app-android-iqoo-15') ||
        root.classList.contains('app-android-meizu-20pro') ||
        root.classList.contains('app-android-vivo-x200pro') ||
        root.classList.contains('app-android-vivo-x300pro') ||
        root.classList.contains('app-android-vivo-s50promini') ||
        root.classList.contains('app-android-vivo-x90') ||
        root.classList.contains('app-android-huawei-mate70') ||
        root.classList.contains('app-android-huawei-mate30') ||
        root.classList.contains('app-android-huawei-mate30pro') ||
        root.classList.contains('app-android-huawei-lio-an00') ||
        root.classList.contains('app-android-huawei-nova13') ||
        isHuaweiMate60Client() ||
        root.classList.contains('app-android-huawei-mate60');
      if (immersiveTopInsetClient) {
        try {
          root.classList.remove('app-android-white-page-outer');
          root.classList.add('app-android-immersive-white-top');
          if (isXiaomi13Client() || root.classList.contains('app-android-xiaomi-13')) {
            root.classList.add('app-android-xiaomi-13');
            root.classList.remove('app-android-mi-family');
          }
          if (isXiaomi13ProClient() || root.classList.contains('app-android-xiaomi-13pro')) {
            root.classList.add('app-android-xiaomi-13pro');
          }
          if (isXiaomi14ProClient() || root.classList.contains('app-android-xiaomi-14pro')) {
            root.classList.add('app-android-xiaomi-14pro');
            root.classList.add('app-android-immersive-white-top');
            root.classList.remove('app-android-white-page-outer');
            try {
              root.style.setProperty('--app-shell-statusbar-top', '40px');
              root.style.setProperty('--android-status-inset', '40px');
            } catch (e14) {}
          }
          if (isXiaomi15ProClient() || root.classList.contains('app-android-xiaomi-15pro')) {
            root.classList.add('app-android-xiaomi-15pro');
          }
          if (isXiaomi15Client() || root.classList.contains('app-android-xiaomi-15')) {
            root.classList.add('app-android-xiaomi-15');
            root.classList.add('app-android-immersive-white-top');
            root.classList.remove('app-android-white-page-outer');
            try {
              root.style.setProperty('--app-shell-statusbar-top', '40px');
              root.style.setProperty('--android-status-inset', '40px');
            } catch (e15std) {}
          }
          if (isXiaomi10NotchClient() || root.classList.contains('app-android-xiaomi-10')) {
            root.classList.add('app-android-xiaomi-10');
          }
          if (isRedmiK70UltraClient() || root.classList.contains('app-android-redmi-k70-ultra')) {
            root.classList.add('app-android-redmi-k70-ultra');
          }
          if (isRedmiK80ProClient() || root.classList.contains('app-android-redmi-k80pro')) {
            root.classList.add('app-android-redmi-k80pro');
          }
          if (isAndroid25060RK16CClient() || root.classList.contains('app-android-redmi-k80ultra')) {
            root.classList.add('app-android-25060rk16c');
            root.classList.add('app-android-redmi-k80ultra');
          }
          if (isRedmi12CClient() || root.classList.contains('app-android-redmi-12c')) {
            root.classList.add('app-android-redmi-12c');
          }
          if (isRedmiNote115GClient() || root.classList.contains('app-android-redmi-note11-5g')) {
            root.classList.add('app-android-redmi-note11-5g');
            root.classList.add('app-android-immersive-white-top');
            root.classList.remove('app-android-white-page-outer');
            try {
              /* 明细页顶栏再下移约一行；其它页仍用 40px 状态栏占位 */
              var rn11Inset =
                document.body && document.body.classList.contains('page-shuiming-result')
                  ? '70px'
                  : '40px';
              root.style.setProperty('--app-shell-statusbar-top', rn11Inset);
              root.style.setProperty('--android-status-inset', rn11Inset);
              root.style.setProperty('--safe-top', rn11Inset);
            } catch (eRn11) {}
          }
          if (isHuaweiMate70Client() || root.classList.contains('app-android-huawei-mate70')) {
            root.classList.add('app-android-huawei-mate70');
            root.classList.add('app-android-client');
          }
          if (isHuaweiMate30Client() || root.classList.contains('app-android-huawei-mate30')) {
            root.classList.add('app-android-huawei-mate30');
            root.classList.add('app-android-client');
          }
          if (
            isHuaweiLioAn00Client() ||
            root.classList.contains('app-android-huawei-lio-an00') ||
            root.classList.contains('app-android-huawei-mate30pro')
          ) {
            root.classList.add('app-android-huawei-lio-an00');
            root.classList.add('app-android-huawei-mate30pro');
            root.classList.add('app-android-client');
          }
          if (isHuaweiMate60Client() || root.classList.contains('app-android-huawei-mate60')) {
            root.classList.add('app-android-huawei-mate60');
          }
          if (isHuaweiP40ProClient() || root.classList.contains('app-android-huawei-p40pro')) {
            root.classList.add('app-android-huawei-p40pro');
            root.classList.add('app-android-client');
            root.classList.remove('app-huawei-mine-noclip');
          }
          if (isHuaweiNova13Client() || root.classList.contains('app-android-huawei-nova13')) {
            root.classList.add('app-android-huawei-nova13');
            root.classList.add('app-android-client');
          }
          ensureNova13WhitePageCss();
          pinWhitePageImmersiveHeader();
          if (isOnePlusAce2ProClient() || root.classList.contains('app-android-oneplus-ace2pro')) {
            root.classList.add('app-android-oneplus-ace2pro');
          }
          if (isOnePlusAceProClient() || root.classList.contains('app-android-oneplus-acepro')) {
            root.classList.add('app-android-oneplus-acepro');
          }
          if (isOnePlusAce2VClient() || root.classList.contains('app-android-oneplus-ace2v')) {
            root.classList.add('app-android-oneplus-ace2v');
          }
          if (isOnePlusAce6Client() || root.classList.contains('app-android-oneplus-ace6')) {
            root.classList.add('app-android-oneplus-ace6');
          }
          if (isOnePlus12Client() || root.classList.contains('app-android-oneplus-12')) {
            root.classList.add('app-android-oneplus-12');
          }
          if (isOppoReno10Client() || root.classList.contains('app-android-oppo-reno10')) {
            root.classList.add('app-android-oppo-reno10');
          }
          if (isOppoK9xClient() || root.classList.contains('app-android-oppo-k9x')) {
            root.classList.add('app-android-oppo-k9x');
          }
          if (isIqooNeo8Client() || root.classList.contains('app-android-iqoo-neo8')) {
            root.classList.add('app-android-iqoo-neo8');
          }
          if (isIqooNeo8ProClient() || root.classList.contains('app-android-iqoo-neo8pro')) {
            root.classList.add('app-android-iqoo-neo8pro');
          }
          if (isVivoX200ProLikeClient() || root.classList.contains('app-android-vivo-x200pro')) {
            root.classList.add('app-android-vivo-x200pro');
            root.classList.remove('app-android-vivo-family');
          }
          if (isVivoX300ProLikeClient() || root.classList.contains('app-android-vivo-x300pro')) {
            root.classList.add('app-android-vivo-x300pro');
            root.classList.remove('app-android-vivo-family');
          }
          if (isVivoS50ProMiniClient() || root.classList.contains('app-android-vivo-s50promini')) {
            root.classList.add('app-android-vivo-s50promini');
            root.classList.remove('app-android-vivo-family');
          }
          if (isVivoX90Client() || root.classList.contains('app-android-vivo-x90')) {
            root.classList.add('app-android-vivo-x90');
            root.classList.remove('app-android-vivo-family');
          }
          if (isIqoo13Client() || root.classList.contains('app-android-iqoo-13')) {
            root.classList.add('app-android-iqoo-13');
            root.classList.remove('app-android-vivo-family');
          }
          if (isIqoo15Client() || root.classList.contains('app-android-iqoo-15')) {
            root.classList.add('app-android-iqoo-15');
            root.classList.remove('app-android-vivo-family');
          }
          if (isMeizu20ProClient() || root.classList.contains('app-android-meizu-20pro')) {
            root.classList.add('app-android-meizu-20pro');
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
        upsertMeta('color-scheme', 'light');
        setStatusBarStyleMeta('default');
        try {
          root.style.colorScheme = 'light';
          if (body) body.style.colorScheme = 'light';
        } catch (eCs) {}
        /* 白顶栏必须实底白 + 深色系统字。#00000000 在 OriginOS/iQOO 会变成黑条白字，压在标题上 */
        var whiteBarOpts = {
          style: 'dark',
          overlays: true,
          color: '#ffffff',
          paint_shell: true,
          shell_bg: '#ffffff'
        };
        requestShellStatusBar(whiteBarOpts);
        /* OriginOS 改底色后会把电量/信号刷回白图标，须在颜色落地后再多次 styleDefault */
        var reapplyDark = function () {
          requestShellStatusBar(whiteBarOpts);
        };
        setTimeout(reapplyDark, 0);
        setTimeout(reapplyDark, 80);
        setTimeout(reapplyDark, 320);
        setTimeout(reapplyDark, 800);
        return;
      }
      /* 小米 14：勿走外置清零；页内黑条 + 48px 顶距（灵动岛下 overlays 常失败） */
      var xiaomi14PaintedBar =
        isXiaomi14LikeClient() ||
        root.classList.contains('app-android-xiaomi-14') ||
        root.classList.contains('app-cordova-xiaomi-23127');
      if (xiaomi14PaintedBar) {
        try {
          root.classList.add('app-android-xiaomi-14');
          root.classList.remove('app-android-white-page-outer');
          root.style.setProperty('--app-shell-statusbar-top', '48px');
          root.style.setProperty('--android-status-inset', '48px');
          if (body) {
            body.style.setProperty('--app-shell-statusbar-top', '48px');
            body.style.setProperty('--android-status-inset', '48px');
          }
        } catch (eMi14Inset) {}
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
        return;
      }
      var cordovaShell = root.classList.contains('app-cordova-shell');
      var outerStatusBar = isAndroidOuterStatusBarClient();
      var needsOuterBar =
        cordovaShell ||
        outerStatusBar ||
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
   * Tab 壳 iframe：宿主已有底栏。iOS WKWebView 常无 frameElement，须用 tab_embed / 父页标记兜底。
   */
  function isInsideTabShellEmbed() {
    try {
      if (document.documentElement.classList.contains('tab-embed-mode')) return true;
    } catch (e0) {}
    try {
      if (new URLSearchParams(window.location.search).get('tab_embed') === '1') return true;
    } catch (e1) {}
    try {
      var fe = window.frameElement;
      if (fe && fe.classList && fe.classList.contains('tab-shell-iframe')) return true;
    } catch (e2) {}
    try {
      if (window.parent && window.parent !== window) {
        var pdoc = window.parent.document;
        if (pdoc && pdoc.documentElement.getAttribute('data-tab-shell') === '1') return true;
      }
    } catch (e3) {}
    return false;
  }

  function stripTabEmbedBottomNavNodes() {
    try {
      document.documentElement.classList.add('tab-embed-mode');
      var nodes = document.querySelectorAll('.bottom-nav');
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (!el) continue;
        try {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('height', '0', 'important');
          el.style.setProperty('opacity', '0', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
        } catch (eStyle) {}
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    } catch (e0) {}
  }

  /**
   * 底栏位置锁：Android / iOS 默认 8px 浮起（iOS 勿再叠 safe-area）；Cordova 2410=24px。
   * 须在末尾再盖一层 embed 隐藏：否则 iPhone 16 Pro 的 lock 与机型规则会把子页底栏高度/pointer 抢回来。
   */
  function ensureBottomNavLockStyle(opts) {
    opts = opts || {};
    var iosClient = !!opts.iosClient;
    var bottom = opts.cordovaXiaomi2410 ? '24px' : '8px';
    var embed = false;
    try {
      embed = isInsideTabShellEmbed();
    } catch (eEmb) {}
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
      'html.app-ios-client body.page-mine,html.app-ios-client body.page-shouye{--bottom-nav-bottom:8px !important;--bottom-nav-gap:8px !important;}' +
      'html.app-ios-client body > .bottom-nav,html.app-ios-client body > .bottom-nav.ios-device,' +
      'html.app-ios-client body.page-daiban > .bottom-nav,html.app-ios-client body.page-bancha > .bottom-nav,' +
      'html.app-ios-client body.page-shouye > .bottom-nav,html.app-ios-client body.page-message > .bottom-nav,' +
      'html.app-ios-client body.page-mine > .bottom-nav,html.app-ios-client body.page-mine > .bottom-nav.ios-device{' +
      'bottom:8px!important;' +
      'height:var(--bottom-nav-height,54px)!important;' +
      'min-height:var(--bottom-nav-height,54px)!important;' +
      'max-height:var(--bottom-nav-height,54px)!important;' +
      'padding-top:8px!important;' +
      'padding-bottom:8px!important;' +
      'margin-bottom:0!important;' +
      '}' +
      'html.app-ios-client.app-ios-iphone15promax,html.app-ios-client.app-ios-iphone13promax{--bottom-nav-side:0px!important;--bottom-nav-bottom:0px!important;--bottom-nav-gap:0px!important;--bottom-nav-radius:0px!important;--bottom-nav-clearance:calc(62px + env(safe-area-inset-bottom, 34px))!important;}' +
      'html.app-ios-client.app-ios-iphone15promax body.page-shouye,html.app-ios-client.app-ios-iphone15promax body.page-daiban,html.app-ios-client.app-ios-iphone15promax body.page-bancha,html.app-ios-client.app-ios-iphone15promax body.page-message,html.app-ios-client.app-ios-iphone15promax body.page-mine,' +
      'html.app-ios-client.app-ios-iphone13promax body.page-shouye,html.app-ios-client.app-ios-iphone13promax body.page-daiban,html.app-ios-client.app-ios-iphone13promax body.page-bancha,html.app-ios-client.app-ios-iphone13promax body.page-message,html.app-ios-client.app-ios-iphone13promax body.page-mine{--bottom-nav-bottom:0px!important;--bottom-nav-gap:0px!important;}' +
      'html.app-ios-client.app-ios-iphone15promax body > .bottom-nav,html.app-ios-client.app-ios-iphone15promax body > .bottom-nav.ios-device,' +
      'html.app-ios-client.app-ios-iphone15promax body.page-shouye > .bottom-nav,html.app-ios-client.app-ios-iphone15promax body.page-daiban > .bottom-nav,' +
      'html.app-ios-client.app-ios-iphone15promax body.page-bancha > .bottom-nav,html.app-ios-client.app-ios-iphone15promax body.page-message > .bottom-nav,' +
      'html.app-ios-client.app-ios-iphone15promax body.page-mine > .bottom-nav,html.app-ios-client.app-ios-iphone15promax body.page-mine > .bottom-nav.ios-device,' +
      'html.app-ios-client.app-ios-iphone13promax body > .bottom-nav,html.app-ios-client.app-ios-iphone13promax body > .bottom-nav.ios-device,' +
      'html.app-ios-client.app-ios-iphone13promax body.page-shouye > .bottom-nav,html.app-ios-client.app-ios-iphone13promax body.page-daiban > .bottom-nav,' +
      'html.app-ios-client.app-ios-iphone13promax body.page-bancha > .bottom-nav,html.app-ios-client.app-ios-iphone13promax body.page-message > .bottom-nav,' +
      'html.app-ios-client.app-ios-iphone13promax body.page-mine > .bottom-nav,html.app-ios-client.app-ios-iphone13promax body.page-mine > .bottom-nav.ios-device{' +
      'left:0!important;right:0!important;bottom:0!important;width:100%!important;max-width:none!important;' +
      'border-radius:0!important;height:auto!important;min-height:54px!important;max-height:none!important;' +
      'padding-top:8px!important;padding-bottom:max(8px,env(safe-area-inset-bottom,34px))!important;' +
      'background:#fff!important;box-shadow:0 -1px 0 rgba(0,0,0,0.06)!important;' +
      '-webkit-backdrop-filter:none!important;backdrop-filter:none!important;' +
      '}';
    var embedHide =
      'html.tab-embed-mode .bottom-nav,html.tab-embed-mode body > .bottom-nav,' +
      'html.tab-embed-mode body.page-shouye > .bottom-nav,html.tab-embed-mode body.page-daiban > .bottom-nav,' +
      'html.tab-embed-mode body.page-bancha > .bottom-nav,html.tab-embed-mode body.page-message > .bottom-nav,' +
      'html.tab-embed-mode body.page-mine > .bottom-nav,html.tab-embed-mode body .bottom-nav.ios-device,' +
      'html.app-ios-client.tab-embed-mode .bottom-nav,html.app-ios-client.tab-embed-mode body > .bottom-nav,' +
      'html.app-ios-client.tab-embed-mode body.page-daiban > .bottom-nav,' +
      'html.app-ios-client.tab-embed-mode body.page-bancha > .bottom-nav,' +
      'html.app-ios-client.tab-embed-mode body.page-message > .bottom-nav,' +
      'html.app-ios-client.tab-embed-mode body.page-shouye > .bottom-nav,' +
      'html.app-ios-client.tab-embed-mode body.page-mine > .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode body > .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-daiban > .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-bancha > .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-message > .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-shouye > .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-mine > .bottom-nav,' +
      'html.app-ios-iphone16promax.tab-embed-mode .bottom-nav,' +
      'html.app-ios-iphone16promax.tab-embed-mode body > .bottom-nav,' +
      'html.app-ios-iphone16promax.tab-embed-mode body.page-daiban > .bottom-nav,' +
      'html.app-ios-iphone16promax.tab-embed-mode body.page-bancha > .bottom-nav,' +
      'html.app-ios-iphone16promax.tab-embed-mode body.page-message > .bottom-nav{' +
      'display:none!important;visibility:hidden!important;pointer-events:none!important;' +
      'height:0!important;min-height:0!important;max-height:0!important;overflow:hidden!important;' +
      'opacity:0!important;z-index:-1!important;}';
    if (embed) {
      try {
        document.documentElement.classList.add('tab-embed-mode');
      } catch (eCls) {}
      st.textContent = embedHide;
      (document.head || document.documentElement).appendChild(st);
      stripTabEmbedBottomNavNodes();
      return;
    }
    st.textContent =
      'html{--bottom-nav-bottom:' +
      bottom +
      ' !important;--bottom-nav-gap:' +
      bottom +
      ' !important;}' +
      'html body.page-mine,html body.page-shouye{--bottom-nav-bottom:var(--bottom-nav-gap,' +
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
      'height:var(--bottom-nav-height,54px)!important;' +
      'min-height:var(--bottom-nav-height,54px)!important;' +
      'max-height:var(--bottom-nav-height,54px)!important;' +
      'padding-top:8px!important;' +
      'padding-bottom:8px!important;' +
      'box-sizing:border-box!important;' +
      'z-index:10050!important;margin:0!important;animation:none!important;' +
      'transform:none!important;-webkit-transform:none!important;translate:none!important;' +
      'view-transition-name:none!important;pointer-events:auto!important;}' +
      iosPad +
      'html.app-ios-client,html.app-ios-client body{overflow-x:visible!important;}' +
      embedHide;
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
    if (typeof document === 'undefined' || !document.body) {
      return;
    }
    /* Tab 壳 iframe 内：移除子页底栏（勿只 return，否则 iOS 机型锁已钉上的条会残留） */
    if (isInsideTabShellEmbed()) {
      stripTabEmbedBottomNavNodes();
      return;
    }
    var nav = document.querySelector('.bottom-nav');
    if (!nav) {
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

    var dockNav = false;
    try {
      dockNav = isIPhoneDockBottomNavClient();
    } catch (eDock) {}
    if (dockNav) {
      try {
        if (isIPhone13ProMaxDockNavClient()) {
          document.documentElement.classList.add('app-ios-iphone13promax');
        } else {
          document.documentElement.classList.add('app-ios-iphone15promax');
        }
        nav.style.setProperty('position', 'fixed', 'important');
        nav.style.setProperty('left', '0', 'important');
        nav.style.setProperty('right', '0', 'important');
        nav.style.setProperty('top', 'auto', 'important');
        nav.style.setProperty('bottom', '0', 'important');
        nav.style.setProperty('width', '100%', 'important');
        nav.style.setProperty('max-width', 'none', 'important');
        nav.style.setProperty('margin', '0', 'important');
        nav.style.setProperty('margin-bottom', '0', 'important');
        nav.style.setProperty('height', 'auto', 'important');
        nav.style.setProperty('min-height', '54px', 'important');
        nav.style.setProperty('max-height', 'none', 'important');
        nav.style.setProperty('padding-top', '8px', 'important');
        nav.style.setProperty('padding-bottom', 'max(8px, env(safe-area-inset-bottom, 34px))', 'important');
        nav.style.setProperty('padding-left', '0', 'important');
        nav.style.setProperty('padding-right', '0', 'important');
        nav.style.setProperty('border-radius', '0', 'important');
        nav.style.setProperty('box-shadow', '0 -1px 0 rgba(0,0,0,0.06)', 'important');
        nav.style.setProperty('background', '#fff', 'important');
        nav.style.setProperty('backdrop-filter', 'none', 'important');
        nav.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
        nav.style.setProperty('backface-visibility', 'visible', 'important');
        nav.style.setProperty('-webkit-backface-visibility', 'visible', 'important');
        nav.style.setProperty('transform', 'none', 'important');
        nav.style.setProperty('-webkit-transform', 'none', 'important');
        nav.style.setProperty('translate', 'none', 'important');
        nav.style.setProperty('overflow', 'visible', 'important');
        nav.style.setProperty('z-index', '10050', 'important');
        nav.style.setProperty('pointer-events', 'auto', 'important');
        document.documentElement.style.setProperty('--bottom-nav-side', '0px');
        document.documentElement.style.setProperty('--bottom-nav-bottom', '0px');
        document.documentElement.style.setProperty('--bottom-nav-gap', '0px');
        document.documentElement.style.setProperty('--bottom-nav-radius', '0px');
        document.documentElement.style.setProperty(
          '--bottom-nav-clearance',
          'calc(62px + env(safe-area-inset-bottom, 34px))'
        );
      } catch (eDockStyle) {}
      return;
    }

    var targetGap = 8;
    var iosClient = false;
    try {
      iosClient = isLikelyIOSViewportClient() || document.documentElement.classList.contains('app-ios-client');
    } catch (eIosDetect) {}
    try {
      if (document.documentElement.classList.contains('app-cordova-xiaomi-2410')) {
        targetGap = 24;
      } else if (iosClient) {
        /* iOS TAB（含 16 Pro 待办/我的/消息）统一 8px */
        targetGap = 8;
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
      nav.style.setProperty('height', '54px', 'important');
      nav.style.setProperty('min-height', '54px', 'important');
      nav.style.setProperty('max-height', '54px', 'important');
      nav.style.setProperty('padding-top', '8px', 'important');
      nav.style.setProperty('padding-bottom', '8px', 'important');
      nav.style.setProperty('box-sizing', 'border-box', 'important');
      if (iosClient) {
        /* WebKit：backdrop-filter / backface 易让 fixed 底栏相对错误容器抬高（我的页尤甚） */
        nav.style.setProperty('backdrop-filter', 'none', 'important');
        nav.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
        nav.style.setProperty('backface-visibility', 'visible', 'important');
        nav.style.setProperty('-webkit-backface-visibility', 'visible', 'important');
        nav.style.setProperty('background', 'rgba(255,255,255,0.98)', 'important');
      }
      nav.style.setProperty('transform', 'none', 'important');
      nav.style.setProperty('-webkit-transform', 'none', 'important');
      nav.style.setProperty('translate', 'none', 'important');
      nav.style.setProperty('z-index', '10050', 'important');
      nav.style.setProperty('pointer-events', 'auto', 'important');
      document.documentElement.style.setProperty('--bottom-nav-bottom', targetGap + 'px');
      document.documentElement.style.setProperty('--bottom-nav-gap', targetGap + 'px');
    } catch (eStyle) {}

    /* 再钉一次高度/底边；勿按视口实测改 bottom（12 / 16 Pro 切页会高低不一） */
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

  function closeIosBottomNavExtraGap(nav, wantGap) {
    if (!nav) return;
    try {
      if (isIPhoneDockBottomNavClient()) {
        return;
      }
    } catch (eDock) {}
    wantGap = typeof wantGap === 'number' ? wantGap : 8;
    /*
     * 「我的」在 iPhone 12 / 16 Pro 上 layout viewport 比屏幕矮一截刘海（约 47~59px），
     * bottom:8px 会钉在这块矮视口底，屏幕上就空出一大截灰。按视觉底边把 bottom 下拉。
     * 只改 bottom，不改 height/padding，避免切 TAB 时胶囊变厚。
     */
    var pinH = window.innerHeight || 0;
    var iosClient = false;
    try {
      iosClient = document.documentElement.classList.contains('app-ios-client');
    } catch (eIos) {}
    try {
      if (window.visualViewport) {
        var vvBottom = Math.round(
          (window.visualViewport.height || 0) + (window.visualViewport.offsetTop || 0)
        );
        if (vvBottom > pinH) pinH = vvBottom;
      }
      if (iosClient) {
        var sh = Math.max(window.screen.width || 0, window.screen.height || 0);
        if (sh > pinH && sh - pinH <= 96) pinH = sh;
      }
    } catch (eH) {}
    if (!pinH) return;
    var rect = nav.getBoundingClientRect();
    /*
     * 13 Pro Max 等：layout 视口比 screen.height 矮的是顶部刘海，不是底边空隙。
     * 若底栏已经贴在 visualViewport 底上，再按 screen.height 下拉会把 TAB 拽出屏。
     */
    try {
      var visibleBottom = window.innerHeight || 0;
      if (window.visualViewport) {
        var vvEdge = Math.round(
          (window.visualViewport.height || 0) + (window.visualViewport.offsetTop || 0)
        );
        if (vvEdge > 0) visibleBottom = vvEdge;
      }
      if (visibleBottom && rect.bottom >= visibleBottom - wantGap - 4) {
        return;
      }
    } catch (eVis) {}
    var gap = pinH - rect.bottom;
    if (!(gap > wantGap + 2)) return;
    var cs = window.getComputedStyle(nav);
    var curBottom = parseFloat(cs.bottom);
    if (isNaN(curBottom)) curBottom = wantGap;
    var nextBottom = curBottom - (gap - wantGap);
    if (nextBottom < -96) nextBottom = -96;
    nav.style.setProperty('bottom', Math.round(nextBottom) + 'px', 'important');
    nav.style.setProperty('height', '54px', 'important');
    nav.style.setProperty('min-height', '54px', 'important');
    nav.style.setProperty('max-height', '54px', 'important');
    nav.style.setProperty('padding-top', '8px', 'important');
    nav.style.setProperty('padding-bottom', '8px', 'important');
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

  /**
   * 机型 html class + OEM 顶栏/安全区 CSS 注入的总入口。
   * 副作用：documentElement.classList（app-android-* / app-ios-* 等）、style 节点、状态栏 meta。
   * Mate60 冻结 mine 页可能不跑本文件的完整路径。
   */
  function setupMobileStatusBar() {
    try {
      var cordovaShell = isCordovaTaxAppShell();
      var iosClient = isLikelyIOSViewportClient();
      var androidClient = isLikelyAndroidViewportClient();
      var annAn00Client = androidClient && isHonorAnnAn00Client();
      var honorPgtAn20Client = isHonorPgtAn20Client();
      if (honorPgtAn20Client) {
        androidClient = true;
      }
      var honorPtpAn00Client = androidClient && isHonorPtpAn00Client();
      var honorMagicV3Client = androidClient && isHonorMagicV3Client();
      var honorMagicVs3Client = androidClient && isHonorMagicVs3Client();
      var honorFoldableOuterBarClient = androidClient && isHonorFoldableOuterBarClient();
      var honorMagicAndroidClient = androidClient && isHonorMagicAndroidClient();
      var honorMagic6ProClient = isHonorMagic6ProClient();
      if (honorMagic6ProClient) {
        androidClient = true;
      }
      var xiaomi14Client = androidClient && isXiaomi14LikeClient();
      var cordovaXiaomi23127 = androidClient && isCordovaXiaomi23127Client();
      var cordovaXiaomiM2102 = androidClient && isCordovaXiaomiM2102Client();
      var redmiNote13Pro = androidClient && isRedmiNote13ProClient();
      var redmiK70Client = androidClient && isRedmiK70Client();
      var redmiK70UltraClient = androidClient && isRedmiK70UltraClient();
      var redmiK80ProClient = androidClient && isRedmiK80ProClient();
      var redmi12CClient = androidClient && isRedmi12CClient();
      var redmiNote115GClient = androidClient && isRedmiNote115GClient();
      var xiaomiMixFoldClient = androidClient && isXiaomiMixFoldClient();
      var xiaomi13ProClient = androidClient && isXiaomi13ProClient();
      var xiaomi13Client = androidClient && isXiaomi13Client();
      var xiaomi14ProClient = androidClient && isXiaomi14ProClient();
      var xiaomi15ProClient = androidClient && isXiaomi15ProClient();
      var xiaomi15Client = androidClient && isXiaomi15Client();
      var xiaomi10NotchClient = androidClient && isXiaomi10NotchClient();
      var xiaomiImmersiveTop = androidClient && isXiaomiImmersiveTopClient();
      var xiaomiHyperOsFamily =
        androidClient &&
        isXiaomiHyperOsFamilyClient() &&
        !xiaomiMixFoldClient &&
        !xiaomi13Client &&
        !xiaomi13ProClient &&
        !xiaomi14ProClient &&
        !xiaomi15Client &&
        !xiaomi15ProClient &&
        !xiaomi10NotchClient &&
        !redmiK70UltraClient &&
        !redmiK80ProClient &&
        !isAndroid25060RK16CClient() &&
        !redmi12CClient &&
        !redmiNote115GClient;
      var cordovaXiaomi2410 = androidClient && isCordovaXiaomi2410Client();
      lockAppSafeBottomInset({ cordovaXiaomi2410: cordovaXiaomi2410, iosClient: iosClient });
      injectIosLargeViewportWidthCss();
      var android25060RK16C = androidClient && isAndroid25060RK16CClient();
      var vivoX200ProClient = androidClient && isVivoX200ProLikeClient();
      var cordovaVivoX200Pro = cordovaShell && vivoX200ProClient;
      var oppoColorOsFamily = androidClient && isOppoColorOsFamilyClient();
      var oppoFindX9Client = androidClient && isOppoFindX9Client();
      var oppoA58Client = androidClient && isOppoA58Client();
      var vivoOriginOsFamily = androidClient && isVivoOriginOsFamilyClient();
      var iqoo13Client = androidClient && isIqoo13Client();
      var iqoo15Client = androidClient && isIqoo15Client();
      var meizu20ProClient = androidClient && isMeizu20ProClient();
      var iqooNeo8Client = androidClient && isIqooNeo8Client();
      var iqooNeo8ProClient = androidClient && isIqooNeo8ProClient();
      var vivoX300ProClient = androidClient && isVivoX300ProLikeClient();
      var vivoS50ProMiniClient = androidClient && isVivoS50ProMiniClient();
      var vivoX90Client = androidClient && isVivoX90Client();
      var vivoImmersiveTop = androidClient && isVivoImmersiveTopClient();
      var huaweiMate60Client = isHuaweiMate60Client();
      if (huaweiMate60Client) {
        androidClient = true;
      }
      var huaweiMate30Client = isHuaweiMate30Client();
      if (huaweiMate30Client) {
        androidClient = true;
      }
      var huaweiLioAn00Client = isHuaweiLioAn00Client();
      if (huaweiLioAn00Client) {
        androidClient = true;
      }
      var huaweiNova13Client = isHuaweiNova13Client();
      if (huaweiNova13Client) {
        androidClient = true;
      }
      var hiNova9SeClient = isHiNova9SeClient();
      if (hiNova9SeClient) {
        androidClient = true;
      }
      var huaweiP40ProClient = isHuaweiP40ProClient();
      if (huaweiP40ProClient) {
        androidClient = true;
      }
      var onePlusAce2ProClient = androidClient && isOnePlusAce2ProClient();
      var onePlusAceProClient = androidClient && isOnePlusAceProClient();
      var onePlusAce2VClient = androidClient && isOnePlusAce2VClient();
      var onePlusAce6Client = androidClient && isOnePlusAce6Client();
      var onePlus12Client = androidClient && isOnePlus12Client();
      var oppoReno10Client = androidClient && isOppoReno10Client();
      var oppoK9xClient = androidClient && isOppoK9xClient();
      var onePlusAce2Immersive =
        onePlusAce2ProClient ||
        onePlusAceProClient ||
        onePlusAce2VClient ||
        onePlusAce6Client ||
        onePlus12Client ||
        oppoReno10Client ||
        oppoK9xClient;
      var androidOuterStatusBar =
        androidClient &&
        isAndroidOuterStatusBarClient() &&
        !xiaomi14Client &&
        !xiaomiMixFoldClient &&
        !xiaomi13Client &&
        !xiaomi13ProClient &&
        !xiaomi14ProClient &&
        !xiaomi15ProClient &&
        !xiaomi10NotchClient &&
        !redmiK70UltraClient &&
        !redmiK80ProClient &&
        !redmi12CClient &&
        !redmiNote115GClient &&
        !huaweiMate60Client &&
        !huaweiMate30Client &&
        !huaweiLioAn00Client &&
        !huaweiNova13Client &&
        !onePlusAce2Immersive;
      var iosIPhone11Pro = iosClient && isIPhone11ProLikeClient();
      var iosIPhoneAir = iosClient && isIPhoneAirClient();
      var iosIPhone17Pro = iosClient && isIPhone17ProLikeClient();
      var iosIPhone17ProMax = iosClient && isIPhone17ProMaxClient();
      var iosIPhone16ProMax = iosClient && isIPhone16ProMaxClient();
      var iosIPhone16Pro = iosClient && isIPhone16ProLikeClient();
      var iosIPhone14Pro = iosClient && isIPhone14ProLikeClient();
      var iosIPhone14 = iosClient && isIPhone14LikeClient();
      var iosIPhone13 = iosClient && isIPhone13Client();
      var iosIPhone13ProMax = iosClient && isIPhone13ProMaxClient();
      var iosIPhone12Pro = iosClient && isIPhone12ProLikeClient();
      var iosIPhone15 = iosClient && isIPhone15LikeClient();
      var iosIPhone15ProMax = iosClient && isIPhone15PlusProMaxLikeClient();
      var iosIPhone12ProMax = iosClient && isIPhone12ProMaxClient();
      var iosIPhoneProMaxFont = iosClient && isIPhoneProMaxLargeFontClient();
      var huaweiPura70Client = androidClient && isHuaweiPura70LikeClient();
      var cordovaHuaweiPura70 = cordovaShell && huaweiPura70Client;
      var huaweiClsAl00Client = androidClient && isHuaweiClsAl00Client();
      var huaweiTasAn00Client = androidClient && isHuaweiTasAn00Client();
      var onePlus13Client = androidClient && isOnePlus13Client();
      var samsungOneUiFamily = androidClient && isSamsungOneUiFamilyClient();
      var samsungS24UltraClient = androidClient && isSamsungS24UltraClient();
      var huaweiHarmonyFamily =
        androidClient &&
        isHuaweiHarmonyOsFamilyClient() &&
        !huaweiMate60Client &&
        !huaweiMate30Client &&
        !huaweiLioAn00Client &&
        !huaweiNova13Client;
      var hiNovaFamily = androidClient && isHiNovaFamilyClient();
      var tallAndroidStatusBar =
        androidClient &&
        !xiaomi14Client &&
        !redmiK70Client &&
        !(xiaomiHyperOsFamily && !xiaomi14Client) &&
        !oppoColorOsFamily &&
        !vivoOriginOsFamily &&
        !samsungOneUiFamily &&
        !huaweiHarmonyFamily &&
        !huaweiMate60Client &&
        isTallAndroidStatusBarClient();
      /*
       * 默认：Cordova / iOS / Android 用浅色根底，避免切页蓝闪。
       * 蓝顶栏页（我的/待办/办查/消息）：根底与顶色一致 + translucent，消除刘海白条。
       */
      var lightRootChrome = cordovaShell || iosClient || androidClient;
      var immersiveBlueTop = getImmersiveBlueTopColor();
      /*
       * 安卓 / 鸿蒙蓝顶页：系统栏用黑条（theme-color=#000），与 iOS black-translucent 蓝顶区分。
       * 小米 14 / 23127 等同黑条。
       */
      var rootChromeBg =
        androidClient && (immersiveBlueTop || cordovaXiaomi23127 || xiaomi14Client)
          ? '#000000'
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
        androidClient && immersiveBlueTop
          ? 'black'
          : immersiveBlueTop || !lightRootChrome
            ? 'black-translucent'
            : 'default'
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
            : huaweiMate60Client
            ? '40px'
            : xiaomiImmersiveTop ||
                xiaomi13ProClient ||
                xiaomi15ProClient ||
                xiaomi14ProClient ||
                xiaomi10NotchClient ||
                redmiK70UltraClient ||
                redmiK80ProClient ||
                redmi12CClient ||
                redmiNote115GClient ||
                onePlusAce2Immersive ||
                vivoImmersiveTop
            ? '40px'
            : cordovaHuaweiPura70
            ? '0px'
            : huaweiPura70Client
            ? '32px'
            : huaweiLioAn00Client
            ? '40px'
            : onePlus13Client
            ? '40px'
            : honorFoldableOuterBarClient
            ? '0px'
            : honorPtpAn00Client
            ? '44px'
            : honorPgtAn20Client
              ? '36px'
              : xiaomi14Client || cordovaXiaomi23127
                ? '48px'
              : androidOuterStatusBar ||
                  redmiK70Client ||
                  samsungOneUiFamily ||
                  huaweiHarmonyFamily ||
                  (xiaomiHyperOsFamily && !xiaomi14Client) ||
                  (oppoColorOsFamily && !onePlus13Client && !onePlusAce2Immersive) ||
                  (vivoOriginOsFamily && !vivoImmersiveTop)
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
      if (honorMagic6ProClient) {
        document.documentElement.classList.add('app-android-client');
        document.documentElement.classList.add('app-android-honor-magic6pro');
      }
      if (androidClient && isXiaomi14LikeClient()) {
        document.documentElement.classList.add('app-android-xiaomi-14');
        /* 首帧申请黑条；HyperOS 常忽略 overlays=false，CSS 另绘 48px 页内黑边兜底 */
        try {
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
        } catch (eMi14Bar) {}
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
      if (xiaomi13ProClient) {
        document.documentElement.classList.add('app-android-xiaomi-13pro');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (xiaomi13Client) {
        document.documentElement.classList.add('app-android-xiaomi-13');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (xiaomi14ProClient) {
        document.documentElement.classList.add('app-android-xiaomi-14pro');
      }
      if (xiaomi15ProClient) {
        document.documentElement.classList.add('app-android-xiaomi-15pro');
      }
      if (xiaomi15Client) {
        document.documentElement.classList.add('app-android-xiaomi-15');
        document.documentElement.classList.add('app-android-immersive-white-top');
        document.documentElement.classList.remove('app-android-white-page-outer');
        document.documentElement.style.setProperty('--app-shell-statusbar-top', '40px');
        document.documentElement.style.setProperty('--android-status-inset', '40px');
      }
      if (xiaomi10NotchClient) {
        document.documentElement.classList.add('app-android-xiaomi-10');
      }
      if (redmiK70UltraClient) {
        document.documentElement.classList.add('app-android-redmi-k70-ultra');
      }
      if (redmiK80ProClient) {
        document.documentElement.classList.add('app-android-redmi-k80pro');
      }
      if (redmi12CClient) {
        document.documentElement.classList.add('app-android-redmi-12c');
      }
      if (redmiNote115GClient) {
        document.documentElement.classList.add('app-android-redmi-note11-5g');
      }
      if (xiaomiImmersiveTop || onePlusAce2Immersive || huaweiMate60Client) {
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (xiaomiHyperOsFamily && !xiaomi14Client) {
        document.documentElement.classList.add('app-android-mi-family');
      }
      if (cordovaXiaomi2410) {
        document.documentElement.classList.add('app-cordova-xiaomi-2410');
      }
      if (android25060RK16C) {
        document.documentElement.classList.add('app-android-25060rk16c');
        document.documentElement.classList.add('app-android-redmi-k80ultra');
      }
      if (vivoX200ProClient) {
        document.documentElement.classList.add('app-android-vivo-x200pro');
        document.documentElement.classList.add('app-android-immersive-white-top');
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
      if (vivoOriginOsFamily && !vivoImmersiveTop) {
        document.documentElement.classList.add('app-android-vivo-family');
      }
      if (iqoo13Client) {
        document.documentElement.classList.add('app-android-iqoo-13');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (iqoo15Client) {
        document.documentElement.classList.add('app-android-iqoo-15');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (meizu20ProClient) {
        document.documentElement.classList.add('app-android-meizu-20pro');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (iqooNeo8Client) {
        document.documentElement.classList.add('app-android-iqoo-neo8');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (iqooNeo8ProClient) {
        document.documentElement.classList.add('app-android-iqoo-neo8pro');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (vivoX300ProClient) {
        document.documentElement.classList.add('app-android-vivo-x300pro');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (vivoS50ProMiniClient) {
        document.documentElement.classList.add('app-android-vivo-s50promini');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (vivoX90Client) {
        document.documentElement.classList.add('app-android-vivo-x90');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (iosClient) {
        document.documentElement.classList.add('app-ios-client');
      }
      if (iosIPhone11Pro) {
        document.documentElement.classList.add('app-ios-iphone11pro');
      }
      if (iosIPhoneAir) {
        document.documentElement.classList.add('app-ios-iphoneair');
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
      if (!iosIPhoneAir) {
        if (
          iosIPhone16ProMax ||
          iosIPhone15ProMax ||
          iosIPhone17ProMax ||
          (iosClient && isIPhoneLargePromaxWidthViewport())
        ) {
          markIosPromaxWideLayout();
        } else {
          try {
            if (sessionStorage.getItem('tax_ios_promax_wide_v1') === '1') {
              markIosPromaxWideLayout();
            }
          } catch (eWideSeen) {}
        }
      }
      if (iosIPhone14 || iosIPhone12Pro) {
        /* 12 Pro 与 14 同为 390×844 刘海，复用白顶栏避让样式 */
        document.documentElement.classList.add('app-ios-iphone14');
      }
      if (iosIPhone13) {
        document.documentElement.classList.add('app-ios-iphone13');
      }
      if (iosIPhone13ProMax) {
        document.documentElement.classList.add('app-ios-iphone13promax');
      }
      if (iosIPhone12Pro) {
        document.documentElement.classList.add('app-ios-iphone12pro');
      }
      if (iosIPhone15) {
        document.documentElement.classList.add('app-ios-iphone15');
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
      if (iosIPhoneAir) {
        document.documentElement.classList.remove('app-ios-promax-wide');
        document.documentElement.classList.remove('app-ios-iphone-promax-font');
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
      if (huaweiMate30Client) {
        document.documentElement.classList.add('app-android-huawei-mate30');
      }
      if (huaweiLioAn00Client) {
        document.documentElement.classList.add('app-android-huawei-lio-an00');
        document.documentElement.classList.add('app-android-huawei-mate30pro');
        document.documentElement.classList.add('app-android-immersive-white-top');
        document.documentElement.classList.remove('app-android-white-page-outer');
        document.documentElement.style.setProperty('--app-shell-statusbar-top', '40px');
      }
      if (huaweiMate60Client) {
        document.documentElement.classList.add('app-android-huawei-mate60');
        document.documentElement.classList.add('app-android-immersive-white-top');
        document.documentElement.classList.remove('app-huawei-mine-noclip');
        document.documentElement.classList.remove('app-android-huawei-harmony');
        document.documentElement.style.setProperty('--app-shell-statusbar-top', '40px');
      }
      if (huaweiP40ProClient) {
        document.documentElement.classList.add('app-android-client');
        document.documentElement.classList.add('app-android-huawei-p40pro');
        document.documentElement.classList.remove('app-huawei-mine-noclip');
      }
      if (huaweiNova13Client) {
        document.documentElement.classList.add('app-android-client');
        document.documentElement.classList.add('app-android-huawei-nova13');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (huaweiHarmonyFamily && !huaweiMate60Client) {
        document.documentElement.classList.add('app-android-huawei-harmony');
      }
      if (hiNovaFamily) {
        document.documentElement.classList.add('app-android-hinova');
      }
      if (hiNova9SeClient) {
        document.documentElement.classList.add('app-android-hinova9se');
        document.documentElement.classList.add('app-android-immersive-white-top');
        document.documentElement.style.setProperty('--app-shell-statusbar-top', '40px');
        document.documentElement.style.setProperty('--android-status-inset', '40px');
      }
      if (onePlus13Client) {
        document.documentElement.classList.add('app-android-oneplus-13');
      }
      if (onePlusAce2ProClient) {
        document.documentElement.classList.add('app-android-oneplus-ace2pro');
      }
      if (onePlusAceProClient) {
        document.documentElement.classList.add('app-android-oneplus-acepro');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (onePlusAce2VClient) {
        document.documentElement.classList.add('app-android-oneplus-ace2v');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (onePlusAce6Client) {
        document.documentElement.classList.add('app-android-oneplus-ace6');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (onePlus12Client) {
        document.documentElement.classList.add('app-android-oneplus-12');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (oppoReno10Client) {
        document.documentElement.classList.add('app-android-oppo-reno10');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
      if (oppoK9xClient) {
        document.documentElement.classList.add('app-android-oppo-k9x');
        document.documentElement.classList.add('app-android-immersive-white-top');
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
          'html.app-android-xiaomi-14.app-top-safe-shell{--app-shell-statusbar-top:48px !important;--android-status-inset:48px !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell::before{content:"" !important;position:fixed !important;left:0 !important;right:0 !important;top:0 !important;height:var(--app-shell-statusbar-top,48px) !important;background:#000 !important;z-index:2147483000 !important;pointer-events:none !important;}' +
          'html.app-android-xiaomi-mix-fold.app-top-safe-shell{--app-shell-statusbar-top:40px !important;}' +
          'html.app-android-xiaomi-13.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-xiaomi-13pro.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-xiaomi-15.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-xiaomi-10.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-iqoo-neo8.app-top-safe-shell,html.app-android-iqoo-neo8pro.app-top-safe-shell,html.app-android-iqoo-13.app-top-safe-shell,html.app-android-iqoo-15.app-top-safe-shell,html.app-android-meizu-20pro.app-top-safe-shell,html.app-android-vivo-x300pro.app-top-safe-shell,html.app-android-vivo-s50promini.app-top-safe-shell,html.app-android-vivo-x200pro.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-vivo-x90.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-redmi-k70.app-top-safe-shell:not(.app-android-redmi-k80pro):not(.app-android-redmi-k80ultra):not(.app-android-immersive-white-top),html.app-android-mi-family.app-top-safe-shell:not(.app-android-redmi-k80pro):not(.app-android-redmi-k80ultra):not(.app-android-xiaomi-15):not(.app-android-xiaomi-15pro):not(.app-android-immersive-white-top),html.app-android-oppo-family.app-top-safe-shell:not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x):not(.app-android-immersive-white-top),html.app-android-vivo-family.app-top-safe-shell:not(.app-android-immersive-white-top):not(.app-android-vivo-x300pro):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x90):not(.app-android-iqoo-13):not(.app-android-iqoo-15):not(.app-android-meizu-20pro),html.app-android-samsung.app-top-safe-shell:not(.app-android-immersive-white-top),html.app-android-samsung-s24u.app-top-safe-shell:not(.app-android-immersive-white-top),html.app-android-huawei-harmony.app-top-safe-shell:not(.app-android-huawei-mate60):not(.app-android-huawei-mate70):not(.app-android-huawei-mate30):not(.app-android-huawei-mate30pro):not(.app-android-huawei-lio-an00):not(.app-android-huawei-nova13):not(.app-android-immersive-white-top),html.app-android-hinova.app-top-safe-shell:not(.app-android-immersive-white-top){--app-shell-statusbar-top:0px !important;}' +
          /* 沉浸压栏机（含 Mate60 / Mate70 白顶栏 / 小米10 / K70至尊 / 12C / Ace 2 Pro / Neo8 Pro / 魅族 20 Pro）：压过族清零 */ +
          'html.app-android-immersive-white-top.app-top-safe-shell,' +
          'html.app-android-huawei-mate60.app-top-safe-shell,' +
          'html.app-android-huawei-mate70.app-top-safe-shell,' +
          'html.app-android-huawei-mate30.app-android-immersive-white-top.app-top-safe-shell,' +
          'html.app-android-huawei-mate30pro.app-android-immersive-white-top.app-top-safe-shell,' +
          'html.app-android-huawei-lio-an00.app-android-immersive-white-top.app-top-safe-shell,' +
          'html.app-android-huawei-harmony.app-android-huawei-mate70.app-top-safe-shell,' +
          'html.app-android-huawei-harmony.app-android-immersive-white-top.app-top-safe-shell,' +
          'html.app-android-huawei-nova13.app-top-safe-shell,' +
          'html.app-android-huawei-nova13.app-android-immersive-white-top.app-top-safe-shell,' +
          'html.app-android-oneplus-ace2pro.app-top-safe-shell,' +
          'html.app-android-oneplus-acepro.app-top-safe-shell,' +
          'html.app-android-oneplus-ace2v.app-top-safe-shell,' +
          'html.app-android-oneplus-ace6.app-top-safe-shell,' +
          'html.app-android-oneplus-12.app-top-safe-shell,' +
          'html.app-android-oppo-reno10.app-top-safe-shell,' +
          'html.app-android-xiaomi-10.app-top-safe-shell,' +
          'html.app-android-iqoo-neo8.app-top-safe-shell,' +
          'html.app-android-iqoo-neo8pro.app-top-safe-shell,' +
          'html.app-android-iqoo-13.app-top-safe-shell,html.app-android-iqoo-15.app-top-safe-shell,' +
          'html.app-android-meizu-20pro.app-top-safe-shell,' +
          'html.app-android-vivo-x300pro.app-top-safe-shell,' +
          'html.app-android-vivo-s50promini.app-top-safe-shell,' +
          'html.app-android-vivo-x200pro.app-top-safe-shell,' +
          'html.app-android-vivo-x90.app-top-safe-shell,' +
          'html.app-android-redmi-k70-ultra.app-top-safe-shell,' +
          'html.app-android-xiaomi-15.app-top-safe-shell,' +
          'html.app-android-redmi-k80pro.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-redmi-k80ultra.app-top-safe-shell,html.app-android-25060rk16c.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-redmi-12c.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-redmi-note11-5g.app-top-safe-shell{--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          /* Note11 明细页：顶栏再下移约一行（压过下方 immersive 40px） */ +
          'html.app-android-redmi-note11-5g.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-redmi-note11-5g.app-top-safe-shell.app-android-immersive-white-top body.page-shuiming-result .page-root,' +
          'html.app-android-redmi-note11-5g.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .page-root{' +
          '--app-shell-statusbar-top:70px !important;--safe-top:70px !important;--android-status-inset:70px !important;}' +
          'html.app-android-redmi-note11-5g.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-redmi-note11-5g.app-top-safe-shell.app-android-immersive-white-top body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-redmi-note11-5g.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .header{' +
          'top:0 !important;height:calc(var(--header-height,48px) + 70px) !important;min-height:calc(var(--header-height,48px) + 70px) !important;' +
          'padding:70px 16px 0 !important;box-sizing:border-box !important;}' +
          'html.app-android-redmi-note11-5g.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-redmi-note11-5g.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-redmi-note11-5g.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-redmi-note11-5g.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{' +
          'top:70px !important;height:var(--header-height,48px) !important;}' +
          'html.app-android-redmi-note11-5g.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-redmi-note11-5g.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{' +
          'top:calc(var(--header-height,48px) + 70px) !important;}' +
          'html.app-android-redmi-note11-5g.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-android-redmi-note11-5g.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .list{' +
          'margin-top:calc(var(--header-height,48px) + 70px) !important;}' +
          /* 首页顶距由下方 Android 统一规则接管，勿在此清零 */ +
          'html.app-android-client.app-top-safe-shell .page-root{--safe-top:var(--app-shell-statusbar-top) !important;}' +
          'html.app-android-client.app-top-safe-shell .top-fixed .header{top:0 !important;height:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;padding:var(--app-shell-statusbar-top) 16px 0 !important;z-index:120 !important;}' +
          'html.app-android-client.app-top-safe-shell .top-fixed .header .back-btn,html.app-android-client.app-top-safe-shell .top-fixed .header .header-right{top:var(--app-shell-statusbar-top) !important;height:var(--header-height,52px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-client.app-top-safe-shell .top-fixed .summary{top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-client.app-top-safe-shell .list{margin-top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;}' +
          /* 收入纳税明细：外置黑条机型勿叠顶距；Cordova 沉浸壳用 shell 顶距兜底（压状态栏时） */
          'html.app-android-client.app-top-safe-shell.app-android-oppo-family:not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x):not(.app-android-immersive-white-top) body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-vivo-family:not(.app-android-immersive-white-top):not(.app-android-vivo-x300pro):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x90) body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-mi-family:not(.app-android-xiaomi-14pro):not(.app-android-immersive-white-top) body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-redmi-k70:not(.app-android-immersive-white-top) body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-samsung:not(.app-android-immersive-white-top) body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-samsung-s24u:not(.app-android-immersive-white-top) body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-flc:not(.app-android-immersive-white-top) body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-fcp:not(.app-android-immersive-white-top) body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-shell):not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x):not(.app-android-xiaomi-14pro):not(.app-android-immersive-white-top) body.page-shuiming-result .page-root{--safe-top:0px !important;}' +
          'html.app-android-client.app-top-safe-shell.app-android-oppo-family:not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x):not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-vivo-family:not(.app-android-immersive-white-top):not(.app-android-vivo-x300pro):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x90) body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-mi-family:not(.app-android-xiaomi-14pro):not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-redmi-k70:not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-flc:not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-fcp:not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-shell):not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x):not(.app-android-xiaomi-14pro):not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header{top:0 !important;height:var(--header-height,48px) !important;min-height:var(--header-height,48px) !important;padding:8px 16px !important;box-sizing:border-box !important;z-index:120 !important;}' +
          'html.app-android-client.app-top-safe-shell.app-android-oppo-family:not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x):not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-vivo-family:not(.app-android-immersive-white-top):not(.app-android-vivo-x300pro):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x90) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-mi-family:not(.app-android-xiaomi-14pro):not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-redmi-k70:not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-flc:not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-fcp:not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-oppo-family:not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x):not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-vivo-family:not(.app-android-immersive-white-top):not(.app-android-vivo-x300pro):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x90) body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-mi-family:not(.app-android-xiaomi-14pro):not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-redmi-k70:not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-flc:not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-fcp:not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-shell):not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x):not(.app-android-xiaomi-14pro):not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-shell):not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x):not(.app-android-xiaomi-14pro):not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .header .header-right{top:0 !important;height:var(--header-height,48px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-client.app-top-safe-shell.app-android-oppo-family:not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x):not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-vivo-family:not(.app-android-immersive-white-top):not(.app-android-vivo-x300pro):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x90) body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-mi-family:not(.app-android-xiaomi-14pro):not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-redmi-k70:not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-flc:not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-fcp:not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-shell):not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x):not(.app-android-xiaomi-14pro):not(.app-android-immersive-white-top) body.page-shuiming-result .top-fixed .summary{top:var(--header-height,48px) !important;}' +
          'html.app-android-client.app-top-safe-shell.app-android-oppo-family:not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x):not(.app-android-immersive-white-top) body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-vivo-family:not(.app-android-immersive-white-top):not(.app-android-vivo-x300pro):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x90) body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-mi-family:not(.app-android-xiaomi-14pro):not(.app-android-immersive-white-top) body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-redmi-k70:not(.app-android-immersive-white-top) body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-flc:not(.app-android-immersive-white-top) body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-honor-fcp:not(.app-android-immersive-white-top) body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-shell):not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x):not(.app-android-xiaomi-14pro):not(.app-android-immersive-white-top) body.page-shuiming-result .list{margin-top:var(--header-height,48px) !important;}' +
          /* 白顶栏默认沉浸：压过族清零后，Cordova / 非 Cordova 都按壳顶距排版（Note11 明细 70px / 小米 14 黑条除外） */
          'html.app-android-client.app-top-safe-shell.app-android-immersive-white-top:not(.app-android-redmi-note11-5g):not(.app-android-xiaomi-14) body.page-shuiming-result .page-root{--safe-top:var(--app-shell-statusbar-top,40px) !important;}' +
          'html.app-android-client.app-top-safe-shell.app-android-immersive-white-top:not(.app-android-redmi-note11-5g):not(.app-android-xiaomi-14) body.page-shuiming-result .top-fixed .header{top:0 !important;height:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;min-height:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;padding:var(--app-shell-statusbar-top,40px) 16px 0 !important;box-sizing:border-box !important;z-index:120 !important;background:#fff !important;}' +
          'html.app-android-client.app-top-safe-shell.app-android-immersive-white-top:not(.app-android-redmi-note11-5g):not(.app-android-xiaomi-14) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-immersive-white-top:not(.app-android-redmi-note11-5g):not(.app-android-xiaomi-14) body.page-shuiming-result .top-fixed .header .header-right{top:var(--app-shell-statusbar-top,40px) !important;height:var(--header-height,48px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-client.app-top-safe-shell.app-android-immersive-white-top:not(.app-android-redmi-note11-5g):not(.app-android-xiaomi-14) body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;}' +
          'html.app-android-client.app-top-safe-shell.app-android-immersive-white-top:not(.app-android-redmi-note11-5g):not(.app-android-xiaomi-14) body.page-shuiming-result .list{margin-top:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;}' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .page-root{--safe-top:var(--app-shell-statusbar-top,48px) !important;}' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .header{top:0 !important;height:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,48px)) !important;min-height:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,48px)) !important;padding:var(--app-shell-statusbar-top,48px) 16px 0 !important;box-sizing:border-box !important;z-index:120 !important;background:#fff !important;}' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{top:var(--app-shell-statusbar-top,48px) !important;height:var(--header-height,48px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,48px)) !important;}' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .list{margin-top:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,48px)) !important;}' +
          'html.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed{height:0 !important;margin:0 !important;padding:0 !important;overflow:visible !important;}' +
          'html.app-top-safe-shell .search-bar-wrapper{padding-top:calc(6px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-top-safe-shell body.page-shouye .search-bar-wrapper{background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;box-shadow:none !important;}' +
          'html.app-top-safe-shell:not(.app-ios-client) body.page-shouye .shouye-page{padding-top:var(--shouye-fixed-top-h,78px) !important;}' +
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
          'html.app-android-honor-magic.app-top-safe-shell:not(.app-android-honor-pgt-an20) .search-bar-wrapper{padding-top:calc(8px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell body.page-shouye .search-bar-wrapper{background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell body.page-shouye .search-bar-wrapper.scrolled{background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243)) !important;background-image:url(/img/home/apk-home-header-bg.png) !important;background-size:100% auto !important;background-position:top center !important;background-repeat:no-repeat !important;}' +
          'html.app-android-honor-pgt-an20.app-top-safe-shell{--app-shell-statusbar-top:36px !important;}' +
          'html.app-android-client.app-android-honor-pgt-an20.app-top-safe-shell body.page-shouye{--shouye-status-inset:8px !important;--app-shell-statusbar-top:8px !important;}' +
          'html.app-android-client.app-android-honor-pgt-an20.app-top-safe-shell body.page-shouye::before{height:8px !important;}' +
          'html.app-android-client.app-android-honor-pgt-an20.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye .search-bar-wrapper,html.app-android-honor-pgt-an20.app-android-honor-magic.app-top-safe-shell body.page-shouye .search-bar-wrapper{padding-top:8px !important;}' +
          'html.app-android-client.app-android-honor-pgt-an20.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye .shouye-page{padding-top:var(--shouye-fixed-top-h,60px) !important;}' +
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
          'html.app-top-safe-shell body.page-consult > .header .back-link{position:static !important;top:auto !important;left:auto !important;right:auto !important;}' +
          /* Mate60 个人信息：相对定位垫高，返回钮跟标题同一行；禁止 sticky+top:52 */
          'html.app-android-huawei-mate60 body.page-personal-info > .header,' +
          'html.app-android-huawei-mate60 body.page-gerenxinxi > .header{' +
          'position:relative !important;top:0 !important;' +
          'padding-top:calc(14px + var(--app-shell-statusbar-top,52px)) !important;padding-bottom:14px !important;' +
          'box-sizing:border-box !important;height:auto !important;min-height:0 !important;background:#fff !important;z-index:100 !important;}' +
          'html.app-android-huawei-mate60 body.page-personal-info > .header .back-btn,' +
          'html.app-android-huawei-mate60 body.page-gerenxinxi > .header .back-btn{' +
          'top:calc(14px + var(--app-shell-statusbar-top,52px)) !important;height:24px !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-huawei-mate60 #arkWhiteTopShield{background:#fff !important;}' +
          'html.app-top-safe-shell body.page-login .header{padding-top:calc(15px + var(--app-shell-statusbar-top)) !important;}' +
          /* Android 白顶栏页：高度随内容；顶距由统一 inset / 页级规则负责，勿写死 14px 顶到状态栏 */
          'html.app-android-client.app-top-safe-shell body > .header{height:auto !important;min-height:0 !important;padding-bottom:15px !important;}' +
          /* 外置状态栏机：登录顶栏 15px 即可；Mate60 等沉浸压栏须保留壳顶距，否则「密码」会顶进系统时间 */
          'html.app-android-client.app-top-safe-shell:not(.app-android-huawei-mate60):not(.app-android-immersive-white-top) body.page-login .header{min-height:auto !important;padding-top:15px !important;}' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-login .header,' +
          'html.app-android-immersive-white-top.app-top-safe-shell body.page-login .header{min-height:auto !important;padding-top:calc(15px + var(--app-shell-statusbar-top,40px)) !important;}' +
          /* 注册页：Cordova env(safe-area) 常为 0，键盘弹起滚动时「密码」易压进状态栏 */
          'html.app-android-huawei-mate60 body.page-register,' +
          'html.app-android-immersive-white-top body.page-register{--app-shell-statusbar-top:40px !important;--safe-t:40px !important;scroll-padding-top:52px !important;}' +
          'html.app-android-huawei-mate60 body.page-register .reg-top,' +
          'html.app-android-immersive-white-top body.page-register .reg-top{position:sticky !important;top:0 !important;z-index:30 !important;background:#f4f7fb !important;padding-top:calc(12px + var(--app-shell-statusbar-top,40px)) !important;}' +
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
          'html.app-ios-iphone16pro.app-top-safe-shell,html.app-ios-iphone16promax.app-top-safe-shell,html.app-ios-iphone15promax.app-top-safe-shell,html.app-ios-iphone17promax.app-top-safe-shell{--app-shell-statusbar-top:max(59px,env(safe-area-inset-top,59px)) !important;}' +
          /* iOS 我的：头图顶入，禁用拼接伪元素 */
          'html.app-ios-client.app-top-safe-shell body.page-mine::before,html.app-ios-client.app-top-safe-shell body.page-mine .header-bg::after{display:none !important;content:none !important;}' +
          'html.app-ios-client.app-top-safe-shell body.page-mine .header-bg{position:relative;z-index:0 !important;padding-top:var(--app-shell-statusbar-top,0px) !important;overflow:hidden !important;background:#2286ee !important;}' +
          'html.app-ios-client.app-top-safe-shell body.page-mine .header-bg > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,0px)) !important;position:relative !important;z-index:1 !important;display:block !important;width:100% !important;}' +
          'html.app-ios-client.app-top-safe-shell body.page-mine .mine-activate-btn,html.app-ios-client.app-top-safe-shell body.page-mine .mine-fill-data-btn{top:calc(var(--mine-activate-btn-top-offset,66px) + var(--app-shell-statusbar-top,0px)) !important;}' +
          'html body.page-mine,html body.page-shouye{--bottom-nav-bottom:var(--bottom-nav-gap,8px)!important;min-height:100vh!important;}' +
          'html body.page-mine > .bottom-nav,html body.page-shouye > .bottom-nav{bottom:var(--bottom-nav-bottom,8px)!important;top:auto!important;margin:0!important;height:var(--bottom-nav-height,54px)!important;min-height:var(--bottom-nav-height,54px)!important;max-height:var(--bottom-nav-height,54px)!important;padding-top:8px!important;padding-bottom:8px!important;box-sizing:border-box!important;transform:none!important;-webkit-transform:none!important;}' +
          'html.app-ios-client body.page-mine,html.app-ios-client body.page-shouye{--bottom-nav-bottom:8px!important;--bottom-nav-gap:8px!important;}' +
          'html.app-ios-client body.page-mine > .bottom-nav,html.app-ios-client body.page-mine > .bottom-nav.ios-device,html.app-ios-client body.page-shouye > .bottom-nav,html.app-ios-client body.page-shouye > .bottom-nav.ios-device{bottom:8px!important;height:var(--bottom-nav-height,54px)!important;padding-top:8px!important;padding-bottom:8px!important;margin-bottom:0!important;top:auto!important;transform:none!important;-webkit-transform:none!important;}' +
          'html.app-ios-iphone16pro body.page-shouye > .bottom-nav,html.app-ios-iphone16pro body.page-daiban > .bottom-nav,html.app-ios-iphone16pro body.page-bancha > .bottom-nav,html.app-ios-iphone16pro body.page-message > .bottom-nav,html.app-ios-iphone16pro body.page-mine > .bottom-nav,html.app-ios-iphone16pro body.page-mine > .bottom-nav.ios-device,html.app-ios-iphone16promax body.page-shouye > .bottom-nav,html.app-ios-iphone16promax body.page-daiban > .bottom-nav,html.app-ios-iphone16promax body.page-bancha > .bottom-nav,html.app-ios-iphone16promax body.page-message > .bottom-nav,html.app-ios-iphone16promax body.page-mine > .bottom-nav,html.app-ios-iphone16promax body.page-mine > .bottom-nav.ios-device{bottom:8px!important;}' +
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
          'html.app-ios-iphone12promax.app-top-safe-shell body.page-mine .mine-activate-btn,html.app-ios-iphone12promax.app-top-safe-shell body.page-mine .mine-fill-data-btn{top:calc(var(--mine-activate-btn-top-offset,66px) + env(safe-area-inset-top,0px)) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-cordova-xiaomi-23127) body.page-mine .header-bg > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,0px)) !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell{--app-shell-statusbar-top:48px !important;--android-status-inset:48px !important;--app-cordova-statusbar-chrome:48px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .search-bar-wrapper{padding-top:calc(6px + var(--app-shell-statusbar-top,48px)) !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shouye .shouye-banner-wrap .notice-bar{position:relative !important;top:auto !important;margin:2px 12px 14px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .bancha-header:not([data-header-mode="builtin"]){padding-top:var(--app-cordova-statusbar-chrome,48px) !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .bancha-header[data-header-mode="builtin"]{padding-top:0 !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .bancha-header:not([data-header-mode="builtin"]) > img{margin-top:calc(-1 * var(--app-cordova-statusbar-chrome,48px)) !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .daiban-header:not([data-header-mode="builtin"]){padding-top:var(--app-cordova-statusbar-chrome,48px) !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .daiban-header[data-header-mode="builtin"]{padding-top:0 !important;background:#2b81f2 !important;overflow:hidden !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .daiban-header:not([data-header-mode="builtin"]) > img{margin-top:calc(-1 * var(--app-cordova-statusbar-chrome,48px)) !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .message-header-toolbar{padding-top:calc(14px + var(--app-cordova-statusbar-chrome,48px)) !important;padding-bottom:20px !important;padding-left:16px !important;padding-right:16px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .header-bg{padding-top:var(--app-cordova-statusbar-chrome,48px) !important;background:#2286ee !important;overflow:hidden !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .header-bg > img{margin-top:calc(-1 * var(--app-cordova-statusbar-chrome,48px)) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-cordova-xiaomi-23127) body.page-mine .user-card{margin:-50px 16px 0 !important;border-radius:12px 12px 0 0 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .user-card{margin:-50px 16px 0 !important;border-radius:12px 12px 0 0 !important;padding:16px 14px 14px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .user-name{margin-bottom:4px !important;line-height:1.25 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .personal-info-btn{top:16px !important;}' +
          'html.app-cordova-xiaomi-m2102 body.page-mine .user-card{padding:12px 0 12px 12px !important;}' +
          'html.app-cordova-xiaomi-m2102 body.page-mine .user-name{font-size:12px !important;margin-bottom:4px !important;line-height:1.25 !important;}' +
          'html.app-android-huawei-tas-an00 body.page-mine .user-name{font-size:13px !important;line-height:1.35 !important;}' +
          'html.app-cordova-xiaomi-m2102 body.page-mine .user-id{font-size:10px !important;line-height:1.25 !important;word-break:normal !important;white-space:nowrap !important;flex-wrap:nowrap !important;gap:4px !important;}' +
          'html.app-cordova-xiaomi-m2102 body.page-mine #userTaxIdText{white-space:nowrap !important;letter-spacing:-0.02em !important;}' +
          'html.app-cordova-xiaomi-m2102 body.page-mine .personal-info-btn{font-size:10.5px !important;padding:4px 8px 4px 10px !important;}' +
          'html.app-cordova-xiaomi-m2102.app-top-safe-shell body.page-mine .mine-activate-btn{position:fixed !important;top:calc(var(--mine-activate-btn-top-offset,66px) + var(--app-shell-statusbar-top,48px)) !important;right:18px !important;z-index:500 !important;}' +
          'html.app-cordova-xiaomi-m2102.app-top-safe-shell body.page-mine .mine-fill-data-btn{position:fixed !important;top:calc(var(--mine-activate-btn-top-offset,66px) + var(--app-shell-statusbar-top,48px)) !important;left:18px !important;z-index:500 !important;}' +
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
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .mine-fill-data-btn{position:fixed !important;top:calc(var(--mine-activate-btn-top-offset,66px) + var(--app-cordova-statusbar-chrome,40px)) !important;left:18px !important;z-index:500 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .header-activate-btn{position:fixed !important;top:calc(10px + var(--app-cordova-statusbar-chrome,40px)) !important;right:12px !important;z-index:500 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .back-link{top:calc(10px + var(--app-cordova-statusbar-chrome,40px)) !important;}' +
          /* 收入纳税明细：小米 14 页内黑条 + 顶距，标题避开时间/灵动岛 */
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-android-xiaomi-14pro) body.page-shuiming-result .page-root,html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .page-root{--safe-top:var(--app-shell-statusbar-top,48px) !important;--android-status-inset:48px !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-android-xiaomi-14pro) body.page-shuiming-result .top-fixed .header,html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .top-fixed .header{top:0 !important;height:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,48px)) !important;min-height:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,48px)) !important;padding:var(--app-shell-statusbar-top,48px) 16px 0 !important;box-sizing:border-box !important;background:#fff !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-android-xiaomi-14pro) body.page-shuiming-result .top-fixed .header .back-btn,html.app-android-xiaomi-14.app-top-safe-shell:not(.app-android-xiaomi-14pro) body.page-shuiming-result .top-fixed .header .header-right,html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{top:var(--app-shell-statusbar-top,48px) !important;height:var(--header-height,48px) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-android-xiaomi-14pro) body.page-shuiming-result .top-fixed .summary,html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,48px)) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-android-xiaomi-14pro) body.page-shuiming-result .list,html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .list{margin-top:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,48px)) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell body.page-shouye{--shouye-status-inset:48px !important;--app-shell-statusbar-top:48px !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell body.page-shouye::before{background:#000 !important;background-image:none !important;height:var(--shouye-status-inset,48px) !important;z-index:9999 !important;}' +
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
          'html.app-ios-client.app-top-safe-shell:has(body.page-shouye){background-color:#f6f7fb !important;background-image:linear-gradient(rgb(var(--shouye-top-bar-rgb,79, 144, 243)),rgb(var(--shouye-top-bar-rgb,79, 144, 243))) !important;background-size:100% var(--app-shell-statusbar-top,env(safe-area-inset-top,48px)) !important;background-repeat:no-repeat !important;background-position:top center !important;}' +
          'html.app-ios-client.app-top-safe-shell body.page-shouye{background:#f6f7fb !important;min-height:100vh !important;height:auto !important;}' +
          /* iPhone 16 Pro：收入纳税明细筛选页顶栏铺满安全区，避免状态栏下露灰/色差 */
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming > .header{position:fixed !important;top:0 !important;left:0 !important;right:0 !important;z-index:120 !important;background:#fff !important;border-bottom:1px solid #eee !important;padding-top:calc(14px + var(--app-shell-statusbar-top)) !important;padding-bottom:15px !important;box-sizing:border-box !important;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming > .content{padding-top:calc(46px + var(--app-shell-statusbar-top)) !important;}' +
          /* iPhone 16 Pro：收入纳税明细结果页顶栏+汇总区铺满安全区，状态栏与导航同为白底 */
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .page-root{--header-height:44px !important;--safe-top:var(--app-shell-statusbar-top) !important;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header{top:0 !important;height:calc(var(--header-height,44px) + var(--app-shell-statusbar-top)) !important;padding:var(--app-shell-statusbar-top) 16px 0 !important;background:#fff !important;box-sizing:border-box !important;box-shadow:none !important;z-index:120 !important;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{top:var(--app-shell-statusbar-top) !important;height:var(--header-height,44px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,44px) + var(--app-shell-statusbar-top)) !important;background:#f5f6fa !important;padding:12px 0 10px !important;box-sizing:border-box !important;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .list{margin-top:calc(var(--header-height,44px) + var(--app-shell-statusbar-top)) !important;padding-left:0 !important;padding-right:0 !important;width:100% !important;max-width:100% !important;box-sizing:border-box !important;background:#f5f6fa !important;}' +
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
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result .top-fixed .header,html.app-ios-iphone16promax.app-top-safe-shell body.page-shuiming-result .top-fixed .header{top:var(--app-shell-statusbar-top) !important;height:var(--header-height,52px) !important;padding:15px 20px !important;background:#fff !important;box-sizing:border-box !important;z-index:120 !important;}' +
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,html.app-ios-iphone16promax.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-ios-iphone16promax.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{top:auto !important;height:auto !important;display:flex !important;align-items:center !important;}' +
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;background:#f5f6fa !important;z-index:121 !important;padding:10px 0 6px !important;}' +
          'html.app-ios-iphone16promax.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;background:#fff !important;z-index:121 !important;}' +
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result .list,html.app-ios-iphone16promax.app-top-safe-shell body.page-shuiming-result .list{margin-top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;}' +
          /* 15 Plus 顶距交给 syncTopFixedHeight 实测写入，勿 !important 锁死以免盖住首条 */
          /* 15 Plus 列表贴边铺满（压过 min-width:414 / promax-wide 的 20px） */
          'html.app-ios-iphone15promax body.page-shuiming-result .list,html.app-ios-iphone15promax.app-ios-promax-wide body.page-shuiming-result .list{padding-left:0 !important;padding-right:0 !important;box-sizing:border-box !important;}' +
          'html.app-ios-iphone15promax body.page-shuiming-result .list-item,html.app-ios-iphone15promax.app-ios-promax-wide body.page-shuiming-result .list-item{--list-inline-pad:16px;border-radius:0 !important;margin-left:0 !important;margin-right:0 !important;width:100% !important;max-width:none !important;box-sizing:border-box !important;}' +
          'html.app-ios-iphone15promax body.page-shuiming-result .summary > .summary-item,html.app-ios-iphone15promax.app-ios-promax-wide body.page-shuiming-result .summary > .summary-item{padding-left:16px !important;padding-right:16px !important;}' +
          'html.app-ios-iphone15promax body.page-shuiming-result .top-fixed .header,html.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result .top-fixed .header{padding-left:12px !important;padding-right:12px !important;}' +
          'html.app-ios-iphone15promax body.page-shuiming-result .back-btn{left:12px !important;}' +
          'html.app-ios-iphone15promax body.page-shuiming-result .header-right{right:12px !important;}' +
          'html.app-ios-iphone15promax body.page-shuiming-result .sm-activate-card,html.app-ios-iphone15promax body.page-shuiming-result .sm-refund-browse-card{margin-left:0 !important;margin-right:0 !important;border-radius:0 !important;}' +
          'html.app-ios-promax-wide body.page-shuiming-result .list,html.app-ios-iphone16promax body.page-shuiming-result .list{padding-left:0 !important;padding-right:0 !important;box-sizing:border-box !important;}' +
          'html.app-ios-promax-wide body.page-shuiming-result .list-item,html.app-ios-iphone16promax body.page-shuiming-result .list-item{--list-inline-pad:16px;border-radius:0 !important;margin-left:0 !important;margin-right:0 !important;width:100% !important;max-width:none !important;}' +
          'html.app-ios-promax-wide body.page-shuiming-result .summary > .summary-item,html.app-ios-iphone16promax body.page-shuiming-result .summary > .summary-item{padding-left:16px !important;padding-right:16px !important;}' +
          'html.app-ios-promax-wide.platform-ios body.page-shuiming-result .list-company-name,html.app-ios-iphone16promax.platform-ios body.page-shuiming-result .list-company-name{max-width:20em !important;}' +
          'html.app-ios-promax-wide body.page-shuiming-result .back-btn,html.app-ios-iphone16promax body.page-shuiming-result .back-btn{left:12px !important;}' +
          'html.app-ios-promax-wide body.page-shuiming-result .header-right,html.app-ios-iphone16promax body.page-shuiming-result .header-right{right:12px !important;}' +
          'html.app-ios-promax-wide body.page-shuiming-result .sm-activate-card,html.app-ios-promax-wide body.page-shuiming-result .sm-refund-browse-card,html.app-ios-iphone16promax body.page-shuiming-result .sm-activate-card,html.app-ios-iphone16promax body.page-shuiming-result .sm-refund-browse-card{margin-left:0 !important;margin-right:0 !important;border-radius:0 !important;}' +
          'html.app-ios-promax-wide.app-top-safe-shell body.page-shuiming > .header{padding-left:12px !important;padding-right:12px !important;}' +
          'html.app-ios-promax-wide body.page-shuiming .content{padding-left:0 !important;padding-right:0 !important;}' +
          /* 15 Plus 再次压过 promax-wide（class 同挂时仍走贴边） */
          'html.app-ios-iphone15promax.app-ios-promax-wide body.page-shuiming-result .list{padding-left:0 !important;padding-right:0 !important;}' +
          'html.app-ios-iphone15promax.app-ios-promax-wide body.page-shuiming-result .list-item{--list-inline-pad:16px;border-radius:0 !important;margin-left:0 !important;margin-right:0 !important;width:100% !important;max-width:none !important;}' +
          'html.app-ios-iphone15promax.app-ios-promax-wide body.page-shuiming-result .summary > .summary-item{padding-left:16px !important;padding-right:16px !important;}' +
          'html.app-ios-iphone15promax.app-ios-promax-wide body.page-shuiming-result .back-btn{left:12px !important;}' +
          'html.app-ios-iphone15promax.app-ios-promax-wide body.page-shuiming-result .header-right{right:12px !important;}' +
          'html.app-ios-iphone15promax.app-ios-promax-wide body.page-shuiming-result .sm-activate-card,html.app-ios-iphone15promax.app-ios-promax-wide body.page-shuiming-result .sm-refund-browse-card{margin-left:0 !important;margin-right:0 !important;border-radius:0 !important;}' +
          'html.app-ios-iphone15promax.app-ios-promax-wide.app-top-safe-shell body.page-shuiming > .header{padding-left:12px !important;padding-right:12px !important;}' +
          /* iPhone Air（420×912）：压过 min-width:414 / promax-wide 的 20px 左右空条，列表贴边 */
          'html.app-ios-iphoneair body.page-shuiming-result .list,html.app-ios-iphoneair.app-ios-promax-wide body.page-shuiming-result .list{padding-left:0 !important;padding-right:0 !important;box-sizing:border-box !important;}' +
          'html.app-ios-iphoneair body.page-shuiming-result .list-item,html.app-ios-iphoneair.app-ios-promax-wide body.page-shuiming-result .list-item{--list-inline-pad:16px;border-radius:0 !important;margin-left:0 !important;margin-right:0 !important;width:100% !important;max-width:none !important;box-sizing:border-box !important;}' +
          'html.app-ios-iphoneair body.page-shuiming-result .summary > .summary-item,html.app-ios-iphoneair.app-ios-promax-wide body.page-shuiming-result .summary > .summary-item{padding-left:16px !important;padding-right:16px !important;}' +
          'html.app-ios-iphoneair body.page-shuiming-result .top-fixed .header,html.app-ios-iphoneair.app-top-safe-shell body.page-shuiming-result .top-fixed .header{padding-left:12px !important;padding-right:12px !important;}' +
          'html.app-ios-iphoneair body.page-shuiming-result .back-btn{left:12px !important;}' +
          'html.app-ios-iphoneair body.page-shuiming-result .header-right{right:12px !important;}' +
          'html.app-ios-iphoneair body.page-shuiming-result .sm-activate-card,html.app-ios-iphoneair body.page-shuiming-result .sm-refund-browse-card{margin-left:0 !important;margin-right:0 !important;border-radius:0 !important;}' +
          'html.app-ios-iphoneair.app-top-safe-shell body.page-shuiming > .header{padding-left:12px !important;padding-right:12px !important;}' +
          'html.app-ios-iphoneair.app-ios-promax-wide.app-top-safe-shell body.page-shuiming > .header{padding-left:12px !important;padding-right:12px !important;}' +
          'html.app-ios-iphoneair body.page-shuiming .content{padding-left:0 !important;padding-right:0 !important;}' +
          'html.app-ios-iphoneair body.page-shuiming-result .top-fixed .summary,html.app-ios-iphoneair.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,html.app-ios-iphoneair.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{background:#f5f6fa !important;}' +
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
          'html.app-ios-iphone-promax-font.app-top-safe-shell:not(.app-ios-iphone16pro) body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;background:#fff !important;}' +
          'html.app-ios-iphone-promax-font.app-top-safe-shell body.page-shuiming-result .list{margin-top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;}' +
          cssDeviceShuiming17ProMax() +
                    '@media screen and (min-width:428px),screen and (min-device-width:428px){' +
          'html.platform-ios body.page-shuiming-result .list{padding-left:0 !important;padding-right:0 !important;}' +
          'html.platform-ios body.page-shuiming-result .list-item{--list-inline-pad:16px;border-radius:0 !important;margin-left:0 !important;margin-right:0 !important;width:100% !important;max-width:none !important;}' +
          'html.platform-ios body.page-shuiming-result .summary > .summary-item{padding-left:16px !important;padding-right:16px !important;}' +
          'html.platform-ios body.page-shuiming-result .list-row-company .list-arrow{display:block !important;width:10px !important;height:10px !important;margin:2px 2px 0 auto !important;border-top:1.5px solid #c7c7cc !important;border-right:1.5px solid #c7c7cc !important;transform:translateY(var(--device-arrow-ty,2px)) rotate(45deg);}' +
          '}' +
          'body.page-shuiming-result .list{padding-left:0 !important;padding-right:0 !important;}' +
          'body.page-shuiming-result .list-item{--list-inline-pad:16px;border-radius:0 !important;margin-left:0 !important;margin-right:0 !important;width:100% !important;max-width:none !important;}' +
          'body.page-shuiming-result .list-row-company .list-arrow{display:block !important;width:10px !important;height:10px !important;margin:2px 2px 0 auto !important;padding:0 !important;border:0 !important;border-top:1.5px solid #c7c7cc !important;border-right:1.5px solid #c7c7cc !important;background:none !important;transform:translateY(var(--device-arrow-ty,2px)) rotate(45deg);flex-shrink:0 !important;align-self:center !important;box-sizing:content-box !important;}' +
          cssDeviceShuiming17ProMax() +
          /*
           * 浏览器/非 Cordova：结果页顶栏仅用真实 safe-area（去掉 24/48 占位）。
           * 排除：Android 沉浸白顶；以及已单独适配的 iOS 刘海/Island 机——
           * 否则 :not 链优先级更高会盖掉 16 Pro 等机型的 59px 规则，env=0 时标题贴顶。
           */
          'html.app-top-safe-shell:not(.app-cordova-shell):not(.app-android-xiaomi-14pro):not(.app-android-iqoo-13):not(.app-android-iqoo-15):not(.app-android-meizu-20pro):not(.app-ios-iphone16pro):not(.app-ios-iphone17pro):not(.app-ios-iphone16promax):not(.app-ios-iphone17promax):not(.app-ios-iphone15promax):not(.app-ios-iphone14):not(.app-ios-iphone-promax-font):not(.app-ios-iphoneair) body.page-shuiming-result .page-root{--safe-top:env(safe-area-inset-top,0px) !important;}' +
          'html.app-top-safe-shell:not(.app-cordova-shell):not(.app-android-xiaomi-14pro):not(.app-android-iqoo-13):not(.app-android-iqoo-15):not(.app-android-meizu-20pro):not(.app-ios-iphone16pro):not(.app-ios-iphone17pro):not(.app-ios-iphone16promax):not(.app-ios-iphone17promax):not(.app-ios-iphone15promax):not(.app-ios-iphone14):not(.app-ios-iphone-promax-font):not(.app-ios-iphoneair) body.page-shuiming-result::before{content:none !important;display:none !important;height:0 !important;}' +
          'html.app-top-safe-shell:not(.app-cordova-shell):not(.app-android-xiaomi-14pro):not(.app-android-iqoo-13):not(.app-android-iqoo-15):not(.app-android-meizu-20pro):not(.app-ios-iphone16pro):not(.app-ios-iphone17pro):not(.app-ios-iphone16promax):not(.app-ios-iphone17promax):not(.app-ios-iphone15promax):not(.app-ios-iphone14):not(.app-ios-iphone-promax-font):not(.app-ios-iphoneair) body.page-shuiming-result .top-fixed .header{top:0 !important;height:calc(var(--header-height,48px) + env(safe-area-inset-top,0px)) !important;padding:calc(8px + env(safe-area-inset-top,0px)) 16px 8px !important;box-sizing:border-box !important;align-items:center !important;}' +
          'html.app-top-safe-shell:not(.app-cordova-shell):not(.app-android-xiaomi-14pro):not(.app-android-iqoo-13):not(.app-android-iqoo-15):not(.app-android-meizu-20pro):not(.app-ios-iphone16pro):not(.app-ios-iphone17pro):not(.app-ios-iphone16promax):not(.app-ios-iphone17promax):not(.app-ios-iphone15promax):not(.app-ios-iphone14):not(.app-ios-iphone-promax-font):not(.app-ios-iphoneair) body.page-shuiming-result .top-fixed .header .back-btn,html.app-top-safe-shell:not(.app-cordova-shell):not(.app-android-xiaomi-14pro):not(.app-android-iqoo-13):not(.app-android-iqoo-15):not(.app-android-meizu-20pro):not(.app-ios-iphone16pro):not(.app-ios-iphone17pro):not(.app-ios-iphone16promax):not(.app-ios-iphone17promax):not(.app-ios-iphone15promax):not(.app-ios-iphone14):not(.app-ios-iphone-promax-font):not(.app-ios-iphoneair) body.page-shuiming-result .top-fixed .header .header-right{top:auto !important;height:auto !important;position:absolute !important;display:flex !important;align-items:center !important;}' +
          'html.app-top-safe-shell:not(.app-cordova-shell):not(.app-android-xiaomi-14pro):not(.app-android-iqoo-13):not(.app-android-iqoo-15):not(.app-android-meizu-20pro):not(.app-ios-iphone16pro):not(.app-ios-iphone17pro):not(.app-ios-iphone16promax):not(.app-ios-iphone17promax):not(.app-ios-iphone15promax):not(.app-ios-iphone14):not(.app-ios-iphone-promax-font):not(.app-ios-iphoneair) body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,48px) + env(safe-area-inset-top,0px)) !important;}' +
          'html.app-top-safe-shell:not(.app-cordova-shell):not(.app-android-xiaomi-14pro):not(.app-android-iqoo-13):not(.app-android-iqoo-15):not(.app-android-meizu-20pro):not(.app-ios-iphone16pro):not(.app-ios-iphone17pro):not(.app-ios-iphone16promax):not(.app-ios-iphone17promax):not(.app-ios-iphone15promax):not(.app-ios-iphone14):not(.app-ios-iphone-promax-font):not(.app-ios-iphoneair) body.page-shuiming-result .list{margin-top:calc(var(--header-height,48px) + env(safe-area-inset-top,0px)) !important;}' +
          /* iPhone 16 Pro：压过上文——Island 顶距；顶栏 44px；汇总顶 12px 灰缝对齐官方 */
          'html.app-ios-iphone16pro.app-top-safe-shell{--app-shell-statusbar-top:max(59px,env(safe-area-inset-top,59px)) !important;--device-list-edge:0px;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .page-root{--header-height:44px !important;--safe-top:var(--app-shell-statusbar-top) !important;--shuiming-chrome-top:var(--app-shell-statusbar-top) !important;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header{top:0 !important;height:calc(var(--header-height,44px) + var(--app-shell-statusbar-top)) !important;min-height:calc(var(--header-height,44px) + var(--app-shell-statusbar-top)) !important;padding:var(--app-shell-statusbar-top) 16px 0 !important;background:#fff !important;box-sizing:border-box !important;box-shadow:none !important;z-index:120 !important;align-items:center !important;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn{left:16px !important;top:var(--app-shell-statusbar-top) !important;height:var(--header-height,44px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{right:16px !important;top:var(--app-shell-statusbar-top) !important;height:var(--header-height,44px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,html.app-ios-iphone16pro body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,44px) + var(--app-shell-statusbar-top)) !important;background:#f5f6fa !important;padding:12px 0 10px !important;box-sizing:border-box !important;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shuiming-result .list,html.app-ios-iphone16pro body.page-shuiming-result .list{margin-top:calc(var(--header-height,44px) + var(--app-shell-statusbar-top)) !important;padding-left:0 !important;padding-right:0 !important;width:100% !important;max-width:100% !important;margin-left:0 !important;margin-right:0 !important;box-sizing:border-box !important;background:#f5f6fa !important;}' +
          'html.app-ios-iphone16pro body.page-shuiming-result .summary > .summary-item{padding-left:16px !important;padding-right:16px !important;border-radius:0 !important;}' +
          'html.app-ios-iphone16pro body.page-shuiming-result .list-item{--list-inline-pad:16px;padding:17px 16px 16px !important;border-radius:0 !important;margin-left:0 !important;margin-right:0 !important;width:100% !important;max-width:none !important;box-sizing:border-box !important;}' +
          /* 402×874 无 class：仍锁官方顶灰缝 */
          '@media screen and (min-device-width:399px) and (max-device-width:405px) and (min-device-height:868px) and (max-device-height:878px),screen and (min-width:399px) and (max-width:405px) and (min-height:868px) and (max-height:878px){' +
          'html:not(.app-ios-iphone17pro) body.page-shuiming-result .top-fixed .header{box-shadow:none !important;}' +
          'html:not(.app-ios-iphone17pro) body.page-shuiming-result .top-fixed .summary{background:#f5f6fa !important;padding:12px 0 10px !important;box-sizing:border-box !important;}' +
          'html:not(.app-ios-iphone17pro) body.page-shuiming-result .list{background:#f5f6fa !important;}' +
          '}' +
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
          'html.app-android-oppo-family.app-top-safe-shell:not(.app-android-oneplus-13):not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x) body.page-shouye,' +
          'html.app-android-oppo-a58.app-top-safe-shell body.page-shouye{' +
          '--shouye-status-inset:6px;--app-shell-statusbar-top:6px !important;}' +
          'html.app-android-oppo-family.app-top-safe-shell:not(.app-android-oneplus-13):not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x) body.page-shouye::before,' +
          'html.app-android-oppo-a58.app-top-safe-shell body.page-shouye::before{' +
          'height:6px !important;}' +
          'html.app-android-oppo-family.app-top-safe-shell:not(.app-android-oneplus-13):not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x) body.page-shouye .search-bar-wrapper,' +
          'html.app-android-oppo-a58.app-top-safe-shell body.page-shouye .search-bar-wrapper{' +
          'padding-top:6px !important;}' +
          'html.app-android-oppo-family.app-top-safe-shell:not(.app-android-oneplus-13):not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x) body.page-shouye .shouye-page,' +
          'html.app-android-oppo-a58.app-top-safe-shell body.page-shouye .shouye-page{' +
          'padding-top:var(--shouye-fixed-top-h,58px) !important;}' +
          /*
           * 荣耀 Magic5 Pro：系统栏已在 WebView 外，压过上方 Android 统一 40px，
           * 否则搜索条上会空一截蓝。
           */
          'html.app-android-client.app-android-honor-pgt-an20.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye{' +
          '--shouye-status-inset:8px !important;--app-shell-statusbar-top:8px !important;}' +
          'html.app-android-client.app-android-honor-pgt-an20.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye::before{height:8px !important;}' +
          'html.app-android-client.app-android-honor-pgt-an20.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye .search-bar-wrapper,' +
          'html.app-android-honor-pgt-an20.app-android-honor-magic.app-top-safe-shell body.page-shouye .search-bar-wrapper{padding-top:8px !important;}' +
          'html.app-android-client.app-android-honor-pgt-an20.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye .shouye-page{padding-top:var(--shouye-fixed-top-h,60px) !important;}' +
          /*
           * Mate 60 / Pro：ahead 图已带顶蓝，再套 Android 统一 40px 会空一截。
           * 压过上方首页统一顶距，只留 12px 并略微上移搜索条。
           */
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shouye{' +
          '--shouye-status-inset:12px !important;--app-shell-statusbar-top:12px !important;}' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shouye::before{height:12px !important;}' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shouye .search-bar-wrapper{padding-top:12px !important;}' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shouye .sy-apk-ahead{margin-top:-8px !important;}' +
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
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-daiban .daiban-header-builtin,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-bancha .bancha-header-builtin{' +
          'padding-top:calc(10px + 40px) !important;}' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-message .message-header-toolbar{' +
          'padding-top:calc(14px + 40px) !important;}' +
          /* Mate60 消息详情：自管固定顶栏 40px，勿被 ark 白顶 52/66 相对定位叠出大块空白 */
          'html.app-android-huawei-mate60 body.page-message-detail,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-message-detail{' +
          '--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;--safe-top:40px !important;' +
          'padding-top:calc(44px + 40px) !important;}' +
          'html.app-android-huawei-mate60 body.page-message-detail > .header,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-message-detail > .header{' +
          'position:fixed !important;top:0 !important;left:0 !important;right:0 !important;' +
          'padding:40px 12px 11px !important;min-height:0 !important;height:auto !important;' +
          'box-sizing:border-box !important;background:#fff !important;z-index:100 !important;}' +
          'html.app-android-huawei-mate60 body.page-message-detail > .header .back-btn,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-message-detail > .header .back-btn{' +
          'top:auto !important;height:auto !important;display:flex !important;align-items:center !important;left:12px !important;}' +
          'html.app-android-huawei-mate60 body.page-message-detail .detail-wrap,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-message-detail .detail-wrap{' +
          'max-width:none !important;width:100% !important;margin:0 !important;' +
          'padding-left:16px !important;padding-right:16px !important;box-sizing:border-box !important;}' +
          'html.app-android-huawei-mate60 body.page-message-detail #arkWhiteTopShield{display:none !important;height:0 !important;}' +
          'html.app-android-huawei-mate60 body.page-bancha .bancha-page,' +
          'html.app-android-huawei-mate60 body.page-daiban .daiban-content,' +
          'html.app-android-huawei-mate60 body.page-message{' +
          '--bottom-nav-clearance:calc(var(--bottom-nav-height,54px) + var(--bottom-nav-bottom,8px) + 28px) !important;' +
          'padding-bottom:var(--bottom-nav-clearance) !important;}' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-daiban .daiban-header:not([data-header-mode="builtin"]) > img,' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-bancha .bancha-header:not([data-header-mode="builtin"]) > img{' +
          'margin-top:calc(-1 * var(--android-status-inset,40px)) !important;}' +
          'html.app-android-client.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-message .message-header-toolbar{' +
          'padding-top:calc(14px + var(--android-status-inset,40px)) !important;}' +
          'html.app-android-iqoo-neo8.app-top-safe-shell body.page-message,' +
          'html.app-android-iqoo-neo8pro.app-top-safe-shell body.page-message,' +
          'html.app-android-iqoo-neo8.app-top-safe-shell body.page-daiban,' +
          'html.app-android-iqoo-neo8pro.app-top-safe-shell body.page-daiban,' +
          'html.app-android-iqoo-neo8.app-top-safe-shell body.page-bancha,' +
          'html.app-android-iqoo-neo8pro.app-top-safe-shell body.page-bancha{' +
          '--android-status-inset:40px !important;--app-shell-statusbar-top:40px !important;}' +
          'html.app-android-iqoo-neo8.app-top-safe-shell body.page-message .message-header-toolbar,' +
          'html.app-android-iqoo-neo8pro.app-top-safe-shell body.page-message .message-header-toolbar{' +
          'padding-top:calc(14px + 40px) !important;}' +
          /* 白顶栏纳税页：外置状态栏 / overlays=false 后顶距清零 */
          'html.app-android-white-page-outer.app-top-safe-shell:not(.app-android-huawei-nova13):not(.app-android-immersive-white-top) body.page-shuiming > .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer:not(.app-android-huawei-nova13):not(.app-android-immersive-white-top) body.page-shuiming > .header{' +
          'padding-top:14px !important;padding-bottom:15px !important;}' +
          'html.app-android-white-page-outer.app-top-safe-shell:not(.app-android-huawei-nova13):not(.app-android-immersive-white-top) body.page-shuiming > .content,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer:not(.app-android-huawei-nova13):not(.app-android-immersive-white-top) body.page-shuiming > .content{' +
          'padding-top:46px !important;}' +
          'html.app-android-white-page-outer.app-top-safe-shell:not(.app-android-huawei-nova13):not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-xiangqing,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer:not(.app-android-huawei-nova13):not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-xiangqing{' +
          'padding-top:48px !important;}' +
          'html.app-android-white-page-outer.app-top-safe-shell:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .page-root,' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .page-root{' +
          '--safe-top:0px !important;--android-status-inset:0px !important;--app-shell-statusbar-top:0px !important;}' +
          'html.app-android-white-page-outer.app-top-safe-shell:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .top-fixed .header,' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .top-fixed .header{' +
          'top:0 !important;height:var(--header-height,48px) !important;min-height:var(--header-height,48px) !important;' +
          'padding:8px 16px !important;box-sizing:border-box !important;z-index:120 !important;}' +
          'html.app-android-white-page-outer.app-top-safe-shell:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-white-page-outer.app-top-safe-shell:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .top-fixed .header .header-right{' +
          'top:0 !important;height:var(--header-height,48px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-white-page-outer.app-top-safe-shell:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .top-fixed .summary,' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .top-fixed .summary{' +
          'top:var(--header-height,48px) !important;}' +
          'html.app-android-white-page-outer.app-top-safe-shell:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .list,' +
          'html.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer:not(.app-android-immersive-white-top):not(.app-android-vivo-s50promini):not(.app-android-vivo-x200pro):not(.app-android-vivo-x300pro) body.page-shuiming-result .list{' +
          'margin-top:var(--header-height,48px) !important;}' +
          /*
           * 小米 14 Pro / 15 Pro / Mate 60：沉浸压栏，须压过 mi-family / harmony / white-page-outer 清零规则。
           */
          'html.app-android-xiaomi-14pro.app-top-safe-shell,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell,' +
          'html.app-android-huawei-mate60.app-top-safe-shell,html.app-android-xiaomi-10.app-top-safe-shell,' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell.app-android-white-page-outer,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer,' +
          'html.app-android-huawei-mate60.app-top-safe-shell.app-android-white-page-outer,html.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer{' +
          '--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming-result .page-root,html.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .page-root,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .page-root,' +
          'html.app-android-huawei-mate60.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .page-root,html.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .page-root,' +
          'html.app-cordova-shell.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-cordova-shell.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-cordova-shell.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming-result .page-root,html.app-cordova-shell.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-14pro body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60 body.page-shuiming-result .page-root,html.app-android-client.app-top-safe-shell.app-android-xiaomi-10 body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-14pro:not(.app-cordova-shell) body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro:not(.app-cordova-shell) body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60:not(.app-cordova-shell) body.page-shuiming-result .page-root,html.app-android-client.app-top-safe-shell.app-android-xiaomi-10:not(.app-cordova-shell) body.page-shuiming-result .page-root{' +
          '--safe-top:var(--app-shell-statusbar-top,40px) !important;--android-status-inset:40px !important;--app-shell-statusbar-top:40px !important;}' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming-result .top-fixed .header,html.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-huawei-mate60.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header,html.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header,' +
          'html.app-cordova-shell.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-cordova-shell.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-cordova-shell.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming-result .top-fixed .header,html.app-cordova-shell.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-14pro body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60 body.page-shuiming-result .top-fixed .header,html.app-android-client.app-top-safe-shell.app-android-xiaomi-10 body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-14pro:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header,html.app-android-client.app-top-safe-shell.app-android-xiaomi-10:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header{' +
          'top:0 !important;height:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;' +
          'min-height:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;' +
          'padding:var(--app-shell-statusbar-top,40px) 16px 0 !important;box-sizing:border-box !important;z-index:120 !important;background:#fff !important;}' +
          /* 小米 14 Pro：补齐 back/右键/摘要/列表（此前仅 15 Pro 有），硬编码 40px 压过 env(0) */
          'html.app-android-xiaomi-14pro body.page-shuiming-result .page-root,' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-cordova-shell.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .page-root{' +
          '--safe-top:40px !important;--android-status-inset:40px !important;--app-shell-statusbar-top:40px !important;}' +
          'html.app-android-xiaomi-14pro body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-cordova-shell.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header{' +
          'top:0 !important;height:calc(var(--header-height,48px) + 40px) !important;' +
          'min-height:calc(var(--header-height,48px) + 40px) !important;' +
          'padding:40px 16px 0 !important;box-sizing:border-box !important;z-index:120 !important;background:#fff !important;}' +
          'html.app-android-xiaomi-14pro body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-xiaomi-14pro body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-cordova-shell.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-cordova-shell.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{' +
          'top:40px !important;height:var(--header-height,48px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-xiaomi-14pro body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-cordova-shell.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{' +
          'top:calc(var(--header-height,48px) + 40px) !important;}' +
          'html.app-android-xiaomi-14pro body.page-shuiming-result .list,' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-android-xiaomi-14pro.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .list,' +
          'html.app-android-client.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-cordova-shell.app-android-xiaomi-14pro.app-top-safe-shell body.page-shuiming-result .list{' +
          'margin-top:calc(var(--header-height,48px) + 40px) !important;}' +
          /* iQOO 15（V2505A / I2501）：OriginOS 6 沉浸压栏，同 14 Pro 硬编码 40px 压过 env(0) / vivo 族清零 */
          'html.app-android-iqoo-13 body.page-shuiming-result .page-root,html.app-android-iqoo-15 body.page-shuiming-result .page-root,' +
          'html.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .page-root,html.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-iqoo-13.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .page-root,html.app-android-iqoo-15.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .page-root,html.app-android-client.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-cordova-shell.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .page-root,html.app-cordova-shell.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-meizu-20pro body.page-shuiming-result .page-root,' +
          'html.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-meizu-20pro.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-cordova-shell.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .page-root{' +
          '--safe-top:40px !important;--android-status-inset:40px !important;--app-shell-statusbar-top:40px !important;}' +
          'html.app-android-iqoo-13 body.page-shuiming-result .top-fixed .header,html.app-android-iqoo-15 body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .top-fixed .header,html.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-iqoo-13.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header,html.app-android-iqoo-15.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .top-fixed .header,html.app-android-client.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-cordova-shell.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .top-fixed .header,html.app-cordova-shell.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-meizu-20pro body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-meizu-20pro.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-cordova-shell.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header{' +
          'top:0 !important;height:calc(var(--header-height,48px) + 40px) !important;' +
          'min-height:calc(var(--header-height,48px) + 40px) !important;' +
          'padding:40px 16px 0 !important;box-sizing:border-box !important;z-index:120 !important;background:#fff !important;}' +
          'html.app-android-iqoo-13 body.page-shuiming-result .top-fixed .header .back-btn,html.app-android-iqoo-15 body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-iqoo-13 body.page-shuiming-result .top-fixed .header .header-right,html.app-android-iqoo-15 body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,html.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-iqoo-13.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .back-btn,html.app-android-iqoo-15.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-iqoo-13.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .header-right,html.app-android-iqoo-15.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-android-client.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,html.app-android-client.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-cordova-shell.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-cordova-shell.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-cordova-shell.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,html.app-cordova-shell.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-meizu-20pro body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-meizu-20pro body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-meizu-20pro.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-meizu-20pro.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-cordova-shell.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-cordova-shell.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{' +
          'top:40px !important;height:var(--header-height,48px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-iqoo-13 body.page-shuiming-result .top-fixed .summary,html.app-android-iqoo-15 body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,html.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-iqoo-13.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .summary,html.app-android-iqoo-15.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,html.app-android-client.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-cordova-shell.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,html.app-cordova-shell.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-meizu-20pro body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-meizu-20pro.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-cordova-shell.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{' +
          'top:calc(var(--header-height,48px) + 40px) !important;}' +
          'html.app-android-iqoo-13 body.page-shuiming-result .list,html.app-android-iqoo-15 body.page-shuiming-result .list,' +
          'html.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .list,html.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-android-iqoo-13.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .list,html.app-android-iqoo-15.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .list,' +
          'html.app-android-client.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .list,html.app-android-client.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-cordova-shell.app-android-iqoo-13.app-top-safe-shell body.page-shuiming-result .list,html.app-cordova-shell.app-android-iqoo-15.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-android-meizu-20pro body.page-shuiming-result .list,' +
          'html.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-android-meizu-20pro.app-top-safe-shell:not(.app-cordova-shell) body.page-shuiming-result .list,' +
          'html.app-android-client.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-cordova-shell.app-android-meizu-20pro.app-top-safe-shell body.page-shuiming-result .list{' +
          'margin-top:calc(var(--header-height,48px) + 40px) !important;}' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,html.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-huawei-mate60.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .back-btn,html.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-huawei-mate60.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .header-right,html.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60 body.page-shuiming-result .top-fixed .header .back-btn,html.app-android-client.app-top-safe-shell.app-android-xiaomi-10 body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60 body.page-shuiming-result .top-fixed .header .header-right,html.app-android-client.app-top-safe-shell.app-android-xiaomi-10 body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .back-btn,html.app-android-client.app-top-safe-shell.app-android-xiaomi-10:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .header-right,html.app-android-client.app-top-safe-shell.app-android-xiaomi-10:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .header-right{' +
          'top:var(--app-shell-statusbar-top,40px) !important;height:var(--header-height,48px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,html.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-huawei-mate60.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .summary,html.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60 body.page-shuiming-result .top-fixed .summary,html.app-android-client.app-top-safe-shell.app-android-xiaomi-10 body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .summary,html.app-android-client.app-top-safe-shell.app-android-xiaomi-10:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .summary{' +
          'top:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;}' +
          /* Mate 60 / Pro（ALN-AL00）：独立压过，列表贴边；修复此前错误逗号选择器导致顶距失效 */
          'html.app-android-huawei-mate60 body.page-shuiming-result .page-root,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming-result .page-root{' +
          '--safe-top:40px !important;--android-status-inset:40px !important;--app-shell-statusbar-top:40px !important;}' +
          'html.app-android-huawei-mate60 body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming-result .top-fixed .header{' +
          'top:0 !important;height:calc(var(--header-height,48px) + 40px) !important;' +
          'min-height:calc(var(--header-height,48px) + 40px) !important;' +
          'padding:40px 16px 0 !important;box-sizing:border-box !important;z-index:120 !important;background:#fff !important;}' +
          'html.app-android-huawei-mate60 body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-huawei-mate60 body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{' +
          'top:40px !important;height:var(--header-height,48px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-huawei-mate60 body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{' +
          'top:calc(var(--header-height,48px) + 40px) !important;background:#f5f6fa !important;}' +
          'html.app-android-huawei-mate60 body.page-shuiming-result .list,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming-result .list{' +
          'margin-top:calc(var(--header-height,48px) + 40px) !important;padding-left:0 !important;padding-right:0 !important;}' +
          'html.app-android-huawei-mate60 body.page-shuiming-result .list-item,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming-result .list-item{' +
          '--list-inline-pad:16px;border-radius:0 !important;margin-left:0 !important;margin-right:0 !important;' +
          'width:100% !important;max-width:none !important;box-sizing:border-box !important;}' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming-result .list,html.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .list,' +
          'html.app-android-huawei-mate60.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .list,html.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60 body.page-shuiming-result .list,html.app-android-client.app-top-safe-shell.app-android-xiaomi-10 body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro:not(.app-cordova-shell) body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60:not(.app-cordova-shell) body.page-shuiming-result .list,html.app-android-client.app-top-safe-shell.app-android-xiaomi-10:not(.app-cordova-shell) body.page-shuiming-result .list{' +
          'margin-top:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;}' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming > .header,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming > .header,html.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming > .header,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming > .header,' +
          'html.app-android-huawei-mate60.app-top-safe-shell.app-android-white-page-outer body.page-shuiming > .header,html.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming > .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro body.page-shuiming > .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60 body.page-shuiming > .header,html.app-android-client.app-top-safe-shell.app-android-xiaomi-10 body.page-shuiming > .header{' +
          'padding-top:calc(14px + var(--app-shell-statusbar-top,40px)) !important;padding-bottom:15px !important;}' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell body.page-shuiming > .content,' +
          'html.app-android-huawei-mate60.app-top-safe-shell body.page-shuiming > .content,html.app-android-xiaomi-10.app-top-safe-shell body.page-shuiming > .content,' +
          'html.app-android-xiaomi-15pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming > .content,' +
          'html.app-android-huawei-mate60.app-top-safe-shell.app-android-white-page-outer body.page-shuiming > .content,html.app-android-xiaomi-10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming > .content,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15pro body.page-shuiming > .content,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-mate60 body.page-shuiming > .content,html.app-android-client.app-top-safe-shell.app-android-xiaomi-10 body.page-shuiming > .content{' +
          'padding-top:calc(46px + var(--app-shell-statusbar-top,40px)) !important;}' +
          /* 小米 15（dada / 24129PN74）：HyperOS 2 沉浸压栏，硬编码 40px 压过 mi-family / env(0) */
          'html.app-android-xiaomi-15.app-top-safe-shell,' +
          'html.app-android-xiaomi-15.app-top-safe-shell.app-android-white-page-outer{' +
          '--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-xiaomi-15 body.page-shuiming-result .page-root,' +
          'html.app-android-xiaomi-15.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-xiaomi-15.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15 body.page-shuiming-result .page-root,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15:not(.app-cordova-shell) body.page-shuiming-result .page-root,' +
          'html.app-cordova-shell.app-android-xiaomi-15.app-top-safe-shell body.page-shuiming-result .page-root{' +
          '--safe-top:40px !important;--android-status-inset:40px !important;--app-shell-statusbar-top:40px !important;}' +
          'html.app-android-xiaomi-15 body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-xiaomi-15.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-xiaomi-15.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15 body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header,' +
          'html.app-cordova-shell.app-android-xiaomi-15.app-top-safe-shell body.page-shuiming-result .top-fixed .header{' +
          'top:0 !important;height:calc(var(--header-height,48px) + 40px) !important;' +
          'min-height:calc(var(--header-height,48px) + 40px) !important;' +
          'padding:40px 16px 0 !important;box-sizing:border-box !important;z-index:120 !important;background:#fff !important;}' +
          'html.app-android-xiaomi-15 body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-xiaomi-15 body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-xiaomi-15.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-xiaomi-15.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-xiaomi-15.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-xiaomi-15.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15 body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15 body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .header-right{' +
          'top:40px !important;height:var(--header-height,48px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-xiaomi-15 body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-xiaomi-15.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-xiaomi-15.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15 body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .summary{' +
          'top:calc(var(--header-height,48px) + 40px) !important;}' +
          'html.app-android-xiaomi-15 body.page-shuiming-result .list,' +
          'html.app-android-xiaomi-15.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-android-xiaomi-15.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15 body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15:not(.app-cordova-shell) body.page-shuiming-result .list{' +
          'margin-top:calc(var(--header-height,48px) + 40px) !important;}' +
          'html.app-android-xiaomi-15.app-top-safe-shell body.page-shuiming > .header,' +
          'html.app-android-xiaomi-15.app-top-safe-shell.app-android-white-page-outer body.page-shuiming > .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15 body.page-shuiming > .header{' +
          'padding-top:calc(14px + var(--app-shell-statusbar-top,40px)) !important;padding-bottom:15px !important;}' +
          'html.app-android-xiaomi-15.app-top-safe-shell body.page-shuiming > .content,' +
          'html.app-android-xiaomi-15.app-top-safe-shell.app-android-white-page-outer body.page-shuiming > .content,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-15 body.page-shuiming > .content{' +
          'padding-top:calc(46px + var(--app-shell-statusbar-top,40px)) !important;}' +
          /*
           * 小米 14 Pro：补「返回 / 筛选 / 列表」顶距（header 已有规则，按钮原先漏写，
           * 会被通用 Android :not(cordova) 的 top:0 压回去）。
           */
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-14pro body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-14pro body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-14pro:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-14pro:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-13 body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-13 body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-13:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-13:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-13pro body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-13pro body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-13pro:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-13pro:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .header .header-right{' +
          'top:var(--app-shell-statusbar-top,40px) !important;height:var(--header-height,48px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-14pro body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-14pro:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-13 body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-13:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-13pro body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-13pro:not(.app-cordova-shell) body.page-shuiming-result .top-fixed .summary{' +
          'top:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;}' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-14pro body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-14pro:not(.app-cordova-shell) body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-13 body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-13:not(.app-cordova-shell) body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-13pro body.page-shuiming-result .list,' +
          'html.app-android-client.app-top-safe-shell.app-android-xiaomi-13pro:not(.app-cordova-shell) body.page-shuiming-result .list{' +
          'margin-top:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;}' +
          /*
           * 统一沉浸白顶栏：K70 至尊 / 红米 12C / 小米 10 / 15 Pro / Mate 60 / 一加 Ace 2 Pro。
           * 压过 mi-family、redmi-k70、white-page-outer 的 0 顶距。
           */
          'html.app-android-immersive-white-top.app-top-safe-shell,' +
          'html.app-android-immersive-white-top.app-top-safe-shell.app-android-white-page-outer,' +
          'html.app-android-oneplus-ace2pro.app-top-safe-shell,' +
          'html.app-android-oneplus-acepro.app-top-safe-shell,' +
          'html.app-android-oneplus-ace2pro.app-top-safe-shell.app-android-white-page-outer,' +
          'html.app-android-oneplus-acepro.app-top-safe-shell.app-android-white-page-outer,' +
          'html.app-android-oneplus-ace2v.app-top-safe-shell,' +
          'html.app-android-oneplus-ace6.app-top-safe-shell,' +
          'html.app-android-oneplus-12.app-top-safe-shell,' +
          'html.app-android-oneplus-ace2v.app-top-safe-shell.app-android-white-page-outer,' +
          'html.app-android-oppo-reno10.app-top-safe-shell,' +
          'html.app-android-oppo-reno10.app-top-safe-shell.app-android-white-page-outer,' +
          'html.app-android-redmi-k70-ultra.app-top-safe-shell,' +
          'html.app-android-redmi-12c.app-top-safe-shell,' +
          'html.app-android-redmi-note11-5g.app-top-safe-shell{' +
          '--app-shell-statusbar-top:40px !important;--android-status-inset:40px !important;}' +
          'html.app-android-immersive-white-top.app-top-safe-shell:not(.app-android-redmi-note11-5g) body.page-shuiming-result .page-root,' +
          'html.app-android-immersive-white-top.app-top-safe-shell.app-android-white-page-outer:not(.app-android-redmi-note11-5g) body.page-shuiming-result .page-root,' +
          'html.app-android-oneplus-ace2pro.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-oneplus-acepro.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-oneplus-ace2pro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .page-root,' +
          'html.app-android-oneplus-acepro.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .page-root,' +
          'html.app-android-oneplus-ace2v.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-oneplus-ace2v.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .page-root,' +
          'html.app-android-oppo-reno10.app-top-safe-shell body.page-shuiming-result .page-root,' +
          'html.app-android-oppo-reno10.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .page-root{' +
          '--safe-top:var(--app-shell-statusbar-top,40px) !important;--android-status-inset:40px !important;--app-shell-statusbar-top:40px !important;}' +
          'html.app-android-immersive-white-top.app-top-safe-shell:not(.app-android-redmi-note11-5g) body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-immersive-white-top.app-top-safe-shell.app-android-white-page-outer:not(.app-android-redmi-note11-5g) body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-vivo-x300pro.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-vivo-x300pro.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-vivo-s50promini.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .header,' +
          'html.app-android-vivo-s50promini.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header{' +
          'top:0 !important;height:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;' +
          'min-height:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;' +
          'padding:var(--app-shell-statusbar-top,40px) 16px 0 !important;box-sizing:border-box !important;z-index:120 !important;background:#fff !important;}' +
          'html.app-android-immersive-white-top.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-immersive-white-top.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-immersive-white-top.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-immersive-white-top.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-vivo-x300pro.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-vivo-x300pro.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-vivo-x300pro.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-vivo-x300pro.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-vivo-s50promini.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-vivo-s50promini.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right,' +
          'html.app-android-vivo-s50promini.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .back-btn,' +
          'html.app-android-vivo-s50promini.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .header .header-right{' +
          'top:var(--app-shell-statusbar-top,40px) !important;height:var(--header-height,48px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-immersive-white-top.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-immersive-white-top.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-vivo-x300pro.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-vivo-x300pro.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-vivo-s50promini.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .top-fixed .summary,' +
          'html.app-android-vivo-s50promini.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .top-fixed .summary{' +
          'top:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;}' +
          'html.app-android-immersive-white-top.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-android-immersive-white-top.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .list,' +
          'html.app-android-vivo-x300pro.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-android-vivo-x300pro.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .list,' +
          'html.app-android-vivo-s50promini.app-cordova-shell.app-android-client.app-top-safe-shell body.page-shuiming-result .list,' +
          'html.app-android-vivo-s50promini.app-cordova-shell.app-android-client.app-top-safe-shell.app-android-white-page-outer body.page-shuiming-result .list{' +
          'margin-top:calc(var(--header-height,48px) + var(--app-shell-statusbar-top,40px)) !important;}' +
          'html.app-android-immersive-white-top.app-top-safe-shell body.page-shuiming > .header,' +
          'html.app-android-huawei-nova13.app-top-safe-shell body.page-shuiming > .header,' +
          'html.app-android-immersive-white-top.app-top-safe-shell.app-android-white-page-outer body.page-shuiming > .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer.app-android-huawei-nova13 body.page-shuiming > .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer.app-android-immersive-white-top body.page-shuiming > .header{' +
          'padding-top:calc(14px + var(--app-shell-statusbar-top,40px)) !important;padding-bottom:15px !important;}' +
          'html.app-android-immersive-white-top.app-top-safe-shell body.page-shuiming > .content,' +
          'html.app-android-huawei-nova13.app-top-safe-shell body.page-shuiming > .content,' +
          'html.app-android-immersive-white-top.app-top-safe-shell.app-android-white-page-outer body.page-shuiming > .content,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer.app-android-huawei-nova13 body.page-shuiming > .content,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer.app-android-immersive-white-top body.page-shuiming > .content{' +
          'padding-top:calc(46px + var(--app-shell-statusbar-top,40px)) !important;}' +
          'html.app-android-immersive-white-top.app-top-safe-shell body.page-xiangqing,' +
          'html.app-android-huawei-nova13.app-top-safe-shell body.page-xiangqing,' +
          'html.app-android-client.app-top-safe-shell.app-android-huawei-nova13 body.page-xiangqing,' +
          'html.app-android-client.app-top-safe-shell.app-android-immersive-white-top body.page-xiangqing,' +
          'html.app-android-immersive-white-top.app-top-safe-shell.app-android-white-page-outer body.page-xiangqing,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer.app-android-huawei-nova13 body.page-xiangqing,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer.app-android-immersive-white-top body.page-xiangqing{' +
          'padding-top:calc(48px + var(--app-shell-statusbar-top,40px)) !important;}' +
          'html.app-android-immersive-white-top.app-top-safe-shell body.page-xiangqing > .header,' +
          'html.app-android-huawei-nova13.app-top-safe-shell body.page-xiangqing > .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer.app-android-huawei-nova13 body.page-xiangqing > .header,' +
          'html.app-android-client.app-top-safe-shell.app-android-white-page-outer.app-android-immersive-white-top body.page-xiangqing > .header{' +
          'padding-top:calc(10px + var(--app-shell-statusbar-top,40px)) !important;box-sizing:border-box !important;}' +
          topFixedHeaderRule;
        /*
         * 底栏主 Tab（尤其首页）：延后挂载 ~90KB shell CSS，让首屏先画。
         * 机型 class / --app-shell-statusbar-top 已在上方同步写好；
         * 首页本身还有 shouye.html 内联 40px 顶距，Mate60/S50 不受影响。
         */
        var appendShellExtra = function () {
          if (document.querySelector('style[data-app-top-safe-shell]')) return;
          document.head.appendChild(shellExtra);
        };
        var pageNow = '';
        try {
          pageNow = String((location.pathname || '').split('/').pop() || '');
        } catch (ePage) {}
        var deferShellPages = {
          'shouye.html': true,
          'daiban.html': true,
          'bancha.html': true,
          'message.html': true,
          'mine.html': true
        };
        if (androidClient && deferShellPages[pageNow]) {
          var ranShell = false;
          var runShellOnce = function () {
            if (ranShell) return;
            ranShell = true;
            appendShellExtra();
          };
          if (typeof requestAnimationFrame === 'function') {
            requestAnimationFrame(function () {
              requestAnimationFrame(runShellOnce);
            });
          } else {
            setTimeout(runShellOnce, 0);
          }
          setTimeout(runShellOnce, 120);
        } else {
          appendShellExtra();
        }
      }
    } catch (e) {}
    applyIPhone16ProPageChrome();
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
  /* 首屏只打安全区 class，大段 OEM 样式放到首帧后再跑，避免挡住安卓首绘 */
  markViewportChromeClasses();
  function refreshMobilePageChrome() {
    if (typeof document === 'undefined' || !document.documentElement) {
      return;
    }
    setupMobileStatusBar();
    syncAppShellStatusbarTop();
    pinMate60MineE1Layout();
    pinXiaomi14ProMineE1Layout();
    pinAceProMineE1Layout();
    pinMineE1PlainImgLayout();
    pinNova13MineE1Layout();
    pinHonorMagic5ProHomeCards();
    applyMinePageChrome();
    applyDaibanBanchaPageChrome();
    applyMessagePageChrome();
    applyShouyePageChrome();
    applyIosStandaloneEntryChrome();
    applyIPhone16ProPageChrome();
    applyImmersiveNotchWhitePageChrome();
  }
  function scheduleDeferredMobileChrome() {
    if (window.__authDeferredChromeScheduled) {
      return;
    }
    window.__authDeferredChromeScheduled = 1;
    var ran = false;
    function run() {
      if (ran) {
        return;
      }
      ran = true;
      window.__authDeferredChromeRan = true;
      try {
        refreshMobilePageChrome();
      } catch (eChrome) {}
    }
    function afterPaint(cb) {
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(function () {
          requestAnimationFrame(cb);
        });
      } else {
        setTimeout(cb, 50);
      }
    }
    /* defer 后 body 已在、首帧已过，只等两帧即可，勿再空等 80ms */
    if (document.body) {
      afterPaint(run);
      return;
    }
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(function () {
        afterPaint(run);
      }, { timeout: 80 });
    } else {
      afterPaint(run);
    }
    setTimeout(run, 80);
  }
  scheduleDeferredMobileChrome();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindIosTopBarDiagnostics);
  } else {
    bindIosTopBarDiagnostics();
  }
  try {
  } catch (eMate60Boot) {}
  function onDocumentReadyChrome() {
    if (window.__authDeferredChromeRan) {
      return;
    }
    refreshMobilePageChrome();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDocumentReadyChrome);
  } else {
    setTimeout(onDocumentReadyChrome, 0);
  }
  window.addEventListener('orientationchange', function () {
    setTimeout(function () {
      syncAppShellStatusbarTop();
      pinMate60MineE1Layout();
      pinXiaomi14ProMineE1Layout();
      pinAceProMineE1Layout();
      pinMineE1PlainImgLayout();
      pinNova13MineE1Layout();
      pinHonorMagic5ProHomeCards();
      applyImmersiveNotchWhitePageChrome();
    }, 50);
  });
  window.addEventListener('resize', function () {
    setTimeout(function () {
      syncAppShellStatusbarTop();
      pinMate60MineE1Layout();
      pinXiaomi14ProMineE1Layout();
      pinAceProMineE1Layout();
      pinMineE1PlainImgLayout();
      pinNova13MineE1Layout();
      pinHonorMagic5ProHomeCards();
      applyImmersiveNotchWhitePageChrome();
    }, 50);
  });
  window.addEventListener('pageshow', function () {
    setTimeout(function () {
      refreshImmersiveBluePageChrome();
    }, 0);
  });
  /* Cordova StatusBar 插件常在 deviceready 后才可用，再刷一次蓝顶栏页 */
  function refreshImmersiveBluePageChrome() {
    try {
      if (isXiaomi13ProClient()) {
        document.documentElement.classList.add('app-android-xiaomi-13pro');
        document.documentElement.classList.add('app-android-immersive-white-top');
        document.documentElement.classList.remove('app-android-white-page-outer');
        document.documentElement.classList.remove('app-android-mi-family');
      }
      if (isXiaomi13Client()) {
        document.documentElement.classList.add('app-android-xiaomi-13');
        document.documentElement.classList.add('app-android-immersive-white-top');
        document.documentElement.classList.remove('app-android-white-page-outer');
        document.documentElement.classList.remove('app-android-mi-family');
      }
      if (isXiaomi14ProClient()) {
        document.documentElement.classList.add('app-android-xiaomi-14pro');
        document.documentElement.classList.add('app-android-immersive-white-top');
        document.documentElement.classList.remove('app-android-white-page-outer');
        document.documentElement.classList.remove('app-android-mi-family');
      }
      if (isOnePlusAce2VClient()) {
        document.documentElement.classList.add('app-android-oneplus-ace2v');
        document.documentElement.classList.add('app-android-immersive-white-top');
        document.documentElement.classList.remove('app-android-white-page-outer');
      }
      if (isVivoX300ProLikeClient()) {
        document.documentElement.classList.add('app-android-vivo-x300pro');
        document.documentElement.classList.add('app-android-immersive-white-top');
        document.documentElement.classList.remove('app-android-white-page-outer');
        document.documentElement.classList.remove('app-android-vivo-family');
      }
      if (isVivoS50ProMiniClient()) {
        document.documentElement.classList.add('app-android-vivo-s50promini');
        document.documentElement.classList.add('app-android-immersive-white-top');
        document.documentElement.classList.remove('app-android-white-page-outer');
        document.documentElement.classList.remove('app-android-vivo-family');
      }
      if (isIqoo13Client()) {
        document.documentElement.classList.add('app-android-iqoo-13');
        document.documentElement.classList.add('app-android-immersive-white-top');
        document.documentElement.classList.remove('app-android-white-page-outer');
        document.documentElement.classList.remove('app-android-vivo-family');
      }
      if (isIqoo15Client()) {
        document.documentElement.classList.add('app-android-iqoo-15');
        document.documentElement.classList.add('app-android-immersive-white-top');
        document.documentElement.classList.remove('app-android-white-page-outer');
        document.documentElement.classList.remove('app-android-vivo-family');
      }
      if (isMeizu20ProClient()) {
        document.documentElement.classList.add('app-android-meizu-20pro');
        document.documentElement.classList.add('app-android-immersive-white-top');
        document.documentElement.classList.remove('app-android-white-page-outer');
      }
      if (isHuaweiP40ProClient()) {
        document.documentElement.classList.add('app-android-client');
        document.documentElement.classList.add('app-android-huawei-p40pro');
        document.documentElement.classList.remove('app-huawei-mine-noclip');
      }
      if (isHuaweiNova13Client()) {
        document.documentElement.classList.add('app-android-client');
        document.documentElement.classList.add('app-android-huawei-nova13');
        document.documentElement.classList.add('app-android-immersive-white-top');
        document.documentElement.classList.remove('app-android-white-page-outer');
      }
      if (isHonorPgtAn20Client()) {
        document.documentElement.classList.add('app-android-client');
        document.documentElement.classList.add('app-android-honor-pgt-an20');
        document.documentElement.classList.add('app-android-honor-magic');
      }
      if (isHonorMagic6ProClient()) {
        document.documentElement.classList.add('app-android-client');
        document.documentElement.classList.add('app-android-honor-magic6pro');
      }
      if (isXiaomi13ProClient()) {
        document.documentElement.classList.add('app-android-client');
        document.documentElement.classList.add('app-android-xiaomi-13pro');
      } else if (isXiaomi13Client()) {
        document.documentElement.classList.add('app-android-client');
        document.documentElement.classList.add('app-android-xiaomi-13');
        document.documentElement.classList.add('app-android-immersive-white-top');
      }
    } catch (eMi14p) {}
    rememberCordovaDeviceModel();
    syncAppShellStatusbarTop();
    pinMate60MineE1Layout();
    pinXiaomi14ProMineE1Layout();
    pinAceProMineE1Layout();
    pinMineE1PlainImgLayout();
    pinNova13MineE1Layout();
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
  window.addEventListener('message', function (ev) {
    try {
      var d = ev && ev.data;
      if (!d || d.source !== 'tax-shell' || d.type !== 'device-hint') {
        return;
      }
      var changed = false;
      if (d.model) {
        changed = persistDeviceModelHint(d.model) || changed;
      }
      if (d.ua) {
        try {
          localStorage.setItem(DEVICE_UA_STORE, String(d.ua).slice(0, 512));
          changed = true;
        } catch (eUa) {}
      }
      if (changed) {
        refreshImmersiveBluePageChrome();
      }
    } catch (eHintMsg) {}
  });
  hydrateDeviceModelHints(function (changed) {
    if (changed) {
      refreshImmersiveBluePageChrome();
    }
  });
  /* theme-loader 异步写入 CSS 变量后，再刷一次首页顶栏蓝，避免 StatusBar 与垫色两截 */
  window.addEventListener('mineUiConfig', function () {
    try {
      if (document.body && document.body.classList.contains('page-shouye')) {
        applyShouyePageChrome();
      }
    } catch (eMineUi) {}
  });

  // === 登录态 / 公开页判断 ===
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

  /**
   * 是否公开页（未登录可停留）。命中则跳过文末登录跳转门禁。
   */
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

  /** 读 localStorage.token（JWT）；异常时返回空串。 */
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

  // === 渠道归因（sales_channel、share、landing AB、purchase ABC）===
  // sticky key：sales_channel_v1、share_attr_v1、landing_bc_assignment_v1、purchase_abc_assignment_v1 等
  /** URL-only 渠道：仅当页面 URL 带 ?ch=xxx 时生效，不写入 localStorage、不留存。
   *  用于一次性安装统计（如 abc），避免污染后续会话的渠道归因。 */
  var URL_ONLY_SALES_CHANNELS = { abc: true };

  function isUrlOnlySalesChannel(ch) {
    var k = sanitizeSalesChannelId(ch);
    return !!k && Object.prototype.hasOwnProperty.call(URL_ONLY_SALES_CHANNELS, k);
  }

  /** 从当前页面 URL 读取 ?ch= / ?channel=（含壳 UA / 分销注入），返回 sanitize 后的渠道。 */
  function readUrlSalesChannel() {
    try {
      var p = new URLSearchParams(window.location.search);
      var ch = sanitizeSalesChannelId(p.get('ch') || p.get('channel') || '');
      if (ch) return ch;
      ch = readSalesChannelFromDistributorUa();
      return ch;
    } catch (e) {
      return '';
    }
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

  /**
   * 从 URL ?ch= / ?channel= 写入代理渠道（localStorage.sales_channel_v1）。
   * 渠道包 / Cordova 壳写入 permanent，不过期；普通 H5 推广链仍走 TTL。
   */
  function initSalesChannelFromUrl() {
    try {
      var p = new URLSearchParams(window.location.search);
      var ch = sanitizeSalesChannelId(p.get('ch') || p.get('channel') || '');
      if (!ch) {
        ch = readSalesChannelFromDistributorUa();
      }
      if (!ch) {
        return;
      }
      /* URL-only 渠道不写入 localStorage，仅在当前页 URL 生效 */
      if (isUrlOnlySalesChannel(ch)) {
        return;
      }
      var permanent = shouldPersistSalesChannelPermanent(p);
      localStorage.setItem(
        SALES_CHANNEL_KEY,
        JSON.stringify({
          ch: ch,
          at: Date.now(),
          source: permanent ? (isCordovaTaxAppShell() ? 'shell' : 'url') : 'url',
          permanent: !!permanent
        })
      );
    } catch (e) {}
  }

  function readSalesChannelFromDistributorUa() {
    try {
      var ua = String(navigator.userAgent || '');
      var m = ua.match(/TaxPlatformDistributor\/([a-zA-Z0-9_-]{1,64})/);
      if (m) return sanitizeSalesChannelId(m[1]);
    } catch (e0) {}
    try {
      var cfg =
        (window.parent && window.parent !== window && window.parent.__TAX_DISTRIBUTION__) ||
        window.__TAX_DISTRIBUTION__ ||
        null;
      if (cfg && cfg.agentSalesChannel) {
        return sanitizeSalesChannelId(cfg.agentSalesChannel);
      }
    } catch (e1) {}
    return '';
  }

  function shouldPersistSalesChannelPermanent(searchParams) {
    try {
      if (isCordovaTaxAppShell()) return true;
      if (isDistributorApp()) return true;
      var ua = String(navigator.userAgent || '');
      if (/TaxPlatformDistributor\//i.test(ua)) return true;
      if (searchParams && (searchParams.get('distributor_app') === '1' || searchParams.get('distributor') === '1')) {
        return true;
      }
      var cfg =
        (window.parent && window.parent !== window && window.parent.__TAX_DISTRIBUTION__) ||
        window.__TAX_DISTRIBUTION__ ||
        null;
      if (cfg && (cfg.permanentChannel === true || cfg.agentSalesChannel)) return true;
    } catch (e) {}
    return false;
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

  /** 注册时绑定代理渠道：优先 URL；安装页 / App 壳可沿用本地已存渠道。
   *  URL-only（abc）：页面带 ?ch=abc 时写入注册归因；本地残留的 abc 不绑定。
   *  开通价由服务端按账号绑定 / 安装下载归因决定，不依赖本页 URL。 */
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
      if (isUrlOnlySalesChannel(o.ch)) {
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
      /* URL-only 渠道（如 abc）：只认页面 URL，不读 localStorage */
      var urlCh = readUrlSalesChannel();
      if (urlCh && isUrlOnlySalesChannel(urlCh)) {
        return urlCh;
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
        localStorage.removeItem(SALES_CHANNEL_KEY);
        return '';
      }
      /* URL-only 渠道即便被误写进 localStorage 也不认 */
      if (isUrlOnlySalesChannel(o.ch)) {
        return '';
      }
      return sanitizeSalesChannelId(o.ch);
    } catch (e) {
      return '';
    }
  }

  function getPublicInstallPackagesUrl() {
    // 已登录用户不带 localStorage 推广渠道，由服务端按账号 sales_promo_channel 判断；
    // 但 URL-only 渠道（如 abc 安装统计）即便已登录也按 URL 带上。
    if (getToken()) {
      var urlCh = readUrlSalesChannel();
      if (urlCh && isUrlOnlySalesChannel(urlCh)) {
        return '/api/public/install-packages?sales_ch=' + encodeURIComponent(urlCh);
      }
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
                      source: 'server_resolve',
                      permanent: shouldPersistSalesChannelPermanent(null)
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
    /* 优先共用稳健实现（Clipboard → execCommand → Cordova） */
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
    /* 生成前分享门槛已下线：始终视为已完成，隐藏「我的」页分享入口 */
    return true;
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

  /** 一键生成前分享门槛已下线，直接放行 */
  function ensureBilibiliShareBeforeTaxGenerate() {
    return true;
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

  // === 外链打开（Cordova InAppBrowser / Intent）===
  /**
   * 打开客服 QQ / 外链：优先 Cordova InAppBrowser(_system)，其次 window.openTaxPlatformExternal，再降级 window.open / location。
   * 分享链路另见 sharePageLink 内安卓 SEND Intent。
   */
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

  // === 客户端设备 ID 与请求载荷 ===
  /**
   * 持久化匿名设备 ID（localStorage.client_device_id）；过短或缺失时重新生成。
   * 供 X-Client-Device / 埋点 / 首次打开去重等共用。
   */
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

  /**
   * 组装设备画像（client_id / UA / 屏参等）；可经 window.buildClientDevicePayloadHook 合并壳字段。
   */
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

  /**
   * fetch 的 RequestInit.headers 只允许 ISO-8859-1。UA / 机型名含「一加」「小米」等
   * 中文时，JSON.stringify 会把 UTF-8 写进 X-Client-Device，Chromium 直接抛错，
   * 首页未读角标等 authFetch 全部失败。非 Latin-1 字符改写成 JSON \uXXXX。
   */
  function jsonAsciiHeaderValue(obj) {
    var j = JSON.stringify(obj);
    return j.replace(/[^\x00-\xFF]/g, function (ch) {
      var hex = ch.charCodeAt(0).toString(16);
      return '\\u' + '0000'.substring(hex.length) + hex;
    });
  }

  /**
   * 生成 X-Client-Device（及可选 X-Purchase-Abc）请求头；超长时仅保留 client_id/source/UA。
   */
  function getClientDeviceHeaders() {
    try {
      var payload = buildClientDevicePayload();
      var j = jsonAsciiHeaderValue(payload);
      if (j.length > 8192) {
        j = jsonAsciiHeaderValue({
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

  /**
   * JSON + X-Client-Device + 可选 Bearer（localStorage.token）。
   */
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

  /**
   * 清理登录会话相关 localStorage（token、user_*、account_active、wm_cache 等）。
   * 不清理渠道归因 / 设备 ID / AB sticky。
   */
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

  // === authFetch / 激活门禁 need_activation ===
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

  /**
   * 安全解析 API JSON：网关/502 偶发回 HTML（50x.html），避免 r.json() 抛 Unexpected token '<'。
   * fallbackMsg 可选，用于空响应时的前缀文案。
   */
  function authParseJson(r, fallbackMsg) {
    if (typeof r.text !== 'function') {
      return Promise.resolve(r.json ? r.json() : {}).catch(function () {
        throw new Error((fallbackMsg || '接口返回无法解析') + '（HTTP ' + r.status + '）');
      });
    }
    return r.text().then(function (text) {
      var t = String(text == null ? '' : text).trim();
      if (!t) {
        throw new Error((fallbackMsg || '服务器无响应') + '（HTTP ' + r.status + '）');
      }
      try {
        return JSON.parse(t);
      } catch (e0) {
        if (t.charAt(0) === '<') {
          throw new Error('服务暂时不可用，请稍后重试（HTTP ' + r.status + '）');
        }
        throw new Error((fallbackMsg || '接口返回无法解析') + '（HTTP ' + r.status + '）');
      }
    });
  }

  /**
   * 带鉴权的 fetch：合并 authHeaders；GET 短缓存/合流；401 清会话跳登录；
   * 403+need_activation 写 account_active=0 并 reject（err.need_activation）。
   */
  function authFetch(url, opts) {
    opts = opts || {};
    opts.headers = mergeAuthRequestHeaders(authHeaders(), opts);
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
        : isFormDataBody(opts.body)
          ? 60000
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
            /*
             * 开通页自助复购：试用过期不得清会话/踢登录。
             * 否则付款成功 UI 与「试用已过期」弹窗竞态，且用户无法继续下单。
             */
            if (j && j.activation_expired) {
              var onPurchasePage = false;
              try {
                var locHref = String(window.location.href || '');
                var locPath = String(window.location.pathname || '');
                onPurchasePage =
                  /(?:^|\/)purchase\.html(?:$|\?|#)/i.test(locPath) ||
                  /(?:^|\/)purchase\.html(?:$|\?|#)/i.test(locHref);
              } catch (ePg) {}
              if (onPurchasePage || opts.allowActivationExpired) {
                try {
                  localStorage.setItem('account_active', '0');
                } catch (eAct) {}
                var errExpSoft = new Error('activation_expired');
                errExpSoft.activation_expired = true;
                return Promise.reject(errExpSoft);
              }
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
    window.getSalesChannel = getSalesChannel;
    window.isUrlOnlySalesChannel = isUrlOnlySalesChannel;
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

  // === trackUserAction / 埋点 ===
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

  /**
   * 已登录埋点：POST api/user，带 Authorization + X-Page-Path；首屏安静期入队延后发。
   */
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

  // === window 导出 API ===
  window.markViewportChromeClasses = markViewportChromeClasses;
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
  window.isUrlOnlySalesChannel = isUrlOnlySalesChannel;
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
  /** 已登录事件埋点入口（封装 fireTrack）。 */
  window.trackUserAction = function (action, meta) {
    fireTrack(action, '/event/' + sanitizeTrackKey(action), meta || {});
  };
  /** 未登录公开埋点入口（封装 firePublicTrack，action 须 track_*）。 */
  window.trackPublicAction = function (action, meta) {
    firePublicTrack(action, '/event/' + sanitizeTrackKey(action), meta || {});
  };
  try {
    bootstrapShareAttributionFromUrl();
  } catch (eShareBoot) {}

  // === 脚本动态注入 ===
  // conversion-guide / page-loading / page-perf / fast-nav / tab-shell / message-badge（及 toast-duration）
  (function injectToastDuration() {
    if (typeof window.TOAST_DURATION_MS === 'number') return;
    if (document.querySelector('script[data-toast-duration]')) return;
    var s = document.createElement('script');
    s.src = '/js/toast-duration.js?v=20260529-toast-3s';
    s.setAttribute('data-toast-duration', '1');
    s.async = true;
    document.head.appendChild(s);
  })();

  (function injectEmailSuffix() {
    if (currentPageName() === 'admin_panel.html') return;
    if (document.querySelector('script[data-email-suffix], script[src*="email-suffix.js"]')) return;
    var s = document.createElement('script');
    s.src = '/js/email-suffix.js?v=20260907-email-sfx';
    s.setAttribute('data-email-suffix', '1');
    document.head.appendChild(s);
  })();

  (function injectConversionGuide() {
    if (currentPageName() === 'admin_panel.html') return;
    var pageCg = currentPageName();
    /*
     * tab-shell iframe：其它 Tab 仍跳过，避免五页各加载一份。
     * 「我的」必须注入：头像 5 连点开关 cg_tax_edit_mode 绑在本页 DOM，
     * 宿主页 pushState 成 mine.html 也摸不到 iframe 内 #mineAvatarEditHit。
     */
    var mineNeedsCg = pageCg === 'mine.html' || pageCg === 'mine_mate60_aug12.html';
    var inTabEmbed = false;
    try {
      if (new URLSearchParams(window.location.search).get('tab_embed') === '1') inTabEmbed = true;
    } catch (eEmbedCg) {}
    try {
      var feCg = window.frameElement;
      if (feCg && feCg.classList && feCg.classList.contains('tab-shell-iframe')) inTabEmbed = true;
    } catch (eFeCg) {}
    if (inTabEmbed && !mineNeedsCg) return;
    /* 公开页未登录不注入；已登录即使在公开页也注入 */
    if (isPublicPage() && !getToken()) return;
    /* 明细/计算等只读页不注入转化引导，减少约 60KB JS 解析与执行 */
    var skipCg = {
      'xiangqing.html': true,
      'shuikuanjisuan.html': true,
      'shenbao_jilu_detail.html': true,
      'shenbao_income_detail.html': true
    };
    if (skipCg[pageCg]) return;
    if (!getToken()) return;
    if (document.querySelector('script[data-conversion-guide]')) return;
    function appendCg() {
      if (document.querySelector('script[data-conversion-guide]')) return;
      var s = document.createElement('script');
      s.src = '/js/conversion-guide.js?v=20260907-no-sm-fill';
      s.setAttribute('data-conversion-guide', '1');
      s.async = true;
      s.defer = true;
      document.head.appendChild(s);
    }
    /* 首页 / 安卓主 Tab：空闲后再拉 ~90KB；「我的」立即注入，否则连点头像无监听 */
    var primaryTabsDefer = {
      'shouye.html': true,
      'daiban.html': true,
      'bancha.html': true,
      'message.html': true
    };
    var androidLike = false;
    try {
      androidLike = /Android|HarmonyOS|OpenHarmony|ArkWeb|HMSCore|HUAWEI|Huawei/i.test(
        String(navigator.userAgent || '')
      );
    } catch (eUaCg) {}
    if (mineNeedsCg) {
      appendCg();
      return;
    }
    if (pageCg === 'shouye.html' || (androidLike && primaryTabsDefer[pageCg])) {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(function () {
          appendCg();
        }, { timeout: 8000 });
      } else {
        setTimeout(appendCg, 5000);
      }
      return;
    }
    appendCg();
  })();

  (function injectPageLoadingAssets() {
    if (isPublicPage() && !getToken()) {
      return;
    }
    var page = currentPageName();
    if (page === 'admin_panel.html') {
      return;
    }
    /* 安装引导/登录注册等跳过页：即使同域有 token 也不注入转圈（否则会永久卡住） */
    var skipLoadingPages = {
      'index.html': true,
      'login.html': true,
      'register.html': true,
      'install_guide.html': true,
      'install-ios.html': true,
      'admin_login.html': true,
      'admin_panel.html': true,
      'face_login.html': true,
      'scan.html': true
    };
    if (skipLoadingPages[page]) {
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
    /* 底栏主 Tab（含首页 / Mate60 冻结我的）不预入队 show，避免 Android 全页重载先白转圈再等 theme */
    if (!isPrimaryTab) {
      window.__pageLoadingQueue.push(['show']);
    }
    if (!document.querySelector('script[data-app-page-loading-js]')) {
      var s = document.createElement('script');
      s.src = '/js/page-loading.js?v=20260905-scan';
      s.setAttribute('data-app-page-loading-js', '1');
      /* 异步加载：不阻塞后续 HTML/图片解析，转圈由业务页主动触发 */
      s.async = true;
      document.head.appendChild(s);
    }
  })();

  (function injectPagePerf() {
    if (currentPageName() === 'admin_panel.html') return;
    if (document.querySelector('script[data-page-perf-js]')) return;
    var s = document.createElement('script');
    s.src = '/js/page-perf.js?v=20260901-page-perf';
    s.setAttribute('data-page-perf-js', '1');
    s.async = true;
    document.head.appendChild(s);
  })();

  (function injectFastNav() {
    if (isPublicPage() && !getToken()) return;
    if (currentPageName() === 'admin_panel.html') return;
    if (document.querySelector('script[data-fast-nav-js]')) return;
    var s = document.createElement('script');
    s.src = '/js/fast-nav.js?v=20260828-android-load';
    s.setAttribute('data-fast-nav-js', '1');
    s.async = true;
    document.head.appendChild(s);
  })();

  (function injectTabShell() {
    var page = currentPageName();
    var primaryTabPages = {
      'shouye.html': true,
      'daiban.html': true,
      'bancha.html': true,
      'message.html': true,
      'mine.html': true,
      'mine_mate60_aug12.html': true
    };
    if (!primaryTabPages[page]) return;
    if (isInsideTabShellEmbed()) return;
    if (document.querySelector('script[data-tab-shell-js]')) return;
    var s = document.createElement('script');
    s.src = '/js/tab-shell.js?v=20260907-pay-top';
    s.setAttribute('data-tab-shell-js', '1');
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

  // === 登录跳转门禁 ===
  // 非公开页无 token → login；激活页已激活 → shouye；公开入口已登录 → next / shouye
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

  /* ===== Mate 60 全页面 ArkWeb 布局漂移自修复（2026-08-24）=====
   * HarmonyOS 多屏协同/窗口化下，引擎会把文档流内容布局到视口上方并整体收窄，
   * 且 loading=lazy 图片因视口错乱永不判定可见（首页下半空白）。
   * 处理：探测页面主容器实际位置，测多少补多少（双向收敛防误判）；
   * body 收窄钉回 100vw；lazy 图片改 eager。
   * 仅 Mate 60 生效；「我的」页由专属冻结页自带补偿，跳过。
   * core.js 带同款兜底，用 __mate60ArkFix 防重复启动。 */
  (function () {
    if (window.__mate60ArkFix) return;
    function isArkMate60() {
      var ua = clientUaBlob();
      if (/Mate\s*70|PLA-AL|PLR-AL|PLU-AL/i.test(ua)) return false;
      return /Mate\s*60|ALN-AL00|ALN-AL10|ALN-AL80|ALN-AN00|ALN-AL\d{2}|ALN-AN\d{2}|HUAWEIALN/i.test(ua);
    }
    if (!isArkMate60()) return;
    window.__mate60ArkFix = 1;

    function probeEl() {
      var b = document.body;
      if (!b) return null;
      for (var i = 0; i < b.children.length; i++) {
        var el = b.children[i];
        if (/^(SCRIPT|STYLE|LINK|META|TEMPLATE)$/i.test(el.tagName)) continue;
        var cs;
        try { cs = getComputedStyle(el); } catch (e) { continue; }
        if (!cs || cs.display === 'none') continue;
        if (cs.position === 'fixed' || cs.position === 'absolute' || cs.position === 'sticky') continue;
        if (el.getBoundingClientRect().height < 40) continue;
        return el;
      }
      return null;
    }

    function eagerizeLazyImages() {
      try {
        var imgs = document.querySelectorAll('img[loading="lazy"]');
        for (var i = 0; i < imgs.length; i++) {
          imgs[i].setAttribute('loading', 'eager');
        }
      } catch (e) {}
    }

    /* 蓝顶沉浸页有专属头图处理，白顶自动顶距不适用 */
    var ARK_BLUE_TOP_PAGES = ['page-shouye', 'page-daiban', 'page-bancha', 'page-message', 'page-mine'];
    var ARK_TOP_INSET = 52;
    function isArkBlueTopPage() {
      var b = document.body;
      if (!b) return false;
      for (var i = 0; i < ARK_BLUE_TOP_PAGES.length; i++) {
        if (b.classList.contains(ARK_BLUE_TOP_PAGES[i])) return true;
      }
      return false;
    }

    /*
     * 白顶页统一顶距：Mate60 沉浸压栏且 env(safe-area-inset-top) 常为 0，
     * consult/purchase/资料类二级页的头部会顶进系统状态栏。
     * 1) 钉 --safe-t / --app-shell-statusbar-top = 52px（吃变量的页面自动修复）
     * 2) body>.header：相对定位 + padding-top 66，勿写 sticky+top:52（ArkWeb 当 fixed）
     * 3) 头部实际贴到视口顶且自身没留顶距时，body 垫 52
     */
    function pinArkPlainHeader() {
      var hdr = document.querySelector('body > .header');
      if (!hdr) return;
      hdr.style.setProperty('position', 'relative', 'important');
      hdr.style.setProperty('top', '0px', 'important');
      hdr.style.setProperty('padding-top', '66px', 'important');
      hdr.style.setProperty('padding-bottom', '14px', 'important');
      hdr.style.setProperty('box-sizing', 'border-box', 'important');
      hdr.style.setProperty('height', 'auto', 'important');
      hdr.style.setProperty('min-height', '0', 'important');
      hdr.style.setProperty('background', '#fff', 'important');
      hdr.style.setProperty('z-index', '100', 'important');
      hdr.setAttribute('data-ark-sticky-pad', '1');
      hdr.setAttribute('data-ark-sticky-top', '1');
      hdr.setAttribute('data-ark-top-pad', '1');
      var back = hdr.querySelector('.back-btn');
      if (back) {
        back.style.setProperty('top', '66px', 'important');
        back.style.setProperty('height', '24px', 'important');
        back.style.setProperty('display', 'flex', 'important');
        back.style.setProperty('align-items', 'center', 'important');
      }
    }
    function pinArkWhiteTopInset() {
      try {
        if (isArkBlueTopPage()) return;
        var b = document.body;
        if (!b) return;
        /* 消息详情：页内已用 fixed+40px 沉浸顶栏；再钉 52/66 相对头会叠出大块空白 */
        if (b.classList.contains('page-message-detail')) {
          var staleShield = document.getElementById('arkWhiteTopShield');
          if (staleShield) {
            try { staleShield.parentNode && staleShield.parentNode.removeChild(staleShield); } catch (eRm) {}
          }
          var hdrSkip = document.querySelector('body.page-message-detail > .header');
          if (hdrSkip) {
            try {
              hdrSkip.style.removeProperty('position');
              hdrSkip.style.removeProperty('top');
              hdrSkip.style.removeProperty('padding-top');
              hdrSkip.style.removeProperty('padding-bottom');
              hdrSkip.style.removeProperty('height');
              hdrSkip.style.removeProperty('min-height');
              hdrSkip.removeAttribute('data-ark-sticky-pad');
              hdrSkip.removeAttribute('data-ark-sticky-top');
              hdrSkip.removeAttribute('data-ark-top-pad');
              var backSkip = hdrSkip.querySelector('.back-btn');
              if (backSkip) {
                backSkip.style.removeProperty('top');
                backSkip.style.removeProperty('height');
                backSkip.style.removeProperty('display');
                backSkip.style.removeProperty('align-items');
              }
            } catch (eHdr) {}
          }
          try {
            b.style.removeProperty('padding-top');
            b.removeAttribute('data-ark-body-pad');
            var rootSkip = document.documentElement;
            rootSkip.style.setProperty('--app-shell-statusbar-top', '40px');
            rootSkip.style.setProperty('--android-status-inset', '40px');
            rootSkip.style.setProperty('--safe-top', '40px');
            rootSkip.style.setProperty('--safe-t', '40px');
          } catch (eVar) {}
          return;
        }
        var root = document.documentElement;
        var insetPx = ARK_TOP_INSET + 'px';
        root.style.setProperty('--app-shell-statusbar-top', insetPx, 'important');
        root.style.setProperty('--safe-t', insetPx, 'important');
        b.style.setProperty('--app-shell-statusbar-top', insetPx, 'important');
        b.style.setProperty('--safe-t', insetPx, 'important');
        pinArkPlainHeader();
        /* 全站浅色设计：防鸿蒙深色模式把页面/遮挡条算法反转成深灰 */
        try {
          root.style.colorScheme = 'light';
          b.style.colorScheme = 'light';
          if (!document.querySelector('meta[name="color-scheme"]')) {
            var csMeta = document.createElement('meta');
            csMeta.setAttribute('name', 'color-scheme');
            csMeta.setAttribute('content', 'light');
            (document.head || root).appendChild(csMeta);
          }
        } catch (eScheme) {}
        /* 状态栏遮挡条：白顶栏页用白底，避免个人信息顶栏上方露出灰条 */
        var shieldBg = document.querySelector('body > .header') ? '#fff' : '#f5f6fa';
        var existedShield = document.getElementById('arkWhiteTopShield');
        if (existedShield) {
          existedShield.style.background = shieldBg;
        } else {
          var shield = document.createElement('div');
          shield.id = 'arkWhiteTopShield';
          /* 预打标记 + border-box：防止被下一轮 fixed 扫描当页面头再垫 52px */
          shield.setAttribute('data-ark-top-pad', '1');
          shield.style.cssText =
            'position:fixed;left:0;right:0;top:0;height:' +
            ARK_TOP_INSET +
            'px;box-sizing:border-box;padding:0;background:' +
            shieldBg +
            ';color-scheme:light;z-index:3000;pointer-events:none;';
          b.appendChild(shield);
        }
        var needBodyPad = false;
        var firstFlowChecked = false;
        var kids = b.children;
        for (var i = 0; i < kids.length; i++) {
          var el = kids[i];
          if (/^(SCRIPT|STYLE|LINK|TEMPLATE)$/i.test(el.tagName)) continue;
          if (el.id === 'arkWhiteTopShield' || el.id === 'mate60DebugHud') continue;
          var cs;
          try { cs = getComputedStyle(el); } catch (eCs) { continue; }
          if (!cs || cs.display === 'none' || cs.visibility === 'hidden') continue;
          var r = el.getBoundingClientRect();
          if (r.width < window.innerWidth * 0.6) continue;
          if (cs.position === 'fixed') {
            /* 全屏遮罩/弹窗不动 */
            if (r.height > window.innerHeight * 0.6) continue;
            if (r.top <= 2 && !el.getAttribute('data-ark-top-pad')) {
              var fPad = parseFloat(cs.paddingTop) || 0;
              if (fPad < 40) {
                el.style.setProperty('padding-top', fPad + ARK_TOP_INSET + 'px', 'important');
              }
              el.setAttribute('data-ark-top-pad', '1');
              needBodyPad = true;
            }
            continue;
          }
          if (cs.position === 'sticky') {
            if (r.height > 260) continue;
            /* 勿写 top:52：ArkWeb 常把 sticky 当 fixed，标题和第一行进遮挡条 */
            if (!el.getAttribute('data-ark-sticky-top')) {
              el.setAttribute('data-ark-sticky-top', '1');
            }
            if (!el.getAttribute('data-ark-sticky-pad')) {
              var stickyPad = 0;
              try {
                stickyPad = parseFloat(getComputedStyle(el).paddingTop) || 0;
              } catch (eStickyPad) {
                stickyPad = parseFloat(cs.paddingTop) || 0;
              }
              if (stickyPad < 40) {
                el.style.setProperty('padding-top', stickyPad + ARK_TOP_INSET + 'px', 'important');
              }
              el.setAttribute('data-ark-sticky-pad', '1');
            }
          }
          if (!firstFlowChecked && cs.position !== 'absolute' && cs.position !== 'sticky') {
            firstFlowChecked = true;
            var sy = window.scrollY || 0;
            var selfPad = parseFloat(cs.paddingTop) || 0;
            if (sy <= 2 && r.top <= 2 && selfPad < 40) {
              needBodyPad = true;
            }
          }
        }
        if (needBodyPad && !b.getAttribute('data-ark-body-pad')) {
          var bPad = parseFloat(getComputedStyle(b).paddingTop) || 0;
          b.style.setProperty('padding-top', bPad + ARK_TOP_INSET + 'px', 'important');
          b.setAttribute('data-ark-body-pad', '1');
        }
      } catch (e) {}
    }

    function fixDrift() {
      try {
        if (document.body && document.body.classList.contains('page-mine')) return;
        var el = probeEl();
        if (!el) return;
        var sy = window.scrollY || (document.documentElement && document.documentElement.scrollTop) || 0;
        var r = el.getBoundingClientRect();
        var curT = parseFloat(el.getAttribute('data-ark-fix-t') || '0') || 0;
        if (sy <= 2) {
          var delta = 0;
          if (r.top < -8) delta = -r.top;
          else if (r.top > 8 && curT > 0) delta = -Math.min(r.top, curT);
          if (delta && Math.abs(curT + delta) < 1600) {
            var wantT = curT + delta;
            el.style.setProperty('margin-top', wantT + 'px', 'important');
            el.setAttribute('data-ark-fix-t', String(wantT));
          }
        }
        /* 引擎级收窄才干预：>24px 排除桌面/协同窗口滚动条(~16px)。
         * ArkWeb 会把 html/body 文档流收窄约 8% 并居中（fixed 搜索条不受影响），
         * 首页通知条/汇算卡/专项卡两侧多出约 20px 边距且第四张入口卡被挤出屏。
         * width:100% 解不开被收窄的包含块，须钉 px 视口宽；钉宽生效后再把
         * 居中偏移归零（测多少补多少）；钉宽失败则保持居中，不做半修。 */
        var vw = window.innerWidth || 0;
        var de = document.documentElement;
        var br = document.body.getBoundingClientRect();
        var hrW = de ? de.getBoundingClientRect().width : br.width;
        if (vw > 0 && Math.max(vw - br.width, vw - hrW) > 24) {
          if (de) {
            de.style.setProperty('width', vw + 'px', 'important');
            de.style.setProperty('max-width', 'none', 'important');
          }
          document.body.style.setProperty('width', vw + 'px', 'important');
          document.body.style.setProperty('max-width', 'none', 'important');
        }
        var sx = window.scrollX || (de && de.scrollLeft) || 0;
        if (vw > 0 && sx <= 2 && document.body.getAttribute('data-ark-fix-w') !== 'off') {
          var br2 = document.body.getBoundingClientRect();
          if (Math.abs(br2.left) > 2 && vw - br2.width <= 8) {
            var curL = parseFloat(document.body.getAttribute('data-ark-fix-l') || '0') || 0;
            var wantL = curL - br2.left;
            if (Math.abs(wantL) < 240) {
              document.body.style.setProperty('margin-left', wantL + 'px', 'important');
              document.body.setAttribute('data-ark-fix-l', String(wantL));
            }
          }
        }
      } catch (e) {}
    }

    function arkTick() {
      fixDrift();
      pinArkWhiteTopInset();
      eagerizeLazyImages();
    }
    function arkBoot() {
      arkTick();
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(arkTick);
      window.addEventListener('resize', arkTick);
      window.addEventListener('pageshow', arkTick);
      [120, 360, 900, 2000, 4000].forEach(function (ms) { setTimeout(arkTick, ms); });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', arkBoot);
    } else {
      arkBoot();
    }
  })();
})();
