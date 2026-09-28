import { describe, it, expect } from 'vitest';
import { normalizeOcrTaxText } from '../../src/tax/screenshotOcr.js';

describe('tax screenshot OCR normalize', () => {
  it('folds multi-line APP blocks and renames 已申报税额', () => {
    const raw =
      '南京某某科技有限公司\n' +
      '2024年01月\n\n正常工资薪金\n\n收入 20,000.00\n\n已申报税额 150.50\n' +
      '2024年02月\n正常工资薪金\n收入 20,000.00\n税额 160.20';
    const text = normalizeOcrTaxText(raw);
    expect(text).toContain('2024年1月 收入20000.00元 税额150.50元');
    expect(text).toContain('2024年2月 收入20000.00元 税额160.20元');
    expect(text).not.toContain('已申报税额');
  });

  it('repairs common OCR month and income typos', () => {
    const text = normalizeOcrTaxText(
      '某某有限公司\n2024年03 FA\nWA, 21,000.00\n税额 180.00'
    );
    expect(text).toMatch(/2024年3月/);
    expect(text).toMatch(/收入\s*21,?000/);
  });
});
