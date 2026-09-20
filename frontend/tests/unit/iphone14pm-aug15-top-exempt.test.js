import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const nginx = readFileSync(resolve(__dirname, '../../nginx.conf'), 'utf8');
const shuiming = readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('iPhone 14/15 Pro Max：顶栏回退 Aug15（black-translucent + 59px，不进 liquid-glass/inflow）', () => {
  it('auth.js 提供 14/15PM 例外判定与 Aug15 顶栏强制', () => {
    expect(auth).toContain('function isIPhone14ProMaxAug15TopExempt');
    expect(auth).toContain('function applyIPhone14ProMaxAug15TopChrome');
    expect(auth).toContain('function isAug15TopExemptFifteenPromax');
    expect(auth).toContain("classList.contains('app-ios-iphone15promax')");
    expect(auth).toContain('isIPhone15PlusProMaxLikeClient()');
    expect(auth).toContain("setProperty('--app-shell-statusbar-top', '59px', 'important')");
    expect(auth).toContain("upsertMeta('apple-mobile-web-app-status-bar-style', 'black-translucent')");
    expect(auth).toContain("classList.remove('app-ios27')");
    expect(auth).toContain("classList.remove('app-ios-liquid-glass')");
    expect(auth).toContain("classList.add('app-ios-iphone15promax')");
    expect(auth).toContain("classList.remove('app-ios-iphone14promax')");
  });

  it('liquid-glass / iOS27 default / inflow 对 14/15PM 短路', () => {
    expect(auth).toMatch(
      /function isIosLiquidGlassOS\(\)\s*\{[\s\S]*?isIPhone14ProMaxAug15TopExempt\(\)[\s\S]*?return false/
    );
    expect(auth).toMatch(
      /function isIosLiquidGlassWebClip\(\)\s*\{[\s\S]*?isIPhone14ProMaxAug15TopExempt\(\)[\s\S]*?return false/
    );
    expect(auth).toContain('getIOSMajorVersion() >= 27 && !isIPhone14ProMaxAug15TopExempt()');
    expect(auth).toContain('!isIPhone14ProMaxAug15TopExempt()');
  });

  it('Aug15 在 iOS27+env≈0 时顶距清零，避免系统占栏后再垫 59px', () => {
    expect(auth).toContain('function measureAug15SafeAreaTopPx');
    expect(auth).toContain('systemOwnsBar');
    expect(auth).toContain("setProperty('--app-shell-statusbar-top', '0px', 'important')");
    expect(auth).toContain("classList.add('app-ios-status-outer')");
    expect(boot).toContain('systemOwnsBar');
    expect(boot).toContain("setProperty('--app-shell-statusbar-top', '0px', 'important')");
  });

  it('白顶页 Aug15 按占栏情况选择 default/0 或 black-translucent/59，并跳过 sticky tint', () => {
    expect(auth).toContain('function applyIPhone16ProPageChrome');
    expect(auth).toMatch(
      /function applyIPhone16ProPageChrome\(\)\s*\{[\s\S]*?isIPhone14ProMaxAug15TopExempt\(\)[\s\S]*?hideIosStickyTintBar\(\)/
    );
    expect(auth).toMatch(
      /function ensureIosStickyTintBar\(\)\s*\{[\s\S]*?isIPhone14ProMaxAug15TopExempt\(\)[\s\S]*?hideIosStickyTintBar\(\)/
    );
  });

  it('auth-boot 首屏即识别 14/15PM 并跳过 paintIos27LiquidGlassPlate', () => {
    expect(boot).toContain('function isIPhone14ProMaxAug15TopExemptBoot');
    expect(boot).toContain('function applyIPhone14ProMaxAug15TopChromeBoot');
    expect(boot).toContain('function isAug15TopExemptFifteenPromaxBoot');
    expect(boot).toContain('isIPhone14ProMaxAug15TopExemptBoot()');
    expect(boot).toContain('applyIPhone14ProMaxAug15TopChromeBoot()');
    expect(boot).toContain('/iPhone\\s*15\\s*Pro\\s*Max|iPhone\\s*15\\s*Plus|iPhone16,2\\b|iPhone15,5\\b/i');
    expect(boot).toContain("setProperty('--app-shell-statusbar-top', '59px', 'important')");
    expect(boot).toContain("setAttribute('content', 'black-translucent')");
    expect(boot).toContain("classList.add('app-ios-iphone15promax')");
    expect(boot).toContain("classList.remove('app-ios-iphone14promax')");
  });

  it('shuiming firstpaint 对 14/15PM 不打 app-ios27 / liquid-glass，overlays 保持 true', () => {
    expect(shuiming).toContain('var is14pmExempt');
    expect(shuiming).toContain('var is15pmUa');
    expect(shuiming).toContain('liquidGlass = iosMajor >= 26 && !is14pmExempt');
    expect(shuiming).toContain("style: is14pmExempt && iosMajor < 27 ? 'black-translucent' : 'default'");
    expect(shuiming).toContain('overlays: is14pmExempt ? (iosMajor < 27) : iosMajor >= 27 ? false : true');
    expect(shuiming).toContain("classList.add('app-ios-iphone15promax')");
    expect(shuimingResult).toContain('var is14pmExempt');
    expect(shuimingResult).toContain('var is15pmUa');
    expect(shuimingResult).toContain('liquidGlass = iosMajor >= 26 && !is14pmExempt');
    expect(shuimingResult).toContain("style: is14pmExempt && iosMajor < 27 ? 'black-translucent' : 'default'");
    expect(shuimingResult).toContain("classList.add('app-ios-iphone15promax')");
  });

  it('nginx 对 14/15 Pro Max UA 保持 black-translucent', () => {
    expect(nginx).toContain('~*iPhone15,3');
    expect(nginx).toContain('~*iPhone 14 Pro Max');
    expect(nginx).toContain('~*iPhone16,2');
    expect(nginx).toContain('~*iPhone 15 Pro Max');
    expect(nginx).toContain('~*iPhone15,5');
    expect(nginx).toContain('"black-translucent"');
    // 机型例外必须写在 OS 27 default 规则之前（nginx map 按出现顺序匹配）
    const model14Idx = nginx.indexOf('~*iPhone15,3');
    const model15Idx = nginx.indexOf('~*iPhone16,2');
    const os27Idx = nginx.indexOf('~ OS 2[7-9]_');
    expect(model14Idx).toBeGreaterThan(-1);
    expect(model15Idx).toBeGreaterThan(-1);
    expect(os27Idx).toBeGreaterThan(model14Idx);
    expect(os27Idx).toBeGreaterThan(model15Idx);
  });

  it('主页面缓存戳已刷新', () => {
    expect(shuiming).toContain('auth-boot.js?v=20260920-15pm-no-double');
    expect(shuiming).toContain('auth.js?v=20260920-15pm-no-double');
    expect(shuimingResult).toContain('auth-boot.js?v=20260920-15pm-no-double');
    expect(shuimingResult).toContain('auth.js?v=20260920-15pm-no-double');
  });

  it('xiangqing 首屏按 iOS27/env 决定 0 或 59，避免双顶距', () => {
    const xiangqing = readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8');
    expect(xiangqing).toContain('系统占栏时顶距 0');
    expect(xiangqing).toContain("setProperty('--app-shell-statusbar-top', '0px', 'important')");
    expect(xiangqing).toContain("classList.add('app-ios-status-outer')");
    expect(xiangqing).toContain("classList.add('app-ios-iphone15promax')");
    expect(xiangqing).toContain('html.app-ios-status-outer body.page-xiangqing');
    expect(xiangqing).toContain('auth-boot.js?v=20260920-15pm-no-double');
    expect(xiangqing).toContain('auth.js?v=20260920-15pm-no-double');
  });
});
