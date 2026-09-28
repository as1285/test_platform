import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE = /SM-S918|Galaxy\s*S23\s*Ultra|S23[\s_-]*Ultra/i;
const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const pages = {
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8')
};

describe('三星 S23 Ultra status-bar inset', () => {
  it('matches S23 Ultra model codes and not S23 / S23+ / S24 Ultra', () => {
    ['SM-S9180', 'SM-S918B', 'SM-S918U', 'Galaxy S23 Ultra', 'S23 Ultra', 'S23ULTRA', 'S23_Ultra'].forEach(
      (model) => {
        expect(MODEL_RE.test(model), model).toBe(true);
      }
    );
    expect(MODEL_RE.test('SM-S9110')).toBe(false);
    expect(MODEL_RE.test('SM-S9160')).toBe(false);
    expect(MODEL_RE.test('SM-S9280')).toBe(false);
    expect(MODEL_RE.test('Galaxy S24 Ultra')).toBe(false);
    expect(MODEL_RE.test('Galaxy S23')).toBe(false);
  });

  it('keeps One UI immersive 40px instead of Samsung outer-bar zero inset', () => {
    expect(auth).toContain('function isSamsungS23UltraClient()');
    expect(auth).toContain('app-android-samsung-s23u');
    expect(auth).toContain('isSamsungS23UltraClient()');
    expect(auth).toMatch(
      /isSamsungOneUiFamilyClient\(\)\s*&&\s*!isSamsungS23UltraClient\(\)/
    );
    expect(auth).toMatch(/immersiveTopInsetClient[\s\S]*isSamsungS23UltraClient\(\)/);
    expect(auth).toContain("samsungS23UltraClient");
  });

  it('does not skip S23 Ultra in auth-boot white-page first-paint', () => {
    const start = boot.indexOf('function applyAndroidWhitePageInsetFirstPaint');
    expect(start).toBeGreaterThan(0);
    const fn = boot.slice(start, start + 2800);
    expect(fn).toContain('samsungOuterBar');
    expect(fn).toContain('SM-S918');
    expect(fn).toMatch(/S23\[\\s_-\]\*Ultra/);
  });

  it('first-paints income detail pages below the system status bar', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(MODEL_RE.test(html), name).toBe(true);
      expect(html, name).toContain('app-android-samsung-s23u');
      expect(html, name).toContain('app-android-immersive-white-top');
      expect(html, name).toContain("'--app-shell-statusbar-top', '40px'");
    });
    expect(pages.shuimingResult).toContain('data-samsung-s23u-result-firstpaint');
    expect(pages.shuimingResult).toContain(
      'html.app-android-samsung-s23u body.page-shuiming-result .top-fixed .header'
    );
    expect(pages.shuimingResult).toContain(
      'margin-top:calc(var(--header-height,48px) + 40px)'
    );
  });
});
