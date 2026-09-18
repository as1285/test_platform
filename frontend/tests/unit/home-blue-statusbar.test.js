import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const cordova = readFileSync(resolve(__dirname, '../../../cordova-app/www/index.html'), 'utf8');

describe('首页蓝顶栏 / 纳税明细顶白底', () => {
  it('安卓对齐 8 月初：蓝顶沉浸；仅 Ace2V/小米14 外置黑条；iOS 不变', () => {
    const start = auth.indexOf('function applyImmersiveBlueStatusBar');
    const end = auth.indexOf('function applyMinePageChrome');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const fn = auth.slice(start, end);
    expect(fn).toContain('isLikelyAndroidViewportClient()');
    expect(fn).not.toContain('ensureAndroidFixedBlackStatusPad');
    expect(fn).toContain('isOnePlusAce2VClient()');
    expect(fn).toContain('isXiaomi14LikeClient()');
    expect(fn).toContain("color: '#000000'");
    expect(fn).toContain('overlays: false');
    expect(fn).toContain('color: topColor');
    expect(fn).toContain('overlays: !androidOuterSolid');
  });

  it('setupMobileStatusBar 不再把全部安卓蓝顶页刷成黑条', () => {
    expect(auth).toContain('安卓蓝顶页：对齐 8 月初 UI');
    expect(auth).toContain('cordovaXiaomi23127 || xiaomi14Client');
    expect(auth).not.toContain(
      'androidClient && (immersiveBlueTop || cordovaXiaomi23127 || xiaomi14Client)'
    );
    expect(auth).not.toContain('androidClient && immersiveBlueTop\n          ? \'black\'');
    expect(auth).toContain(
      "immersiveBlueTop || !lightRootChrome ? 'black-translucent' : 'default'"
    );
  });

  it('Cordova 默认状态栏沉浸实底白，避免透明色落成黑框', () => {
    expect(cordova).toContain("backgroundColorByHexString('#ffffff')");
    expect(cordova).toContain('StatusBar.styleDefault()');
    expect(cordova).toContain('iOS 默认沉浸实底白');
    expect(cordova).toContain('iOS 外置栏会落成黑框');
  });

  it('小米 14 首页顶条跟搜索蓝，黑条仅白顶栏页', () => {
    expect(auth).toContain('html.app-android-xiaomi-14.app-top-safe-shell:has(body.page-shuiming)::before');
    expect(auth).toContain(
      'html.app-android-xiaomi-14.app-top-safe-shell body.page-shouye::before{background-color:rgb(var(--shouye-top-bar-rgb,79, 144, 243))'
    );
    expect(auth).not.toContain(
      'html.app-android-xiaomi-14.app-top-safe-shell::before{content:"" !important;position:fixed !important;left:0 !important;right:0 !important;top:0 !important;height:var(--app-shell-statusbar-top,48px) !important;background:#000 !important;z-index:2147483000 !important;pointer-events:none !important;}'
    );
  });

  it('首页从白顶返回会延迟再刷蓝顶', () => {
    expect(auth).toContain('从白顶栏页返回时 Cordova 可能残留白/黑栏');
    expect(auth).toContain('setTimeout(reapplyBlue, 800)');
  });

  it('纳税明细 iOS 状态栏区铺实底白，列表仍可滚动', () => {
    expect(shuimingResult).toContain('html.platform-ios:not(.app-ios-status-outer) body.page-shuiming-result::before');
    expect(shuimingResult).toContain('background: #fff');
    expect(shuimingResult).toContain('overscroll-behavior-y: none');
    expect(shuimingResult).toContain('width: 4px');
    expect(shuimingResult).toContain('auth.js?v=20260918-ios27-webclip');
  });

  it('首页脚本缓存戳已刷新', () => {
    expect(shouye).toContain('auth.js?v=20260918-ios27-webclip');
  });

  it('iPhone 14 Pro 首页刘海垫搜索蓝，不留 Cordova 顶黑框', () => {
    expect(shouye).toContain('data-iphone14pro-home-blue');
    expect(shouye).toContain("classList.add('app-ios-iphone14pro')");
    expect(shouye).toContain('iPhone15,2');
    expect(shouye).toMatch(
      /html\.app-ios-iphone14pro\.app-ios-client\.app-top-safe-shell body\.page-shouye::before[\s\S]{0,80}background-color:\s*#4f90f3/
    );
    expect(auth).toContain('isIPhone14ProLikeClient()');
    expect(auth).toContain(
      'html.app-ios-client.app-ios-iphone14promax,html.app-ios-client.app-ios-iphone14pro,html.app-ios-client.app-ios-iphone15{background-color:#'
    );
  });

  it('蓝顶 StatusBar 在 style 后再钉 overlays（11 / 14PM 防黑条变矮）', () => {
    const start = auth.indexOf('function requestShellStatusBar');
    const end = auth.indexOf('function applyImmersiveBlueStatusBar');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const fn = auth.slice(start, end);
    expect(fn).toContain('iPhone 11 / 14 Pro Max');
    expect(fn).toContain('overlaysWebView(true)');
    expect(fn).toContain('styleLightContent');
    expect(fn).toContain('iOS 外置栏会落成顶部黑框');
    expect(fn).toContain('wantOverlay = true');
  });
});
