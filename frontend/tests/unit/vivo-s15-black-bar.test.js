import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE = /V2203A|V2203T|PD2203\b/i;
const NAME_RE = /(?:vivo[\s_-]*)?S15\b(?![\s_-]*(?:Pro|e))/i;

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');
const shouye = readFileSync(resolve(__dirname, '../../shouye.html'), 'utf8');
const pages = {
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8'),
  message: readFileSync(resolve(__dirname, '../../message.html'), 'utf8'),
  daiban: readFileSync(resolve(__dirname, '../../daiban.html'), 'utf8'),
  bancha: readFileSync(resolve(__dirname, '../../bancha.html'), 'utf8')
};

describe('vivo S15 OriginOS 4 official black status bar', () => {
  it('matches S15 model codes and not S15 Pro / S15e', () => {
    ['V2203A', 'V2203T', 'PD2203', 'vivo S15', 'S15'].forEach((id) => {
      expect(MODEL_RE.test(id) || NAME_RE.test(id), id).toBe(true);
    });
    expect(NAME_RE.test('vivo S15 Pro')).toBe(false);
    expect(NAME_RE.test('S15e')).toBe(false);
    expect(MODEL_RE.test('V2207A')).toBe(false);
    expect(MODEL_RE.test('V2190A')).toBe(false);
  });

  it('detects S15 and paints a 40px black pad instead of vivo-family inset 0', () => {
    expect(auth).toContain('function isVivoS15Client()');
    expect(auth).toContain('V2203A');
    expect(auth).toContain('app-android-vivo-s15');
    expect(auth).toContain(':not(.app-android-vivo-s15)');
    expect(auth).toContain('if (isVivoS15Client())');
    expect(auth).toMatch(
      /html\.app-android-vivo-s15\.app-top-safe-shell\{--app-shell-statusbar-top:40px/
    );
    expect(auth).toContain(
      'html.app-android-vivo-s15.app-top-safe-shell::before{content:"" !important;position:fixed'
    );
    expect(auth).toContain('background:#000 !important;z-index:2147483000');
    const start = auth.indexOf('function applyImmersiveBlueStatusBar');
    const end = auth.indexOf('function applyMinePageChrome');
    expect(start).toBeGreaterThan(0);
    const fn = auth.slice(start, end);
    expect(fn).toContain('isVivoS15Client()');
    expect(fn).toContain("color: '#000000'");
    expect(fn).toContain('overlays: false');
  });

  it('「我的」走 underlap-black，首屏即打黑垫', () => {
    expect(auth).toContain('isVivoS15Client()');
    expect(boot).toContain('V2203A');
    expect(boot).toContain("return 'underlap-black'");
    expect(mine).toContain('var s15 =');
    expect(mine).toContain('V2203A');
    expect(mine).toContain("classList.add('app-android-vivo-s15')");
    expect(mine).toContain("classList.add('app-mine-black-status')");
    expect(mine).toContain('auth.js?v=20260914-s15-black');
    expect(mine).toContain('auth-boot.js?v=20260916-android-pages');
  });

  it('首页首屏把搜索蓝顶改成黑框', () => {
    expect(shouye).toContain('app-android-vivo-s15');
    expect(shouye).toContain('data-vivos15-black-firstpaint');
    expect(shouye).toContain('html.app-android-vivo-s15.app-top-safe-shell body.page-shouye::before');
    expect(shouye).toContain('background-color: #000 !important');
    expect(shouye).toContain('auth.js?v=20260914-s15-black');
  });

  it('first-paints the other tab and tax pages', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(html, name).toContain('app-android-vivo-s15');
      expect(html, name).toContain('V2203A');
    });
  });
});
