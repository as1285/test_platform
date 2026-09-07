import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('我的页右上角激活按钮', () => {
  const mine = readFileSync(resolve(__dirname, '../../mine.html'), 'utf8');
  const guide = readFileSync(resolve(__dirname, '../../public/js/conversion-guide.js'), 'utf8');
  const auth = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

  it('有右上角激活按钮节点与样式', () => {
    expect(mine).toContain('id="mineActivateBtn"');
    expect(mine).toContain('class="mine-activate-btn header-activate-btn"');
    expect(mine).toContain('.mine-activate-btn');
    expect(mine).toContain('position: fixed');
  });

  it('已激活隐藏、未激活/过期显示', () => {
    expect(mine).toContain('body.page-mine.mine-account-active .mine-activate-btn');
    expect(mine).toMatch(/function updateMineActivateButton[\s\S]*btn\.style\.display = 'none'/);
    expect(mine).toMatch(/function updateMineActivateButton[\s\S]*btn\.style\.display = 'inline-flex'/);
    expect(mine).toContain('试用过期');
  });

  it('点击走开通入口', () => {
    expect(mine).toMatch(/mineActivateBtn\.addEventListener\('click'[\s\S]*openMineActivateModal/);
  });

  it('转化引导清理营销 UI 时，未开通不得打 mine-account-active', () => {
    expect(guide).toMatch(
      /function removeMineConversionUi[\s\S]*classList\.toggle\(\s*['"]mine-account-active['"]\s*,\s*isAccountActive\(\)/
    );
    expect(guide).not.toMatch(
      /function removeMineConversionUi[\s\S]*classList\.add\(\s*['"]mine-account-active['"]/
    );
    expect(auth).toContain('conversion-guide.js?v=20260907-no-sm-fill');
  });
});
