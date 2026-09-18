import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const cordova = readFileSync(resolve(__dirname, '../../../cordova-app/www/index.html'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('iOS 27 Liquid Glass：去掉 fixed 顶垫，改 sticky 实白', () => {
  it('auth-boot 隐藏 fixed 顶垫，用 sticky 实白顶栏采样', () => {
    expect(boot).toContain('function paintIos27LiquidGlassPlate');
    expect(boot).toContain('function ios27StatusPlateColor');
    expect(boot).toContain("classList.add('app-ios-liquid-glass')");
    expect(boot).toContain('#ios27StatusPlate{display:none!important');
    expect(boot).toContain('position:sticky!important;top:0!important;background:#fff!important');
    expect(boot).not.toContain('z-index:2147483000!important');
    expect(boot).toContain("page === 'shouye.html'");
    expect(boot).toContain("return '#4f90f3'");
    expect(boot).toContain("return '#ffffff'");
    expect(boot).toContain('paintIos27LiquidGlassPlate()');
  });

  it('auth.js 全机 iOS 26+ 都打 liquid-glass，不再铺 fixed 顶垫', () => {
    expect(auth).toContain('function isIosLiquidGlassOS');
    expect(auth).toContain('function syncIos27StatusPlate');
    expect(auth).toContain('getIOSMajorVersion() >= 26');
    expect(auth).toContain('liquidGlassWebclip || isIosLiquidGlassOS()');
    expect(auth).toContain("syncIos27StatusPlate('#ffffff')");
    expect(auth).toContain('syncIos27StatusPlate(topColor)');
    expect(auth).toContain('#ios27StatusPlate{display:none!important');
    expect(auth).toContain('position:sticky !important;top:0 !important');
    expect(auth).toContain('-webkit-text-fill-color:#000!important');
  });

  it('Cordova 父文档不再显示 fixed 顶垫', () => {
    expect(cordova).toContain('#iosStatusPlate');
    expect(cordova).toContain("earlyPlate.style.display = 'none'");
    expect(cordova).toContain("plate.style.display = 'none'");
    expect(cordova).not.toContain("earlyPlate.style.height = '48px'");
    expect(cordova).not.toContain("plate.style.height = '48px'");
  });

  it('主页面已刷新缓存戳', () => {
    expect(shouye).toContain('auth-boot.js?v=20260918-ios27-edge');
    expect(shouye).toContain('auth.js?v=20260918-ios27-edge');
    expect(shuimingResult).toContain('auth-boot.js?v=20260918-ios27-edge');
    expect(shuimingResult).toContain('auth.js?v=20260918-ios27-edge');
  });
});
