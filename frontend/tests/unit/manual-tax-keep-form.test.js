import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const recordsJs = readFileSync(resolve(__dirname, '../../public/js/consult-records.js'), 'utf8');
const coreJs = readFileSync(resolve(__dirname, '../../public/js/consult-core.js'), 'utf8');
const consultHtml = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');

describe('手动编辑税额以表单为准', () => {
  it('单条保存：手改税额优先于同公司累计预扣强制重算', () => {
    expect(recordsJs).toContain('手改税额优先保留');
    expect(recordsJs).toMatch(/if\s*\(\s*usedManualTax\s*\)\s*\{/);
    expect(recordsJs).toMatch(
      /o\.tax_reported\s*=\s*taxAmountKey\(\s*document\.getElementById\(\s*['"]f_tax_reported['"]\s*\)\.value\s*\)/
    );
    expect(recordsJs).toMatch(/else if\s*\(\s*hasPriorSameCompanyWageRecord\(\s*o\s*,\s*list\s*\)\s*\)/);
  });

  it('收入变更时同步本期收入（仍跟旧收入一致时）', () => {
    expect(coreJs).toContain('function syncIncomeThisPeriodIfNeeded');
    expect(coreJs).toContain('incomeLoadedValue');
    expect(recordsJs).toContain('syncIncomeThisPeriodIfNeeded');
  });

  it('表单提示说明手改税额以填写为准', () => {
    expect(consultHtml).toContain('手改税额以填写为准');
  });
});
