import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');
const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');

describe('红米 Note 13 Pro 我的页税号与三宫格', () => {
  it('不走 HyperOS 2 的 100% 100% 压扁，底图按宽度顶对齐', () => {
    expect(auth).toContain('function pinRedmiNote13ProMineE1Layout()');
    expect(auth).toContain('pinRedmiNote13ProMineE1Layout()');
    expect(auth).toContain(':not(.app-android-redmi-note13-pro)');
    expect(auth).toContain("canvasN13.style.setProperty('background-size', '100% auto', 'important')");
    expect(auth).toContain("canvasN13.style.setProperty('aspect-ratio', '750 / 1242', 'important')");
    expect(auth).toMatch(
      /function isHyperOs2MineE1SmClient\(\) \{[\s\S]{0,1200}isRedmiNote13ProClient\(\)/
    );
    expect(auth).toMatch(
      /function pinXiaomi14ProMineE1Layout\(\) \{[\s\S]{0,1400}pinRedmiNote13ProMineE1Layout\(\)/
    );
  });

  it('税号上移 8rpx，胶囊仍留在 688 对齐未压扁底图', () => {
    expect(auth).toContain('top:calc(430 * var(--mine-rpx)) !important');
    expect(mine).toContain('top: calc(430 * var(--mine-rpx)) !important');
    expect(mine).toContain('background-size: 100% auto !important');
    expect(mine).toContain('aspect-ratio: 750 / 1242 !important');
    expect(mine).not.toMatch(
      /html\.app-android-redmi-note13-pro body\.page-mine \.mine-e1-pill[\s\S]{0,80}top:/
    );
  });
});
