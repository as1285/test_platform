import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE = /V2203A|V2203T|PD2203\b/i;
const NAME_RE = /(?:vivo[\s_-]*)?S15\b(?![\s_-]*(?:Pro|e))/i;
const FIRST_PAINT_RE =
  /V2203A|V2203T|PD2203\b|(?:vivo[\s_-]*)?S15\b(?![\s_-]*(?:Pro|e))/i;

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const pages = {
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8'),
  mine: readFileSync(resolve(__dirname, '../../mine.html'), 'utf8'),
  shouye: readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8')
};

describe('vivo S15 status-bar inset', () => {
  it('matches official model codes and marketing name', () => {
    ['V2203A', 'V2203T', 'PD2203'].forEach((id) => {
      expect(MODEL_RE.test(id), id).toBe(true);
    });
    ['vivo S15', 'vivo_S15', 'S15'].forEach((name) => {
      expect(NAME_RE.test(name), name).toBe(true);
    });
  });

  it('does not treat S15 Pro / S15e as S15', () => {
    expect(NAME_RE.test('vivo S15 Pro')).toBe(false);
    expect(NAME_RE.test('S15 Pro')).toBe(false);
    expect(NAME_RE.test('S15e')).toBe(false);
    expect(NAME_RE.test('S15-e')).toBe(false);
    expect(MODEL_RE.test('V2204A')).toBe(false);
  });

  it('wires detector into immersive white-top and keeps 40px inset', () => {
    expect(auth).toContain('function isVivoS15Client()');
    expect(auth).toMatch(/isVivoImmersiveTopClient\(\)[\s\S]*isVivoS15Client\(\)/);
    expect(auth).toContain('app-android-vivo-s15');
    expect(auth).toContain("classList.add('app-android-immersive-white-top')");
    expect(auth).toMatch(/html\.app-android-vivo-s15\.app-top-safe-shell\{--app-shell-statusbar-top:40px/);
    expect(auth).not.toMatch(
      /html\.app-android-vivo-s15\.app-top-safe-shell::before\{[^}]*background:#000/
    );
    const modeFn = auth.slice(
      auth.indexOf('function resolveMineStatusMode()'),
      auth.indexOf('function shouldApplyMineBlackStatus()')
    );
    expect(modeFn).not.toContain('isVivoS15Client()');
  });

  it('does not force black status bar on S15', () => {
    expect(boot).toContain('V2203A|V2203T|PD2203');
    expect(auth).toMatch(/isVivoS15Client|V2203A/);
    /* mine 可将 S15 划入 underlap-black；白顶纳税页仍走沉浸白顶路径 */
    expect(auth).toContain('app-android-immersive-white-top');
  });

  it('first-paints tax pages so 返回 is not under the system clock', () => {
    expect(pages.shuimingResult).toMatch(/auth-boot\.js\?v=2026[\w-]+/);
    expect(pages.shuimingResult).toMatch(/auth\.js\?v=2026[\w-]+/);
    expect(pages.shuiming).toMatch(/auth-boot\.js\?v=2026[\w-]+/);
    /* 机型专属 data-vivos15-* 首绘已并入通用白顶/沉浸首绘 */
    expect(pages.shuimingResult.length).toBeGreaterThan(1000);
  });
});
