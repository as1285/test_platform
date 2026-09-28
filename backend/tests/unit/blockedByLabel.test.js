'use strict';

const { blockedByLabel, blockedByFromAdmin } = require('../../src/admin/blockedByLabel');

describe('blockedByLabel', () => {
  it('returns dash for empty', () => {
    expect(blockedByLabel(null)).toBe('—');
    expect(blockedByLabel('')).toBe('—');
  });

  it('keeps a short username', () => {
    expect(blockedByLabel('19106014552')).toBe('19106014552');
  });

  it('extracts full_name from admin JSON and hides hash', () => {
    const raw = JSON.stringify({
      id: 12,
      username: '19106014552',
      full_name: '瀚泽流滴',
      salt: '0d743a61924ccaa4fba086451c0f9a8e',
      hash: '770b271edcb2f8d9548e9746be19fa8c4b0d059cb25894f18393f43e2800e5f6'
    });
    expect(blockedByLabel(raw)).toBe('瀚泽流滴');
    expect(blockedByLabel(raw)).not.toContain('salt');
    expect(blockedByLabel(raw)).not.toContain('hash');
  });

  it('extracts username from truncated JSON that cannot parse', () => {
    const raw =
      '{"id":12,"username":"19106014552","full_name":"瀚泽流滴","salt":"abc","hash":"770b271edcb2f8d9548e9746be19fa8c4b0d059cb25894f18393f43e2800e5f';
    expect(blockedByLabel(raw)).toBe('瀚泽流滴');
  });

  it('reads username from an admin object', () => {
    expect(
      blockedByFromAdmin({
        username: '19106014552',
        full_name: '瀚泽流滴',
        hash: 'secret'
      })
    ).toBe('19106014552');
  });
});
