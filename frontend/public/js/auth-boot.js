/**
 * 首屏同步引导（小文件，建议 <head> 同步引入）：登录态、公开页判断、安全区 class、未登录跳转。
 *
 * 与 auth.js 分工：
 * - 本文件：首屏立刻要用的轻量 API 与跳转，避免 defer 的 auth.js 解析前白屏/闪错。
 * - auth.js（defer）：机型顶栏 / OEM 补丁、authFetch 完整实现、转化脚本注入等大段逻辑。
 *   勿把大段 OEM 样式或重逻辑放进本文件。
 *
 * PUBLIC_PAGES：未登录也可访问的白名单页（首页/我的/登录注册/安装引导/广告落地等）。
 * 另有特例：najilu.html?view=verify、xiugaimima.html?from=login 视为公开。
 *
 * 尽早挂到 window 的 API（业务页内联脚本可能依赖）：
 * authGetToken / authFetch（Bearer 占位）/ currentPageName / isPublicPage /
 * sanitizeLoginNext / getLoginNextTarget / getSalesChannel / appendSalesChannelToUrl /
 * buildLoginPageUrl / markViewportChromeClasses；以及 showPageLoading 队列占位。
 */
(function () {
  if (typeof window === 'undefined') {
    return;
  }
  if (window.__authBootRan) {
    return;
  }
  window.__authBootRan = 1;

  var LOGIN_PAGE = 'login.html';
  var SALES_CHANNEL_KEY = 'sales_channel_v1';
  var SALES_CHANNEL_TTL_MS = 15 * 60 * 1000;

  function isSalesChannelStickyRecordValid(o) {
    if (!o || !o.ch) return false;
    if (o.permanent === true) return true;
    if (Date.now() - Number(o.at) > SALES_CHANNEL_TTL_MS) return false;
    return true;
  }

  // === PUBLIC_PAGES / 页面判断 ===
  /** 未登录可访问的白名单；受保护页无 token 时跳登录 */
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

  /** @returns {string} 当前 HTML 文件名，缺省为 index.html */
  function currentPageName() {
    var p = window.location.pathname || '';
    var i = p.lastIndexOf('/');
    var name = (i >= 0 ? p.slice(i + 1) : p) || '';
    if (!name) {
      return 'index.html';
    }
    return name;
  }

  function isRedmiK70StandardModelBlob(ua) {
    ua = String(ua || '');
    if (
      /2407FPN8E[GR]|2407FRK8EC|XIG06|A402XM|(?:Redmi|Xiaomi|REDMI)[\s_-]*K70[\s_-]*(?:至尊|Ultra)/i.test(
        ua
      )
    ) {
      return false;
    }
    if (/24117RK2C|24122RKC7|24127RK2CC|25060RK16C|(?:Redmi|Xiaomi|REDMI)[\s_-]*K80/i.test(ua)) {
      return false;
    }
    if (/23113RKC6[CG]|2311DRK48[CGI]/i.test(ua)) {
      return true;
    }
    return /(?:Redmi|Xiaomi|REDMI)[\s_-]*K70(?![\s_-]*(?:至尊|Ultra|Pro))/i.test(ua);
  }

  function readMineStatusUaBlob() {
    var blob = '';
    try {
      blob += String(navigator.userAgent || '');
    } catch (eUa) {}
    try {
      blob += ' ' + String(localStorage.getItem('tax_device_model_v1') || '');
    } catch (eModel) {}
    try {
      blob += ' ' + String(localStorage.getItem('tax_device_ua_v1') || '');
    } catch (eStored) {}
    return blob;
  }

  function isMineUnderlapPreviewBlob(ua) {
    ua = String(ua || '');
    var liveUa = '';
    try {
      liveUa = String(navigator.userAgent || '');
    } catch (eLive) {}
    if (/iPhone|iPad|iPod/.test(ua + liveUa)) {
      return false;
    }
    if (
      /2407FPN8E[GR]|2407FRK8EC|XIG06|A402XM|(?:Redmi|Xiaomi|REDMI)[\s_-]*K70[\s_-]*(?:至尊|Ultra)/i.test(
        ua
      )
    ) {
      return false;
    }
    try {
      var q = new URLSearchParams(String(location.search || ''));
      if (/^(1|true|yes|k70)$/i.test(String(q.get('k70') || q.get('k70_mine') || ''))) {
        return true;
      }
      var forced = String(q.get('device') || q.get('model') || '');
      if (/23113RKC6[CG]|2311DRK48[CGI]/i.test(forced)) {
        return true;
      }
    } catch (eQ) {}
    if (/Xiaomi|Redmi|Huawei|HONOR|OPPO|vivo|OnePlus|iQOO|Samsung|HarmonyOS|Miui|HyperOS/i.test(liveUa)) {
      return false;
    }
    if (/sdk_gphone|Android SDK|goldfish|ranchu|\bEmulator\b/i.test(ua + ' ' + liveUa)) {
      return true;
    }
    var narrow = false;
    try {
      narrow = Math.min(window.innerWidth || 0, screen.width || 0) <= 500;
    } catch (eW) {
      narrow = false;
    }
    if (!narrow) {
      return false;
    }
    if (/Windows|Macintosh|X11/i.test(liveUa)) {
      return true;
    }
    try {
      if (navigator.webdriver) {
        return false;
      }
    } catch (eWd) {}
    try {
      var plat = String(navigator.platform || '');
      var hint = '';
      try {
        hint = String((navigator.userAgentData && navigator.userAgentData.platform) || '');
      } catch (eHint) {}
      if (/Win32|Win64|Windows|MacIntel|Macintosh/i.test(plat + ' ' + hint)) {
        return true;
      }
    } catch (ePlat) {}
    return false;
  }

  /** 「我的」顶栏档。K70 标准版，或桌面窄屏 / AVD 预览。 */
  function resolveMineStatusMode() {
    if (currentPageName() !== 'mine.html') {
      return '';
    }
    try {
      if (document.body && !document.body.classList.contains('page-mine')) {
        return '';
      }
    } catch (eBody) {}
    var ua = readMineStatusUaBlob();
    if (
      isRedmiK70StandardModelBlob(ua) ||
      /V2203A|V2203T|PD2203\b|(?:vivo[\s_-]*)?S15\b(?![\s_-]*(?:Pro|e))/i.test(ua) ||
      isMineUnderlapPreviewBlob(ua)
    ) {
      return 'underlap-black';
    }
    return '';
  }

  function getToken() {
    try {
      return localStorage.getItem('token') || '';
    } catch (e) {
      return '';
    }
  }

  /** 纳税记录「核验」视图：公开可访问，不走登录门禁 */
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

  /** 登录页「忘记密码」链路：xiugaimima.html?from=login 视为公开 */
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
    return !!PUBLIC_PAGES[currentPageName()] || isNajiluVerifyView() || isForgotPwdFromLoginPage();
  }

  /** login/index 带 need_activate=1：激活引导页，已开通则应离开 */
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

  /**
   * 清洗登录后回跳目标：仅允许同目录下 *.html（可带 query），拒绝绝对 URL / purchase.html。
   * @param {*} raw
   * @returns {string}
   */
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

  // === 销售渠道捕获 ===
  /**
   * 校验渠道 id：小写字母数字下划线横线，最长 64。
   * @param {*} raw
   * @returns {string}
   */
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
   * 读取 localStorage sales_channel_v1（{ch, at}），超时则清除。
   * 实际写入多在 auth.js；此处只读并透传到登录/跳转 URL。
   * @returns {string}
   */
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

  /**
   * 已登录账号绑定的 URL-only 渠道（abc）：读 localStorage.sales_promo_channel。
   * sticky sales_channel_v1 仍不存 abc；仅用于跳转补 ?ch=。
   */
  function getAccountBoundUrlOnlySalesChannel() {
    try {
      if (!getToken()) return '';
      var k = sanitizeSalesChannelId(localStorage.getItem('sales_promo_channel') || '');
      if (!k || k !== 'abc') return '';
      return k;
    } catch (eAcc) {
      return '';
    }
  }

  /** 若 URL 尚无 ch/channel，则追加当前销售渠道 */
  function appendSalesChannelToUrl(url) {
    var ch = getSalesChannel() || getAccountBoundUrlOnlySalesChannel();
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

  /**
   * 组装登录页 URL：next + extras + 销售渠道。
   * @param {string} [nextPage]
   * @param {Object} [extras]
   * @returns {string}
   */
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

  /** iframe 内跳转开通/登录等页时提到顶层，避免 iOS WKWebView 子框请求挂起 */
  function assignTopLocation(url) {
    var dest = String(url || '');
    if (!dest) return;
    try {
      dest = appendSalesChannelToUrl(dest);
    } catch (eAppend) {}
    try {
      if (window.top && window.top !== window) {
        window.top.location.assign(dest);
        return;
      }
    } catch (e0) {}
    try {
      window.location.assign(dest);
    } catch (e1) {
      window.location.href = dest;
    }
  }

  /** 轻量 Bearer fetch 占位；auth.js 加载后会覆盖为完整 authFetch */
  function bearerTokenFetch(url, opts) {
    opts = opts || {};
    var isFd = false;
    try {
      isFd = typeof FormData !== 'undefined' && !!opts.body && opts.body instanceof FormData;
    } catch (eFd) {}
    var headers = Object.assign(isFd ? {} : { 'Content-Type': 'application/json' }, opts.headers || {});
    if (isFd) {
      delete headers['Content-Type'];
      delete headers['content-type'];
    }
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

  // === 安全区 / 机型 chrome class ===
  /**
   * 根据 UA + 本地机型缓存给 html 打 app-ios-client / app-android-client / app-top-safe-shell。
   * 细机型补丁仍在 auth.js。
   */
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

  /**
   * 安卓 WebView 的 100vw 常宽于画布。只裁横向溢出，避免底栏各页和明细页横滑卡顿。
   * 不作用于 iOS：部分机型 overflow-x:hidden 会把 position:fixed 底栏抬高。
   */
  function clipAndroidHorizontalOverflow() {
    try {
      if (!document.documentElement.classList.contains('app-android-client')) return;
      if (document.getElementById('androidPageOverflowClip')) return;
      var st = document.createElement('style');
      st.id = 'androidPageOverflowClip';
      st.textContent =
        'html.app-android-client,html.app-android-client body{overflow-x:hidden;max-width:100%;}';
      (document.head || document.documentElement).appendChild(st);
    } catch (eClip) {}
  }

  /** Android「我的」：不依赖机型 UA，首屏即走 750px @sm 底图（HyperOS WebView 大图合成极慢） */
  function primeAndroidMineE1SmFirstPaint() {
    try {
      if (currentPageName() !== 'mine.html') {
        return;
      }
      var ua = '';
      try {
        ua = String(navigator.userAgent || '');
      } catch (eUa) {}
      try {
        ua += ' ' + String(localStorage.getItem('tax_device_model_v1') || '');
      } catch (eModel) {}
      if (!/Android|HarmonyOS|OpenHarmony|ArkWeb|HMSCore|HUAWEI|Huawei/i.test(ua)) {
        return;
      }
      /*
       * 单层底图档（vivo X90 / iQOO Z9 Turbo+）：@sm 档两层同图会留半透明白卡残影，须在注入裁切首屏样式
       * 「之前」判掉，否则该 style 节点留在 DOM 里抢。样式见 mine.html plainimg 档。
       */
      var cl = document.documentElement.classList;
      if (
        window.__mineE1PlainImg ||
        cl.contains('app-android-mine-e1-plainimg') ||
        /V2241A|V2241EA|PD2241\b|(?:vivo[\s_-]*)?X90\b(?![\s_-]*(?:Pro|[sS]|Plus|\+))/i.test(ua) ||
        /V2417A|V2417DA|PD2417\b|(?:iQOO|iqoo)?[\s_-]*Z9[\s_-]*Turbo[\s_-]*(?:\+|Plus)/i.test(ua)
      ) {
        cl.add('app-android-mine-e1-plainimg');
        cl.remove('app-android-mine-e1-sm');
        window.__mineE1PlainImg = true;
        window.__mineE1ForceSm = true;
        return;
      }
      var p40pro = /ELS-AN00|ELS-AN10|ELS-N04|ELS-AN\d{2}|P40[\s_-]*Pro/i.test(ua);
      if (p40pro) {
        document.documentElement.classList.add('app-android-huawei-p40pro');
        document.documentElement.classList.remove('app-huawei-mine-noclip');
      }
      /* Reno10 + A93s（PFGM00）：ColorOS 100vw @sm 裁切会错位，须 early return 勿打 sm */
      var reno10 = /PHW110|CPH2531|CPH2525|PFGM00|A93s/i.test(ua) || (/(?:OPPO\s*)?Reno\s*10\s*5G/i.test(ua) && !/Reno\s*10\s*Pro/i.test(ua));
      if (reno10) {
        document.documentElement.classList.add('app-android-oppo-reno10');
        document.documentElement.classList.add('app-android-immersive-white-top');
        document.documentElement.classList.remove('app-android-mine-e1-sm');
        if (!document.getElementById('reno10MineFirstPaint')) {
          var renoSt = document.createElement('style');
          renoSt.id = 'reno10MineFirstPaint';
          renoSt.setAttribute('data-reno10-mine-e1-firstpaint', '1');
          renoSt.textContent =
            'html.app-android-oppo-reno10 body.page-mine{--mine-top-bleed:0px!important;}' +
            'html.app-android-oppo-reno10 body.page-mine .mine-e1-canvas{padding-top:0!important;margin-top:0!important;overflow:hidden!important;width:100%!important;height:auto!important;max-height:none!important;aspect-ratio:auto!important;container-type:normal!important;background-image:none!important;background-color:#f5f6fa!important;}' +
            'html.app-android-oppo-reno10 body.page-mine .mine-e1-canvas>img,html.app-android-oppo-reno10 body.page-mine .mine-e1-canvas>#headerImg{margin-top:0!important;display:block!important;position:relative!important;width:100%!important;height:auto!important;max-height:none!important;aspect-ratio:1284/2127!important;object-fit:fill!important;opacity:1!important;}' +
            'html.app-android-oppo-reno10 body.page-mine .mine-e1-layer{top:0!important;height:0!important;padding-bottom:calc(2127 / 1284 * 100%)!important;}';
          document.head.appendChild(renoSt);
        }
        return;
      }
      var acepro = /PGP110|CPH2413|CPH2415|CPH2417|(?:OnePlus|一加)[\s_-]*Ace[\s_-]*Pro(?![\s_-]*2)/i.test(ua);
      if (acepro) {
        document.documentElement.classList.add('app-android-oneplus-acepro');
        document.documentElement.classList.add('app-android-immersive-white-top');
        document.documentElement.classList.remove('app-android-mine-e1-sm');
        if (!document.getElementById('aceproMineFirstPaint')) {
          var aceSt = document.createElement('style');
          aceSt.id = 'aceproMineFirstPaint';
          aceSt.setAttribute('data-acepro-mine-e1-firstpaint', '1');
          aceSt.textContent =
            'html.app-android-oneplus-acepro body.page-mine{--mine-top-bleed:0px!important;}' +
            'html.app-android-oneplus-acepro body.page-mine .mine-e1-canvas{padding-top:0!important;margin-top:0!important;overflow:hidden!important;width:100%!important;height:auto!important;max-height:none!important;aspect-ratio:auto!important;container-type:normal!important;background-image:none!important;background-color:#f5f6fa!important;}' +
            'html.app-android-oneplus-acepro body.page-mine .mine-e1-canvas>img,html.app-android-oneplus-acepro body.page-mine .mine-e1-canvas>#headerImg{margin-top:0!important;display:block!important;position:relative!important;width:100%!important;height:auto!important;max-height:none!important;aspect-ratio:1284/2127!important;object-fit:fill!important;opacity:1!important;}' +
            'html.app-android-oneplus-acepro body.page-mine .mine-e1-layer{top:0!important;height:0!important;padding-bottom:calc(2127 / 1284 * 100%)!important;}';
          document.head.appendChild(aceSt);
        }
        return;
      }
      /*
       * Hi nova 9 SE：勿走 @sm 1180 裁切；顶栏跟随 9/1 安卓逻辑（不再页内黑条）。
       */
      var hinova9se = /FIO-BD00|PHB-AN00|Hi\s*nova[\s_-]*9[\s_-]*SE|hinova[\s_-]*9[\s_-]*se/i.test(ua);
      if (hinova9se) {
        cl.add('app-android-client');
        cl.add('app-top-safe-shell');
        cl.add('app-android-hinova');
        cl.add('app-android-hinova9se');
        cl.remove('app-android-mine-e1-sm');
        cl.remove('app-huawei-mine-noclip');
        document.documentElement.style.setProperty('--mine-top-bleed', '0px', 'important');
        if (!document.getElementById('hinova9seMineFirstPaint')) {
          var hnSt = document.createElement('style');
          hnSt.id = 'hinova9seMineFirstPaint';
          hnSt.setAttribute('data-hinova9se-mine-e1-firstpaint', '1');
          hnSt.textContent =
            'html.app-android-hinova9se body.page-mine{--mine-top-bleed:0px!important;}' +
            'html.app-android-hinova9se body.page-mine .mine-e1-canvas,html.app-android-hinova9se.app-android-mine-e1-sm body.page-mine .mine-e1-canvas{padding-top:0!important;margin-top:0!important;overflow:hidden!important;width:100%!important;height:auto!important;max-height:none!important;aspect-ratio:auto!important;container-type:normal!important;background-image:none!important;background-color:#f5f6fa!important;}' +
            'html.app-android-hinova9se body.page-mine .mine-e1-canvas>img,html.app-android-hinova9se body.page-mine .mine-e1-canvas>#headerImg,html.app-android-hinova9se.app-android-mine-e1-sm body.page-mine .mine-e1-canvas>img{margin-top:0!important;display:block!important;position:relative!important;width:100%!important;height:auto!important;max-height:none!important;aspect-ratio:1284/2127!important;object-fit:fill!important;opacity:1!important;top:auto!important;transform:none!important;}' +
            'html.app-android-hinova9se body.page-mine .mine-e1-layer,html.app-android-hinova9se.app-android-mine-e1-sm body.page-mine .mine-e1-layer{top:0!important;height:0!important;padding-bottom:calc(2127 / 1284 * 100%)!important;}' +
            'html.app-android-hinova9se body.page-mine .mine-e1-pill{display:inline-flex!important;align-items:center!important;justify-content:center!important;line-height:1!important;}';
          document.head.appendChild(hnSt);
        }
        return;
      }
      /*
       * 红米 K70 标准版「我的」：underlap 黑垫，勿进 @sm 裁切。
       * HyperOS lock 会把画布 padding 清零、把头图蓝铺进系统栏。
       */
      if (cl.contains('app-mine-black-status') || resolveMineStatusMode() === 'underlap-black') {
        if (isRedmiK70StandardModelBlob(ua)) cl.add('app-android-redmi-k70');
        cl.add('app-mine-black-status');
        cl.remove('app-android-mine-e1-sm');
        return;
      }
      window.__mineE1ForceSm = true;
      document.documentElement.classList.add('app-android-mine-e1-sm');
      if (document.getElementById('androidMineSmFirstPaint')) {
        return;
      }
      var st = document.createElement('style');
      st.id = 'androidMineSmFirstPaint';
      st.setAttribute('data-android-mine-e1-sm-firstpaint', '1');
      st.textContent =
        'html.app-android-mine-e1-sm body.page-mine{--mine-top-bleed:0px!important;--mine-rpx:calc(100vw / 750)!important;background-color:#f5f6fa!important;background-image:none!important;}' +
        'html.app-android-mine-e1-sm:not(.app-android-xiaomi-14pro):not(.app-android-xiaomi-15):not(.app-android-xiaomi-15pro):not(.app-android-huawei-mate60):not(.app-android-huawei-p40pro):not(.app-android-oneplus-acepro):not(.app-android-hinova9se):not(.app-mine-black-status):not(.app-android-redmi-k70):not(.app-android-xiaomi-13ultra):not(.app-android-oppo-reno10) body.page-mine .mine-e1-canvas{padding-top:0!important;margin-top:0!important;overflow:hidden!important;background-color:#f5f6fa!important;background-image:url(/img/mine/e1_01@sm.png?v=20260901-android-mine-sm)!important;background-size:100% auto!important;background-position:top center!important;height:calc(1180 * 100vw / 750)!important;max-height:calc(1180 * 100vw / 750)!important;aspect-ratio:unset!important;container-type:normal!important;width:100%!important;}' +
        'html.app-android-huawei-p40pro.app-android-mine-e1-sm body.page-mine .mine-e1-canvas{padding-top:0!important;margin-top:0!important;overflow:hidden!important;background-color:#f5f6fa!important;background-image:url(/img/mine/e1_01@sm.png?v=20260901-android-mine-sm)!important;background-size:100% 100%!important;background-position:top center!important;height:auto!important;max-height:none!important;aspect-ratio:750/1180!important;container-type:normal!important;width:100%!important;}' +
        'html.app-android-mine-e1-sm body.page-mine .mine-e1-canvas>img,html.app-android-mine-e1-sm body.page-mine .mine-e1-canvas>#headerImg{margin-top:0!important;display:block!important;width:1px!important;height:1px!important;max-height:none!important;object-fit:fill!important;position:absolute!important;top:auto!important;transform:none!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;}' +
        'html.app-android-mine-e1-sm:not(.app-android-xiaomi-14pro):not(.app-android-xiaomi-15):not(.app-android-xiaomi-15pro):not(.app-android-huawei-mate60):not(.app-android-huawei-p40pro):not(.app-android-oneplus-acepro):not(.app-android-hinova9se):not(.app-mine-black-status):not(.app-android-redmi-k70):not(.app-android-xiaomi-13ultra):not(.app-android-oppo-reno10) body.page-mine .mine-e1-layer{top:0!important;padding-bottom:calc(1180 / 750 * 100%)!important;}' +
        'html.app-android-huawei-p40pro.app-android-mine-e1-sm body.page-mine .mine-e1-layer{top:0!important;padding-bottom:calc(1180 / 750 * 100%)!important;}' +
        'html.app-android-mine-e1-sm:not(.app-android-xiaomi-14pro):not(.app-android-xiaomi-15):not(.app-android-xiaomi-15pro):not(.app-android-huawei-mate60):not(.app-android-huawei-p40pro):not(.app-android-oneplus-acepro):not(.app-android-hinova9se):not(.app-mine-black-status):not(.app-android-redmi-k70):not(.app-android-xiaomi-13ultra):not(.app-android-oppo-reno10) body.page-mine .mine-e1-footer{padding-bottom:calc(var(--bottom-nav-height,54px) + var(--bottom-nav-bottom,8px) + 12px)!important;}';
      document.head.appendChild(st);
      if (/2304FPN6|(?:Xiaomi|Mi|小米)[\s_-]*13[\s_-]*Ultra/i.test(ua)) {
        cl.add('app-android-xiaomi-13ultra');
        cl.add('app-android-immersive-white-top');
        if (!document.getElementById('xiaomi13ultraMineFirstPaint')) {
          var u13 = document.createElement('style');
          u13.id = 'xiaomi13ultraMineFirstPaint';
          u13.setAttribute('data-xiaomi13ultra-mine-e1-firstpaint', '1');
          u13.textContent =
            'html.app-android-xiaomi-13ultra body.page-mine{--mine-top-bleed:0px!important;}' +
            'html.app-android-xiaomi-13ultra body.page-mine .mine-e1-canvas,html.app-android-xiaomi-13ultra.app-android-mine-e1-sm body.page-mine .mine-e1-canvas,html.app-android-xiaomi-13ultra.app-android-client.app-top-safe-shell.app-android-immersive-white-top body.page-mine .mine-e1-canvas{padding-top:0!important;margin-top:0!important;width:100%!important;height:auto!important;max-height:none!important;aspect-ratio:750/1180!important;overflow:hidden!important;background-color:#f5f6fa!important;background-image:url(/img/mine/e1_01@sm.png?v=20260901-android-mine-sm)!important;background-size:100% auto!important;background-position:top center!important;background-repeat:no-repeat!important;container-type:normal!important;}' +
            'html.app-android-xiaomi-13ultra body.page-mine .mine-e1-canvas>img,html.app-android-xiaomi-13ultra body.page-mine .mine-e1-canvas>#headerImg{position:absolute!important;width:1px!important;height:1px!important;margin:0!important;opacity:0!important;pointer-events:none!important;overflow:hidden!important;}' +
            'html.app-android-xiaomi-13ultra body.page-mine .mine-e1-layer,html.app-android-xiaomi-13ultra.app-android-client.app-cordova-shell body.page-mine .mine-e1-layer{top:0!important;padding-bottom:calc(1180 / 750 * 100%)!important;}';
          document.head.appendChild(u13);
        }
      }
    } catch (ePrime) {}
  }

  // === window 早期 API 导出 ===
  try {
    if (typeof window.authFetch !== 'function') {
      window.authFetch = bearerTokenFetch;
    }
  } catch (eAuthStub) {}

  window.authGetToken = getToken;
  if (typeof window.assignTopLocation !== 'function') {
    window.assignTopLocation = assignTopLocation;
  }
  window.currentPageName = currentPageName;
  window.isPublicPage = isPublicPage;
  window.sanitizeLoginNext = sanitizeLoginNext;
  window.getLoginNextTarget = getLoginNextTarget;
  window.getSalesChannel = getSalesChannel;
  window.appendSalesChannelToUrl = appendSalesChannelToUrl;
  window.buildLoginPageUrl = buildLoginPageUrl;
  window.markViewportChromeClasses = markViewportChromeClasses;
  window.resolveMineStatusMode = resolveMineStatusMode;

  /** page-loading.js 未到之前：先入队，避免业务页调用报错 */
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

  /** tab-shell iframe：尽早隐藏子页底栏，避免与宿主双底栏闪现 */
  (function tabEmbedEarlyChrome() {
    function parentIsTabShellHost() {
      try {
        if (!window.parent || window.parent === window) return false;
        var pdoc = window.parent.document;
        return !!(pdoc && pdoc.documentElement.getAttribute('data-tab-shell') === '1');
      } catch (e0) {
        return false;
      }
    }
    var embed = false;
    try {
      if (new URLSearchParams(window.location.search).get('tab_embed') === '1') embed = true;
    } catch (e1) {}
    try {
      var fe = window.frameElement;
      if (fe && fe.classList && fe.classList.contains('tab-shell-iframe')) embed = true;
    } catch (e2) {}
    if (!embed && parentIsTabShellHost()) embed = true;
    if (!embed) return;
    document.documentElement.classList.add('tab-embed-mode');
    var st = document.createElement('style');
    st.setAttribute('data-tab-embed-boot', '1');
    /* 盖过各页 html body.page-* > .bottom-nav 的高优先级锁，避免 iframe 子页再冒出一条底栏 */
    st.textContent =
      'html.tab-embed-mode .bottom-nav,' +
      'html.tab-embed-mode body > .bottom-nav,' +
      'html.tab-embed-mode body.page-shouye > .bottom-nav,' +
      'html.tab-embed-mode body.page-daiban > .bottom-nav,' +
      'html.tab-embed-mode body.page-bancha > .bottom-nav,' +
      'html.tab-embed-mode body.page-message > .bottom-nav,' +
      'html.tab-embed-mode body.page-mine > .bottom-nav,' +
      'html.tab-embed-mode body .bottom-nav.ios-device,' +
      'html.app-ios-client.tab-embed-mode .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode .bottom-nav,' +
      'html.app-ios-iphone16promax.tab-embed-mode .bottom-nav,' +
      'html.app-ios-client.tab-embed-mode body > .bottom-nav,' +
      'html.app-ios-client.tab-embed-mode body.page-daiban > .bottom-nav,' +
      'html.app-ios-client.tab-embed-mode body.page-bancha > .bottom-nav,' +
      'html.app-ios-client.tab-embed-mode body.page-message > .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-daiban > .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-bancha > .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-message > .bottom-nav,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-daiban > .bottom-nav.ios-device,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-bancha > .bottom-nav.ios-device,' +
      'html.app-ios-iphone16pro.tab-embed-mode body.page-message > .bottom-nav.ios-device{' +
      'display:none!important;visibility:hidden!important;pointer-events:none!important;' +
      'height:0!important;min-height:0!important;max-height:0!important;overflow:hidden!important;' +
      'opacity:0!important;z-index:-1!important;}' +
      'html.tab-embed-mode body.has-bottom-nav,' +
      'html.tab-embed-mode body.page-daiban,' +
      'html.tab-embed-mode body.page-bancha,' +
      'html.tab-embed-mode body.page-message,' +
      'html.tab-embed-mode body.page-shouye,' +
      'html.tab-embed-mode body.page-mine{' +
      '--bottom-nav-clearance:0px!important;padding-bottom:0!important;}';
    (document.head || document.documentElement).appendChild(st);
    function stripEmbedBottomNav() {
      try {
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
          } catch (eInline) {}
          if (el.parentNode) el.parentNode.removeChild(el);
        }
      } catch (e3) {}
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', stripEmbedBottomNav);
    } else {
      stripEmbedBottomNav();
    }
    /* iOS 16 Pro：auth.js 机型锁可能晚于首次 strip 再钉底栏，拉长复检 + MutationObserver */
    var n = 0;
    var timer = setInterval(function () {
      stripEmbedBottomNav();
      n += 1;
      if (n >= 40) clearInterval(timer);
    }, 250);
    try {
      var mo = new MutationObserver(function () {
        stripEmbedBottomNav();
      });
      var startMo = function () {
        if (!document.body) return;
        mo.observe(document.body, { childList: true, subtree: true });
        stripEmbedBottomNav();
      };
      if (document.body) startMo();
      else document.addEventListener('DOMContentLoaded', startMo);
      setTimeout(function () {
        try {
          mo.disconnect();
        } catch (eMo) {}
      }, 15000);
    } catch (eObs) {}
  })();

  /**
   * App 内 Android 白顶栏：首屏默认 40px，避免 defer 的 auth.js 解析前标题压进系统时间。
   * 已核实外置黑条（A58 / Find X9 / 荣耀折叠 / 三星 / Pura70 / 小米 14）不打沉浸 class。
   */
  function applyAndroidWhitePageInsetFirstPaint() {
    try {
      var page = currentPageName();
      if (page !== 'shuiming.html' && page !== 'shuiming_result.html' && page !== 'xiangqing.html') {
        return;
      }
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
      if (!/Android|HarmonyOS|OpenHarmony|ArkWeb|HMSCore|HUAWEI|Huawei/i.test(ua)) {
        return;
      }
      var inApp = /TaxPlatformCordovaApp\//i.test(ua);
      try {
        inApp = inApp || window.top !== window.self;
      } catch (eFrame) {
        inApp = true;
      }
      try {
        inApp =
          inApp ||
          !!(localStorage.getItem('tax_platform_in_app_v1') || sessionStorage.getItem('tax_platform_in_app_v1'));
      } catch (eFlag) {}
      if (!inApp) {
        return;
      }
      if (
        /PHJ110|OPPO\s*A58|Find\s*X\s*9|CPH2797|CPH2791|CPH2841|CPH2873|PLJ110|PLG110|PMA110|PME110|OPG07/i.test(ua) ||
        /FLC-AN00|FLC-AN10|FCP-AN00|FCP-AN10|Magic\s*Vs3|MagicVS3/i.test(ua) ||
        /Samsung|SM-[A-Z]\d{3}|Galaxy/i.test(ua) ||
        /HBN-AL00|HBN-AL80|HBN-AL10|Pura\s*70|Pura70|ADY-AL00|ADY-AL80/i.test(ua) ||
        /23127PN0CC|23127PN0CG|23127PN\b/i.test(ua)
      ) {
        return;
      }
      if (root.classList.contains('app-android-xiaomi-14')) {
        return;
      }
      if (root.classList.contains('app-android-redmi-note11-5g')) {
        return;
      }
      root.classList.add('app-android-client');
      root.classList.add('app-top-safe-shell');
      root.classList.add('app-android-immersive-white-top');
      try {
        root.classList.remove('app-android-white-page-outer');
      } catch (eOuter) {}
      var cur = '';
      try {
        cur = root.style.getPropertyValue('--app-shell-statusbar-top') || '';
      } catch (eCur) {}
      if (cur !== '70px' && cur !== '48px' && cur !== '52px') {
        root.style.setProperty('--app-shell-statusbar-top', '40px');
        root.style.setProperty('--android-status-inset', '40px');
        root.style.setProperty('--safe-top', '40px');
      }
    } catch (ePaint) {}
  }

  markViewportChromeClasses();
  clipAndroidHorizontalOverflow();
  applyAndroidWhitePageInsetFirstPaint();
  primeAndroidMineE1SmFirstPaint();

  // === 登录门禁跳转 ===
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

  /* 全站同步挂载剪贴板助手（一键复制微信号等）；须在解析期 document.write */
  try {
    if (typeof document !== 'undefined' && typeof document.write === 'function') {
      document.write(
        '<script src="/js/clipboard-copy.js?v=20260905-wxcopy2"><\/script>'
      );
    }
  } catch (eClipBoot) {}
})();
