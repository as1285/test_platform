/**
 * 登录态：JWT 存 localStorage.token；未登录访问受保护页面时跳转登录页。
 * 受保护接口请使用 authFetch（自动带 Authorization + X-Client-Device，401 时清理并跳转）。
 * WebView / App 可设置 window.CLIENT_APP_VERSION；可选 window.buildClientDevicePayloadHook(base) 合并字段。
 * Cordova 壳在 UA 中追加 TaxPlatformCordovaApp（config AppendUserAgent），H5 可识别壳内环境。
 */
(function () {
  var LOGIN_PAGE = 'index.html';
  var ACTIVATE_PAGE = 'index.html?need_activate=1';
  var CLIENT_DEVICE_STORAGE_KEY = 'client_device_id';
  var INSTALL_GUIDE_REFERRAL_KEY = 'install_guide_referral';
  var LANDING_AB_ASSIGNMENT_KEY = 'landing_bc_assignment_v1';
  var INSTALL_GUIDE_REFERRAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  var SALES_CHANNEL_KEY = 'sales_channel_v1';
  var DISTRIBUTOR_APP_KEY = 'distributor_app_v1';
  var SALES_CHANNEL_TTL_MS = 90 * 24 * 60 * 60 * 1000;
  var PUBLIC_PAGES = {
    'index.html': true,
    'register.html': true,
    'login.html': true,
    'install_guide.html': true,
    'tutorial_video.html': true,
    'zhzh_jhm.html': true
  };
  var APP_STATUS_BAR_COLOR = '#1e6fff';
  /** Cordova 壳通过 config AppendUserAgent 追加；若 UA 未透传到 iframe，则用被嵌入状态兜底识别 */
  var CORDOVA_SHELL_UA_RE = /TaxPlatformCordovaApp\//i;

  function isCordovaTaxAppShell() {
    try {
      if (CORDOVA_SHELL_UA_RE.test(navigator.userAgent || '')) {
        return true;
      }
      return window.top !== window.self;
    } catch (e) {
      return true;
    }
  }

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

  function isLikelyAndroidViewportClient() {
    return /Android/i.test(navigator.userAgent || '');
  }

  function getAndroidMajorVersion() {
    var m = String(navigator.userAgent || '').match(/Android\s+(\d+)/i);
    return m ? parseInt(m[1], 10) || 0 : 0;
  }

  function isTallAndroidStatusBarClient() {
    var ua = navigator.userAgent || '';
    return (
      /PKB110|B60P01/i.test(ua) ||
      /Xiaomi\s*14|23127PN|2201PN/i.test(ua) ||
      getAndroidMajorVersion() >= 15
    );
  }

  /** 小米 13（2211133C 等） */
  function isXiaomi13Client() {
    var ua = navigator.userAgent || '';
    return /2211133C|2210132C|Xiaomi\s*13\b/i.test(ua);
  }

  /** 小米 14 / HyperOS 等：UA 偶无型号时仍按 Android 15+ 顶栏高度处理 */
  function isXiaomi14LikeClient() {
    var ua = navigator.userAgent || '';
    if (isXiaomi13Client()) {
      return false;
    }
    if (/Xiaomi\s*14|23127PN|2201PN/i.test(ua)) {
      return true;
    }
    if (!/Xiaomi|Miui|Redmi|HyperOS/i.test(ua)) {
      return false;
    }
    return getAndroidMajorVersion() >= 14;
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
   * Cordova 壳 + 2410DPN6CC（Android 16）：WebView 内 env(safe-area-inset-bottom) 常为 0，
   * 底部胶囊导航与系统手势条重叠。仅匹配该机型 UA，不影响其它设备。
   */
  function isCordovaXiaomi2410Client() {
    var ua = navigator.userAgent || '';
    if (!CORDOVA_SHELL_UA_RE.test(ua)) {
      return false;
    }
    return /2410DPN6CC/i.test(ua);
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

  /** Cordova 壳 + vivo X200 Pro：WebView 已由壳体下移，勿再叠 Android 15 的 56px 顶栏占位。 */
  function isCordovaVivoX200ProClient() {
    if (!isCordovaTaxAppShell()) {
      return false;
    }
    return isVivoX200ProLikeClient();
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

  /** iPhone 17 / 17 Pro / 17 Air 等 6.3 寸档逻辑屏约 402×874（容差）。 */
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
   * iPhone 17 系列 6.3 寸（17 / 17 Pro / 17 Air 等，非 Max）：收入纳税明细顶栏「返回」「批量申诉」字号单独放大。
   * UA 含型号时优先；Safari 无型号时用 iOS 26+ 且 402×874 视口与 16 Pro 区分。
   */
  function isIPhone17ProLikeClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    var ua = navigator.userAgent || '';
    if (/iPhone\s*17\s*Pro\s*Max|iPhone18,2|iPhone19,2/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*17(?:\s*Pro)?\b|iPhone\s*17\s*Air\b|iPhone18,1\b|iPhone18,3\b|iPhone18,4\b|iPhone19,1\b/i.test(ua)) {
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

  function isHonorMagicAndroidClient() {
    return isHonorPgtAn20Client() || isHonorPtpAn00Client();
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

  /** iOS 个人中心：状态栏区铺蓝、顶图上移填满安全区 */
  function applyMinePageChrome() {
    try {
      if (!document.body || !document.body.classList.contains('page-mine')) {
        return;
      }
      if (!isLikelyIOSViewportClient()) {
        return;
      }
      /* 与 mine 顶图（grdb/nx）顶缘取样一致，避免状态栏浅蓝与头像区深蓝断层 */
      upsertMeta('theme-color', '#2188f4');
      upsertMeta('msapplication-navbutton-color', '#2188f4');
      upsertMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
      try {
        var sbMine = window.top && window.top.StatusBar;
        if (sbMine) {
          sbMine.overlaysWebView(true);
          sbMine.styleLightContent();
          sbMine.backgroundColorByHexString('#2188f4');
        }
      } catch (eMineSb) {}
    } catch (e) {}
  }

  /** iOS 首页：状态栏与搜索顶栏同蓝（15/16 Pro Max 等易露白底） */
  function applyShouyePageChrome() {
    try {
      if (!document.body || !document.body.classList.contains('page-shouye')) {
        return;
      }
      if (!isLikelyIOSViewportClient()) {
        return;
      }
      upsertMeta('theme-color', '#2c80f4');
      upsertMeta('msapplication-navbutton-color', '#2c80f4');
      upsertMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
      try {
        var sbHome = window.top && window.top.StatusBar;
        if (sbHome) {
          sbHome.overlaysWebView(true);
          sbHome.styleLightContent();
          sbHome.backgroundColorByHexString('#2c80f4');
        }
      } catch (eHomeSb) {}
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
      upsertMeta('apple-mobile-web-app-status-bar-style', 'default');
      /* Cordova iframe：白顶栏页使用深色状态栏文字，避免白底+浅色图标看不见时间/电量 */
      try {
        var sb = window.top && window.top.StatusBar;
        if (sb) {
          sb.overlaysWebView(true);
          sb.styleDefault();
          sb.backgroundColorByHexString('#00000000');
        }
      } catch (e2) {}
    } catch (e) {}
  }

  /**
   * 底栏位置锁：各 TAB 统一 bottom:10px，避免 iPhone 用 safe-area 再抬高（「我的」空隙尤其明显）。
   * 仅 Cordova 2410 需要额外 inset；内容避让仍靠 nav.css 的 --bottom-nav-clearance。
   */
  function ensureBottomNavLockStyle(opts) {
    opts = opts || {};
    var existing = document.querySelector('style[data-app-bottom-nav-lock]');
    if (existing) {
      existing.parentNode && existing.parentNode.removeChild(existing);
    }
    var st = document.createElement('style');
    st.setAttribute('data-app-bottom-nav-lock', '1');
    var bottom = opts.cordovaXiaomi2410 ? 'max(10px, 32px)' : '10px';
    st.textContent =
      '.bottom-nav{position:fixed!important;left:16px!important;right:16px!important;' +
      'bottom:' +
      bottom +
      '!important;z-index:200!important;animation:none!important;' +
      'transform:none!important;-webkit-transform:none!important;view-transition-name:none!important;}' +
      '.bottom-nav.ios-device{bottom:' +
      bottom +
      '!important;padding-bottom:0!important;}';
    (document.head || document.documentElement).appendChild(st);
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
  }

  function setupMobileStatusBar() {
    try {
      var cordovaShell = isCordovaTaxAppShell();
      var iosClient = isLikelyIOSViewportClient();
      var androidClient = isLikelyAndroidViewportClient();
      var annAn00Client = androidClient && isHonorAnnAn00Client();
      var honorPgtAn20Client = androidClient && isHonorPgtAn20Client();
      var honorPtpAn00Client = androidClient && isHonorPtpAn00Client();
      var honorMagicAndroidClient = androidClient && isHonorMagicAndroidClient();
      var xiaomi14Client = androidClient && isXiaomi14LikeClient();
      var cordovaXiaomi23127 = androidClient && isCordovaXiaomi23127Client();
      var cordovaXiaomiM2102 = androidClient && isCordovaXiaomiM2102Client();
      var cordovaXiaomi2410 = androidClient && isCordovaXiaomi2410Client();
      lockAppSafeBottomInset({ cordovaXiaomi2410: cordovaXiaomi2410 });
      var android25060RK16C = androidClient && isAndroid25060RK16CClient();
      var vivoX200ProClient = androidClient && isVivoX200ProLikeClient();
      var cordovaVivoX200Pro = cordovaShell && vivoX200ProClient;
      var iosIPhone11Pro = iosClient && isIPhone11ProLikeClient();
      var iosIPhone17Pro = iosClient && isIPhone17ProLikeClient();
      var iosIPhone17ProMax = iosClient && isIPhone17ProMaxClient();
      var iosIPhone16ProMax = iosClient && isIPhone16ProMaxClient();
      var iosIPhone16Pro = iosClient && isIPhone16ProLikeClient();
      var iosIPhone14 = iosClient && isIPhone14LikeClient();
      var iosIPhone15ProMax = iosClient && isIPhone15PlusProMaxLikeClient();
      var iosIPhone12ProMax = iosClient && isIPhone12ProMaxClient();
      var iosIPhoneProMaxFont = iosClient && isIPhoneProMaxLargeFontClient();
      var huaweiPura70Client = androidClient && isHuaweiPura70LikeClient();
      var cordovaHuaweiPura70 = cordovaShell && huaweiPura70Client;
      var huaweiClsAl00Client = androidClient && isHuaweiClsAl00Client();
      var huaweiTasAn00Client = androidClient && isHuaweiTasAn00Client();
      var tallAndroidStatusBar = androidClient && (isTallAndroidStatusBarClient() || xiaomi14Client);
      /*
       * iOS 维持原有逻辑；安卓改用页面灰根背景，避免页面跳转时先露出品牌蓝或纯白空屏。
       * Cordova / iframe 壳：白底，由各页顶栏铺色。
       */
      var lightRootChrome = cordovaShell || iosClient || androidClient;
      var rootChromeBg = cordovaXiaomi23127
        ? APP_STATUS_BAR_COLOR
        : androidClient
          ? '#f5f6fa'
          : lightRootChrome
            ? '#ffffff'
            : APP_STATUS_BAR_COLOR;
      upsertMeta('theme-color', rootChromeBg);
      upsertMeta('msapplication-navbutton-color', rootChromeBg);
      upsertMeta('apple-mobile-web-app-capable', 'yes');
      upsertMeta(
        'apple-mobile-web-app-status-bar-style',
        lightRootChrome ? 'default' : 'black-translucent'
      );
      /*
       * 顶部与系统状态栏避让：
       * - Cordova / iframe：iframe 内 env(safe-area-inset-top) 常为 0，用固定 48px。
       * - Android：沉浸式 WebView 里 env 常为 0；Android 15+/PKB110 使用更高兜底，避免标题压进系统状态栏。
       * - iOS 顶层 WKWebView（直接打开网址）：需 env(safe-area-inset-top)，否则首页搜索条、待办图头等会与时间栏重合。
       */
      var useTopSafeInset = cordovaShell || iosClient || androidClient;
      var statusInsetCss = androidClient
        ? (cordovaHuaweiPura70
            ? '0px'
            : huaweiPura70Client
            ? '32px'
            : honorPtpAn00Client
            ? '44px'
            : honorPgtAn20Client
              ? '36px'
              : annAn00Client
                ? '32px'
                : tallAndroidStatusBar
                  ? '56px'
                  : '24px')
        : cordovaShell
          ? '48px'
          : iosClient
            ? 'env(safe-area-inset-top, 0px)'
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
        /* 16 Pro 状态栏区易露出 html 白底；首页顶栏为蓝，与 theme-color 对齐 */
        upsertMeta('theme-color', '#2c80f4');
        upsertMeta('msapplication-navbutton-color', '#2c80f4');
      }
      if (iosIPhone16ProMax) {
        document.documentElement.classList.add('app-ios-iphone16promax');
        upsertMeta('theme-color', '#2c80f4');
        upsertMeta('msapplication-navbutton-color', '#2c80f4');
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
          'html.app-android-client.app-top-safe-shell .page-root{--safe-top:var(--app-shell-statusbar-top) !important;}' +
          'html.app-android-client.app-top-safe-shell .top-fixed .header{top:0 !important;height:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;padding:var(--app-shell-statusbar-top) 16px 0 !important;z-index:120 !important;}' +
          'html.app-android-client.app-top-safe-shell .top-fixed .header .back-btn,html.app-android-client.app-top-safe-shell .top-fixed .header .header-right{top:var(--app-shell-statusbar-top) !important;height:var(--header-height,52px) !important;display:flex !important;align-items:center !important;}' +
          'html.app-android-client.app-top-safe-shell .top-fixed .summary{top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-client.app-top-safe-shell .list{margin-top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-top-safe-shell .search-bar-wrapper{padding-top:calc(6px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-top-safe-shell body.page-shouye .search-bar-wrapper{background:rgb(var(--shouye-top-bar-rgb,44,128,244)) !important;box-shadow:none !important;}' +
          'html.app-top-safe-shell body.page-shouye .shouye-page{padding-top:var(--shouye-fixed-top-h,78px) !important;}' +
          'html.app-top-safe-shell body.page-shouye .shouye-header{margin-top:calc(-1 * var(--shouye-fixed-top-h,78px)) !important;padding-top:var(--shouye-fixed-top-h,78px) !important;background:rgb(var(--shouye-top-bar-rgb,44,128,244)) !important;}' +
          'html.app-top-safe-shell body.page-shouye .shouye-banner-wrap .notice-bar{position:relative !important;top:auto !important;left:auto !important;right:auto !important;margin:2px 12px 14px !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell .search-bar-wrapper{padding-top:calc(8px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell body.page-shouye .shouye-page{padding-top:calc(60px + var(--app-shell-statusbar-top,0px)) !important;}' +
          'html.app-android-ann-an00.app-top-safe-shell .search-bar-wrapper{padding-top:calc(2px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-ann-an00.app-top-safe-shell body.page-shouye .shouye-page{padding-top:calc(53px + var(--app-shell-statusbar-top,0px)) !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell .search-bar-wrapper{padding-top:calc(8px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell body.page-shouye .search-bar-wrapper{background:rgb(var(--shouye-top-bar-rgb,44,128,244)) !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell body.page-shouye .search-bar-wrapper.scrolled{background:rgb(var(--shouye-top-bar-rgb,44,128,244)) !important;}' +
          'html.app-android-honor-pgt-an20.app-top-safe-shell{--app-shell-statusbar-top:36px !important;}' +
          'html.app-android-honor-ptp-an00.app-top-safe-shell{--app-shell-statusbar-top:44px !important;}' +
          'html.app-android-honor-ptp-an00.app-top-safe-shell body.page-shouye .shouye-page{padding-top:calc(54px + var(--app-shell-statusbar-top,44px)) !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell body.page-mine .header-bg{padding-top:var(--app-shell-statusbar-top,0px) !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell .daiban-header{padding-top:var(--app-shell-statusbar-top) !important;background:#2c80f4 !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell .daiban-header > img{margin-top:0 !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell .bancha-header{padding-top:var(--app-shell-statusbar-top) !important;background:#2c80f4 !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell .bancha-header > img{margin-top:0 !important;}' +
          'html.app-android-honor-magic.app-top-safe-shell .message-header-toolbar{padding-top:calc(12px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-top-safe-shell .daiban-header{padding-top:var(--app-shell-statusbar-top) !important;background:#2c80f4 !important;overflow:visible;}' +
          'html.app-top-safe-shell .daiban-header > img{margin-top:0 !important;}' +
          'html.app-top-safe-shell .bancha-header{padding-top:var(--app-shell-statusbar-top) !important;background:#2c80f4 !important;overflow:visible;}' +
          'html.app-top-safe-shell .bancha-header > img{margin-top:0 !important;}' +
          'html.app-top-safe-shell .message-header-toolbar{padding-top:calc(14px + var(--app-shell-statusbar-top)) !important;padding-bottom:20px !important;padding-left:16px !important;padding-right:16px !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell .message-header-toolbar{padding-bottom:20px !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell .message-header-title{margin-bottom:18px !important;}' +
          'html.app-top-safe-shell body:not(.page-shuiming) > .header{padding-top:calc(14px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-top-safe-shell body.page-login .header{padding-top:calc(15px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-client.app-top-safe-shell body:not(.page-shuiming) > .header{height:auto !important;min-height:calc(48px + var(--app-shell-statusbar-top)) !important;padding-top:calc(14px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-client.app-top-safe-shell body.page-login .header{min-height:auto !important;padding-top:calc(15px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-top-safe-shell body.page-xiangqing{padding-top:calc(48px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-top-safe-shell body.page-mine .header-bg{padding-top:var(--app-shell-statusbar-top,0px) !important;background:linear-gradient(180deg,#2188f4 0%,#1e81fb 45%,#2c80f4 100%) !important;}' +
          'html.app-top-safe-shell body.page-mine .header-bg > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,0px)) !important;}' +
          /* iOS 我的：顶图再上移，安全区用 env 与顶图同色蓝底补条填满（避免浅蓝/深蓝接缝） */
          'html.app-ios-client.app-top-safe-shell{--app-shell-statusbar-top:env(safe-area-inset-top,48px) !important;--mine-ios-header-lift:12px;--mine-header-blue-top:#2188f4;}' +
          'html.app-ios-client.app-top-safe-shell body.page-mine::before{content:"";position:fixed;left:0;right:0;top:0;height:var(--app-shell-statusbar-top,env(safe-area-inset-top,48px));background:#2188f4;z-index:8;pointer-events:none;}' +
          'html.app-ios-client.app-top-safe-shell body.page-mine .header-bg{position:relative;z-index:9;padding-top:calc(var(--app-shell-statusbar-top,0px) + var(--mine-ios-header-lift,12px)) !important;overflow:visible !important;background:linear-gradient(180deg,#2188f4 0%,#1e81fb 45%,#2c80f4 100%) !important;}' +
          'html.app-ios-client.app-top-safe-shell body.page-mine .header-bg > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,0px) - var(--mine-ios-header-lift,12px)) !important;}' +
          'html.app-ios-client.app-top-safe-shell body.page-mine .mine-activate-btn{top:calc(var(--mine-activate-btn-top-offset,66px) + var(--app-shell-statusbar-top,0px) + var(--mine-ios-header-lift,12px)) !important;}' +
          /* iPhone 12 Pro Max：待办/办查/消息/我的 刘海区白边（仅 12PM，其它机型不改） */
          'html.app-ios-iphone12promax.app-top-safe-shell{--mine-ios-header-lift:0px !important;--app-shell-statusbar-top:env(safe-area-inset-top,0px) !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell body.page-daiban::before,html.app-ios-iphone12promax.app-top-safe-shell body.page-bancha::before{content:"" !important;position:fixed !important;top:0 !important;left:0 !important;right:0 !important;height:env(safe-area-inset-top,0px) !important;background:#2c80f4 !important;z-index:12 !important;pointer-events:none !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell .daiban-header,html.app-ios-iphone12promax.app-top-safe-shell .bancha-header{padding-top:env(safe-area-inset-top,0px) !important;background:#2c80f4 !important;overflow:visible !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell .daiban-header > img,html.app-ios-iphone12promax.app-top-safe-shell .bancha-header > img{margin-top:0 !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell body.page-message::before{content:"" !important;position:fixed !important;top:0 !important;left:0 !important;right:0 !important;height:env(safe-area-inset-top,0px) !important;background:#1e8fff !important;z-index:3 !important;pointer-events:none !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell .message-header-toolbar{padding-top:calc(14px + env(safe-area-inset-top,0px)) !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell body.page-mine::before{height:env(safe-area-inset-top,0px) !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell body.page-mine .header-bg{padding-top:env(safe-area-inset-top,0px) !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell body.page-mine .header-bg > img{margin-top:calc(-1 * env(safe-area-inset-top,0px)) !important;}' +
          'html.app-ios-iphone12promax.app-top-safe-shell body.page-mine .mine-activate-btn{top:calc(var(--mine-activate-btn-top-offset,66px) + env(safe-area-inset-top,0px)) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-cordova-xiaomi-23127) body.page-mine .header-bg > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,0px) + 8px) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-cordova-xiaomi-23127) body.page-mine .user-card{margin:-70px 16px 0 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell{--app-shell-statusbar-top:0px !important;--app-cordova-statusbar-chrome:40px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .search-bar-wrapper{padding-top:6px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shouye .shouye-banner-wrap .notice-bar{position:relative !important;top:auto !important;margin:2px 12px 14px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .bancha-header{padding-top:var(--app-cordova-statusbar-chrome,40px) !important;background:#2c80f4 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .bancha-header > img{margin-top:0 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .daiban-header{padding-top:var(--app-cordova-statusbar-chrome,40px) !important;background:#2c80f4 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .daiban-header > img{margin-top:0 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .message-header-toolbar{padding-top:14px !important;padding-bottom:20px !important;padding-left:16px !important;padding-right:16px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .header-bg{padding-top:0 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .header-bg > img{margin-top:0 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .content-wrapper{margin-top:-6px !important;padding-top:14px !important;}' +
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
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .mine-activate-btn{position:fixed !important;top:calc(var(--mine-activate-btn-top-offset,66px) + var(--app-cordova-statusbar-chrome,40px)) !important;right:18px !important;z-index:500 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .header-activate-btn{position:fixed !important;top:calc(10px + var(--app-cordova-statusbar-chrome,40px)) !important;right:12px !important;z-index:500 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .back-link{top:calc(10px + var(--app-cordova-statusbar-chrome,40px)) !important;}' +
          /* 收入纳税明细 shuiming_result：小米 14 顶栏/汇总区避免被状态栏遮挡 */
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-cordova-xiaomi-23127) body.page-shuiming-result .top-fixed .header{height:calc(var(--header-height,52px) + var(--app-shell-statusbar-top) + 10px) !important;padding-top:calc(var(--app-shell-statusbar-top) + 10px) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-cordova-xiaomi-23127) body.page-shuiming-result .top-fixed .header .back-btn,html.app-android-xiaomi-14.app-top-safe-shell:not(.app-cordova-xiaomi-23127) body.page-shuiming-result .top-fixed .header .header-right{top:calc(var(--app-shell-statusbar-top) + 10px) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-cordova-xiaomi-23127) body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top) + 10px) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-cordova-xiaomi-23127) body.page-shuiming-result .list{margin-top:calc(var(--header-height,52px) + var(--app-shell-statusbar-top) + 10px) !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .top-fixed .header{height:calc(var(--header-height,52px) + var(--app-cordova-statusbar-chrome,40px)) !important;padding-top:var(--app-cordova-statusbar-chrome,40px) !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn,html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .top-fixed .header .header-right{top:var(--app-cordova-statusbar-chrome,40px) !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .top-fixed .summary{top:calc(var(--header-height,52px) + var(--app-cordova-statusbar-chrome,40px)) !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-shuiming-result .list{margin-top:calc(var(--header-height,52px) + var(--app-cordova-statusbar-chrome,40px)) !important;}' +
          /* 华为 Pura 70：H5 横向铺满，录屏黑边改为页面灰底；个人中心主区贴边 */
          'html.app-huawei-pura70,html.app-huawei-pura70 body{width:100% !important;min-width:100% !important;max-width:none !important;margin:0 !important;background:#f5f6fa !important;overflow-x:hidden !important;}' +
          'html.app-huawei-pura70 body.page-mine .header-bg,html.app-huawei-pura70 body.page-mine .content-wrapper{width:100vw !important;max-width:100vw !important;margin-left:calc(50% - 50vw) !important;margin-right:calc(50% - 50vw) !important;box-sizing:border-box !important;}' +
          'html.app-huawei-pura70 body.page-mine .user-card,html.app-huawei-pura70 body.page-mine .menu-list{margin-left:0 !important;margin-right:0 !important;border-radius:0 !important;}' +
          'html.app-huawei-pura70 body.page-mine .function-cards{margin-left:8px !important;margin-right:8px !important;}' +
          'html.app-huawei-pura70.app-top-safe-shell body.page-mine .header-bg{padding-top:var(--app-shell-statusbar-top,0px) !important;}' +
          /* 华为 Pura 70 Cordova：壳已避开状态栏，顶栏贴 WebView 顶；高度由首页 JS 写入 --shouye-fixed-top-h */
          'html.app-cordova-huawei-pura70.app-top-safe-shell{--app-shell-statusbar-top:0px !important;--app-cordova-statusbar-chrome:0px !important;}' +
          'html.app-cordova-huawei-pura70.app-top-safe-shell body.page-shouye .search-bar-wrapper{padding-top:6px !important;padding-bottom:6px !important;background:rgb(var(--shouye-top-bar-rgb,44,128,244)) !important;box-shadow:none !important;}' +
          'html.app-cordova-huawei-pura70.app-top-safe-shell body.page-shouye .shouye-page{padding-top:var(--shouye-fixed-top-h,52px) !important;}' +
          /* 华为 Pura 70 非 Cordova（浏览器调试） */
          'html.app-huawei-pura70.app-top-safe-shell:not(.app-cordova-huawei-pura70){--app-shell-statusbar-top:32px !important;}' +
          'html.app-huawei-pura70.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye .search-bar-wrapper{padding-top:calc(6px + var(--app-shell-statusbar-top)) !important;background:rgb(var(--shouye-top-bar-rgb,44,128,244)) !important;box-shadow:none !important;}' +
          'html.app-huawei-pura70.app-top-safe-shell:not(.app-cordova-huawei-pura70) body.page-shouye .shouye-page{padding-top:calc(46px + var(--app-shell-statusbar-top,32px) + 6px) !important;}' +
          /* iPhone 16 Pro：首页固定搜索条上方安全区铺蓝，消除状态栏下白边 */
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shouye .search-bar-wrapper{background:rgb(var(--shouye-top-bar-rgb,44,128,244)) !important;}' +
          'html.app-ios-iphone16pro.app-top-safe-shell body.page-shouye .search-bar-wrapper.scrolled{background:rgb(var(--shouye-top-bar-rgb,44,128,244)) !important;}' +
          /* iPhone 15/16 Pro Max 首页：状态栏区强制铺蓝，避免白底接缝 */
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shouye::before,html.app-ios-iphone16promax.app-top-safe-shell body.page-shouye::before{content:"" !important;position:fixed !important;left:0 !important;right:0 !important;top:0 !important;height:var(--app-shell-statusbar-top,env(safe-area-inset-top,48px)) !important;background:rgb(var(--shouye-top-bar-rgb,44,128,244)) !important;z-index:998 !important;pointer-events:none !important;}' +
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shouye .search-bar-wrapper,html.app-ios-iphone16promax.app-top-safe-shell body.page-shouye .search-bar-wrapper{padding-top:calc(6px + var(--app-shell-statusbar-top,env(safe-area-inset-top,48px))) !important;background:rgb(var(--shouye-top-bar-rgb,44,128,244)) !important;box-shadow:none !important;}' +
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shouye .search-bar-wrapper.scrolled,html.app-ios-iphone16promax.app-top-safe-shell body.page-shouye .search-bar-wrapper.scrolled{background:rgb(var(--shouye-top-bar-rgb,44,128,244)) !important;}' +
          'html.app-ios-iphone15promax.app-top-safe-shell:has(body.page-shouye),html.app-ios-iphone16promax.app-top-safe-shell:has(body.page-shouye){background:rgb(var(--shouye-top-bar-rgb,44,128,244)) !important;}' +
          'html.app-ios-iphone15promax.app-top-safe-shell body.page-shouye,html.app-ios-iphone16promax.app-top-safe-shell body.page-shouye{background:#f6f7fb !important;}' +
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

  setupMobileStatusBar();
  applyMinePageChrome();
  applyShouyePageChrome();
  applyIPhone16ProPageChrome();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyMinePageChrome);
    document.addEventListener('DOMContentLoaded', applyShouyePageChrome);
    document.addEventListener('DOMContentLoaded', applyIPhone16ProPageChrome);
  }

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
    if (currentPageName() === 'shouye.html') {
      try {
        var guestQuery = new URLSearchParams(window.location.search);
        if (guestQuery.get('guest') === '1' && guestQuery.get('landing_ab') === 'c') {
          return true;
        }
      } catch (e0) {}
    }
    return !!PUBLIC_PAGES[currentPageName()] || isNajiluVerifyView() || isForgotPwdFromLoginPage();
  }

  function isActivationPage() {
    if (currentPageName() !== 'index.html') {
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
        return;
      }
      localStorage.setItem(
        SALES_CHANNEL_KEY,
        JSON.stringify({
          ch: ch,
          at: Date.now(),
          source: 'url'
        })
      );
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
      }
    } catch (e) {}
  }

  function isDistributorApp() {
    try {
      var p = new URLSearchParams(window.location.search);
      if (p.get('distributor_app') === '1' || p.get('distributor') === '1') {
        return true;
      }
      return !!localStorage.getItem(DISTRIBUTOR_APP_KEY);
    } catch (e) {
      return false;
    }
  }

  function isInAppRegisterDisabled() {
    return isCordovaTaxAppShell() && isDistributorApp();
  }

  /** 注册时绑定代理渠道：普通注册仅认当前页 URL 的 ch；安装指南来源可沿用非 IP 归因缓存 */
  function getRegisterSalesChannel(fromInstallGuide) {
    try {
      var p = new URLSearchParams(window.location.search);
      var urlCh = sanitizeSalesChannelId(p.get('ch') || p.get('channel') || '');
      if (urlCh) {
        return urlCh;
      }
      if (!fromInstallGuide) {
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
      if (o.source === 'server_resolve' || o.source === 'install_packages') {
        return '';
      }
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
      if (Date.now() - Number(o.at) > SALES_CHANNEL_TTL_MS) {
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

  function applyXianyuPurchaseVisibility(data) {
    var show =
      data &&
      data.show_xianyu_purchase !== false &&
      data.xianyu_purchase_url &&
      String(data.xianyu_purchase_url).trim();
    ['btnXianyuPurchase', 'btnMineActivateXianyu', 'btnConsultActivateXianyu'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.style.display = show ? '' : 'none';
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
        return r.json();
      })
      .then(function (body) {
        if (body && body.code === 200 && body.data && body.data.sales_ch) {
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
        return r.json();
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
                source: 'install_packages'
              })
            );
          } catch (e) {}
        }
        if (data) {
          writeInstallPackagesCache(data);
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

  function getLandingAbVariant() {
    var assignment = getLandingAbAssignment();
    return assignment ? assignment.variant : '';
  }

  function setLandingAbAssignment(variant, source) {
    var v = String(variant || '').toLowerCase();
    if (v !== 'b' && v !== 'c') return null;
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
      return { 'X-Client-Device': j };
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
  var _apiPerfLastReportAt = 0;
  var _authGetInFlight = new Map();
  var _authGetShortCache = new Map();
  var AUTH_GET_SHORT_CACHE_MS = 8000;
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
    var p = fetch(url, opts).then(function (r) {
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
          clearSession();
          var j = null;
          try {
            j = JSON.parse(text);
          } catch (e) {}
          if (j && j.banned) {
            try {
              alert('账号已被封禁');
            } catch (e2) {}
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
      runTrackWhenIdle(function () {
        if (typeof fireTrack === 'function' && hasUserToken()) {
          fireTrack('track_api_perf', '/event/api_perf', payload);
        } else if (typeof firePublicTrack === 'function') {
          firePublicTrack('track_api_perf', '/event/api_perf', payload);
        }
      });
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

  /** 跳转埋点聚合键：只保留路径 + 白名单 query（如 tab），忽略 id_tr 等同页不同参数，避免管理台按 ID 拆行 */
  var TRACK_JUMP_AGGREGATE_QUERY_ALLOW = /^tab$/i;

  function jumpTrackAggregatePath(normalizedPath) {
    var s = String(normalizedPath || '').trim();
    if (!s || s === '__history_back__') return s;
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
      var urlStr = s;
      if (urlStr.indexOf('://') < 0) {
        urlStr = new URL(urlStr.charAt(0) === '/' ? urlStr : '/' + urlStr.replace(/^\/+/, ''), base).href;
      }
      var u = new URL(urlStr);
      var path = u.pathname || '/';
      var allowed = new URLSearchParams();
      try {
        u.searchParams.forEach(function (v, k) {
          if (TRACK_JUMP_AGGREGATE_QUERY_ALLOW.test(String(k))) {
            allowed.set(String(k).toLowerCase(), String(v == null ? '' : v).trim());
          }
        });
      } catch (e1) {}
      var q = allowed.toString();
      return path + (q ? '?' + q : '');
    } catch (e2) {
      var qi = s.indexOf('?');
      var hi = s.indexOf('#');
      var cut = s.length;
      if (hi >= 0) cut = Math.min(cut, hi);
      if (qi >= 0) cut = Math.min(cut, qi);
      var fallback = s.substring(0, cut);
      if (fallback && fallback.charAt(0) !== '/') fallback = '/' + fallback.replace(/^\/+/, '');
      return fallback || '/';
    }
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

  function firstText(node) {
    if (!node) return '';
    var t = String(node.getAttribute && (node.getAttribute('aria-label') || node.getAttribute('title')) || '').trim();
    if (t) return t.substring(0, 64);
    t = String(node.textContent || '').replace(/\s+/g, ' ').trim();
    return t.substring(0, 64);
  }

  function detectJumpTarget(el) {
    if (!el) return '';
    if (el.tagName && el.tagName.toLowerCase() === 'a') {
      var href = String(el.getAttribute('href') || '').trim();
      if (!href || href.charAt(0) === '#') return '';
      if (/^javascript:\s*history\.back/i.test(href)) return '__history_back__';
      if (/^javascript:/i.test(href)) return '';
      return normalizeTrackPath(href);
    }
    var oc = '';
    try {
      oc = String(el.getAttribute('onclick') || '');
    } catch (e) {}
    var m = oc.match(/(?:location\.href|location\.assign|window\.open)\s*\(?\s*['"]([^'"]+)['"]/i);
    if (m && m[1]) return normalizeTrackPath(m[1]);
    if (/history\.back/i.test(oc)) return '__history_back__';
    return '';
  }

  function autoTrackJumpButtons() {
    if (typeof document === 'undefined') return;
    document.addEventListener(
      'click',
      function (e) {
        var t = e.target;
        if (!t || !t.closest) return;
        var el = t.closest('a,button,[role="button"]');
        if (!el) return;
        if (el.getAttribute && el.getAttribute('data-no-track') === '1') return;
        var target = detectJumpTarget(el);
        if (!target) return;
        var agg = jumpTrackAggregatePath(target);
        var targetKey = sanitizeTrackKey(
          String(agg)
            .replace(/^\/+/, '')
            .replace(/[/.-]+/g, '_') || 'jump'
        );
        fireTrack('track_jump_' + targetKey, '/event/jump/' + targetKey, {
          from: (window.location && window.location.pathname) || '',
          to: target,
          text: firstText(el)
        });
      },
      true
    );
  }

  window.isCordovaTaxAppShell = isCordovaTaxAppShell;
  window.authGetToken = getToken;
  window.authHeaders = authHeaders;
  window.authFetch = authFetch;
  window.authClearSession = clearSession;
  window.reportApiPerf = reportApiPerf;
  window.measureFetchAndRender = measureFetchAndRender;
  window.getClientDeviceHeaders = getClientDeviceHeaders;
  window.buildClientDevicePayload = buildClientDevicePayload;
  window.getOrCreateClientDeviceId = getOrCreateClientDeviceId;
  window.getLandingAbAssignment = getLandingAbAssignment;
  window.getLandingAbVariant = getLandingAbVariant;
  window.setLandingAbAssignment = setLandingAbAssignment;
  window.markInstallGuideReferral = markInstallGuideReferral;
  window.hasInstallGuideReferral = hasInstallGuideReferral;
  window.clearInstallGuideReferral = clearInstallGuideReferral;
  window.consumeInstallGuideReferral = consumeInstallGuideReferral;
  window.getSalesChannel = getSalesChannel;
  window.getRegisterSalesChannel = getRegisterSalesChannel;
  window.getPublicInstallPackagesUrl = getPublicInstallPackagesUrl;
  window.isDistributorApp = isDistributorApp;
  window.isInAppRegisterDisabled = isInAppRegisterDisabled;
  window.applyXianyuPurchaseVisibility = applyXianyuPurchaseVisibility;
  window.persistSalesChannelAttribution = persistSalesChannelAttribution;
  window.resolveSalesChannelFromServer = resolveSalesChannelFromServer;
  window.appendSalesChannelToUrl = appendSalesChannelToUrl;
  window.refreshPublicInstallPackagesUi = refreshPublicInstallPackagesUi;
  window.getCachedPublicInstallPackages = getCachedPublicInstallPackages;
  window.fetchPublicInstallPackages = fetchPublicInstallPackages;
  window.trackUserAction = function (action, meta) {
    fireTrack(action, '/event/' + sanitizeTrackKey(action), meta || {});
  };
  window.trackPublicAction = function (action, meta) {
    firePublicTrack(action, '/event/' + sanitizeTrackKey(action), meta || {});
  };
  autoTrackJumpButtons();

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
    if (isPublicPage()) return;
    if (currentPageName() === 'admin_panel.html') return;
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
    s.src = '/js/conversion-guide.js?v=20260720-guest-funnel';
    s.setAttribute('data-conversion-guide', '1');
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  })();

  (function injectPageLoadingAssets() {
    if (isPublicPage()) {
      return;
    }
    var page = currentPageName();
    if (page === 'admin_panel.html') {
      return;
    }
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
    window.__pageLoadingQueue.push(['show']);
    if (!document.querySelector('script[data-app-page-loading-js]')) {
      var s = document.createElement('script');
      s.src = '/js/page-loading.js?v=20260721-shuiming-spin';
      s.setAttribute('data-app-page-loading-js', '1');
      s.async = false;
      document.head.appendChild(s);
    }
  })();

  (function injectFastNav() {
    if (isPublicPage()) return;
    if (currentPageName() === 'admin_panel.html') return;
    if (document.querySelector('script[data-fast-nav-js]')) return;
    var s = document.createElement('script');
    s.src = '/js/fast-nav.js?v=20260721d-bonus';
    s.setAttribute('data-fast-nav-js', '1');
    s.async = true;
    document.head.appendChild(s);
  })();

  if (!isPublicPage()) {
    if (!getToken()) {
      window.location.replace(LOGIN_PAGE);
      return;
    }
    if (isActivationPage()) {
      if (isAccountActive()) {
        window.location.replace('mine.html');
      }
      return;
    }
    /* 未激活也可浏览业务页，在个人中心（consult）等处激活 */
  } else {
    var page = currentPageName();
    if ((page === 'index.html' || page === 'login.html') && getToken()) {
      if (isAccountActive()) {
        window.location.replace('mine.html');
      } else {
        if (page === 'index.html' && isActivationPage()) {
          return;
        }
        window.location.replace('mine.html');
      }
    }
  }

  (function applyDistributorAppUi() {
    if (!isInAppRegisterDisabled()) {
      return;
    }
    if (currentPageName() === 'register.html') {
      window.location.replace('index.html');
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
          window.location.href = 'register.html?from=install_guide';
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
