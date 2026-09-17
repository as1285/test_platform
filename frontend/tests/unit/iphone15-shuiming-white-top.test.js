import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const shuiming = readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8');

describe('iPhone 15 收入纳税明细实底白顶栏', () => {
  it('识别 15 / iPhone15,4，并用 393×852 兜底', () => {
    expect(auth).toContain('function isIPhone15LikeClient');
    expect(auth).toContain('iPhone15,4');
    expect(auth).toContain('return isIPhone393x852Viewport()');
    expect(auth).toContain('classList.add(\'app-ios-iphone15\')');
  });

  it('白顶页 59px 灵动岛兜底含 iPhone 15', () => {
    expect(auth).toContain('isIPhone15LikeClient() ||');
    expect(auth).toContain(
      'html.app-ios-iphone15.app-top-safe-shell,html.app-ios-liquid-glass.app-top-safe-shell{--app-shell-statusbar-top:max(59px,env(safe-area-inset-top,59px)) !important;'
    );
  });

  it('通用规则不再关掉 15 的状态栏白底盾牌', () => {
    expect(auth).toContain(':not(.app-ios-iphone15promax):not(.app-ios-iphone15):not(.app-ios-iphone14)');
    expect(auth).toMatch(
      /html\.app-ios-iphone15\.app-top-safe-shell body\.page-shuiming-result::before,html\.app-ios-liquid-glass body\.page-shuiming-result::before\{[^}]*background:#fff/
    );
    expect(auth).toMatch(
      /html\.app-ios-iphone15\.app-top-safe-shell body\.page-shuiming-result \.top-fixed \.header\{[^}]*backdrop-filter:none/
    );
  });

  it('白顶页 env=0 时不再清掉 59px', () => {
    expect(auth).toContain('描述文件 WebClip：env≈0 表示系统已经占了状态栏');
    expect(auth).toContain('app-ios-status-outer');
    expect(auth).toContain(
      'html.platform-ios.app-top-safe-shell:not(.app-ios-status-outer) body.page-shuiming > .header'
    );
  });

  it('根上铺实底白，不依赖 15 class（毛玻璃采样 html/盾牌）', () => {
    expect(auth).toContain('iOS 白顶页根上铺实底白');
    expect(auth).toContain('data-ios-white-status-root');
    expect(auth).toContain(
      'html.platform-ios body.page-shuiming-result .shuiming-chrome-shield'
    );
    expect(shuimingResult).toContain('data-ios-white-status-firstpaint');
    expect(shuimingResult).toContain('name="theme-color" content="#ffffff"');
    expect(shuimingResult).toContain('linear-gradient(#fff, #fff)');
    expect(shuimingResult).toContain(
      'html.platform-ios body.page-shuiming-result .shuiming-chrome-shield'
    );
    expect(shuiming).toContain('data-ios-white-status-firstpaint');
    expect(auth).toContain(
      'html.app-ios-iphone15.app-top-safe-shell:has(body.page-shuiming-result)'
    );
    expect(auth).toContain('background-size:100% 200px');
    expect(auth).toContain("setProperty('background-color', '#fff', 'important')");
  });

  it('结果页首屏打标并铺实底白，避免毛玻璃透出列表', () => {
    expect(shuimingResult).toContain('data-iphone15-result-firstpaint');
    expect(shuimingResult).toContain("classList.add('app-ios-iphone15')");
    expect(shuimingResult).toContain('auth.js?v=20260917-iphone12-first');
    expect(shuimingResult).toContain(
      'html.app-ios-iphone15.app-top-safe-shell:not(.app-ios-status-outer) body.page-shuiming-result .top-fixed .header'
    );
    expect(shuimingResult).toMatch(
      /html\.app-ios-iphone15\.app-top-safe-shell:not\(\.app-ios-status-outer\) body\.page-shuiming-result \.top-fixed \.header \{[\s\S]*?background:\s*#fff/
    );
    expect(shuimingResult).toContain('html.app-ios-status-outer body.page-shuiming-result::before');
    expect(shuimingResult).toContain('content: none !important');
    expect(shuimingResult).toContain('.top-fixed .header::before');
    expect(shuimingResult).toContain('visibility: visible !important');
    expect(auth).toContain('nudgeIosLiquidGlassSample');
    expect(auth).toContain('content:none !important');
    expect(auth).toContain('visibility:visible !important');
    expect(auth).toContain('.top-fixed .header::before');
  });

  it('外置状态栏时返回钮不被白垫盖住', () => {
    expect(auth).toContain(
      'html.app-ios-status-outer.app-ios-iphone15.app-top-safe-shell.app-ios-client body.page-shuiming-result .top-fixed .header .back-btn'
    );
    expect(auth).toContain('html.app-ios-status-outer body.page-shuiming-result .page-root{isolation:auto !important;z-index:auto !important;}');
    expect(shuimingResult).toContain(
      'html.app-ios-status-outer.app-ios-iphone15.app-top-safe-shell body.page-shuiming-result .top-fixed .header .back-btn'
    );
    expect(shuimingResult).toContain('color: #1e6fff !important');
  });

  it('iOS 27 把明细顶栏提到 body 下，返回钮不再被 shield 合成层盖住', () => {
    expect(auth).toContain('function hoistIos27ShuimingResultChrome');
    expect(auth).toContain("classList.add('app-ios-header-hoisted')");
    expect(auth).toContain("back.style.setProperty('top', 'auto', 'important')");
    expect(auth).toContain('Apple 在 iOS 27 忽略 UIDesignRequiresCompatibility');
    expect(shuimingResult).toContain('function hoistIos27ResultChrome');
    expect(shuimingResult).toContain("classList.add('app-ios-header-hoisted')");
    expect(shuimingResult).toContain("top', 'auto', 'important'");
    expect(shuimingResult).toContain('transform: none');
  });

  it('iOS 27 用 sticky 实底白采状态栏，fixed 顶栏不再自带 background', () => {
    expect(auth).toContain('function ios27StickyChromeCss');
    expect(auth).toContain('function ensureIosStickyTintBar');
    expect(auth).toContain('app-ios-sticky-chrome');
    expect(auth).toContain('ios-sticky-tint');
    expect(auth).toContain('position:sticky');
    expect(auth).toContain('background:transparent !important');
    expect(shuimingResult).toContain('app-ios-sticky-chrome');
    expect(shuimingResult).toContain('ios-sticky-tint');
    expect(shuiming).toContain('app-ios-sticky-chrome');
    expect(shuiming).toContain('ios-sticky-tint');
  });

  it('iOS 27 用白边盖住顶栏底的系统细线，不再用灰阴影', () => {
    expect(auth).toContain('isolation:auto !important');
    expect(auth).toContain('box-shadow:0 3px 0 0 #fff !important');
    expect(auth).toContain('bottom:-4px !important');
    expect(auth).toContain('top:-80px !important');
    expect(auth).toContain('+ 56px');
    expect(auth).toContain('margin:0 0 calc(-1 * (var(--app-shell-statusbar-top,env(safe-area-inset-top,59px)) + 56px))');
    expect(shuimingResult).toContain('box-shadow: 0 3px 0 0 #fff');
    expect(shuimingResult).toContain('+ 56px');
    expect(shuiming).toContain('+ 56px');
  });

  it('iOS 26/27 WebClip 不走外置栏，首屏按 393×852 打 15 并垫 59px', () => {
    expect(auth).toContain('function isIosLiquidGlassWebClip');
    expect(auth).toContain('isIosLiquidGlassWebClip() && isIosWhiteStatusPage()');
    expect(auth).toContain("classList.add('app-ios-liquid-glass')");
    expect(auth).toContain('height:calc(44px + var(--app-shell-statusbar-top,59px))');
    expect(shuimingResult).toContain('app-ios-liquid-glass');
    expect(shuimingResult).toContain('longSide >= 848');
    expect(shuimingResult).toContain("classList.remove('app-ios-status-outer')");
    expect(shuiming).toContain('app-ios-liquid-glass');
    expect(shuiming).toContain("classList.remove('app-ios-status-outer')");
    expect(shuimingResult).toContain('--safe-top: var(--app-shell-statusbar-top, env(safe-area-inset-top, 59px))');
  });

  it('筛选页首屏也打 15 标并铺白顶', () => {
    expect(shuiming).toContain('is15LikeSm');
    expect(shuiming).toContain("classList.add('app-ios-iphone15')");
    expect(shuiming).toContain('auth.js?v=20260917-iphone12-first');
    expect(shuiming).toContain(
      'html.app-ios-iphone15.app-top-safe-shell:not(.app-ios-status-outer) body.page-shuiming > .header'
    );
  });

  it('壳内白页外置状态栏，不依赖 iframe 里的 StatusBar', () => {
    const fn = auth.slice(
      auth.indexOf('function applyIPhone16ProPageChrome()'),
      auth.indexOf('function applyImmersiveNotchWhitePageChrome()')
    );
    expect(fn).toContain('var useOuterBar = hasNativeBar || isCordovaTaxAppShell() || webclipOwnsBar');
    expect(fn).toContain('isIosStandaloneApp()');
    expect(fn).toContain('measureSafeAreaInsetTop() < 20 && !liquidGlassWebclip');
    expect(fn).toContain("overlays: !useOuterBar");
    expect(fn).toContain("classList.remove('app-ios-status-outer')");
    expect(auth).toContain('function isIosLiquidGlassWebClip');
    expect(auth).toContain('getIOSMajorVersion() >= 26');
    expect(auth).toContain(
      'html.app-ios-status-outer.app-cordova-shell.app-ios-client.app-top-safe-shell'
    );
    expect(auth).toContain('--app-shell-statusbar-top:0px !important;');
    expect(shuimingResult).toContain("overlays: false");
    expect(shuiming).toContain("overlays: false");
    expect(shuimingResult).toContain("classList.add('app-ios-status-outer')");
    expect(shuiming).toContain("classList.add('app-ios-status-outer')");
    expect(shuimingResult).toContain('navigator.standalone === true');
    expect(shuiming).toContain('navigator.standalone === true');
    expect(shuimingResult).toContain("matchMedia('(display-mode: standalone)')");
    expect(shuiming).toContain("matchMedia('(display-mode: standalone)')");
  });
});
