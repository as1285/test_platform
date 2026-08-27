import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODEL_RE = /TAS-AL00|TAS-AN00|TAS-TL00|TAS-L29|TAS-LX9|TAS-AL\d{2}|TAS-AN\d{2}|HUAWEITAS/i;
const NAME_RE = /(?:Huawei|HUAWEI|华为)?[\s_-]*Mate[\s_-]*30(?![\s_-]*Pro)/i;
const PRO_EXCLUDE_RE = /LIO-|Mate\s*30\s*Pro/i;
const FIRST_PAINT_RE =
  /TAS-AL00|TAS-AN00|TAS-TL00|TAS-L29|TAS-LX9|TAS-AL\d{2}|TAS-AN\d{2}|HUAWEITAS|(?:Huawei|HUAWEI|华为)?[\s_-]*Mate[\s_-]*30(?![\s_-]*Pro)/i;

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const pages = {
  shuiming: readFileSync(resolve(__dirname, '../../shuiming.html'), 'utf8'),
  shuimingResult: readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8'),
  xiangqing: readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8')
};

describe('Huawei Mate 30 status-bar inset', () => {
  it('matches official model codes and marketing name', () => {
    ['TAS-AL00', 'TAS-AN00', 'TAS-TL00', 'TAS-L29', 'TAS-LX9', 'HUAWEITAS'].forEach((id) => {
      expect(MODEL_RE.test(id), id).toBe(true);
    });
    ['Mate 30', 'HUAWEI Mate 30', '华为Mate 30', 'Mate_30'].forEach((name) => {
      expect(NAME_RE.test(name), name).toBe(true);
    });
  });

  it('does not treat Mate 30 Pro / LIO as Mate 30', () => {
    expect(NAME_RE.test('Mate 30 Pro')).toBe(false);
    expect(NAME_RE.test('HUAWEI Mate 30 Pro')).toBe(false);
    expect(PRO_EXCLUDE_RE.test('LIO-AN00')).toBe(true);
    expect(PRO_EXCLUDE_RE.test('Mate 30 Pro')).toBe(true);
    expect(MODEL_RE.test('ALN-AL00')).toBe(false);
    expect(MODEL_RE.test('PLA-AL10')).toBe(false);
  });

  it('wires detector into immersive white-top and keeps 40px inset', () => {
    expect(auth).toContain('function isHuaweiMate30Client()');
    expect(auth).toMatch(/isHuaweiWhitePageImmersiveClient\(\)[\s\S]*isHuaweiMate30Client\(\)/);
    expect(auth).toContain('app-android-huawei-mate30');
    expect(auth).toContain(':not(.app-android-huawei-mate30)');
    expect(auth).toMatch(
      /html\.app-android-huawei-mate30\.app-android-immersive-white-top\.app-top-safe-shell/
    );
  });

  it('first-paints tax pages so 收入纳税明细 is not under the system clock', () => {
    Object.entries(pages).forEach(([name, html]) => {
      expect(FIRST_PAINT_RE.test(html), name).toBe(true);
      expect(html, name).toContain('app-android-huawei-mate30');
      expect(html, name).toContain('app-android-immersive-white-top');
    });
    expect(pages.shuimingResult).toContain('data-mate30-result-firstpaint');
    expect(pages.shuimingResult).toMatch(
      /\.header-title\{[^}]*visibility:visible !important/
    );
  });
});
