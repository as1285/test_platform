import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const cordova = readFileSync(resolve(__dirname, '../../../cordova-app/www/index.html'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('iOS 27 全机状态栏实底（与机型无关）', () => {
  it('auth-boot 在 iOS 26+ 只贴最顶 20px 白垫，z 低于标题', () => {
    expect(boot).toContain('function paintIos27LiquidGlassPlate');
    expect(boot).toContain('function ios27StatusPlateColor');
    expect(boot).toContain("classList.add('app-ios-liquid-glass')");
    expect(boot).toContain("plate.id = 'ios27StatusPlate'");
    expect(boot).toContain('height:20px!important');
    expect(boot).toContain('max-height:20px!important');
    expect(boot).toContain('z-index:2!important');
    expect(boot).not.toContain('z-index:2147483000!important');
    expect(boot).toContain("page === 'shouye.html'");
    expect(boot).toContain("return '#4f90f3'");
    expect(boot).toContain("return '#ffffff'");
    expect(boot).toContain('paintIos27LiquidGlassPlate()');
  });

  it('auth.js 全机 iOS 26+ 都打 liquid-glass，不只 WebClip', () => {
    expect(auth).toContain('function isIosLiquidGlassOS');
    expect(auth).toContain('function syncIos27StatusPlate');
    expect(auth).toContain('getIOSMajorVersion() >= 26');
    expect(auth).toContain('liquidGlassWebclip || isIosLiquidGlassOS()');
    expect(auth).toContain("syncIos27StatusPlate('#ffffff')");
    expect(auth).toContain('syncIos27StatusPlate(topColor)');
    expect(auth).toContain('#ios27StatusPlate{display:block!important');
    expect(auth).toContain('height:20px!important;min-height:20px!important;max-height:20px!important');
    expect(auth).toContain('z-index:2!important');
  });

  it('Cordova 父文档顶垫只盖 20px 时间栏，不再盖标题', () => {
    expect(cordova).toContain('height: 20px');
    expect(cordova).toContain('min-height: 20px');
    expect(cordova).toContain('max-height: 20px');
    expect(cordova).not.toContain('height: calc(env(safe-area-inset-top, 59px) + 18px)');
    expect(cordova).toContain("earlyPlate.style.height = '20px'");
    expect(cordova).toContain("plate.style.height = '20px'");
  });

  it('主页面已刷新缓存戳', () => {
    expect(shouye).toContain('auth-boot.js?v=20260918-ios27-short');
    expect(shouye).toContain('auth.js?v=20260918-ios27-short');
    expect(shuimingResult).toContain('auth-boot.js?v=20260918-ios27-short');
    expect(shuimingResult).toContain('auth.js?v=20260918-ios27-short');
  });
});
