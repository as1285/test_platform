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
const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');

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

  it('white pages restore Sept-1 chrome (no unified FixedBlack pad)', () => {
    const start = auth.indexOf('function applyImmersiveNotchWhitePageChrome');
    const end = auth.indexOf('function isInsideTabShellEmbed');
    const fn = auth.slice(start, end);
    expect(fn).not.toContain('ensureAndroidFixedBlackStatusPad');
    expect(fn).toContain("style: 'dark'");
    expect(fn).toContain('immersiveTopInsetClient');
  });

  it('mine page keeps e1 layout lock without unified 40px black status pad', () => {
    expect(auth).toMatch(/plainImg \|\| acepro \|\| hinova9se \? 'important'/);
    expect(auth).toContain('function hinova9SeMineE1LockCss');
    expect(auth).toContain('function pinHinova9SeMineE1Layout');
    expect(auth).not.toContain('ensureAndroidFixedBlackStatusPad');
    expect(mine).toContain('data-hinova9se-mine-firstpaint');
    expect(mine).toContain('aspect-ratio: 1284 / 2127');
    expect(mine).toMatch(/--mine-top-bleed:\s*0px\s*!important/);
  });
});
