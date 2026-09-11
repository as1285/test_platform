import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');

const K70_STD_MODEL = /23113RKC6[CG]|2311DRK48[CGI]/i;
const K70_STD_NAME = /(?:Redmi|Xiaomi|REDMI)[\s_-]*K70(?![\s_-]*(?:至尊|Ultra|Pro))/i;
const K70_ULTRA =
  /2407FPN8E[GR]|2407FRK8EC|XIG06|A402XM|(?:Redmi|Xiaomi|REDMI)[\s_-]*K70[\s_-]*(?:至尊|Ultra)/i;

describe('红米 K70 标准版「我的」页 underlap 黑垫', () => {
  it('识别 K70 标准版，不把至尊 / K80 / 真机 Pixel 算进来', () => {
    expect(K70_STD_MODEL.test('23113RKC6C')).toBe(true);
    expect(K70_STD_MODEL.test('23113RKC6G')).toBe(true);
    expect(K70_STD_NAME.test('Redmi K70')).toBe(true);
    expect(K70_ULTRA.test('2407FPN8EG')).toBe(true);
    expect(K70_ULTRA.test('Redmi K70 Ultra')).toBe(true);
    expect(K70_ULTRA.test('23113RKC6C')).toBe(false);
    expect(K70_STD_NAME.test('Redmi K70 Ultra')).toBe(false);
    expect(K70_STD_MODEL.test('Pixel 7')).toBe(false);
  });

  it('mine.html 首屏对 K70 和桌面/AVD 预览铺 40px 黑垫', () => {
    expect(mine).toContain('function paintMineBlackStatusFirst');
    expect(mine).toContain('tax_device_model_v1');
    expect(mine).toContain("classList.add('app-mine-black-status')");
    expect(mine).toContain("classList.remove('app-android-mine-e1-sm')");
    expect(mine).toContain('data-mine-black-status-firstpaint');
    expect(mine).toContain('html.app-mine-black-status body.page-mine::before{content:""');
    expect(mine).toContain('height:40px!important;background:#000');
    expect(mine).toContain(
      'html.app-mine-black-status body.page-mine .mine-e1-canvas{padding-top:40px!important;background-color:#000'
    );
    expect(mine).toContain(
      'html.app-mine-black-status body.page-mine .mine-activate-btn{top:calc(10px + 40px)'
    );
    expect(mine).toContain('auth.js?v=20260911-reno10-mine');
    expect(mine).toContain('auth-boot.js?v=20260911-reno10-mine');
    expect(mine).toContain('sdk_gphone|Android SDK|goldfish|ranchu');
    expect(mine).toContain('Windows|Macintosh|X11');
    expect(mine).toContain('Win32|Win64|Windows|MacIntel|Macintosh');
    expect(mine).toContain('underlap 黑垫');
  });

  it('auth.js 用 resolveMineStatusMode，预览不伤至尊 / 其它 OEM', () => {
    expect(auth).toContain('function isRedmiK70StandardClient()');
    expect(auth).toContain('function isMineUnderlapPreviewBlob');
    expect(auth).toContain('function resolveMineStatusMode()');
    expect(auth).toContain("return 'underlap-black'");
    expect(auth).toContain('function shouldApplyMineBlackStatus()');
    expect(auth).toContain('sdk_gphone|Android SDK|goldfish|ranchu');
    expect(auth).toContain('Windows|Macintosh|X11');
    expect(auth).toContain('Win32|Win64|Windows|MacIntel|Macintosh');
    expect(auth).toContain('navigator.webdriver');
    expect(auth).toContain('isMineStatusPage() && isRedmiK70StandardClient()');
    const pinStart = auth.indexOf('function pinXiaomi14ProMineE1Layout');
    expect(pinStart).toBeGreaterThan(0);
    const pinFn = auth.slice(pinStart, pinStart + 500);
    expect(pinFn).toContain('shouldApplyMineBlackStatus()');
    expect(pinFn).toContain('app-mine-black-status');
    const start = auth.indexOf('function applyImmersiveBlueStatusBar');
    const end = auth.indexOf('function applyMinePageChrome');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const fn = auth.slice(start, end);
    expect(fn).toContain('shouldApplyMineBlackStatus()');
    expect(fn).toContain('app-mine-black-status');
    expect(fn).toContain("color: '#000000'");
    expect(fn).toContain('overlays: false');
    expect(auth).toContain("resolveMineStatusMode() === 'underlap-black'");
    expect(auth).toContain('html.app-mine-black-status body.page-mine::before');
    expect(auth).toContain('background:#000000 !important;z-index:40 !important;pointer-events:none');
    expect(auth).toContain('html.app-mine-black-status body.page-mine .mine-activate-btn,');
  });

  it('auth-boot 对 underlap-black 跳过 @sm 裁切', () => {
    expect(boot).toContain('function resolveMineStatusMode()');
    expect(boot).toContain('function isMineUnderlapPreviewBlob');
    expect(boot).toContain('Win32|Win64|Windows|MacIntel|Macintosh');
    expect(boot).toContain('navigator.webdriver');
    expect(boot).toContain("resolveMineStatusMode() === 'underlap-black'");
    expect(boot).toContain("cl.remove('app-android-mine-e1-sm')");
    expect(boot).toContain(':not(.app-mine-black-status):not(.app-android-redmi-k70)');
    expect(boot).toContain('window.resolveMineStatusMode = resolveMineStatusMode');
  });
});
