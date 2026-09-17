import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');
const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');

const MODEL_RE = /PGP110|CPH2413|CPH2415|CPH2417/i;
const NAME_RE = /(?:OnePlus|一加)[\s_-]*Ace[\s_-]*Pro(?![\s_-]*2)/i;

describe('OnePlus Ace Pro mine e1 pills', () => {
  it('matches Ace Pro model codes and marketing name, not Ace 2 Pro', () => {
    ['PGP110', 'CPH2413', 'CPH2415', 'CPH2417'].forEach((id) => {
      expect(MODEL_RE.test(id), id).toBe(true);
    });
    ['OnePlus Ace Pro', '一加 Ace Pro', '一加_Ace_Pro'].forEach((name) => {
      expect(NAME_RE.test(name), name).toBe(true);
    });
    expect(NAME_RE.test('OnePlus Ace 2 Pro')).toBe(false);
    expect(NAME_RE.test('一加 Ace 2 Pro')).toBe(false);
    expect(MODEL_RE.test('PJA110')).toBe(false);
  });

  it('locks Ace Pro off the 100vw @sm crop and HyperOS rpx', () => {
    expect(auth).toContain('function aceProMineE1LockCss()');
    expect(auth).toContain('function pinAceProMineE1Layout()');
    expect(auth).toContain('data-acepro-mine-e1-lock');
    expect(auth).toContain('aspect-ratio:1284 / 2127');
    expect(auth).toContain("var acepro =");
    expect(auth).toMatch(/plainImg \|\| acepro \|\| hinova9se \|\| xiaomi13ultra/);
    expect(auth).toContain(':not(.app-android-oneplus-acepro) body.page-mine');
    expect(auth).toContain(
      ':not(.app-android-iqoo-13):not(.app-android-iqoo-15):not(.app-android-oneplus-acepro)'
    );
    expect(auth).toMatch(
      /function isHyperOs2MineE1SmClient\(\) \{\s*[\s\S]{0,220}app-android-oneplus-acepro/
    );
    expect(auth).toMatch(
      /function pinXiaomi14ProMineE1Layout\(\) \{[\s\S]{0,600}pinAceProMineE1Layout\(\)/
    );
  });

  it('first-paints zero bleed and width-based canvas on mine.html / auth-boot', () => {
    expect(mine).toContain('data-acepro-mine-e1-firstpaint');
    expect(mine).toContain('aspect-ratio:1284/2127');
    expect(mine).toContain('aspect-ratio: 1284 / 2127');
    expect(mine).toContain('--mine-top-bleed: 0px !important');
    expect(mine).toContain(
      ':not(.app-android-oneplus-acepro):not(.app-android-hinova9se):not(.app-mine-black-status):not(.app-android-redmi-k70):not(.app-android-xiaomi-13ultra) body.page-mine .mine-e1-canvas'
    );
    expect(boot).toContain('app-android-oneplus-acepro');
    expect(boot).toContain("classList.remove('app-android-mine-e1-sm')");
    expect(boot).toContain('aspect-ratio:1284/2127');
    expect(boot).toMatch(/if \(acepro\) \{[\s\S]*?__mineE1ForceSm = true;/);
    expect(mine).toMatch(/app-android-oneplus-acepro[\s\S]{0,400}__mineE1ForceSm = true/);
    expect(auth).toMatch(/function pinAceProMineE1Layout\(\) \{[\s\S]{0,500}__mineE1ForceSm = true/);
    expect(auth).toMatch(/function pinAceProMineE1Layout\(\) \{[\s\S]{0,900}mineE1ToSmUrl/);
    expect(boot).toMatch(/if \(acepro\) \{[\s\S]*?return;/);
    expect(mine).toMatch(/auth-boot\.js\?v=2026091/);
    expect(mine).toMatch(/auth\.js\?v=2026091/);
  });

  it('does not keep Ace Pro on the 40px mine bleed group', () => {
    const bleedGroup = mine.slice(
      mine.indexOf('html.app-android-oneplus-13 body.page-mine,'),
      mine.indexOf('html.app-huawei-mine-noclip:not(.app-android-huawei-mate60):not(.app-android-huawei-p40pro) body.page-mine {')
    );
    expect(bleedGroup).toContain('ace2pro');
    expect(bleedGroup).not.toContain('oneplus-acepro');
  });
});
