'use strict';

const catalog = require('../../src/admin/uiCompatCatalog');
const { buildDeviceCompatReport, classifyOs, countRegisteredByPlatform } = require('../../src/admin/deviceStats');

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
    const oneplus12 = catalog.listCatalogModels().find((m) => m.id === 'oneplus-12');
    expect(catalog.modelMatchesBlob(oneplus12, '一加 12 PJD110')).toBe(true);
    expect(catalog.modelMatchesBlob(oneplus12, 'OnePlus 12R CPH2585')).toBe(false);
    const xiaomi15 = catalog.listCatalogModels().find((m) => m.id === 'xiaomi-15');
    expect(catalog.modelMatchesBlob(xiaomi15, '24129PN74C')).toBe(true);
    expect(catalog.modelMatchesBlob(xiaomi15, 'Xiaomi 15 Pro 2410DPN6CC')).toBe(false);
    const k80ultra = catalog.listCatalogModels().find((m) => m.id === 'redmi-k80ultra');
    expect(catalog.modelMatchesBlob(k80ultra, '25060RK16C REDMI K80 Ultra')).toBe(true);
    expect(catalog.modelMatchesBlob(k80ultra, '24122RKC7C REDMI K80 Pro')).toBe(false);
    const findx8 = catalog.listCatalogModels().find((m) => m.id === 'oppo-findx8');
    expect(catalog.modelMatchesBlob(findx8, 'PKB110 OPPO Find X8')).toBe(true);
    expect(catalog.modelMatchesBlob(findx8, 'CPH2797 OPPO Find X9')).toBe(false);
    const x100 = catalog.listCatalogModels().find((m) => m.id === 'vivo-x100');
    expect(catalog.modelMatchesBlob(x100, 'V2309A vivo X100')).toBe(true);
    expect(catalog.modelMatchesBlob(x100, 'V2241A vivo X90')).toBe(false);
    const a57 = catalog.listCatalogModels().find((m) => m.id === 'oppo-a57');
    expect(catalog.modelMatchesBlob(a57, 'PFTM20 OPPO A57')).toBe(true);
    expect(catalog.modelMatchesBlob(a57, 'PHJ110 OPPO A58')).toBe(false);
    const k70 = catalog.listCatalogModels().find((m) => m.id === 'redmi-k70');
    expect(catalog.modelMatchesBlob(k70, '23113RKC6C')).toBe(true);
    expect(k70.issues.some((i) => i.page === 'mine' && /underlap 黑垫/.test(i.title))).toBe(true);
  });

  it('matches Mate 30 without taking Mate 30 Pro or Mate 60', () => {
    const m = catalog.listCatalogModels().find((x) => x.id === 'huawei-mate30');
    expect(catalog.modelMatchesBlob(m, 'HUAWEI Mate 30 TAS-AL00')).toBe(true);
    expect(catalog.modelMatchesBlob(m, 'Android 10; TAS-AN00 Build/HUAWEITAS-AN00')).toBe(true);
    expect(catalog.modelMatchesBlob(m, 'HUAWEI Mate 30 Pro LIO-AN00')).toBe(false);
    expect(catalog.modelMatchesBlob(m, 'HUAWEI Mate 60 ALN-AL00')).toBe(false);
  });

  it('matches iQOO Z9 Turbo+ without taking Z9 Turbo', () => {
    const m = catalog.listCatalogModels().find((x) => x.id === 'iqoo-z9turboplus');
    expect(catalog.modelMatchesBlob(m, 'Android 15; V2417A Build/AP3A.240905.015.A2')).toBe(true);
    expect(catalog.modelMatchesBlob(m, 'iQOO Z9 Turbo+ PD2417')).toBe(true);
    expect(catalog.modelMatchesBlob(m, 'V2352A iQOO Z9 Turbo')).toBe(false);
    expect(catalog.modelMatchesBlob(m, 'V2361A iQOO Z9')).toBe(false);
  });

  it('matches S50 Pro mini without vivo prefix', () => {
    const m = catalog.listCatalogModels().find((x) => x.id === 'vivo-s50promini');
    expect(catalog.modelMatchesBlob(m, 'S50 Pro mini V2527A')).toBe(true);
  });

  it('keeps new Android catalog rows from eating sibling SKUs', () => {
    const k80 = catalog.listCatalogModels().find((m) => m.id === 'redmi-k80');
    expect(catalog.modelMatchesBlob(k80, '24117RK2CC REDMI K80')).toBe(true);
    expect(catalog.modelMatchesBlob(k80, '24122RKC7C REDMI K80 Pro')).toBe(false);
    expect(catalog.modelMatchesBlob(k80, '25060RK16C REDMI K80 Ultra')).toBe(false);
    const acePro = catalog.listCatalogModels().find((m) => m.id === 'oneplus-ace-pro');
    expect(catalog.modelMatchesBlob(acePro, 'PGP110 OnePlus Ace Pro')).toBe(true);
    expect(catalog.modelMatchesBlob(acePro, 'PJX110 OnePlus Ace 3 Pro')).toBe(false);
    const x90 = catalog.listCatalogModels().find((m) => m.id === 'vivo-x90');
    expect(catalog.modelMatchesBlob(x90, 'V2241A vivo X90')).toBe(true);
    expect(catalog.modelMatchesBlob(x90, 'vivo X90 Pro')).toBe(false);
    const a58 = catalog.listCatalogModels().find((m) => m.id === 'oppo-a58');
    expect(catalog.modelMatchesBlob(a58, 'PHJ110 OPPO A58')).toBe(true);
    expect(catalog.modelMatchesBlob(a58, 'PFTM20 OPPO A57')).toBe(false);
    const findx8 = catalog.listCatalogModels().find((m) => m.id === 'oppo-findx8');
    expect(catalog.modelMatchesBlob(findx8, 'PKB110 OPPO Find X8')).toBe(true);
    expect(catalog.modelMatchesBlob(findx8, 'PKT110 OPPO Find X8s')).toBe(false);
    expect(catalog.modelMatchesBlob(findx8, 'PKJ110 OPPO Find X8 Ultra')).toBe(false);
    const x200pro = catalog.listCatalogModels().find((m) => m.id === 'vivo-x200pro');
    expect(catalog.modelMatchesBlob(x200pro, 'V2405A vivo X200 Pro')).toBe(true);
    expect(catalog.modelMatchesBlob(x200pro, 'V2458A vivo X200s')).toBe(false);
    expect(catalog.modelMatchesBlob(x200pro, 'V2419A vivo X200 Pro mini')).toBe(false);
    const pixel9 = catalog.listCatalogModels().find((m) => m.id === 'pixel-9');
    expect(catalog.modelMatchesBlob(pixel9, 'Pixel 9')).toBe(true);
    expect(catalog.modelMatchesBlob(pixel9, 'Pixel 9 Pro')).toBe(false);
    const x15 = catalog.listCatalogModels().find((m) => m.id === 'xiaomi-15');
    expect(catalog.modelMatchesBlob(x15, 'Xiaomi 15 24129PN74C')).toBe(true);
    expect(catalog.modelMatchesBlob(x15, 'Xiaomi 15 Ultra 25019PNF3C')).toBe(false);
    const x13 = catalog.listCatalogModels().find((m) => m.id === 'xiaomi-13');
    expect(catalog.modelMatchesBlob(x13, 'Xiaomi 13 Ultra 2304FPN6DC')).toBe(false);
    const x17 = catalog.listCatalogModels().find((m) => m.id === 'xiaomi-17');
    expect(catalog.modelMatchesBlob(x17, '25113PN0EC')).toBe(true);
    expect(catalog.modelMatchesBlob(x17, '小米 17 Pro 25098PN5AC')).toBe(false);
    const ace3 = catalog.listCatalogModels().find((m) => m.id === 'oneplus-ace3');
    expect(catalog.modelMatchesBlob(ace3, 'PJE110 OnePlus Ace 3')).toBe(true);
    expect(catalog.modelMatchesBlob(ace3, 'PJX110 OnePlus Ace 3 Pro')).toBe(false);
    expect(catalog.modelMatchesBlob(ace3, 'PJF110 OnePlus Ace 3V')).toBe(false);
    const s24 = catalog.listCatalogModels().find((m) => m.id === 'samsung-s24');
    expect(catalog.modelMatchesBlob(s24, 'SM-S921U Galaxy S24')).toBe(true);
    expect(catalog.modelMatchesBlob(s24, 'SM-S9280 Galaxy S24 Ultra')).toBe(false);
    const mate60 = catalog.listCatalogModels().find((m) => m.id === 'huawei-mate60');
    expect(catalog.modelMatchesBlob(mate60, 'HUAWEI Mate 60 BRA-AL00')).toBe(true);
  });

  it('matches Galaxy S23 Ultra without taking S23 or S24 Ultra', () => {
    const m = catalog.listCatalogModels().find((x) => x.id === 'samsung-s23-ultra');
    expect(catalog.modelMatchesBlob(m, 'Android 14; SM-S9180 Samsung')).toBe(true);
    expect(catalog.modelMatchesBlob(m, 'Galaxy S23 Ultra')).toBe(true);
    expect(catalog.modelMatchesBlob(m, 'SM-S9110 Galaxy S23')).toBe(false);
    expect(catalog.modelMatchesBlob(m, 'SM-S9280 Galaxy S24 Ultra')).toBe(false);
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

  it('counts current registered users by first device platform', () => {
    const registered = countRegisteredByPlatform(
      [{ username: 'a' }, { username: 'b' }, { username: 'c' }],
      [
        { username: 'a', user_agent_short: 'Mozilla iPhone OS 18_0', first_seen: '2026-01-01' },
        { username: 'a', user_agent_short: 'Android 15', first_seen: '2026-06-01' },
        { username: 'b', user_agent_short: 'Mozilla HarmonyOS ArkWeb HUAWEI', first_seen: '2026-02-01' }
      ]
    );
    expect(registered.registered_total).toBe(3);
    expect(registered.registered_ios).toBe(1);
    expect(registered.registered_android).toBe(1);
    expect(registered.registered_other).toBe(1);
  });

  it('does not treat locale tags as Android model names', () => {
    const report = buildDeviceCompatReport([
      { username: 'z1', user_agent_short: 'Mozilla/5.0 (Linux; Android 14; zh-cn) AppleWebKit/537.36' }
    ]);
    expect(report.unmatched.some((u) => u.label === 'zh-cn')).toBe(false);
    expect(report.unmatched.some((u) => u.label === 'Android')).toBe(true);
  });
});
