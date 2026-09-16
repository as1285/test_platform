'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { Writable } = require('stream');
const {
  normalizeUploadRelPath,
  isSensitiveUploadPath,
  toSignedPublicAssetUrl,
  verifySignedAssetQuery,
  parseByteRange,
  createPublicAssetHandler
} = require('../../src/shared/signedAssets');

function mockRes() {
  const chunks = [];
  const w = new Writable({
    write(chunk, _enc, cb) {
      chunks.push(Buffer.from(chunk));
      cb();
    }
  });
  w.headers = {};
  w.chunks = chunks;
  w.statusCode = 200;
  w.setHeader = function (k, v) {
    this.headers[k] = v;
  };
  w.status = function (code) {
    this.statusCode = code;
    return this;
  };
  w.json = function (body) {
    this.body = body;
    return this;
  };
  return w;
}

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

  it('signs path-with-filename URL and verifies query', () => {
    const url = toSignedPublicAssetUrl('/uploads/app.apk', cfg);
    expect(url).toMatch(/^\/api\/public\/asset\/geshui\.apk\?/);
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

  it('parses byte ranges for resume', () => {
    expect(parseByteRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseByteRange('bytes=100-', 1000)).toEqual({ start: 100, end: 999 });
    expect(parseByteRange('bytes=-50', 1000)).toEqual({ start: 950, end: 999 });
    expect(parseByteRange('bytes=0-10,11-20', 1000)).toBeNull();
    expect(parseByteRange('bytes=5000-6000', 1000).unsatisfiable).toBe(true);
  });

  it('serves 206 for Range and keeps old query URL working', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'signed-asset-'));
    const rel = '/uploads/demo.apk';
    const abs = path.join(dir, 'demo.apk');
    fs.writeFileSync(abs, Buffer.from('ABCDEFGHIJ'));
    const handler = createPublicAssetHandler({ config: cfg, uploadDir: dir });
    const url = toSignedPublicAssetUrl(rel, cfg);
    const q = Object.fromEntries(new URL(url, 'https://x.test').searchParams.entries());
    const req = { method: 'GET', query: q, headers: { range: 'bytes=2-5' } };
    const res = mockRes();
    await new Promise((resolve, reject) => {
      res.on('finish', resolve);
      res.on('error', reject);
      Promise.resolve(handler(req, res)).catch(reject);
    });
    expect(res.statusCode).toBe(206);
    expect(res.headers['Accept-Ranges']).toBe('bytes');
    expect(res.headers['Content-Range']).toBe('bytes 2-5/10');
    expect(res.headers['Content-Length']).toBe('4');
    expect(res.headers['Content-Disposition']).toContain('geshui.apk');
    expect(Buffer.concat(res.chunks).toString()).toBe('CDEF');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
