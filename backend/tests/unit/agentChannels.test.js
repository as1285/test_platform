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
});
