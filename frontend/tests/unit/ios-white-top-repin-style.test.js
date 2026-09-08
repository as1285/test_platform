import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const cordovaShell = readFileSync(resolve(__dirname, '../../../cordova-app/www/index.html'), 'utf8');

describe('iOS 白顶页 overlays 后再钉 styleDefault（防黑底白字）', () => {
  it('requestShellStatusBar：白顶 darkIcons 在 overlays 后再次 styleDefault', () => {
    const start = auth.indexOf('function requestShellStatusBar');
    const end = auth.indexOf('function applyImmersiveBlueStatusBar');
    const fn = auth.slice(start, end);
    expect(fn).toContain('darkIcons && typeof sb.styleDefault');
    expect(fn).toContain('sb.styleDefault()');
    expect(fn).toContain('否则状态栏会落成黑底白字');
    /* overlays 后再钉：必须先处理 darkIcons→styleDefault，不能只钉 light */
    expect(fn).toMatch(
      /if \(wantOverlay && typeof sb\.overlaysWebView === 'function'\) \{[\s\S]*?if \(darkIcons && typeof sb\.styleDefault === 'function'\) \{[\s\S]*?sb\.styleDefault\(\)/
    );
  });

  it('Cordova 壳：白顶 styleDefault 在 overlays 后再次钉上', () => {
    expect(cordovaShell).toContain('否则收入纳税明细等白顶页会落成黑底白字');
    expect(cordovaShell).toContain('if (wantOverlay) {');
    expect(cordovaShell).toContain('if (styleDefault) {');
    expect(cordovaShell).toContain('StatusBar.styleDefault()');
    expect(cordovaShell).not.toContain('if (wantOverlay && !styleDefault)');
  });
});
