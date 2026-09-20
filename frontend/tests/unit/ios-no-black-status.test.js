import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');
const shuiming = readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const cordova = readFileSync(resolve(__dirname, '../../../cordova-app/www/index.html'), 'utf8');

describe('iOS 全机去掉顶部黑框', () => {
  it('requestShellStatusBar 在 iOS 上强制 overlays=true', () => {
    const fn = auth.slice(
      auth.indexOf('function requestShellStatusBar'),
      auth.indexOf('function applyImmersiveBlueStatusBar')
    );
    expect(fn).toContain('iOS 外置栏会落成顶部黑框');
    expect(fn).toContain('isLikelyIOSViewportClient()');
    expect(fn).toContain('wantOverlay = true');
    expect(fn).toContain('overlays: wantOverlay');
  });

  it('白顶页 Cordova 不走外置栏', () => {
    const fn = auth.slice(
      auth.indexOf('function applyIPhone16ProPageChrome()'),
      auth.indexOf('function applyImmersiveNotchWhitePageChrome()')
    );
    expect(fn).toContain('var useOuterBar = webclipOwnsBar && !isCordovaTaxAppShell()');
    expect(fn).not.toContain('hasNativeBar || isCordovaTaxAppShell() || webclipOwnsBar');
  });

  it('首页 iOS html 实底搜索蓝，刘海垫不再透黑', () => {
    expect(auth).toContain(
      'html.app-ios-client.app-top-safe-shell:has(body.page-shouye){background-color:#4f90f3 !important;background-image:none !important;}'
    );
    expect(shouye).toContain('html.app-ios-client.app-top-safe-shell:has(body.page-shouye)');
    expect(shouye).toContain('background-color: #4f90f3 !important');
    expect(shouye).toContain('auth.js?v=20260920-mi13u-revert');
  });

  it('我的 / 办查 iOS html 实底顶蓝', () => {
    expect(auth).toContain(
      'html.app-ios-client,html.app-ios-iphone14promax{background-color:#1677ff !important;background-image:none !important;'
    );
    expect(auth).toContain(
      'html.app-ios-client,html.app-ios-iphone14promax{background-color:#2b81f2 !important;background-image:none !important;'
    );
  });

  it('Cordova 壳 iOS 一律 overlays=true 并按页色铺父文档顶垫', () => {
    expect(cordova).toContain('iOS 外置栏会落成黑框，一律沉浸 overlays=true');
    expect(cordova).toContain('wantOverlay = true');
    expect(cordova).toContain("plate.style.background = '#4f90f3'");
    expect(cordova).toContain("backgroundColorByHexString('#ffffff')");
  });

  it('白页首屏 Cordova/iframe 不再打 status-outer，overlays 为 true', () => {
    expect(shuiming).toContain('standalone && !inIframe');
    expect(shuimingResult).toContain('standalone && !inIframe');
    expect(shuiming).toContain("overlays: true");
    expect(shuimingResult).toContain("overlays: true");
    expect(shuiming).toContain('auth.js?v=20260920-mi13u-revert');
    expect(shuimingResult).toContain('auth.js?v=20260920-mi13u-revert');
  });
});
