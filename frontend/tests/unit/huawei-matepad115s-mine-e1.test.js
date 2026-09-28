import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');

const MODEL_RE = /TGR-W09|TGR-W19|TGR-W00|TGR-AL00|TGR-AL09|TGR-W\d{2}|TGR-AL\d{2}|HUAWEITGR/i;
const NAME_RE = /(?:Huawei|HUAWEI|华为)?[\s_-]*MatePad[\s_-]*11[\s.]*5[\s"]*S/i;

describe('Huawei MatePad 11.5S mine e1 pills', () => {
  it('matches 11.5S model codes and marketing name, not Mate 60 / MatePad 11.5', () => {
    ['TGR-W09', 'TGR-W19', 'TGR-AL00', 'HUAWEITGR'].forEach((id) => {
      expect(MODEL_RE.test(id), id).toBe(true);
    });
    ['MatePad 11.5S', 'HUAWEI MatePad 11.5"S', '华为 MatePad 11.5 S', 'MatePad11.5S'].forEach(
      (name) => {
        expect(NAME_RE.test(name), name).toBe(true);
      }
    );
    expect(NAME_RE.test('MatePad 11.5')).toBe(false);
    expect(NAME_RE.test('HUAWEI Mate 60')).toBe(false);
    expect(MODEL_RE.test('ALN-AL00')).toBe(false);
    expect(MODEL_RE.test('BTK-W09')).toBe(false);
  });

  it('locks MatePad 11.5S off noclip 100cqw and the 1180 @sm crop', () => {
    expect(auth).toContain('function isHuaweiMatePad115SClient()');
    expect(auth).toContain('function matePad115SMineE1LockCss()');
    expect(auth).toContain('function pinMatePad115SMineE1Layout()');
    expect(auth).toContain('data-matepad115s-mine-e1-lock');
    expect(auth).toContain('app-android-huawei-matepad115s');
    expect(auth).toContain('aspect-ratio:1284 / 2127');
    expect(auth).toContain("var matepad115s =");
    expect(auth).toContain(':not(.app-android-huawei-matepad115s)');
    expect(auth).toMatch(
      /function isHuaweiMineNoClipClient\(\) \{[\s\S]{0,900}isHuaweiMatePad115SClient\(\)/
    );
    expect(auth).toMatch(
      /function pinMate60MineE1Layout\(\) \{[\s\S]{0,500}pinMatePad115SMineE1Layout\(\)/
    );
  });

  it('first-paints zero bleed and width-based canvas before generic Harmony noclip', () => {
    const padIdx = mine.indexOf("classList.add('app-android-huawei-matepad115s')");
    const noclipIdx = mine.indexOf('data-huawei-mine-noclip-inset');
    expect(padIdx).toBeGreaterThan(0);
    expect(noclipIdx).toBeGreaterThan(padIdx);
    expect(mine).toContain('data-matepad115s-mine-e1-firstpaint');
    expect(mine).toContain('aspect-ratio:1284/2127');
    expect(mine).toContain('aspect-ratio: 1284 / 2127');
    expect(mine).toContain("classList.remove('app-huawei-mine-noclip')");
    expect(mine).toContain(
      ':not(.app-android-mine-e1-plainimg):not(.app-android-huawei-matepad115s) body.page-mine'
    );
    expect(boot).toContain('app-android-huawei-matepad115s');
    expect(boot).toMatch(/if \(matepad115s\) \{[\s\S]*?\n        return;/);
    expect(mine).toMatch(/auth-boot\.js\?v=2026091/);
    expect(mine).toContain('auth.js?v=20260923-honor-x20');
  });

  it('overrides the 16px .user-name so tablet name follows canvas rpx', () => {
    expect(mine).toContain(
      'html.app-android-huawei-matepad115s body.page-mine .mine-ov-name.user-name'
    );
    expect(mine).toMatch(
      /html\.app-android-huawei-matepad115s body\.page-mine \.user-name \{[\s\S]{0,80}font-size:\s*calc\(38 \* var\(--mine-rpx\)\)/
    );
    expect(auth).toContain(
      'font-size:calc(38 * var(--mine-rpx)) !important;font-weight:600 !important;'
    );
    expect(auth).toContain('font-size:calc(26 * var(--mine-rpx)) !important;');
  });

  it('keeps the pill row on the 3-grid card instead of the 1180 crop', () => {
    const trueHeight = (800 * 2127) / 1284;
    const croppedHeight = (800 * 1180) / 750;
    expect(Math.round(trueHeight)).toBe(1325);
    expect(Math.round(croppedHeight)).toBe(1259);
    expect(trueHeight).toBeGreaterThan(croppedHeight);
    expect(auth).toContain('padding-bottom:calc(2127 / 1284 * 100%)');
    expect(mine).toContain('padding-bottom: calc(2127 / 1284 * 100%)');
  });
});
