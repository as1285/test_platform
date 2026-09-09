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
  it('inverts App-shell white pages to 40px unless the device is a verified outer bar', () => {
    expect(auth).toContain('function isAndroidWhiteStatusPage()');
    expect(auth).toContain('function isAndroidVerifiedOuterWhitePageClient()');
    expect(auth).toContain('function isAndroidWhitePageImmersiveDefaultClient()');
    expect(auth).toContain('isAndroidWhitePageImmersiveDefaultClient()');
    expect(auth).toMatch(
      /var immersiveTopInsetClient =\s*isAndroidWhitePageImmersiveDefaultClient\(\)/
    );
    expect(auth).toContain('isOppoA58Client()');
    expect(auth).toContain('isOppoFindX9Client()');
    expect(auth).toContain('isHonorFoldableOuterBarClient()');
    expect(auth).toContain('isSamsungOneUiFamilyClient()');
    expect(auth).toContain('isHuaweiPura70LikeClient()');
    expect(auth).toContain('isXiaomi14LikeClient()');
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

  it('keeps syncAppShellStatusbarTop from forcing 0px on immersive white pages', () => {
    const syncIdx = auth.indexOf('function syncAppShellStatusbarTop()');
    const keepIdx = auth.indexOf('var keepWhiteImmersive =');
    const outerZeroIdx = auth.indexOf(
      'isAndroidOuterStatusBarClient()',
      syncIdx
    );
    expect(syncIdx).toBeGreaterThan(0);
    expect(keepIdx).toBeGreaterThan(syncIdx);
    expect(keepIdx).toBeLessThan(outerZeroIdx);
  });

  it('first-paints white pages in auth-boot before auth.js', () => {
    expect(boot).toContain('function applyAndroidWhitePageInsetFirstPaint()');
    expect(boot).toContain('app-android-immersive-white-top');
    expect(boot).toContain("'--app-shell-statusbar-top', '40px'");
    expect(boot).toContain('PHJ110');
    expect(boot).toContain('23127PN');
    Object.entries(pages).forEach(([name, html]) => {
      expect(html).toContain('auth-boot.js?v=20260908-android-uniform-black');
      expect(html).toContain('auth.js?v=20260908-android-uniform-black');
    });
  });
});
