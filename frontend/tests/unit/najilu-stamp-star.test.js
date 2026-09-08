import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const najilu = readFileSync(resolve(__dirname, '../../public/js/najilu.js'), 'utf8');

describe('纳税记录公章对齐正版', () => {
  it('Canvas 章含五角星，且业务专用章在星下方', () => {
    expect(najilu).toContain('function drawFivePointStar');
    expect(najilu).toContain('正版税局电子章中心五角星');
    expect(najilu).toContain("drawSpacedText(ctx, '业务专用章', cx, cy + 32");
    expect(najilu).toMatch(/drawFivePointStar\(ctx,\s*cx,\s*cy\s*-\s*2,\s*24/);
    expect(najilu).not.toMatch(/drawSpacedText\(ctx,\s*'业务专用章',\s*cx,\s*cy\s*\+\s*8/);
  });

  it('正版章用朱红、外粗内细双圈，并含底弧 13 位编号', () => {
    expect(najilu).toContain("var stampRed = '#c62828'");
    expect(najilu).toContain('外粗圈 + 内细圈');
    expect(najilu).toMatch(/ctx\.arc\(cx,\s*cy,\s*radius\s*-\s*6\.2/);
    expect(najilu).toContain('function stampSerialCode');
    expect(najilu).toContain('bottomArc: true');
    expect(najilu).toMatch(/for \(i = 0; i < 13; i\+\+\)/);
  });
});
