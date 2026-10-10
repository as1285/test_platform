import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE = /PGP110|CPH2413|CPH2415|CPH2417|(?:OnePlus|一加)[\s_-]*Ace[\s_-]*Pro(?![\s_-]*2)/i;
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const pages = {
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8')
};

describe('一加 Ace Pro status-bar inset', () => {
  it('matches Ace Pro model codes and not Ace 2 Pro', () => {
    ['PGP110', 'CPH2413', 'CPH2415', 'CPH2417', 'OnePlus Ace Pro', '一加 Ace Pro'].forEach((model) => {
      expect(MODEL_RE.test(model), model).toBe(true);
    });
    expect(MODEL_RE.test('OnePlus Ace 2 Pro')).toBe(false);
    expect(MODEL_RE.test('一加 Ace 2 Pro')).toBe(false);
    expect(MODEL_RE.test('PJA110')).toBe(false);
  });

  it('keeps ColorOS immersive 40px instead of OPPO outer-bar zero inset', () => {
    expect(auth).toContain('function isOnePlusAceProClient()');
    expect(auth).toContain('app-android-oneplus-acepro');
    expect(auth).toContain('isOnePlusAceProClient()');
    expect(auth).toContain(':not(.app-android-oneplus-acepro)');
    expect(auth).toMatch(/isOnePlusAce2ImmersiveTopClient\(\)[\s\S]*isOnePlusAceProClient\(\)/);
  });

  it('first-paints income detail pages below the system status bar', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(MODEL_RE.test(html), name).toBe(true);
      expect(html, name).toContain('app-android-oneplus-acepro');
      expect(html, name).toContain('app-android-immersive-white-top');
      expect(html, name).toContain("'--app-shell-statusbar-top', '40px'");
    });
    expect(pages.shuimingResult).toContain('data-oneplus-acepro-result-firstpaint');
    expect(pages.shuimingResult).toContain(
      'html.app-android-oneplus-acepro body.page-shuiming-result .top-fixed .header'
    );
    expect(pages.shuimingResult).toContain(
      'html.app-android-oneplus-acepro body.page-shuiming-result .top-fixed .header .header-title'
    );
    expect(pages.shuimingResult).toContain('-webkit-text-fill-color:#000');
    expect(pages.shuimingResult).toContain('align-items:flex-end');
    expect(pages.shuimingResult).toContain(
      'html.app-android-oneplus-acepro body.page-shuiming-result .list{margin-top:calc(var(--header-height,48px) + 40px)'
    );
    expect(pages.shuimingResult).toContain("classList.contains('app-android-oneplus-acepro')");
    expect(pages.shuimingResult).toContain("setProperty('z-index', '140'");
    expect(pages.shuimingResult).toContain('auth-boot.js?v=20260918-acepro-top');
    expect(boot).toContain('data-oneplus-acepro-result-firstpaint');
    expect(boot).toContain('Ace Pro（PGP110）');
  });
});
