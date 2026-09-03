import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE = /V2527A|V2527DA|V2527B|PD2527[A-Z]?|\bV2527\b/i;
const NAME_RE = /(?:vivo[\s_-]*)?S50[\s_-]*Pro[\s_-]*[Mm]ini|S50Promini/i;
const FIRST_PAINT_RE =
  /V2527A|V2527DA|V2527B|PD2527[A-Z]?|\bV2527\b|(?:vivo[\s_-]*)?S50[\s_-]*Pro[\s_-]*[Mm]ini|S50Promini/i;

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const pages = {
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8'),
  mine: readFileSync(resolve(__dirname, '../../mine.html'), 'utf8')
};

describe('vivo S50 Pro mini status-bar inset', () => {
  it('matches official model codes and marketing name', () => {
    ['V2527A', 'V2527DA', 'V2527B', 'PD2527', 'PD2527A', 'V2527'].forEach((id) => {
      expect(MODEL_RE.test(id), id).toBe(true);
    });
    ['S50 Pro mini', 'vivo S50 Pro mini', 'S50_Pro_Mini', 'S50Promini'].forEach((name) => {
      expect(NAME_RE.test(name), name).toBe(true);
    });
  });

  it('does not treat S50 / S50 Pro as mini', () => {
    expect(NAME_RE.test('S50')).toBe(false);
    expect(NAME_RE.test('vivo S50')).toBe(false);
    expect(NAME_RE.test('S50 Pro')).toBe(false);
    expect(NAME_RE.test('vivo S50 Pro')).toBe(false);
    expect(MODEL_RE.test('V2502A')).toBe(false);
  });

  it('wires detector into immersive top and keeps 40px inset', () => {
    expect(auth).toContain('function isVivoS50ProMiniClient()');
    expect(auth).toMatch(/isVivoImmersiveTopClient\(\)[\s\S]*isVivoS50ProMiniClient\(\)/);
    expect(auth).toContain('app-android-vivo-s50promini');
    expect(auth).toContain(':not(.app-android-vivo-s50promini)');
    expect(auth).toMatch(
      /html\.app-android-vivo-s50promini\.app-top-safe-shell(?:[^{]|,)*\{[^}]*--app-shell-statusbar-top:40px/
    );
  });

  it('first-paints tax pages so 返回 is not under the system clock', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(FIRST_PAINT_RE.test(html), name).toBe(true);
      expect(html, name).toContain('app-android-vivo-s50promini');
      expect(html, name).toContain('app-android-immersive-white-top');
    });
  });
});
