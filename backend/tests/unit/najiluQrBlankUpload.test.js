'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { readPngDimensions, isSuspiciouslyBlankQrUpload } = require('../../src/admin/najiluQr');

describe('najiluQr blank upload guard', () => {
  it('reads PNG IHDR size', () => {
    const buf = Buffer.alloc(24);
    buf[0] = 0x89;
    buf[1] = 0x50;
    buf[2] = 0x4e;
    buf[3] = 0x47;
    buf.writeUInt32BE(87, 16);
    buf.writeUInt32BE(136, 20);
    expect(readPngDimensions(buf)).toEqual({ width: 87, height: 136 });
    expect(readPngDimensions(Buffer.from('not-a-png'))).toBeNull();
  });

  it('rejects tiny white PNG extracts and keeps normal QR files', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'najilu-qr-'));
    const tiny = path.join(dir, 'white.png');
    const ok = path.join(dir, 'ok.png');
    fs.writeFileSync(tiny, Buffer.alloc(510, 0));
    fs.writeFileSync(ok, Buffer.alloc(4096, 1));
    expect(isSuspiciouslyBlankQrUpload(tiny)).toBe(true);
    expect(isSuspiciouslyBlankQrUpload(ok)).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
