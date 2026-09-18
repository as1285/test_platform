import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const cordova = readFileSync(resolve(__dirname, '../../../cordova-app/www/index.html'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('iOS 27 描述文件 WebClip：关掉 fixed shield，sticky 实白采样', () => {
  it('auth-boot 隐藏 fixed 顶垫/shield，顶栏 sticky 实白', () => {
    expect(boot).toContain('function paintIos27LiquidGlassPlate');
    expect(boot).toContain('function ios27StatusPlateColor');
    expect(boot).toContain("classList.add('app-ios-liquid-glass')");
    expect(boot).toContain("classList.add('app-ios-unified-chrome')");
    expect(boot).toContain('.shuiming-chrome-shield{display:none!important');
    expect(boot).toContain('position:sticky!important;top:0!important;background:#fff!important');
    expect(boot).toContain("page === 'shouye.html'");
    expect(boot).toContain("return '#ffffff'");
    expect(boot).toContain('paintIos27LiquidGlassPlate()');
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
    expect(shouye).toContain('auth-boot.js?v=20260918-ios27-webclip');
    expect(shouye).toContain('auth.js?v=20260918-ios27-webclip');
    expect(shuimingResult).toContain('auth-boot.js?v=20260918-ios27-webclip');
    expect(shuimingResult).toContain('auth.js?v=20260918-ios27-webclip');
  });
});
