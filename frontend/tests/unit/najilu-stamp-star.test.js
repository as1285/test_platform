import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const najilu = readFileSync(resolve(__dirname, '../../public/js/najilu.js'), 'utf8');

describe('纳税记录公章对齐正版', () => {
  it('Canvas 章为单圈、无五角星、无底弧编号，业务专用章居中偏下', () => {
    expect(najilu).not.toContain('function drawFivePointStar');
    expect(najilu).not.toContain('function stampSerialCode');
    expect(najilu).not.toContain('bottomArc: true');
    expect(najilu).toContain("drawSpacedText(ctx, '业务专用章', cx, cy + 32");
    expect(najilu).not.toMatch(/drawSpacedText\(ctx,\s*'业务专用章',\s*cx,\s*cy\s*\+\s*8/);
  });

  it('表头与最外框有表格线，明细行不画内格', () => {
    expect(najilu).toContain('function drawCertTableFrame');
    expect(najilu).toContain('function drawCertTotalRowLines');
    expect(najilu).toContain("var CERT_TABLE_LINE = '#333'");
    expect(najilu).toContain('CERT_TABLE_LINE_W = 1');
    expect(najilu).toContain('drawCertTableFrame(ctx, x0, y0, tableW, CERT_TABLE_HEADER_H, cols, tableBottom)');
    expect(najilu).toContain('drawCertTotalRowLines(ctx, x0, footY, tableW, tableBottom)');
    expect(najilu).toContain('ctx.strokeRect(x0, y0, tableW, tableBottom - y0)');
    expect(najilu).toContain('strokeCertLine(ctx, x0, y0 + headerH, x0 + tableW, y0 + headerH)');
    expect(najilu).not.toContain('function drawCertTableGrid');
    expect(najilu).not.toContain('CERT_TABLE_BOTTOM_LINE');
  });

  it('正版章用朱红单圈，字距拉开', () => {
    expect(najilu).toContain("var stampRed = '#d32f2f'");
    expect(najilu).toContain('对照官方纳税记录红章：朱红单圈、无星、无底弧编号');
    expect(najilu).not.toContain('外粗圈 + 内细圈');
    expect(najilu).not.toMatch(/ctx\.arc\(cx,\s*cy,\s*radius\s*-\s*6\.2/);
    expect(najilu).toMatch(/letterGap:\s*7\.5/);
    expect(najilu).toMatch(/maxSpanRad:\s*Math\.PI\s*\*\s*1\.35/);
  });
});
