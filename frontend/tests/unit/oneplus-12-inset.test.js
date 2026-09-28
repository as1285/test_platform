import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE = /PJD110|CPH2573|CPH2581|CPH2583|(?:OnePlus|一加)[\s_-]*12(?![\s_-]*R)(?![A-Za-z0-9])/i;
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const pages = {
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8')
};

describe('一加 12 status-bar inset', () => {
  it('matches 12 model codes and not 12R', () => {
    ['PJD110', 'CPH2573', 'CPH2581', 'CPH2583', 'OnePlus 12', '一加 12'].forEach((model) => {
      expect(MODEL_RE.test(model), model).toBe(true);
    });
    expect(MODEL_RE.test('OnePlus 12R')).toBe(false);
    expect(MODEL_RE.test('一加 12R')).toBe(false);
    expect(MODEL_RE.test('PJF110')).toBe(false);
    expect(MODEL_RE.test('OnePlus 13')).toBe(false);
  });

  it('keeps ColorOS immersive 40px instead of OPPO outer-bar zero inset', () => {
    expect(auth).toContain('function isOnePlus12Client()');
    expect(auth).toContain('app-android-oneplus-12');
    expect(auth).toContain('isOnePlus12Client()');
    expect(auth).toContain(':not(.app-android-oneplus-12)');
    expect(auth).toMatch(/isOnePlusAce2ImmersiveTopClient\(\)[\s\S]*isOnePlus12Client\(\)/);
  });

  it('first-paints income detail pages below the system status bar', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(MODEL_RE.test(html), name).toBe(true);
      expect(html, name).toContain('app-android-oneplus-12');
      expect(html, name).toContain('app-android-immersive-white-top');
      expect(html, name).toContain("'--app-shell-statusbar-top', '40px'");
    });
    expect(pages.shuimingResult).toContain('data-oneplus-12-result-firstpaint');
    expect(pages.shuimingResult).toContain(
      'html.app-android-oneplus-12 body.page-shuiming-result .top-fixed .header'
    );
    expect(pages.shuimingResult).toContain(
      'html.app-android-oneplus-12 body.page-shuiming-result .list{margin-top:calc(var(--header-height,48px) + 40px)'
    );
  });
});
