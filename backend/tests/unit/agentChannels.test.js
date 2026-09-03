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
      sku_300_7d: '199.00',
      sku_348_14d: '299.50',
      sku_398_30d: '399.00'
    });
    expect(api.normalizeSkuPrices({ sku_300_7d: '88' })).toEqual({ sku_300_7d: '88.00' });
    expect(api.normalizeSkuPrices({ week: '' })).toEqual({});
    expect(api.normalizeSkuPrices({ week: -1 })).toEqual({});
  });
});
