import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE = /23116PN5|23116PN\b/i;
const NAME_RE = /(?:Xiaomi|Mi|小米)[\s_-]*14[\s_-]*Pro(?!\s*Max)/i;

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');
const mineV2 = readFileSync(resolve(__dirname, '../../mine_v2.html'), 'utf8');

describe('Xiaomi 14 Pro mine e1 lock', () => {
  it('matches 14 Pro model codes and marketing name', () => {
    ['23116PN5BC', '23116PN5BG', '23116PN5CG', '23116PN'].forEach((id) => {
      expect(MODEL_RE.test(id), id).toBe(true);
    });
    ['Xiaomi 14 Pro', 'Mi 14 Pro', '小米14 Pro', '小米_14_Pro'].forEach((name) => {
      expect(NAME_RE.test(name), name).toBe(true);
    });
  });

  it('does not treat Xiaomi 14 or 14 Pro Max as 14 Pro', () => {
    expect(NAME_RE.test('Xiaomi 14')).toBe(false);
    expect(NAME_RE.test('Xiaomi 14 Pro Max')).toBe(false);
    expect(MODEL_RE.test('23127PN0CC')).toBe(false);
  });

  it('auth.js locks mine e1 for HyperOS 2 including Xiaomi 15', () => {
    expect(auth).toContain('function isXiaomi14ProClient()');
    expect(auth).toContain('function isXiaomi15Client()');
    expect(auth).toContain('HYPEROS2_MINE_E1_SM_CLASSES');
    expect(auth).toContain('app-android-xiaomi-15');
    expect(auth).toContain('function xiaomi14ProMineE1LockCss()');
    expect(auth).toContain('function pinXiaomi14ProMineE1Layout()');
    expect(auth).toContain('function paintXiaomi14ProMineE1');
    expect(auth).toContain('xiaomi14pro-mine-e1-paint');
    expect(auth).toContain(':not(.app-android-xiaomi-14pro):not(.app-android-xiaomi-15)');
    expect(auth).toContain('overflow:visible !important');
    expect(auth).toContain('data-xiaomi14pro-mine-e1-lock');
    expect(auth).toContain('opacity:0 !important');
    expect(auth).toContain('background-size:100% 100% !important');
  });

  it('mine pages first-paint the lock so HyperOS 2 does not flash a blue empty card', () => {
    [mine, mineV2].forEach((html) => {
      expect(html).toContain('app-android-xiaomi-14pro');
      expect(html).toContain('app-android-xiaomi-15');
      expect(html).toContain('data-xiaomi14pro-mine-firstpaint');
      expect(html).toContain('data-xiaomi15-mine-firstpaint');
      expect(html).toContain('data-xiaomi14pro-mine-e1-paint');
      expect(html).toContain('23116PN5');
      expect(html).toContain('24129PN74');
      expect(html).toContain('overflow:visible!important');
      expect(html).toContain('e1_01@sm.png');
      expect(html).toContain('opacity:0!important');
      expect(html).toContain('aspect-ratio:1284/2127');
      expect(html).toContain('html.app-android-mi-family:not(.app-android-xiaomi-14pro) body.page-mine');
    });
  });

  it('mine pages self-heal the big e1 image (corrupt cache / decode fail)', () => {
    [mine, mineV2].forEach((html) => {
      expect(html).toContain('data-mine-e1-selfheal');
      expect(html).toContain('@sm.png');
      expect(html).toContain('__mineE1ForceSm');
      expect(html).toContain('?v=20260827-e1r3');
      expect(html).toMatch(/auth-boot\.js\?v=2026090/);
      expect(html).toMatch(/auth\.js\?v=2026090/);
      expect(html).not.toContain('20260802-e1fix');
    });
  });
});
