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
  it('安卓白顶栏页统一外置黑条：applyImmersiveNotchWhitePageChrome 全安卓 0px + overlays=false + #000', () => {
    expect(auth).toContain('function isAndroidWhiteStatusPage()');
    expect(auth).toContain('function isAndroidVerifiedOuterWhitePageClient()');
    expect(auth).toContain('function isAndroidWhitePageImmersiveDefaultClient()');
    const start = auth.indexOf('function applyImmersiveNotchWhitePageChrome');
    const end = auth.indexOf('function isInsideTabShellEmbed');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const fn = auth.slice(start, end);
    /* 全安卓白顶栏页统一外置黑条，不再按机型分沉浸 40px / 外置 0px */
    expect(fn).toContain("overlays: false");
    expect(fn).toContain("color: '#000000'");
    expect(fn).toContain("style: 'light'");
    expect(fn).toContain("'--app-shell-statusbar-top', '0px'");
    expect(fn).not.toContain('var immersiveTopInsetClient');
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
    expect(auth).toContain(
      'html.app-android-client.app-top-safe-shell.app-android-honor-flc:not(.app-android-immersive-white-top) body.page-shuiming-result'
    );
    expect(auth).toContain(
      'html.app-android-client.app-top-safe-shell.app-android-samsung:not(.app-android-immersive-white-top) body.page-shuiming-result'
    );
    expect(auth).toContain(
      'html.app-android-oppo-family.app-top-safe-shell:not(.app-android-oneplus-ace2pro):not(.app-android-oneplus-ace2v):not(.app-android-oneplus-acepro):not(.app-android-oneplus-ace6):not(.app-android-oneplus-12):not(.app-android-oppo-reno10):not(.app-android-oppo-k9x):not(.app-android-immersive-white-top)'
    );
  });

  it('syncAppShellStatusbarTop 对全安卓写 0px（Mate60=52px；Hi nova 9 SE 例外保留 40px）', () => {
    const syncIdx = auth.indexOf('function syncAppShellStatusbarTop()');
    expect(syncIdx).toBeGreaterThan(0);
    const syncFn = auth.slice(syncIdx, auth.indexOf('function requestShellStatusBar'));
    /* 安卓分支：Mate60 52px；Hi nova 9 SE 40px；其余一律 0px */
    expect(syncFn).toContain("isHuaweiMate60Client()");
    expect(syncFn).toContain("'--app-shell-statusbar-top', '52px'");
    expect(syncFn).toContain('isHiNova9SeClient()');
    expect(syncFn).toContain("'--app-shell-statusbar-top', '40px'");
    expect(syncFn).toContain("'--app-shell-statusbar-top', '0px'");
    expect(syncFn).not.toContain('var keepWhiteImmersive');
    expect(syncFn).not.toContain('isAndroidWhitePageImmersiveDefaultClient()');
  });

  it('first-paints white pages in auth-boot before auth.js', () => {
    expect(boot).toContain('function applyAndroidWhitePageInsetFirstPaint()');
    expect(boot).toContain('app-android-immersive-white-top');
    expect(boot).toContain("'--app-shell-statusbar-top', '40px'");
    expect(boot).toContain('PHJ110');
    expect(boot).toContain('23127PN');
    Object.entries(pages).forEach(([name, html]) => {
      expect(html).toContain('auth-boot.js?v=20260909-hinova9se-inset-v1');
      expect(html).toContain('auth.js?v=20260909-hinova9se-inset-v1');
    });
  });
});
