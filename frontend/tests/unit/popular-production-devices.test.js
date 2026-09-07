import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  DEVICE_PROFILES,
  PRODUCTION_TOP_MODELS,
  POPULAR_DEVICE_IDS
} from '../e2e/ui-smoke-devices.mjs';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const boot = readFileSync(resolve(__dirname, '../../public/js/auth-boot.js'), 'utf8');

const byId = Object.fromEntries(DEVICE_PROFILES.map((d) => [d.id, d]));

const FIRST_PAINT_IDX = boot.indexOf('function applyAndroidWhitePageInsetFirstPaint');
const FIRST_PAINT = boot.slice(FIRST_PAINT_IDX, FIRST_PAINT_IDX + 2200);

describe('production popular models in smoke catalog', () => {
  it('maps every sampled live model code to a smoke profile', () => {
    PRODUCTION_TOP_MODELS.forEach((row) => {
      const profile = byId[row.id];
      expect(profile, row.model + ' -> ' + row.id).toBeTruthy();
      if (row.model.startsWith('iPhone')) {
        expect(profile.platform, row.id).toBe('ios');
        expect(profile.userAgent, row.id).toMatch(/iPhone OS /);
      } else {
        expect(profile.deviceModel, row.id).toBe(row.model);
        expect(profile.userAgent, row.id).toContain(row.model);
        expect(profile.userAgent, row.id).toMatch(/TaxPlatformCordovaApp\//);
      }
    });
    expect(POPULAR_DEVICE_IDS).toContain('iphone-ios18-7');
    expect(POPULAR_DEVICE_IDS).toContain('redmi-k80ultra');
    expect(POPULAR_DEVICE_IDS).toContain('oneplus-ace3v');
    expect(POPULAR_DEVICE_IDS).toContain('pixel-9');
    expect(POPULAR_DEVICE_IDS).not.toContain('iphone-17-promax');
  });

  it('keeps PGP110 as 一加 Ace Pro (not Ace 2 Pro / 12)', () => {
    expect(byId['oneplus-acepro'].deviceModel).toBe('PGP110');
    expect(byId['oneplus-acepro'].label).toMatch(/Ace Pro/);
    expect(auth).toMatch(/function isOnePlusAceProClient\(\)[\s\S]*PGP110/);
    expect(auth).toMatch(/function isOnePlus12Client\(\)[\s\S]*PJD110/);
    expect(auth).not.toMatch(/function isOnePlus12Client\(\)[\s\S]{0,200}PGP110/);
  });

  it('does not treat K80 Ultra / K70 / Find X8 / X100 / A57 as sibling special-cases', () => {
    const k80pro = /24122RKC7[CG]|24127RK2CC/i;
    const k80proName = /(?:Redmi|Xiaomi|REDMI)[\s_-]*K80[\s_-]*Pro/i;
    const x90 = /V2241A|V2241EA|PD2241\b/i;
    const x200 = /V2405A|V2405DA|V2413\b/i;
    const findX9 = /CPH2797|Find\s*X\s*9/i;
    const a58 = /PHJ110|OPPO\s*A58/i;
    const k70ultra = /2407FPN8E[GR]|K70[\s_-]*(?:至尊|Ultra)/i;

    expect(k80pro.test('25060RK16C')).toBe(false);
    expect(k80proName.test('REDMI K80 Ultra')).toBe(false);
    expect(k70ultra.test('23113RKC6C')).toBe(false);
    expect(x90.test('V2309A')).toBe(false);
    expect(x200.test('V2309A')).toBe(false);
    expect(findX9.test('PKB110')).toBe(false);
    expect(a58.test('PFTM20')).toBe(false);
    expect(a58.test('PKB110')).toBe(false);
  });

  it('wires K80 Ultra into Xiaomi immersive 40px and not K70 outer-zero', () => {
    expect(auth).toContain('function isAndroid25060RK16CClient()');
    expect(auth).toMatch(/isXiaomiImmersiveTopClient\(\)[\s\S]*isAndroid25060RK16CClient\(\)/);
    expect(auth).toContain('app-android-redmi-k80ultra');
    expect(auth).toContain('25060RK16C');
    expect(auth).toMatch(
      /html\.app-android-redmi-k80ultra\.app-top-safe-shell[\s\S]{0,80}--app-shell-statusbar-top:40px/
    );
    expect(auth).toContain(':not(.app-android-redmi-k80ultra)');
    expect(auth).toContain('K80[\\s_-]*(?:至尊|Ultra)');
  });

  it('leaves popular non-allowlist Androids on the default 40px first-paint path', () => {
    expect(FIRST_PAINT).toContain('PHJ110');
    expect(FIRST_PAINT).toContain('23127PN');
    expect(FIRST_PAINT).toContain('app-android-immersive-white-top');
    ['PKB110', 'PFTM20', 'V2309A', '25060RK16C', '23113RKC6C'].forEach((code) => {
      expect(FIRST_PAINT, code + ' should not skip default 40px').not.toContain(code);
    });
  });
});
