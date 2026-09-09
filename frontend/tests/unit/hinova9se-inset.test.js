import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE = /FIO-BD00|PHB-AN00|Hi\s*nova[\s_-]*9[\s_-]*SE|hinova[\s_-]*9[\s_-]*se/i;
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const pages = {
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8')
};

describe('Hi nova 9 SE status-bar inset', () => {
  it('matches both retail and firmware model identifiers', () => {
    ['FIO-BD00', 'PHB-AN00', 'Hi nova 9 SE', 'hinova9se'].forEach((model) => {
      expect(MODEL_RE.test(model), model).toBe(true);
    });
    expect(MODEL_RE.test('Hi nova 11')).toBe(false);
  });

  it('overrides the generic Hi nova outer-bar rule with a 40px immersive inset', () => {
    expect(auth).toContain('function isHiNova9SeClient()');
    expect(auth).toContain('app-android-hinova9se');
    expect(auth).toMatch(/isHiNova9SeClient\(\)[\s\S]*app-android-immersive-white-top/);
    expect(auth).toContain("'--app-shell-statusbar-top', '40px'");
  });

  it('first-paints all income detail pages below the system status bar', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(MODEL_RE.test(html), name).toBe(true);
      expect(html, name).toContain('app-android-hinova9se');
      expect(html, name).toContain('app-android-immersive-white-top');
      expect(html, name).toContain("'--app-shell-statusbar-top', '40px'");
    });
    expect(pages.shuiming).toContain('data-hinova9se-shuiming-firstpaint');
    expect(pages.shuiming).toContain(
      'html.app-android-hinova9se body.page-shuiming > .header'
    );
    expect(pages.shuimingResult).toContain('data-hinova9se-result-firstpaint');
    expect(pages.shuimingResult).toContain(
      'html.app-android-hinova9se body.page-shuiming-result .top-fixed .header'
    );
    expect(pages.shuimingResult).toContain(
      'margin-top:calc(var(--header-height,48px) + 40px)'
    );
  });

  it('keeps immersive 40px on white pages instead of the global outer black-bar zero', () => {
    const start = auth.indexOf('function applyImmersiveNotchWhitePageChrome');
    const end = auth.indexOf('function isInsideTabShellEmbed');
    const fn = auth.slice(start, end);
    expect(fn).toContain('isHiNova9SeClient()');
    expect(fn).toContain('app-android-immersive-white-top');
    expect(fn).toContain("overlays: true");
    expect(fn).toContain("'--app-shell-statusbar-top', '40px'");
    const syncIdx = auth.indexOf('function syncAppShellStatusbarTop()');
    const syncFn = auth.slice(syncIdx, auth.indexOf('function requestShellStatusBar'));
    expect(syncFn).toContain('isHiNova9SeClient()');
    expect(syncFn).toContain("'--app-shell-statusbar-top', '40px'");
  });
});
