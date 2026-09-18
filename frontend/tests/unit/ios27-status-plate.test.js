import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const cordova = readFileSync(resolve(__dirname, '../../../cordova-app/www/index.html'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('iOS 27 描述文件 WebClip：default 不透明状态栏根治毛玻璃', () => {
  it('auth-boot 顶距清零、不加 app-top-safe-shell、关掉 fixed 顶垫/shield', () => {
    expect(boot).toContain('function paintIos27LiquidGlassPlate');
    expect(boot).toContain('function ios27StatusPlateColor');
    expect(boot).toContain("classList.add('app-ios-liquid-glass')");
    expect(boot).toContain("classList.add('app-ios-unified-chrome')");
    expect(boot).toContain("classList.remove('app-top-safe-shell')");
    expect(boot).toContain(".shuiming-chrome-shield{display:none!important");
    expect(boot).toContain("'--app-shell-statusbar-top', '0px', 'important'");
    expect(boot).toContain("page === 'shouye.html'");
    expect(boot).toContain("return '#ffffff'");
    expect(boot).toContain('paintIos27LiquidGlassPlate()');
  });

  it('仅 iOS>=26 切 default、顶距 0；旧系统保留 black-translucent 蓝到刘海', () => {
    expect(auth).toContain('function setStatusBarStyleMeta');
    expect(auth).toContain("upsertMeta('apple-mobile-web-app-status-bar-style', 'default')");
    // 旧系统分支仍保留 black-translucent
    expect(auth).toContain("upsertMeta('apple-mobile-web-app-status-bar-style', 'black-translucent')");
    // default / 顶距清零仅在 iOS>=26 生效
    expect(auth).toContain('getIOSMajorVersion() >= 26');
    expect(auth).toContain("'--app-shell-statusbar-top', '0px', 'important'");
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
    expect(shouye).toContain('auth-boot.js?v=20260918-ios27-default');
    expect(shouye).toContain('auth.js?v=20260918-ios27-default');
    expect(shuimingResult).toContain('auth-boot.js?v=20260918-ios27-default');
    expect(shuimingResult).toContain('auth.js?v=20260918-ios27-default');
  });
});
