import { describe, it, expect } from 'vitest';
import { devices } from 'playwright';
import {
  DEVICE_PROFILES,
  RECENT_DEVICE_IDS,
  POPULAR_DEVICE_IDS,
  MAINSTREAM_DEVICE_IDS,
  PRODUCTION_TOP_MODELS,
  resolveSmokeDevices,
  buildContextOptions
} from '../e2e/ui-smoke-devices.mjs';

describe('ui-smoke device catalog', () => {
  it('covers recent compatibility phones with inset unit tests', () => {
    const ids = DEVICE_PROFILES.map((d) => d.id);
    [
      'iphone-12',
      'iphone-16-promax',
      'iphone-17-promax',
      'iphone-air',
      'oneplus-12',
      'oneplus-ace6',
      'oneplus-ace2pro',
      'oneplus-ace2v',
      'oneplus-acepro',
      'oppo-reno10',
      'oppo-k9x',
      'xiaomi-13',
      'xiaomi-13pro',
      'xiaomi-13ultra',
      'xiaomi-14',
      'xiaomi-14pro',
      'xiaomi-15',
      'xiaomi-15pro',
      'redmi-k80pro',
      'redmi-k70-ultra',
      'redmi-note11-5g',
      'mate60',
      'mate70',
      'mate30',
      'mate30pro',
      'huawei-nova13',
      'hinova9se',
      'pura70',
      'vivo-x200pro',
      'vivo-x300pro',
      'vivo-s50promini',
      'vivo-x90',
      'iqoo-neo8',
      'iqoo-neo8pro',
      'iqoo-13',
      'iqoo-15',
      'meizu-20pro',
      'iphone-ios18-7',
      'iphone-ios18-5',
      'iphone-ios17-6',
      'iphone-ios14-4',
      'redmi-k80ultra',
      'redmi-k70',
      'oppo-findx8',
      'oppo-a57',
      'oppo-a58',
      'vivo-x100',
      'oneplus-ace3v',
      'pixel-9',
      'redmi-k80ultra',
      'redmi-k70'
    ].forEach((id) => {
      expect(ids, id).toContain(id);
    });
    expect(DEVICE_PROFILES.filter((d) => d.suite === 'full')).toHaveLength(1);
    expect(RECENT_DEVICE_IDS.length).toBeGreaterThan(20);
    RECENT_DEVICE_IDS.forEach((id) => {
      expect(ids, 'recent:' + id).toContain(id);
    });
    expect(POPULAR_DEVICE_IDS.length).toBeGreaterThan(15);
    POPULAR_DEVICE_IDS.forEach((id) => {
      expect(ids, 'popular:' + id).toContain(id);
    });
    PRODUCTION_TOP_MODELS.forEach((row) => {
      expect(ids, 'prod:' + row.model).toContain(row.id);
    });
  });

  it('resolves every playwrightDevice against Playwright builtins', () => {
    DEVICE_PROFILES.forEach((profile) => {
      expect(devices[profile.playwrightDevice], profile.id).toBeTruthy();
      const opts = buildContextOptions(profile, devices);
      expect(opts.viewport?.width, profile.id).toBeGreaterThan(300);
      if (profile.cordovaUa) {
        expect(opts.userAgent, profile.id).toMatch(/TaxPlatformCordovaApp\//i);
      }
      if (profile.userAgent && profile.deviceModel) {
        expect(opts.userAgent, profile.id).toContain(profile.deviceModel);
      }
    });
  });

  it('filters by UI_SMOKE_DEVICES', () => {
    expect(resolveSmokeDevices('full').map((d) => d.id)).toEqual(['iphone-12']);
    expect(resolveSmokeDevices('oneplus-12,mate60').map((d) => d.id)).toEqual([
      'oneplus-12',
      'mate60'
    ]);
    expect(resolveSmokeDevices('all').length).toBe(DEVICE_PROFILES.length);
    expect(resolveSmokeDevices('recent').map((d) => d.id).sort()).toEqual(
      [...RECENT_DEVICE_IDS].sort()
    );
    expect(resolveSmokeDevices('popular').map((d) => d.id).sort()).toEqual(
      [...POPULAR_DEVICE_IDS].sort()
    );
    expect(resolveSmokeDevices('mainstream').map((d) => d.id).sort()).toEqual(
      [...MAINSTREAM_DEVICE_IDS].sort()
    );
    expect(MAINSTREAM_DEVICE_IDS).toEqual(expect.arrayContaining(POPULAR_DEVICE_IDS));
    expect(MAINSTREAM_DEVICE_IDS).toContain('oneplus-ace3v');
    expect(MAINSTREAM_DEVICE_IDS).toContain('iphone-ios18-7');
    expect(resolveSmokeDevices('popular').length).toBeLessThan(DEVICE_PROFILES.length);
    expect(resolveSmokeDevices('popular').length).toBeLessThanOrEqual(25);
    expect(() => resolveSmokeDevices('no-such-phone')).toThrow(/无匹配机型/);
  });

  it('红米 K70 标准版列入自动测试，且「我的」走 underlap 黑垫', () => {
    const k70 = DEVICE_PROFILES.find((d) => d.id === 'redmi-k70');
    const ultra = DEVICE_PROFILES.find((d) => d.id === 'redmi-k70-ultra');
    expect(k70, 'redmi-k70 profile').toBeTruthy();
    expect(k70.deviceModel).toBe('23113RKC6C');
    expect(k70.expect.mineBlackStatus).toBe(true);
    expect(k70.expect.immersiveWhiteTop).toBe(true);
    expect(ultra.expect.mineBlackStatus).toBeFalsy();
    expect(RECENT_DEVICE_IDS).toContain('redmi-k70');
    expect(POPULAR_DEVICE_IDS).toContain('redmi-k70');
    expect(MAINSTREAM_DEVICE_IDS).toContain('redmi-k70');
    expect(resolveSmokeDevices('redmi-k70').map((d) => d.id)).toEqual(['redmi-k70']);
  });
});
