import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const shuimingResult = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');

describe('收入纳税明细顶部可拉且无白条', () => {
  it('禁用原生整页 overscroll，改用列表脚本回弹', () => {
    expect(shuimingResult).toContain('overscroll-behavior-y: none');
    expect(shuimingResult).toContain('initSmRubberAndScrollThumb');
    expect(shuimingResult).toContain('function applyRubber');
    expect(shuimingResult).toContain('RUBBER_MAX');
    expect(shuimingResult).toContain("getElementById('recordList')");
  });

  it('回弹空隙用页灰填充，避免汇总下白条', () => {
    expect(shuimingResult).toContain('.list.sm-rubber-active');
    expect(shuimingResult).toContain('box-shadow: 0 -120px 0 0 #f5f6fa');
    expect(shuimingResult).toContain("el.classList.add('sm-rubber-active')");
  });

  it('页面铺满可视高度并铺灰底，减少顶上黑边', () => {
    expect(shuimingResult).toContain('min-height: 100vh');
    expect(shuimingResult).toContain('background: #f5f6fa');
    expect(shuimingResult).toContain('html.platform-ios body.page-shuiming-result::before');
  });
});
