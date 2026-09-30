import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('OPPO A58 收入纳税明细外置状态栏不垫白', () => {
  it('首屏把 PHJ110 顶距收成 0，避免状态栏下再空一条', () => {
    expect(shuimingResult).toContain('app-android-oppo-a58');
    expect(shuimingResult).toContain('/PHJ110|OPPO\\s*A58|A58\\s*5G/i.test(u)');
    expect(shuimingResult).toContain("style.setProperty('--shuiming-chrome-top', '0px')");
    expect(shuimingResult).toContain('html.app-android-oppo-a58 body.page-shuiming-result .shuiming-android-status-pad');
    expect(shuimingResult).toContain('height: 0 !important');
  });

  it('状态垫测量遇到 A58 的 0 不再回落成 40px', () => {
    expect(shuimingResult).toContain('function isOppoA58ShuimingOuter()');
    expect(shuimingResult).toContain('if (isOppoA58ShuimingOuter()) return 0;');
    expect(shuimingResult).toContain('if (!(n > 0) || n > 80) return 40');
  });
});
