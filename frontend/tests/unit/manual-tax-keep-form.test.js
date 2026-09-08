import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const recordsJs = readFileSync(resolve(__dirname, '../../public/js/consult-records.js'), 'utf8');
const shuiming = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const monolith = readFileSync(resolve(__dirname, '../../../backend/src/legacy/monolith.js'), 'utf8');
const consultHtml = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');

describe('手动编辑税额以表单为准', () => {
  it('单条保存：编辑已有记录时保留表单税额，不被公式覆盖', () => {
    expect(recordsJs).toMatch(/!!editId\s*\|\|\s*taxReportedWasManuallyChanged\(\)/);
    expect(recordsJs).toMatch(/formTaxNum\s*>\s*0/);
    expect(recordsJs).toMatch(/o\.tax_reported\s*=\s*formTaxRaw/);
  });

  it('同步后续月份：只改三险一金，保留原税额', () => {
    expect(recordsJs).toMatch(/next\.tax_reported\s*=\s*taxAmountKey\(rec\.tax_reported\)/);
    expect(recordsJs).toContain('保留原税额：同步基数不应覆盖');
    expect(consultHtml).toContain('保留各月已申报税额，不重算');
  });

  it('税款计算：累计收入含年终奖；本期税额优先读库内 tax_reported', () => {
    expect(monolith).toMatch(/totalIncomeAll\s*\+=\s*periodIncome/);
    expect(monolith).toMatch(/total_income:\s*totalIncomeAll\.toFixed\(2\)/);
    expect(monolith).toMatch(/storedCurrentTax\s*=\s*sumRowMoney\(anchor,\s*'tax_reported'\)/);
    expect(monolith).toMatch(/current_tax_reported_formula/);
  });

  it('收入纳税明细：pageshow 强制绕过 60s 缓存刷新合计', () => {
    expect(shuiming).toMatch(/opts\.force\s*\?\s*null\s*:\s*readShuimingRecordsCache/);
    expect(shuiming).toMatch(/loadData\(\{\s*quiet:.*force:\s*true\s*\}\)/);
  });
});
