import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const nginx = readFileSync(resolve(__dirname, '../../nginx.conf'), 'utf8');
const shuiming = readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('iPhone 14 Pro Max：顶栏回退 Aug15（black-translucent + 59px，不进 liquid-glass/inflow）', () => {
  it('auth.js 提供 14PM 例外判定与 Aug15 顶栏强制', () => {
    expect(auth).toContain('function isIPhone14ProMaxAug15TopExempt');
    expect(auth).toContain('function applyIPhone14ProMaxAug15TopChrome');
    expect(auth).toContain("setProperty('--app-shell-statusbar-top', '59px', 'important')");
    expect(auth).toContain("upsertMeta('apple-mobile-web-app-status-bar-style', 'black-translucent')");
    expect(auth).toContain("classList.remove('app-ios27')");
    expect(auth).toContain("classList.remove('app-ios-liquid-glass')");
  });

  it('liquid-glass / iOS27 default / inflow 对 14PM 短路', () => {
    expect(auth).toMatch(
      /function isIosLiquidGlassOS\(\)\s*\{[\s\S]*?isIPhone14ProMaxAug15TopExempt\(\)[\s\S]*?return false/
    );
    expect(auth).toMatch(
      /function isIosLiquidGlassWebClip\(\)\s*\{[\s\S]*?isIPhone14ProMaxAug15TopExempt\(\)[\s\S]*?return false/
    );
    expect(auth).toContain('getIOSMajorVersion() >= 27 && !isIPhone14ProMaxAug15TopExempt()');
    expect(auth).toContain(
      'getIOSMajorVersion() >= 27 && !isIPhone14ProMaxAug15TopExempt()'
    );
    expect(auth).toContain('!isIPhone14ProMaxAug15TopExempt()');
  });

  it('auth-boot 首屏即识别 14PM 并跳过 paintIos27LiquidGlassPlate', () => {
    expect(boot).toContain('function isIPhone14ProMaxAug15TopExemptBoot');
    expect(boot).toContain('function applyIPhone14ProMaxAug15TopChromeBoot');
    expect(boot).toContain('isIPhone14ProMaxAug15TopExemptBoot()');
    expect(boot).toContain('applyIPhone14ProMaxAug15TopChromeBoot()');
    expect(boot).toContain("setProperty('--app-shell-statusbar-top', '59px', 'important')");
    expect(boot).toContain("setAttribute('content', 'black-translucent')");
  });

  it('shuiming firstpaint 对 14PM 不打 app-ios27 / liquid-glass，overlays 保持 true', () => {
    expect(shuiming).toContain('var is14pmExempt');
    expect(shuiming).toContain('liquidGlass = iosMajor >= 26 && !is14pmExempt');
    expect(shuiming).toContain("style: is14pmExempt ? 'black-translucent' : 'default'");
    expect(shuiming).toContain('overlays: is14pmExempt ? true : iosMajor >= 27 ? false : true');
    expect(shuimingResult).toContain('var is14pmExempt');
    expect(shuimingResult).toContain('liquidGlass = iosMajor >= 26 && !is14pmExempt');
    expect(shuimingResult).toContain("style: is14pmExempt ? 'black-translucent' : 'default'");
  });

  it('nginx 对 iPhone15,3 / 14 Pro Max UA 保持 black-translucent', () => {
    expect(nginx).toContain('~*iPhone15,3');
    expect(nginx).toContain('~*iPhone 14 Pro Max');
    expect(nginx).toContain('"black-translucent"');
    // 机型例外必须写在 OS 27 default 规则之前（nginx map 按出现顺序匹配）
    const modelIdx = nginx.indexOf('~*iPhone15,3');
    const os27Idx = nginx.indexOf('~ OS 2[7-9]_');
    expect(modelIdx).toBeGreaterThan(-1);
    expect(os27Idx).toBeGreaterThan(modelIdx);
  });

  it('主页面缓存戳已刷新', () => {
    expect(shuiming).toContain('auth-boot.js?v=20260920-14pm-aug15');
    expect(shuiming).toContain('auth.js?v=20260920-14pm-aug15');
    expect(shuimingResult).toContain('auth-boot.js?v=20260920-14pm-aug15');
    expect(shuimingResult).toContain('auth.js?v=20260920-14pm-aug15');
  });
});
