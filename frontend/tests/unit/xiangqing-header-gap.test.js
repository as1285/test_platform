import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8');

describe('收入纳税明细详情顶栏灰缝', () => {
  it('首块白卡与顶栏之间露出 10px 页灰，对齐正版间隔', () => {
    expect(html).toMatch(/\.xq-section\s*\{[^}]*margin-top:\s*10px/);
    expect(html).not.toMatch(/\.xq-section:first-of-type\s*\{[^}]*margin-top:\s*0/);
    expect(html).not.toMatch(/\.header\s*\{[^}]*border-bottom:\s*1px solid #eee/);
  });

  it('详情页关掉 sticky 顶垫，并把正文顶距收到顶栏真实高度', () => {
    expect(html).toContain('body.page-xiangqing #iosStickyTint');
    expect(html).toContain('function closeXiangqingTopGap()');
    expect(html).toContain("body.style.setProperty('padding-top', nextPad + 'px', 'important')");
    expect(html).toContain('var seam = 10');
    expect(html).toContain('.xq-section[aria-labelledby="secSummary"] .info-row');
    expect(html).toContain('white-space: nowrap;');
  });
});
