import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const shuiming = readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');

describe('iPhone 15 Pro（iPhone16,1）走 15 档实底顶栏', () => {
  it('硬件号识别 15 Pro，且不再当成 15 Plus / Pro Max', () => {
    expect(auth).toContain('function isIPhone15ProHardwareId');
    expect(auth).toContain('iPhone16,1 是 15 Pro（393×852），不是本档');
    expect(auth).toContain('if (isIPhone15ProHardwareId(ua))');
    expect(auth).toContain('isIPhone15ProHardwareId(ua) || /iPhone15,4\\b/i.test(ua)');
    const plusMaxFn = auth.slice(
      auth.indexOf('function isIPhone15PlusProMaxLikeClient'),
      auth.indexOf('function isIPhone15LikeClient')
    );
    expect(plusMaxFn).toContain('iPhone16,2\\b');
    expect(plusMaxFn).not.toMatch(/iPhone16,1\\b/);
    expect(plusMaxFn).toContain('isIPhone15ProHardwareId(ua)');
  });

  it('明细 / 筛选首屏把 iPhone16,1 打成 15，不打 15promax', () => {
    expect(shuimingResult).toContain('iPhone16,1\\b|iPhone15Pro\\b(?!Max)');
    expect(shuiming).toContain('iPhone16,1\\b|iPhone15Pro\\b(?!Max)');
    const pmFirst = shuimingResult.slice(
      shuimingResult.indexOf('var is15pmLike'),
      shuimingResult.indexOf('var is15Vp')
    );
    expect(pmFirst).toContain('iPhone16,2');
    expect(pmFirst).not.toMatch(/iPhone16,1\\b/);
  });

  it('首页给 15 / 15 Pro 铺 59px 实底搜索蓝', () => {
    expect(shouye).toContain('data-iphone15pro-home-blue');
    expect(shouye).toContain("classList.add('app-ios-iphone15')");
    expect(auth).toContain(
      'html.app-ios-client.app-ios-iphone14promax,html.app-ios-client.app-ios-iphone14pro,html.app-ios-client.app-ios-iphone15{background-color:#'
    );
    expect(auth).toContain(
      'html.app-ios-client.app-ios-iphone15.app-top-safe-shell body.page-shouye::before{height:59px !important;background-color:#'
    );
  });

  it('iOS 27 误打 15promax 时不再铺 fixed ::before，改 sticky 实白', () => {
    expect(auth).toContain(
      'html.app-ios-liquid-glass.app-ios-iphone15promax.app-top-safe-shell body.page-shuiming-result::before'
    );
    expect(auth).toContain('content:none !important;display:none !important');
    expect(auth).toContain('position:sticky !important;top:0 !important');
    expect(shuimingResult).toContain('auth.js?v=20260920-15pm-env0');
    expect(shouye).toContain('auth.js?v=20260920-15pm-env0');
  });
});
