import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

beforeAll(() => {
  const code = readFileSync(resolve(__dirname, '../../public/js/shenbao_jilu_store.js'), 'utf8');
  // eslint-disable-next-line no-eval
  eval(code);
});

describe('ShenbaoJiluStore', () => {
  it('normalizes income breakdown and sums', () => {
    const S = window.ShenbaoJiluStore;
    const breakdown = S.normalizeIncomeBreakdown({
      salary: [{ period: '2025-12', subtype: '正常工资薪金', amount: '1000.5' }]
    });
    expect(Array.isArray(breakdown.salary)).toBe(true);
    expect(breakdown.salary.length).toBeGreaterThan(0);
    const sum = S.sumIncomeBreakdown(breakdown);
    expect(Number(sum)).toBeGreaterThan(0);
  });

  it('amountLine formats display', () => {
    const S = window.ShenbaoJiluStore;
    const line = S.amountLine({ amount: '12.3', supplementTax: '12.3' });
    expect(line).toContain('元');
  });

  it('createNewRecordTemplate has id', () => {
    const S = window.ShenbaoJiluStore;
    const t = S.createNewRecordTemplate();
    expect(t).toBeTruthy();
  });
});
