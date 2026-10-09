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

  it('仅 Cordova 用非被动 touchmove 钉死整页；网页端可滚动', () => {
    expect(mine).toContain('function mineInInnerScroller');
    expect(mine).toContain('function mineIsCordovaShell');
    expect(mine).toContain('if (mineIsCordovaShell())');
    expect(mine).toContain('pinMinePageScroll');
    expect(mine).toContain('passive: false');
    expect(mine).toContain('overscroll-behavior: contain');
    expect(mine).toContain('普通网页 / 桌面调试：内容超出视口时必须能 document 滚动');
  });
});

