import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');

describe('个人中心禁止下拉回弹', () => {
  it('html/body 关闭纵向 overscroll，不在 body 上 overflow:hidden', () => {
    expect(mine).toMatch(/html\s*,\s*html body\.page-mine,\s*body\.page-mine \.mine-stack\s*\{[^}]*overscroll-behavior-y:\s*none/);
    expect(mine).toContain('overscroll-behavior-y: none');
    expect(mine).toContain('勿在 body 上 overflow-x:hidden');
  });

  it('用非被动 touchmove 钉死整页，弹层滚动仍可用', () => {
    expect(mine).toContain('function mineInInnerScroller');
    expect(mine).toContain("addEventListener(\n                'touchmove'");
    expect(mine).toContain('passive: false');
    expect(mine).toContain('pinMinePageScroll');
    expect(mine).toContain('overscroll-behavior: contain');
  });
});
