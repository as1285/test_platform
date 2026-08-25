import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const moduleCode = readFileSync(
  resolve(__dirname, '../../public/js/admin/modules/najilu-qr.js'),
  'utf8'
);

describe('完税二维码默认提取框', () => {
  beforeEach(() => {
    delete window.AdminModules;
    // eslint-disable-next-line no-eval
    eval(moduleCode);
  });

  it('整块模式在二维码四周扩边并重点增加验证码下方空间', () => {
    const mod = window.AdminModules['najilu-qr'];
    const region = mod._regionFromQrBox(
      { x: 800, y: 40, width: 180, height: 180 },
      'block',
      1240,
      1754
    );

    expect(region.sw).toBe(223);
    expect(region.sh).toBe(343);
    expect(region.sx).toBe(779);
    expect(region.sy).toBe(31);
    expect(region.sx).toBeLessThan(800);
    expect(region.sy + region.sh).toBeGreaterThan(40 + 180 * (310 / 185));
  });

  it('固定坐标兜底框同步扩大且不会越出图片', () => {
    const mod = window.AdminModules['najilu-qr'];
    expect(mod._regionForMode('block', 1240, 1754)).toEqual({
      sx: 961,
      sy: 33,
      sw: 229,
      sh: 352
    });

    const edge = mod._regionFromQrBox(
      { x: 1100, y: 40, width: 180, height: 180 },
      'block',
      1240,
      1754
    );
    expect(edge.sx + edge.sw).toBe(1240);
  });
});
