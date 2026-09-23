import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const cordova = readFileSync(resolve(__dirname, '../../../cordova-app/www/index.html'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

const IOS27_TOP_PAD = 'calc(env(safe-area-inset-top, 0px) + 56px)';

describe('iOS 27 描述文件 WebClip：default 不透明状态栏根治毛玻璃', () => {
  it('auth-boot 渐隐带顶距、不加 app-top-safe-shell、关掉 fixed 顶垫/shield', () => {
    expect(boot).toContain('function paintIos27LiquidGlassPlate');
    expect(boot).toContain('function ios27StatusPlateColor');
    expect(boot).toContain("classList.add('app-ios-liquid-glass')");
    expect(boot).toContain("classList.add('app-ios-unified-chrome')");
    expect(boot).toContain("classList.remove('app-top-safe-shell')");
    expect(boot).toContain(".shuiming-chrome-shield{display:none!important");
    expect(boot).toContain(IOS27_TOP_PAD);
    expect(boot).toContain("page === 'shouye.html'");
    expect(boot).toContain("return '#ffffff'");
    expect(boot).toContain('paintIos27LiquidGlassPlate()');
  });

  it('仅 iOS>=27 切 default + 渐隐带顶距；旧系统保留 black-translucent 蓝到刘海', () => {
    expect(auth).toContain('function setStatusBarStyleMeta');
    expect(auth).toContain("upsertMeta('apple-mobile-web-app-status-bar-style', 'default')");
    // 旧系统分支仍保留 black-translucent
    expect(auth).toContain("upsertMeta('apple-mobile-web-app-status-bar-style', 'black-translucent')");
    // default / 渐隐带顶距仅在 iOS>=27 生效；iOS 26 保持原样
    expect(auth).toContain('getIOSMajorVersion() >= 27');
    expect(auth).toContain("classList.add('app-ios27')");
    expect(auth).toContain(IOS27_TOP_PAD);
    expect(auth).toContain('function ios27InflowOverrideCss');
    expect(auth).toContain('ios27InflowOverrideCss()');
    expect(auth).toContain("id = 'ios27InflowOverrideCss'");
    // iOS 27 明细页 inflow：根文档不滚、列表内部滚动，消除顶部滚动边缘毛玻璃
    expect(boot).toContain('var isIos27Plus = major >= 27');
    expect(boot).toContain("classList.add('app-ios27')");
    expect(boot).toContain('html.app-ios27.app-ios-liquid-glass body.page-shuiming-result .list{');
    expect(boot).toContain('overflow-y:auto!important');
    // iOS 26 分支保留 59px 顶垫
    expect(boot).toContain("root.style.setProperty('--app-shell-statusbar-top', '59px')");
    // 启动文档静态 meta 保持 black-translucent（旧系统直用；新系统由 nginx 按 UA 改写成 default）
    expect(shouye).toContain('content="black-translucent"');
  });

  it('auth.js 描述文件 WebClip 全机走 unified-chrome，关掉灰 shield', () => {
    expect(auth).toContain('function isIosLiquidGlassOS');
    expect(auth).toContain('function isIosLiquidGlassWebClip');
    expect(auth).toContain('function syncIos27StatusPlate');
    expect(auth).toContain("classList.add('app-ios-unified-chrome')");
    expect(auth).toContain('.shuiming-chrome-shield{display:none !important');
    expect(auth).toContain("classList.contains('app-ios-liquid-glass')) return true");
    expect(auth).toContain("syncIos27StatusPlate('#ffffff')");
  });

  it('Cordova 父文档不再显示 fixed 顶垫', () => {
    expect(cordova).toContain('#iosStatusPlate');
    expect(cordova).toContain("earlyPlate.style.display = 'none'");
    expect(cordova).toContain("plate.style.display = 'none'");
  });

  it('主页面已刷新缓存戳', () => {
    expect(shouye).toContain('auth-boot.js?v=20260923-bs4s-restore');
    expect(shouye).toContain('auth.js?v=20260923-bs4s-restore');
    expect(shuimingResult).toContain('auth-boot.js?v=20260923-bs4s-restore');
    expect(shuimingResult).toContain('auth.js?v=20260923-bs4s-restore');
  });

  it('shuiming firstpaint 不再在 iOS27 上打回 59px，且年份遮罩避开顶栏', () => {
    const shuiming = readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8');
    expect(shuiming).toContain("classList.add('app-ios27')");
    expect(shuiming).toContain('iosMajor >= 27');
    expect(shuiming).toContain(IOS27_TOP_PAD);
    expect(shuiming).toContain('? !aug15SystemOwnsBar');
    expect(shuiming).toContain('html.app-ios27 .picker-overlay{top:calc(var(--app-shell-statusbar-top,56px) + 44px)');
    // 旧无条件 59px 赋值不得再出现在 liquidGlass 分支（已被 iOS27 分支取代）
    expect(shuiming).not.toMatch(
      /if \(liquidGlass\) \{[^}]*setProperty\('--app-shell-statusbar-top', '59px'\)/s
    );
    expect(shuimingResult).toContain("classList.add('app-ios27')");
    expect(shuimingResult).toContain('? !aug15SystemOwnsBar');
  });
});
