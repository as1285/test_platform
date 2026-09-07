import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const cordovaShell = readFileSync(resolve(__dirname, '../../../cordova-app/www/index.html'), 'utf8');

describe('iOS 白顶栏状态栏（13PM 黑条）', () => {
  it('applyIPhone16ProPageChrome 用实底白并延迟重刷，不用透明色', () => {
    expect(auth).toContain('function applyIPhone16ProPageChrome()');
    const fn = auth.slice(
      auth.indexOf('function applyIPhone16ProPageChrome()'),
      auth.indexOf('function applyImmersiveNotchWhitePageChrome()')
    );
    expect(fn).toContain("color: '#ffffff'");
    expect(fn).toContain("shell_bg: '#ffffff'");
    expect(fn).toContain("style: 'default'");
    expect(fn).toContain('setTimeout(reapplyDark, 0)');
    expect(fn).toContain('setTimeout(reapplyDark, 80)');
    expect(fn).toContain('setTimeout(reapplyDark, 320)');
    expect(fn).toContain('setTimeout(reapplyDark, 800)');
    expect(fn).not.toContain('#00000000');
  });

  it('明细页首屏把 428×926 打成 13promax，不再误判 15 Plus', () => {
    expect(shuimingResult).toContain('app-ios-iphone13promax');
    expect(shuimingResult).toContain('is13pmLike');
    expect(shuimingResult).toMatch(/long16 >= 922[\s\S]*long16 <= 928/);
    expect(shuimingResult).toMatch(/!is13pmLike/);
    /* 15 Plus 视口下限抬到 928，避开 13PM 的 926 */
    expect(shuimingResult).toMatch(/long16 >= 928[\s\S]*long16 <= 936/);
    expect(shuimingResult).toContain('auth.js?v=20260907-ios-white-bar');
  });

  it('Cordova 壳收到 default + 透明色时强制铺白', () => {
    expect(cordovaShell).toContain("barColor = '#ffffff'");
    expect(cordovaShell).toContain("barColor === '#00000000'");
    expect(cordovaShell).toContain("styleDefault");
  });
});
