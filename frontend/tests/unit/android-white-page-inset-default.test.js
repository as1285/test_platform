import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const pages = {
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8')
};

const OPPO_FAMILY_RESULT_ZERO =
  ':not(.app-android-oppo-k9x):not(.app-android-immersive-white-top) body.page-shuiming-result';

describe('Android white-page default immersive inset', () => {
  it('安卓白顶栏恢复 9/1：机型沉浸白底深色字 / 外置黑条分流，无统一页内黑垫', () => {
    expect(auth).toContain('function isAndroidWhiteStatusPage()');
    const start = auth.indexOf('function applyImmersiveNotchWhitePageChrome');
    const end = auth.indexOf('function isInsideTabShellEmbed');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const fn = auth.slice(start, end);
    expect(fn).not.toContain('ensureAndroidFixedBlackStatusPad');
    expect(fn).toContain("style: 'dark'");
    expect(fn).toContain('overlays: true');
    expect(fn).toContain('outerStatusBar');
    expect(fn).toContain('immersiveTopInsetClient');
  });

  it('does not let OPPO-family layout-zero rules win over immersive-white-top', () => {
    expect(auth).toContain(OPPO_FAMILY_RESULT_ZERO);
    const oppoResultSelectors = auth.match(
      /:not\(\.app-android-oppo-k9x\)[^']*body\.page-shuiming-result/g
    );
    expect(oppoResultSelectors && oppoResultSelectors.length).toBeGreaterThan(0);
    oppoResultSelectors.forEach((sel) => {
      expect(sel).toContain(':not(.app-android-immersive-white-top)');
    });
    expect(auth).toContain(
      'html.app-android-client.app-top-safe-shell.app-android-redmi-k70:not(.app-android-immersive-white-top) body.page-shuiming-result'
    );
  });

  it('syncAppShellStatusbarTop 安卓默认 40px（Mate60=52；Ace2V=0）', () => {
    const syncIdx = auth.indexOf('function syncAppShellStatusbarTop()');
    expect(syncIdx).toBeGreaterThan(0);
    const syncFn = auth.slice(syncIdx, auth.indexOf('function requestShellStatusBar'));
    expect(syncFn).toContain('isHuaweiMate60Client()');
    expect(syncFn).toContain("'--app-shell-statusbar-top', '52px'");
    expect(syncFn).toContain('isOnePlusAce2VClient()');
    expect(syncFn).toContain("'--app-shell-statusbar-top', '40px'");
  });

  it('first-paints white pages in auth-boot before auth.js', () => {
    expect(boot).toContain('function applyAndroidWhitePageInsetFirstPaint()');
    expect(boot).toContain('app-android-immersive-white-top');
    expect(boot).toContain("'--app-shell-statusbar-top', '40px'");
    Object.entries(pages).forEach(([name, html]) => {
      expect(html).toContain('auth-boot.js?v=20260909-android-statusbar-sep1');
      expect(html).toMatch(/auth\.js\?v=202609(?:09-android-aug1-blue|10-mi13u-listtitle)/);
    });
  });
});
