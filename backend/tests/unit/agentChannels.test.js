'use strict';

const { createAgentChannels } = require('../../src/legacy/agentChannels');

describe('agentChannels normalize', () => {
  const api = createAgentChannels({
    getPool: () => ({
      execute: async () => [[]]
    })
  });

  it('normalizeAbc accepts a/b/c and NFKC', () => {
    expect(api.normalizeAbc('A')).toBe('a');
    expect(api.normalizeAbc('ｂ')).toBe('b');
    expect(api.normalizeAbc('auto')).toBe('');
    expect(api.normalizeAbc('x')).toBe('');
  });

  it('effectivePricingAbc defaults empty/c to a, keeps b', () => {
    expect(api.effectivePricingAbc('')).toBe('a');
    expect(api.effectivePricingAbc('c')).toBe('a');
    expect(api.effectivePricingAbc('b')).toBe('b');
    expect(api.effectivePricingAbc('a')).toBe('a');
  });

  it('normalizePackageUrl accepts uploads and https', () => {
    expect(api.normalizePackageUrl('uploads/a.apk')).toBe('uploads/a.apk');
    expect(api.normalizePackageUrl('/uploads/a.mobileconfig')).toBe('/uploads/a.mobileconfig');
    expect(api.normalizePackageUrl('https://cdn.example.com/x.apk')).toBe(
      'https://cdn.example.com/x.apk'
    );
    expect(api.normalizePackageUrl('uploads/../etc/passwd.apk')).toBe('');
    expect(api.normalizePackageUrl('javascript:alert(1)')).toBe('');
  });

  it('normalizeSkuPrices accepts week aliases and sku ids', () => {
    expect(api.normalizeSkuPrices({ week: 199, biweek: '299.5', month: '399' })).toEqual({
      sku_300_7d: { amount: '199.00' },
      sku_348_14d: { amount: '299.50' },
      sku_398_30d: { amount: '399.00' }
    });
    expect(api.normalizeSkuPrices({ sku_300_7d: '88' })).toEqual({
      sku_300_7d: { amount: '88.00' }
    });
    expect(api.normalizeSkuPrices({ week: '' })).toEqual({});
    expect(api.normalizeSkuPrices({ week: -1 })).toEqual({});
  });

  it('normalizeSkuPrices accepts custom days and hours', () => {
    const out = api.normalizeSkuPrices({
      price_week: '99',
      days_week: 3,
      hours_week: 12,
      label_week: '体验卡',
      days_month: 0,
      hours_month: 6,
      price_month: '50'
    });
    expect(out.sku_300_7d).toEqual({
      amount: '99.00',
      grant_days: 3,
      grant_hours: 12,
      label: '体验卡'
    });
    expect(out.sku_398_30d).toEqual({
      amount: '50.00',
      grant_days: 0,
      grant_hours: 6
    });
  });

  it('normalizeSkuPrices accepts 4th and 5th channel tiers', () => {
    expect(api.CHANNEL_SKU_IDS).toEqual([
      'sku_300_7d',
      'sku_348_14d',
      'sku_398_30d',
      'sku_ch_t4',
      'sku_ch_t5'
    ]);
    const out = api.normalizeSkuPrices({
      price_t4: '598',
      days_t4: 90,
      hours_t4: 0,
      label_t4: '季卡',
      price_t5: '998',
      days_t5: 365,
      label_t5: '年卡'
    });
    expect(out.sku_ch_t4).toEqual({
      amount: '598.00',
      grant_days: 90,
      grant_hours: 0,
      label: '季卡'
    });
    expect(out.sku_ch_t5).toEqual({
      amount: '998.00',
      grant_days: 365,
      grant_hours: 0,
      label: '年卡'
    });
  });

  it('normalizeSkuPrices accepts psych/list anchor amounts', () => {
    const out = api.normalizeSkuPrices({
      price_week: '199',
      psych_week: '399',
      label_week: '体验卡',
      price_t4: '598',
      list_t4: '898',
      days_t4: 90,
      hours_t4: 0
    });
    expect(out.sku_300_7d).toEqual({
      amount: '199.00',
      list_amount: '399.00',
      label: '体验卡'
    });
    expect(out.sku_ch_t4).toEqual({
      amount: '598.00',
      list_amount: '898.00',
      grant_days: 90,
      grant_hours: 0
    });
    const flat = api.normalizeSkuPrices({
      sku_348_14d: { amount: '299', psych_amount: '499', grant_days: 14 }
    });
    expect(flat.sku_348_14d).toEqual({
      amount: '299.00',
      list_amount: '499.00',
      grant_days: 14,
      grant_hours: 0
    });
  });
});

describe('abc is URL-only for channel prices', () => {
  const {
    isUrlOnlySalesChannel,
    resolveSalesChannelForChannelPrices,
    installDownloadBindWindow
  } = require('../../src/legacy/agentChannels');

  it('marks abc as URL-only', () => {
    expect(isUrlOnlySalesChannel('abc')).toBe(true);
    expect(isUrlOnlySalesChannel('ABC')).toBe(true);
    expect(isUrlOnlySalesChannel('github')).toBe(false);
  });

  it('exports helpers so register does not call undefined', () => {
    const mod = require('../../src/legacy/agentChannels');
    expect(typeof mod.isUrlOnlySalesChannel).toBe('function');
    expect(typeof mod.resolveSalesChannelForChannelPrices).toBe('function');
    expect(typeof mod.installDownloadBindWindow).toBe('function');
    expect(typeof mod.createAgentChannels).toBe('function');
  });

  it('uses request abc only; bound account abc alone does not set channel prices', () => {
    expect(resolveSalesChannelForChannelPrices('abc', '')).toBe('');
    expect(resolveSalesChannelForChannelPrices('abc', null)).toBe('');
    expect(resolveSalesChannelForChannelPrices('abc', 'abc')).toBe('abc');
    expect(resolveSalesChannelForChannelPrices('', 'abc')).toBe('abc');
  });

  it('excludes URL-only channels from sticky attribution replay', () => {
    const { sanitizeStickySalesChannelId } = require('../../src/legacy/agentChannels');
    expect(sanitizeStickySalesChannelId('abc')).toBe('');
    expect(sanitizeStickySalesChannelId('ABC')).toBe('');
    expect(sanitizeStickySalesChannelId('quan_c')).toBe('quan_c');
    expect(sanitizeStickySalesChannelId('')).toBe('');
  });

  it('still prefers the current request channel over the account', () => {
    expect(resolveSalesChannelForChannelPrices('quan_c', '')).toBe('quan_c');
    expect(resolveSalesChannelForChannelPrices('quan_c', 'abc')).toBe('abc');
    expect(resolveSalesChannelForChannelPrices('', 'quan_c')).toBe('quan_c');
    expect(resolveSalesChannelForChannelPrices('abc', 'quan_c')).toBe('quan_c');
  });

  it('windows install-download bind around registration', () => {
    var registeredAt = new Date('2026-09-07T04:04:25.000Z');
    var win = installDownloadBindWindow(registeredAt, new Date('2026-09-07T12:00:00.000Z'));
    expect(win.start.toISOString()).toBe('2026-09-07T02:04:25.000Z');
    expect(win.end.toISOString()).toBe('2026-09-07T04:19:25.000Z');
    var live = installDownloadBindWindow(null, new Date('2026-09-07T04:17:00.000Z'));
    expect(live.start.toISOString()).toBe('2026-09-07T02:17:00.000Z');
    expect(live.end.toISOString()).toBe('2026-09-07T04:18:00.000Z');
  });
});
