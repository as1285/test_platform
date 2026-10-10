import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE = /24122RKC7[CG]|24127RK2CC/i;
const NAME_RE = /(?:Redmi|Xiaomi|REDMI)[\s_-]*K80[\s_-]*Pro|POCO[\s_-]*F7[\s_-]*Ultra/i;
const FIRST_PAINT_RE =
  /24122RKC7[CG]|24127RK2CC|(?:Redmi|Xiaomi|REDMI)[\s_-]*K80[\s_-]*Pro|POCO[\s_-]*F7[\s_-]*Ultra/i;

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const pages = {
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8'),
  mine: readFileSync(resolve(__dirname, '../../mine.html'), 'utf8')
};

describe('Redmi K80 Pro status-bar inset', () => {
  it('matches official model codes and marketing name', () => {
    ['24122RKC7C', '24122RKC7G', '24127RK2CC'].forEach((id) => {
      expect(MODEL_RE.test(id), id).toBe(true);
    });
    ['REDMI K80 Pro', 'Redmi K80 Pro', 'Xiaomi K80 Pro', 'POCO F7 Ultra'].forEach((name) => {
      expect(NAME_RE.test(name), name).toBe(true);
    });
  });

  it('does not treat K80 / K80 Ultra / K70 as Pro', () => {
    expect(NAME_RE.test('REDMI K80')).toBe(false);
    expect(NAME_RE.test('Redmi K80 Ultra')).toBe(false);
    expect(NAME_RE.test('25060RK16C')).toBe(false);
    expect(MODEL_RE.test('23113RKC6C')).toBe(false);
    expect(MODEL_RE.test('24117RK2CC')).toBe(false);
  });

  it('wires detector into immersive top and keeps 40px inset', () => {
    expect(auth).toContain('function isRedmiK80ProClient()');
    expect(auth).toMatch(/isXiaomiImmersiveTopClient\(\)[\s\S]*isRedmiK80ProClient\(\)/);
    expect(auth).toContain('app-android-redmi-k80pro');
    expect(auth).toMatch(
      /html\.app-android-redmi-k80pro\.app-top-safe-shell\{--app-shell-statusbar-top:40px/
    );
    expect(auth).toContain('isRedmiK80ProClient() ||');
    expect(auth).toContain('K80 Pro 同分辨率，须先排除');
  });

  it('first-paints tax pages so 返回 is not under the system clock', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(FIRST_PAINT_RE.test(html), name).toBe(true);
      expect(html, name).toContain('app-android-redmi-k80pro');
      expect(html, name).toContain('app-android-immersive-white-top');
    });
  });
});
