import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../xiangqing.html'), 'utf8');

describe('本期专项扣除金额「元」对齐', () => {
  it('箭头绝对定位，不挤占金额文档流，保证与上下行「元」对齐', () => {
    expect(html).toContain('id="specialDeduction"');
    expect(html).toContain('id="specialDeductionArrow"');
    expect(html).toContain('id="specialDeductionDetail"');
    expect(html).toContain('id="bonusSpecialDeduction"');
    expect(html).toContain('class="detail-chevron"');
    expect(html).toMatch(/\.detail-chevron\s*\{[^}]*position:\s*absolute/);
    expect(html).toMatch(/auth\.js\?v=2026[\w-]+/);
  });
});
