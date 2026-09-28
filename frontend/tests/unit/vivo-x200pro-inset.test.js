import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE = /V2405A|V2405DA|V2413\b|V2419A|V2419DA|PD2419[A-Z]?|\bV2419\b/i;
const NAME_RE = /(?:vivo[\s_-]*)?X200[\s_-]*Pro/i;
const FIRST_PAINT_RE =
  /V2405A|V2405DA|V2413\b|V2419A|V2419DA|PD2419[A-Z]?|\bV2419\b|(?:vivo[\s_-]*)?X200[\s_-]*Pro/i;

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const pages = {
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8'),
  mine: readFileSync(resolve(__dirname, '../../mine.html'), 'utf8')
};

describe('vivo X200 Pro / mini status-bar inset', () => {
  it('matches official model codes and marketing name', () => {
    ['V2419A', 'V2419DA', 'V2419', 'PD2419', 'PD2419A', 'V2405A', 'V2413'].forEach((id) => {
      expect(MODEL_RE.test(id), id).toBe(true);
    });
    ['X200 Pro mini', 'vivo X200 Pro mini', 'X200_Pro_Mini', 'vivo X200 Pro'].forEach((name) => {
      expect(NAME_RE.test(name), name).toBe(true);
    });
  });

  it('does not treat X200 (non-Pro) as Pro/mini', () => {
    expect(NAME_RE.test('X200')).toBe(false);
    expect(NAME_RE.test('vivo X200')).toBe(false);
    expect(MODEL_RE.test('V2415A')).toBe(false);
  });

  it('wires detector into immersive top and keeps 40px inset', () => {
    expect(auth).toContain('function isVivoX200ProLikeClient()');
    expect(auth).toMatch(/isVivoImmersiveTopClient\(\)[\s\S]*isVivoX200ProLikeClient\(\)/);
    expect(auth).toContain('app-android-vivo-x200pro');
    expect(auth).toContain(':not(.app-android-vivo-x200pro)');
    expect(auth).toMatch(/html\.app-android-vivo-x200pro\.app-top-safe-shell\{--app-shell-statusbar-top:40px/);
  });

  it('first-paints tax pages so 返回/批量申诉 is not under the system clock', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(FIRST_PAINT_RE.test(html), name).toBe(true);
      expect(html, name).toContain('app-android-vivo-x200pro');
      expect(html, name).toContain('app-android-immersive-white-top');
    });
    expect(pages.shuimingResult).toContain('data-vivox200pro-result-firstpaint');
  });
});
