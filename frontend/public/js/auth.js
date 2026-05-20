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
  var PUBLIC_PAGES = {
    'index.html': true,
    'register.html': true,
    'login.html': true,
    'install_guide.html': true
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
      /Xiaomi\s*14|23127PN|2201PN|2211133C/i.test(ua) ||
      getAndroidMajorVersion() >= 15
    );
  }

  /** 小米 14 / HyperOS 等：UA 偶无型号时仍按 Android 15+ 顶栏高度处理 */
  function isXiaomi14LikeClient() {
    var ua = navigator.userAgent || '';
    if (/Xiaomi\s*14|23127PN|2201PN|2211133C/i.test(ua)) {
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

  /**
   * Redmi K80 等（25060RK16C，Android 16 Cordova）：收入纳税明细「扣缴义务人」需完整展示。
   * 仅按 UA 型号匹配，不影响其它机型。
   */
  function isAndroid25060RK16CClient() {
    return /25060RK16C/i.test(navigator.userAgent || '');
  }

  /**
   * iPhone 16 Pro（非 Max）：收入纳税明细「扣缴义务人」约 13 个汉字需完整展示。
   * UA 含型号时优先匹配；否则按 screen 逻辑像素 402×874（容差）识别，避免影响其它 iPhone。
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

  function isIPhone16ProLikeClient() {
    if (!isLikelyIOSViewportClient()) {
      return false;
    }
    var ua = navigator.userAgent || '';
    if (/iPhone\s*16\s*Pro\s*Max|iPhone17,2/i.test(ua)) {
      return false;
    }
    if (/iPhone\s*16\s*Pro\b|iPhone17,1\b/i.test(ua)) {
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
      return shortSide >= 399 && shortSide <= 405 && longSide >= 868 && longSide <= 878;
    } catch (e) {
      return false;
    }
  }

  /** 荣耀 ANN-AN00（Android 15 / MagicOS）顶部安全区单独适配 */
  function isHonorAnnAn00Client() {
    return /ANN-AN00/i.test(navigator.userAgent || '');
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

  function setupMobileStatusBar() {
    try {
      var cordovaShell = isCordovaTaxAppShell();
      var iosClient = isLikelyIOSViewportClient();
      var androidClient = isLikelyAndroidViewportClient();
      var annAn00Client = androidClient && isHonorAnnAn00Client();
      var xiaomi14Client = androidClient && isXiaomi14LikeClient();
      var cordovaXiaomi23127 = androidClient && isCordovaXiaomi23127Client();
      var cordovaXiaomi2410 = androidClient && isCordovaXiaomi2410Client();
      var android25060RK16C = androidClient && isAndroid25060RK16CClient();
      var iosIPhone11Pro = iosClient && isIPhone11ProLikeClient();
      var iosIPhone16Pro = iosClient && isIPhone16ProLikeClient();
      var huaweiPura70Client = androidClient && isHuaweiPura70LikeClient();
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
        ? (annAn00Client ? '32px' : (tallAndroidStatusBar ? '56px' : '24px'))
        : cordovaShell
          ? '48px'
          : iosClient
            ? 'env(safe-area-inset-top, 0px)'
            : '';
      if (useTopSafeInset) {
        document.documentElement.classList.add('app-top-safe-shell');
      }
      if (androidClient) {
        document.documentElement.classList.add('app-android-client');
      }
      if (annAn00Client) {
        document.documentElement.classList.add('app-android-ann-an00');
      }
      if (androidClient && isXiaomi14LikeClient()) {
        document.documentElement.classList.add('app-android-xiaomi-14');
      }
      if (cordovaXiaomi23127) {
        document.documentElement.classList.add('app-cordova-xiaomi-23127');
      }
      if (cordovaXiaomi2410) {
        document.documentElement.classList.add('app-cordova-xiaomi-2410');
      }
      if (android25060RK16C) {
        document.documentElement.classList.add('app-android-25060rk16c');
      }
      if (iosIPhone11Pro) {
        document.documentElement.classList.add('app-ios-iphone11pro');
      }
      if (iosIPhone16Pro) {
        document.documentElement.classList.add('app-ios-iphone16pro');
      }
      if (huaweiPura70Client) {
        document.documentElement.classList.add('app-huawei-pura70');
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
          'html.app-top-safe-shell .notice-bar{top:calc(57px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell .search-bar-wrapper{padding-top:calc(8px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell .notice-bar{top:calc(60px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-ann-an00.app-top-safe-shell .search-bar-wrapper{padding-top:calc(2px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-ann-an00.app-top-safe-shell .notice-bar{top:calc(53px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-top-safe-shell .daiban-header{padding-top:var(--app-shell-statusbar-top) !important;background:transparent !important;overflow:visible;}' +
          'html.app-top-safe-shell .daiban-header > img{margin-top:calc(-1 * var(--app-shell-statusbar-top)) !important;}' +
          'html.app-top-safe-shell .bancha-header{padding-top:var(--app-shell-statusbar-top) !important;background:transparent !important;overflow:visible;}' +
          'html.app-top-safe-shell .bancha-header > img{margin-top:calc(-1 * var(--app-shell-statusbar-top)) !important;}' +
          'html.app-top-safe-shell .bancha-page .bancha-content{margin-top:calc(80px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell .bancha-page .bancha-content{margin-top:calc(96px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-top-safe-shell .message-header-builtin{padding-top:calc(14px + var(--app-shell-statusbar-top)) !important;padding-bottom:26px !important;}' +
          'html.app-top-safe-shell .message-page .message-list{margin-top:0 !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell .message-header-builtin{padding-bottom:30px !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell .message-header-title{margin-bottom:18px !important;}' +
          'html.app-top-safe-shell body > .header{padding-top:calc(14px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-top-safe-shell body.page-login .header{padding-top:calc(15px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-client.app-top-safe-shell body > .header{height:auto !important;min-height:calc(48px + var(--app-shell-statusbar-top)) !important;padding-top:calc(14px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-android-client.app-top-safe-shell body.page-login .header{min-height:auto !important;padding-top:calc(15px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-top-safe-shell body.page-xiangqing{padding-top:calc(48px + var(--app-shell-statusbar-top)) !important;}' +
          'html.app-top-safe-shell body.page-mine .header-bg{padding-top:var(--app-shell-statusbar-top,0px) !important;background:linear-gradient(180deg,#5eb3ff 0%,#3d94f7 55%,#2d7ae8 100%) !important;}' +
          'html.app-top-safe-shell body.page-mine .header-bg > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,0px)) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-cordova-xiaomi-23127) body.page-mine .header-bg > img{margin-top:calc(-1 * var(--app-shell-statusbar-top,0px) + 8px) !important;}' +
          'html.app-android-xiaomi-14.app-top-safe-shell:not(.app-cordova-xiaomi-23127) body.page-mine .user-card{margin-top:-62px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell{--app-shell-statusbar-top:0px !important;--app-cordova-statusbar-chrome:40px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .search-bar-wrapper{padding-top:6px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .notice-bar{top:49px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .bancha-header{padding-top:0 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .bancha-header > img{margin-top:0 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .bancha-page .bancha-content{margin-top:80px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .daiban-header{padding-top:0 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .daiban-header > img{margin-top:0 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell .message-header-builtin{padding-top:14px !important;padding-bottom:26px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .header-bg{padding-top:0 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .header-bg > img{margin-top:0 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .content-wrapper{margin-top:-6px !important;padding-top:14px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .user-card{margin:-38px 16px 12px !important;border-radius:12px 12px 0 0 !important;padding:16px 14px 14px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .user-name{margin-bottom:10px !important;line-height:1.35 !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .personal-info-btn{top:16px !important;}' +
          'html.app-cordova-xiaomi-23127.app-top-safe-shell body.page-mine .mine-activate-btn{position:fixed !important;top:calc(10px + var(--app-cordova-statusbar-chrome,40px)) !important;right:18px !important;z-index:500 !important;}' +
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
          'html.app-huawei-pura70 body.page-mine .user-card,html.app-huawei-pura70 body.page-mine .menu-list,html.app-huawei-pura70 body.page-mine .logout-section{margin-left:0 !important;margin-right:0 !important;border-radius:0 !important;}' +
          'html.app-huawei-pura70 body.page-mine .function-cards{margin-left:8px !important;margin-right:8px !important;}' +
          'html.app-huawei-pura70.app-top-safe-shell body.page-mine .header-bg{padding-top:var(--app-shell-statusbar-top,0px) !important;}' +
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

  function isPublicPage() {
    return !!PUBLIC_PAGES[currentPageName()] || isNajiluVerifyView();
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
      localStorage.removeItem('wm_cache');
      localStorage.removeItem('wm_cache_time');
    } catch (e) {}
  }

  function authFetch(url, opts) {
    opts = opts || {};
    opts.headers = Object.assign({}, authHeaders(), opts.headers || {});
    return fetch(url, opts).then(function (r) {
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
    fetch('api/user.php', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(function () {});
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

  window.authGetToken = getToken;
  window.authHeaders = authHeaders;
  window.authFetch = authFetch;
  window.authClearSession = clearSession;
  window.getClientDeviceHeaders = getClientDeviceHeaders;
  window.buildClientDevicePayload = buildClientDevicePayload;
  window.trackUserAction = function (action, meta) {
    fireTrack(action, '/event/' + sanitizeTrackKey(action), meta || {});
  };
  autoTrackJumpButtons();

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
})();
