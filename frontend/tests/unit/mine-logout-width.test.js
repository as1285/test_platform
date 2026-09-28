import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');

describe('我的页退出登录与 e1 菜单卡同宽', () => {
  it('footer 左右用 24rpx，不再叠一层 16px', () => {
    expect(mine).toContain('padding: 8px calc(24 * var(--mine-rpx, 100vw / 750))');
    expect(mine).toContain('与 e1 菜单白卡同宽');
    expect(mine).toMatch(/\.logout-section\s*\{[\s\S]*?margin:\s*12px 0 0;/);
    expect(mine).not.toMatch(/\.logout-section\s*\{[\s\S]*?margin:\s*12px 16px 0;/);
  });
});
