'use strict';

const catalog = require('../../src/admin/uiCompatCatalog');
const { buildDeviceCompatReport, classifyOs } = require('../../src/admin/deviceStats');

describe('uiCompatCatalog + deviceStats', () => {
  it('treats HarmonyOS as android', () => {
    expect(classifyOs('Mozilla HarmonyOS ArkWeb HUAWEI ALN-AL00')).toBe('android');
    expect(classifyOs('Mozilla iPhone OS 18_0')).toBe('ios');
  });

  it('does not let Mate70 match Mate60, or iPhone 13 Pro match 13', () => {
    const mate60 = catalog.listCatalogModels().find((m) => m.id === 'huawei-mate60');
    const iphone13 = catalog.listCatalogModels().find((m) => m.id === 'iphone-13');
    const xiaomi13 = catalog.listCatalogModels().find((m) => m.id === 'xiaomi-13');
    expect(catalog.modelMatchesBlob(mate60, 'HUAWEI Mate 60 ALN-AL00')).toBe(true);
    expect(catalog.modelMatchesBlob(mate60, 'HUAWEI Mate 70 PLA-AL00')).toBe(false);
    expect(catalog.modelMatchesBlob(iphone13, 'iPhone 13 iPhone14,5')).toBe(true);
    expect(catalog.modelMatchesBlob(iphone13, 'iPhone 13 Pro iPhone14,2')).toBe(false);
    expect(catalog.modelMatchesBlob(iphone13, 'iPhone 13 Pro Max iPhone14,3')).toBe(false);
    const iphone13pm = catalog.listCatalogModels().find((m) => m.id === 'iphone-13-promax');
    expect(catalog.modelMatchesBlob(iphone13pm, 'iPhone 13 Pro Max iPhone14,3')).toBe(true);
    expect(catalog.modelMatchesBlob(iphone13pm, 'iPhone 13 iPhone14,5')).toBe(false);
    expect(catalog.modelMatchesBlob(xiaomi13, 'Xiaomi 13 2211133C')).toBe(true);
    expect(catalog.modelMatchesBlob(xiaomi13, 'Xiaomi 13 Pro 2210132C')).toBe(false);
  });

  it('matches Mate 30 without taking Mate 30 Pro or Mate 60', () => {
    const m = catalog.listCatalogModels().find((x) => x.id === 'huawei-mate30');
    expect(catalog.modelMatchesBlob(m, 'HUAWEI Mate 30 TAS-AL00')).toBe(true);
    expect(catalog.modelMatchesBlob(m, 'Android 10; TAS-AN00 Build/HUAWEITAS-AN00')).toBe(true);
    expect(catalog.modelMatchesBlob(m, 'HUAWEI Mate 30 Pro LIO-AN00')).toBe(false);
    expect(catalog.modelMatchesBlob(m, 'HUAWEI Mate 60 ALN-AL00')).toBe(false);
  });

  it('matches S50 Pro mini without vivo prefix', () => {
    const m = catalog.listCatalogModels().find((x) => x.id === 'vivo-s50promini');
    expect(catalog.modelMatchesBlob(m, 'S50 Pro mini V2527A')).toBe(true);
  });

  it('merges catalog with live devices for compare stats', () => {
    const report = buildDeviceCompatReport([
      { username: 'a1', user_agent_short: 'iPhone 16 Pro iPhone17,1' },
      { username: 'a2', user_agent_short: 'iPhone 16 Pro iPhone17,1' },
      { username: 'b1', user_agent_short: 'Android 14; ALN-AL00 HarmonyOS' },
      {
        username: 'c1',
        user_agent_short: 'Android 15',
        device_detail_json: JSON.stringify({ model: 'Pixel 8', brand: 'Google' })
      }
    ]);
    expect(report.summary.users_ios).toBe(2);
    expect(report.summary.users_android).toBe(2);
    expect(report.summary.matched_users).toBe(3);
    const mate60 = report.models.find((m) => m.id === 'huawei-mate60');
    const ip16 = report.models.find((m) => m.id === 'iphone-16-pro');
    expect(mate60.user_count).toBe(1);
    expect(ip16.user_count).toBe(2);
    expect(mate60.issue_count).toBeGreaterThan(0);
    const shouye = report.page_compare.find((p) => p.page === 'shouye');
    expect(shouye.ios_issues).toBeGreaterThan(0);
    expect(shouye.android_issues).toBeGreaterThan(0);
    expect(shouye.ios_users).toBe(2);
    const shuiming = report.page_compare.find((p) => p.page === 'shuiming');
    expect(shuiming.ios_users).toBe(2);
    expect(report.unmatched.some((u) => /Pixel/.test(u.label))).toBe(true);
  });

  it('does not treat locale tags as Android model names', () => {
    const report = buildDeviceCompatReport([
      { username: 'z1', user_agent_short: 'Mozilla/5.0 (Linux; Android 14; zh-cn) AppleWebKit/537.36' }
    ]);
    expect(report.unmatched.some((u) => u.label === 'zh-cn')).toBe(false);
    expect(report.unmatched.some((u) => u.label === 'Android')).toBe(true);
  });
});
