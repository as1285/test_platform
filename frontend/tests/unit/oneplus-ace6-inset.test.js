import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE = /PLQ110|(?:OnePlus|一加)[\s_-]*Ace[\s_-]*6(?![\s_-]*Pro)(?!\d)/i;
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const pages = {
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8')
};

describe('一加 Ace 6 status-bar inset', () => {
  it('matches Ace 6 model codes and not Ace 6 Pro', () => {
    ['PLQ110', 'OnePlus Ace 6', '一加 Ace 6', 'OnePlus Ace6'].forEach((model) => {
      expect(MODEL_RE.test(model), model).toBe(true);
    });
    expect(MODEL_RE.test('OnePlus Ace 6 Pro')).toBe(false);
    expect(MODEL_RE.test('PJA110')).toBe(false);
  });

  it('keeps ColorOS immersive 40px instead of OPPO outer-bar zero inset', () => {
    expect(auth).toContain('function isOnePlusAce6Client()');
    expect(auth).toContain('app-android-oneplus-ace6');
    expect(auth).toContain('isOnePlusAce6Client()');
    expect(auth).toContain(':not(.app-android-oneplus-ace6)');
    expect(auth).toMatch(/isOnePlusAce2ImmersiveTopClient\(\)[\s\S]*isOnePlusAce6Client\(\)/);
  });

  it('first-paints income detail pages below the system status bar', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(MODEL_RE.test(html), name).toBe(true);
      expect(html, name).toContain('app-android-oneplus-ace6');
      expect(html, name).toContain('app-android-immersive-white-top');
      expect(html, name).toContain("'--app-shell-statusbar-top', '40px'");
    });
    expect(pages.shuimingResult).toContain('data-oneplus-ace6-result-firstpaint');
    expect(pages.shuimingResult).toContain(
      'html.app-android-oneplus-ace6 body.page-shuiming-result .top-fixed .header'
    );
    expect(pages.shuimingResult).toContain(
      'margin-top:calc(var(--header-height,48px) + 40px)'
    );
  });
});
