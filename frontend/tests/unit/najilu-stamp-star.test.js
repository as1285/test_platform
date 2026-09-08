import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const najilu = readFileSync(resolve(__dirname, '../../public/js/najilu.js'), 'utf8');

describe('纳税记录公章对齐正版', () => {
  it('Canvas 章含五角星，且业务专用章在星下方', () => {
    expect(najilu).toContain('function drawFivePointStar');
    expect(najilu).toContain('正版税局电子章中心五角星');
    expect(najilu).toContain("drawSpacedText(ctx, '业务专用章', cx, cy + 34");
    expect(najilu).toMatch(/drawFivePointStar\(ctx,\s*cx,\s*cy\s*-\s*2,\s*24/);
    expect(najilu).not.toMatch(/drawSpacedText\(ctx,\s*'业务专用章',\s*cx,\s*cy\s*\+\s*8/);
  });

  it('正版章用朱红、外粗内细双圈，无底弧电话/编号，字距拉开', () => {
    expect(najilu).toContain("var stampRed = '#c62828'");
    expect(najilu).toContain('外粗圈 + 内细圈');
    expect(najilu).toMatch(/ctx\.arc\(cx,\s*cy,\s*radius\s*-\s*6\.2/);
    expect(najilu).not.toContain('function stampSerialCode');
    expect(najilu).not.toContain('bottomArc: true');
    expect(najilu).toMatch(/letterGap:\s*7\.5/);
    expect(najilu).toMatch(/maxSpanRad:\s*Math\.PI\s*\*\s*1\.02/);
  });
});
