'use strict';

const {
  normalizeUploadRelPath,
  isSensitiveUploadPath,
  toSignedPublicAssetUrl,
  verifySignedAssetQuery
} = require('../../src/shared/signedAssets');

describe('signedAssets', () => {
  const cfg = { JWT_SECRET: 'test-secret', ASSET_SIGN_TTL_SEC: 600 };

  it('normalizes uploads apk/mobileconfig paths', () => {
    expect(normalizeUploadRelPath('/uploads/a.apk')).toBe('/uploads/a.apk');
    expect(normalizeUploadRelPath('uploads/a.apk')).toBe('/uploads/a.apk');
    expect(normalizeUploadRelPath('https://cdn.example.com/uploads/x.mobileconfig')).toBe(
      '/uploads/x.mobileconfig'
    );
  });

  it('rejects traversal and non-sensitive paths', () => {
    expect(normalizeUploadRelPath('/uploads/../etc/passwd.apk')).toBe('');
    expect(normalizeUploadRelPath('/uploads/a.png')).toBe('');
    expect(isSensitiveUploadPath('/uploads/a.jpg')).toBe(false);
  });

  it('signs and verifies query', () => {
    const url = toSignedPublicAssetUrl('/uploads/app.apk', cfg);
    expect(url).toMatch(/^\/api\/public\/asset\?/);
    const q = Object.fromEntries(new URL(url, 'https://x.test').searchParams.entries());
    const ok = verifySignedAssetQuery(q, cfg);
    expect(ok.ok).toBe(true);
    expect(ok.rel).toBe('/uploads/app.apk');
  });

  it('rejects bad signature', () => {
    const url = toSignedPublicAssetUrl('/uploads/app.apk', cfg);
    const q = Object.fromEntries(new URL(url, 'https://x.test').searchParams.entries());
    q.s = 'deadbeef';
    expect(verifySignedAssetQuery(q, cfg).ok).toBe(false);
  });
});
