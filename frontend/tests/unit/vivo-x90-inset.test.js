import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE = /V2241A|V2241EA|PD2241\b/i;
const NAME_RE = /(?:vivo[\s_-]*)?X90\b(?![\s_-]*(?:Pro|[sS]|Plus|\+))/i;
const FIRST_PAINT_RE = /V2241A|V2241EA|PD2241\b|(?:vivo[\s_-]*)?X90\b(?![\s_-]*(?:Pro|[sS]|Plus|\+))/i;

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const pages = {
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8'),
  mine: readFileSync(resolve(__dirname, '../../mine.html'), 'utf8')
};

describe('vivo X90 status-bar inset', () => {
  it('matches official model codes and marketing name', () => {
    ['V2241A', 'V2241EA', 'PD2241'].forEach((id) => {
      expect(MODEL_RE.test(id), id).toBe(true);
    });
    ['vivo X90', 'vivo_X90', 'X90'].forEach((name) => {
      expect(NAME_RE.test(name), name).toBe(true);
    });
  });

  it('does not treat X90 Pro / Pro+ / X90s as X90', () => {
    expect(NAME_RE.test('vivo X90 Pro')).toBe(false);
    expect(NAME_RE.test('X90 Pro+')).toBe(false);
    expect(NAME_RE.test('X90s')).toBe(false);
    expect(NAME_RE.test('vivo X90s')).toBe(false);
    expect(MODEL_RE.test('V2242A')).toBe(false);
    expect(MODEL_RE.test('V2227A')).toBe(false);
  });

  it('wires detector into immersive top and keeps 40px inset', () => {
    expect(auth).toContain('function isVivoX90Client()');
    expect(auth).toMatch(/isVivoImmersiveTopClient\(\)[\s\S]*isVivoX90Client\(\)/);
    expect(auth).toContain('app-android-vivo-x90');
    expect(auth).toContain(':not(.app-android-vivo-x90)');
    expect(auth).toMatch(/html\.app-android-vivo-x90\.app-top-safe-shell\{--app-shell-statusbar-top:40px/);
  });

  it('first-paints tax pages so 返回/申诉 is not under the status bar', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(FIRST_PAINT_RE.test(html), name).toBe(true);
      expect(html, name).toContain('app-android-vivo-x90');
      expect(html, name).toContain('app-android-immersive-white-top');
    });
    expect(pages.shuimingResult).toContain('data-vivox90-result-firstpaint');
  });
});
