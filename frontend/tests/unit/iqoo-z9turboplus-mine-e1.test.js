import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');

const Z9TP_RE =
  /V2417A|V2417DA|PD2417\b|(?:iQOO|iqoo)?[\s_-]*Z9[\s_-]*Turbo[\s_-]*(?:\+|Plus)/i;

describe('iQOO Z9 Turbo+ mine e1 single-layer paint', () => {
  it('routes Z9 Turbo+ but not Z9 Turbo / Z9 / Z9x', () => {
    ['V2417A', 'V2417DA', 'PD2417', 'iQOO Z9 Turbo+', 'iQOO Z9 Turbo Plus', 'Z9 Turbo+'].forEach(
      (ua) => {
        expect(Z9TP_RE.test(ua), ua).toBe(true);
      }
    );
    ['V2352A', 'iQOO Z9 Turbo', 'Z9 Turbo', 'V2361A', 'iQOO Z9', 'V2353A', 'iQOO Z9x'].forEach(
      (ua) => {
        expect(Z9TP_RE.test(ua), ua).toBe(false);
      }
    );
    expect(mine).toContain('V2417A|V2417DA|PD2417\\b');
    expect(mine).toContain("classList.add('app-android-iqoo-z9turboplus')");
    expect(mine).toContain("classList.add('app-android-mine-e1-plainimg')");
  });

  it('detects Z9 Turbo+ in auth-boot before any @sm first-paint style is injected', () => {
    expect(boot).toContain('V2417A|V2417DA|PD2417\\b');
    const uaIdx = boot.indexOf('V2417A|V2417DA|PD2417');
    const smClassIdx = boot.indexOf("document.documentElement.classList.add('app-android-mine-e1-sm')");
    const smStyleIdx = boot.indexOf("st.id = 'androidMineSmFirstPaint'");
    expect(uaIdx).toBeGreaterThan(0);
    expect(smClassIdx).toBeGreaterThan(uaIdx);
    expect(smStyleIdx).toBeGreaterThan(uaIdx);
  });

  it('keeps Z9 Turbo+ mine-only so pin does not flip other pages to immersive white top', () => {
    expect(auth).toContain('function isIqooZ9TurboPlusClient()');
    expect(auth).toMatch(
      /function isMineE1PlainImgClient\(\)[\s\S]*isIqooZ9TurboPlusClient\(\)[\s\S]*currentPageName\(\) === 'mine\.html'/
    );
    const immersiveFn = auth.slice(
      auth.indexOf('function isVivoImmersiveTopClient()'),
      auth.indexOf('function isVivoImmersiveTopClient()') + 450
    );
    expect(immersiveFn).toContain('isVivoX90Client()');
    expect(immersiveFn).not.toContain('isIqooZ9TurboPlusClient');
    const z9MineIdx = mine.indexOf('app-android-iqoo-z9turboplus');
    const z9ImmersiveIdx = mine.indexOf(
      "classList.add('app-android-immersive-white-top')",
      z9MineIdx
    );
    const nextIfIdx = mine.indexOf('if (/PGP110', z9MineIdx);
    expect(z9MineIdx).toBeGreaterThan(0);
    expect(z9ImmersiveIdx === -1 || z9ImmersiveIdx > nextIfIdx).toBe(true);
  });

  it('first-paints the plainimg flags before auth-boot loads', () => {
    const bootTagIdx = mine.indexOf('/js/auth-boot.js?v=');
    expect(mine.indexOf("classList.add('app-android-iqoo-z9turboplus')")).toBeLessThan(bootTagIdx);
    expect(mine).toMatch(/auth-boot\.js\?v=2026091/);
    expect(mine).toMatch(/auth\.js\?v=2026091/);
  });
});
