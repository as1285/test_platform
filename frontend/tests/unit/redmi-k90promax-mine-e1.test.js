import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE = /25102RKBEC|25102RK69C|25102PCBEG/i;
const NAME_RE = /(?:Redmi|Xiaomi|REDMI)[\s_-]*K90[\s_-]*Pro[\s_-]*Max|POCO[\s_-]*F8[\s_-]*Ultra/i;

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');
const pages = {
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8')
};

describe('Redmi K90 Pro Max mine e1 layout lock', () => {
  it('matches official model codes and marketing name', () => {
    ['25102RKBEC', '25102RK69C', '25102PCBEG'].forEach((id) => {
      expect(MODEL_RE.test(id), id).toBe(true);
    });
    ['REDMI K90 Pro Max', 'Redmi K90 Pro Max', 'Xiaomi K90 Pro Max', 'POCO F8 Ultra'].forEach((name) => {
      expect(NAME_RE.test(name), name).toBe(true);
    });
  });

  it('does not treat bare K90 / K90 Ultra / K80 Pro as Pro Max', () => {
    expect(NAME_RE.test('REDMI K90')).toBe(false);
    expect(NAME_RE.test('Redmi K90 Ultra')).toBe(false);
    expect(NAME_RE.test('Redmi K90 Max')).toBe(false);
    expect(NAME_RE.test('REDMI K80 Pro')).toBe(false);
    expect(MODEL_RE.test('24122RKC7C')).toBe(false);
    expect(MODEL_RE.test('25060RK16C')).toBe(false);
  });

  it('wires detector into immersive top, plain-img mine, hyperOs exclude, and canvas lock', () => {
    expect(auth).toContain('function isRedmiK90ProMaxClient()');
    expect(auth).toContain('function k90ProMaxMineE1LockCss()');
    expect(auth).toContain('function pinK90ProMaxMineE1Layout()');
    expect(auth).toMatch(/isXiaomiImmersiveTopClient\(\)[\s\S]*isRedmiK90ProMaxClient\(\)/);
    expect(auth).toMatch(
      /function isHyperOs2MineE1SmClient\(\) \{[\s\S]{0,500}isRedmiK90ProMaxClient\(\)/
    );
    expect(auth).toMatch(
      /function isMineE1PlainImgClient\(\) \{[\s\S]{0,900}isRedmiK90ProMaxClient\(\)/
    );
    expect(auth).toContain('app-android-redmi-k90promax');
    expect(auth).toContain('aspect-ratio:1284 / 2127');
    expect(auth).toContain('data-k90promax-mine-e1-lock');
    expect(auth).toContain('25102RKBEC|25102RK69C|25102PCBEG');
  });

  it('first-paints true-ratio canvas + centered pills on mine and immersive on tax pages', () => {
    expect(mine).toContain('25102RKBEC');
    expect(mine).toContain('app-android-redmi-k90promax');
    expect(mine).toContain('app-android-mine-e1-plainimg');
    expect(mine).toContain('window.__mineE1PlainImg = true');
    expect(mine).toContain('k90proMaxMineFirstPaint');
    expect(mine).toContain('aspect-ratio:1284/2127');
    expect(mine).toMatch(
      /html\.app-android-redmi-k90promax body\.page-mine \.mine-e1-pill[\s\S]{0,200}inline-flex/
    );
    expect(mine).toMatch(
      /mine-e1-pill-family\{[^}]*left:calc\(135 \* var\(--mine-rpx\)\)/
    );
    expect(mine).toMatch(/auth-boot\.js\?v=20261010-k90promax-layout/);
    expect(mine).toMatch(/auth\.js\?v=20261010-mine-activate/);
    expect(boot).toContain('25102RKBEC|25102RK69C|25102PCBEG');
    expect(boot).toContain('app-android-redmi-k90promax');
    expect(boot).toContain("cl.add('app-android-mine-e1-plainimg')");
    expect(boot).toContain('k90proMaxMineFirstPaint');
    Object.entries(pages).forEach(([name, html]) => {
      expect(html, name).toContain('25102RKBEC');
      expect(html, name).toContain('app-android-redmi-k90promax');
      expect(html, name).toContain('app-android-immersive-white-top');
    });
  });
});
