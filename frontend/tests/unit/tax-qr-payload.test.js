import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const frontend = resolve(__dirname, '../..');

beforeAll(() => {
  const code = readFileSync(resolve(frontend, 'public/js/tax-qr-payload.js'), 'utf8');
  // eslint-disable-next-line no-eval
  eval(code);
});

describe('tax-record QR payload (demo + printed najilu verify)', () => {
  it('parses the certificate verify URL already printed by najilu.js', () => {
    const code = 'AB3DK7MNPQ2RST4U';
    const abs = 'https://demo.example/najilu.html?view=verify&code=' + code;
    const rel = 'najilu.html?view=verify&code=' + code.toLowerCase();
    expect(window.parseTaxQrPayload(abs)).toMatchObject({
      ok: true,
      type: 'verify',
      code,
      href: 'najilu.html?view=verify&code=' + encodeURIComponent(code)
    });
    expect(window.parseTaxQrPayload(rel).code).toBe(code);
    expect(window.parseTaxQrPayload(code).type).toBe('verify');
    expect(window.parseTaxQrPayload('  ' + code.toLowerCase() + '  ').code).toBe(code);
  });

  it('round-trips the TP1 demo import/generate payload', () => {
    const encoded = window.encodeTaxQrPayload({
      code: 'DEMOQRTAXREC0001',
      period_start: '2025-01',
      period_end: '2025-03',
      records: [
        { year: 2025, month: 1, company_name: '演示科技有限公司', income: 15000, tax_reported: 260 }
      ]
    });
    expect(encoded.startsWith('TP1.')).toBe(true);
    const parsed = window.parseTaxQrPayload(encoded);
    expect(parsed.ok).toBe(true);
    expect(parsed.type).toBe('taxrec');
    expect(parsed.code).toBe('DEMOQRTAXREC0001');
    expect(parsed.period_start).toBe('2025-01');
    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0].company_name).toBe('演示科技有限公司');
    expect(parsed.records[0].income).toBe(15000);
    expect(parsed.records[0].income_type).toBe('工资薪金');
    expect(window.parseTaxQrPayload(window.demoTaxQrPayload()).records.length).toBeGreaterThan(0);
  });

  it('rejects unknown or truncated payloads', () => {
    expect(window.parseTaxQrPayload('https://example.com/help_center.html').ok).toBe(false);
    expect(window.parseTaxQrPayload('TP1.@@@').ok).toBe(false);
    expect(window.parseTaxQrPayload('SHORT').ok).toBe(false);
    expect(window.parseTaxQrPayload('').ok).toBe(false);
  });
});

describe('homepage scan opens camera scanner', () => {
  const shouye = readFileSync(resolve(frontend, 'shouye.html'), 'utf8');
  const scan = readFileSync(resolve(frontend, 'scan.html'), 'utf8');
  const boot = readFileSync(resolve(frontend, 'public/js/auth-boot.js'), 'utf8');
  const auth = readFileSync(resolve(frontend, 'public/js/auth.js'), 'utf8');
  const loading = readFileSync(resolve(frontend, 'public/js/page-loading.js'), 'utf8');

  it('scan page matches the camera overlay copy and album control', () => {
    expect(existsSync(resolve(frontend, 'scan.html'))).toBe(true);
    expect(scan).toContain('<title>扫一扫</title>');
    expect(scan).toContain('返回');
    expect(scan).toContain('请将摄像头对准二维码');
    expect(scan).toContain('相册');
    expect(scan).toContain('id="scanAlbumBtn"');
    expect(scan).toContain('id="scanVideo"');
    expect(scan).toContain('tax-qr-payload.js?v=20260905-scan');
    expect(scan).toContain('scan-qr.js?v=20260905-scan2');
    expect(scan).toContain('jsqr.min.js?v=20260905-scan');
    expect(existsSync(resolve(frontend, 'public/js/vendor/jsqr.min.js'))).toBe(true);
  });

  it('is reachable without login and skips the loading HUD', () => {
    expect(boot).toContain("'scan.html': true");
    expect(auth).toContain("'scan.html': true");
    expect(auth).toMatch(/skipLoadingPages[\s\S]*'scan\.html': true/);
    expect(loading).toMatch(/SKIP_PAGES[\s\S]*'scan\.html': true/);
    expect(shouye).toContain("window.location.href = 'scan.html'");
  });
});
