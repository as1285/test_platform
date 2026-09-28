'use strict';

const { readFileSync } = require('fs');
const { resolve } = require('path');
const { adminCertWantDemo: lizhiWantDemo } = require('../../src/admin/lizhiCert');
const { adminCertWantDemo: zaizhiWantDemo } = require('../../src/admin/zaizhiCert');

describe('admin employment cert formal by default', () => {
  it('adminCertWantDemo is false unless explicitly requested', () => {
    expect(lizhiWantDemo({})).toBe(false);
    expect(lizhiWantDemo({ demo: false })).toBe(false);
    expect(lizhiWantDemo({ demo: 0 })).toBe(false);
    expect(lizhiWantDemo({ demo: 'false' })).toBe(false);
    expect(lizhiWantDemo({ demo: true })).toBe(true);
    expect(lizhiWantDemo({ demo: 1 })).toBe(true);
    expect(lizhiWantDemo({ demo: '1' })).toBe(true);
    expect(lizhiWantDemo({ demo: 'true' })).toBe(true);

    expect(zaizhiWantDemo({})).toBe(false);
    expect(zaizhiWantDemo({ demo: true })).toBe(true);
  });

  it('admin generate handlers default demo off and drop -demo suffix when formal', () => {
    const lizhi = readFileSync(resolve(__dirname, '../../src/admin/lizhiCert.js'), 'utf8');
    const zaizhi = readFileSync(resolve(__dirname, '../../src/admin/zaizhiCert.js'), 'utf8');
    expect(lizhi).toContain('var wantDemo = adminCertWantDemo(b);');
    expect(lizhi).toContain('demo: wantDemo');
    expect(lizhi).toContain("wantDemo ? '-demo.pdf' : '.pdf'");
    expect(lizhi).not.toMatch(/demo:\s*true\s*\n\s*\};/);

    expect(zaizhi).toContain('var wantDemo = adminCertWantDemo(b);');
    expect(zaizhi).toContain('demo: wantDemo');
    expect(zaizhi).toContain("wantDemo ? '-demo.pdf' : '.pdf'");
  });

  it('admin UI sends demo:false and shows formal copy', () => {
    const lizhiJs = readFileSync(
      resolve(__dirname, '../../../frontend/public/js/admin/modules/lizhi-cert.js'),
      'utf8'
    );
    const zaizhiJs = readFileSync(
      resolve(__dirname, '../../../frontend/public/js/admin/modules/zaizhi-cert.js'),
      'utf8'
    );
    const html = readFileSync(
      resolve(__dirname, '../../../frontend/admin_panel.html'),
      'utf8'
    );
    expect(lizhiJs).toContain('demo: false');
    expect(lizhiJs).toContain('正式无水印');
    expect(zaizhiJs).toContain('demo: false');
    expect(zaizhiJs).toContain('正式无水印');
    expect(html).toContain('正式无水印</strong>离职证明');
    expect(html).toContain('正式无水印</strong>工作证明');
    expect(html).not.toContain('非正式离职证明');
    expect(html).not.toContain('非正式工作证明');
  });
});
