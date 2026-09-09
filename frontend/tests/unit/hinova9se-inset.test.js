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

  it('still recognizes the model and keeps 40px inset vars', () => {
    expect(auth).toContain('function isHiNova9SeClient()');
    expect(auth).toContain('app-android-hinova9se');
    expect(auth).toMatch(/isHiNova9SeClient\(\)[\s\S]*app-android-immersive-white-top/);
    expect(auth).toContain("'--app-shell-statusbar-top', '40px'");
  });

  it('first-paints income pages with black-pad-aligned header inset', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(MODEL_RE.test(html), name).toBe(true);
      expect(html, name).toContain('app-android-hinova9se');
      expect(html, name).toContain('app-android-immersive-white-top');
      expect(html, name).toContain("'--app-shell-statusbar-top', '40px'");
    });
    expect(pages.shuiming).toContain('data-hinova9se-shuiming-firstpaint');
    expect(pages.shuiming).toContain('padding-top:calc(12px + 40px)');
    expect(pages.shuimingResult).toContain('data-hinova9se-result-firstpaint');
    expect(pages.shuimingResult).toContain(
      'html.app-android-hinova9se body.page-shuiming-result .top-fixed .header'
    );
  });

  it('white pages use black pad + light icons (no dark-icon exception)', () => {
    const start = auth.indexOf('function applyImmersiveNotchWhitePageChrome');
    const end = auth.indexOf('function isInsideTabShellEmbed');
    const fn = auth.slice(start, end);
    expect(fn).toContain('ensureAndroidFixedBlackStatusPad');
    expect(fn).toContain("style: 'light'");
    expect(fn).toContain("color: '#000000'");
    expect(fn).not.toContain("style: 'dark'");
    const padStart = auth.indexOf('function ensureAndroidFixedBlackStatusPad');
    const padFn = auth.slice(padStart, padStart + 2500);
    expect(padFn).toContain('body.page-shuiming > .header');
    expect(padFn).toContain('calc(12px + var(--app-shell-statusbar-top,40px))');
  });
});
