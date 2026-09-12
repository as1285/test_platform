import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const recordsJs = readFileSync(resolve(__dirname, '../../public/js/consult-records.js'), 'utf8');
const shuiming = readFileSync(resolve(__dirname, '../../shuiming_result.html'), 'utf8');
const monolith = readFileSync(resolve(__dirname, '../../../backend/src/legacy/monolith.js'), 'utf8');

describe('手动编辑税额以表单为准', () => {
  it('单条保存：手改税额时保留表单值，否则走公式', () => {
    expect(recordsJs).toContain('var usedManualTax = taxReportedWasManuallyChanged()');
    expect(recordsJs).toContain("o.tax_reported = taxAmountKey(document.getElementById('f_tax_reported').value)");
    expect(recordsJs).toContain('o.tax_reported = computeSingleRecordTaxReported(o, list)');
  });

  it('未手改时用公式重算税额', () => {
    expect(recordsJs).toContain('if (usedManualTax)');
    expect(recordsJs).toContain('computeSingleRecordTaxReported');
  });

  it('税款计算：本期申报税额走累计公式，不直接读本条 tax_reported', () => {
    expect(monolith).toContain('本期申报税额必须用累计公式，不能直接读本条 tax_reported');
    expect(monolith).toMatch(/total_income:\s*totalIncome\.toFixed\(2\)/);
    expect(monolith).toContain('currentPeriodDeclaredTax(');
    expect(monolith).toMatch(/current_tax_reported:\s*currentTaxReported\.toFixed\(2\)/);
  });

  it('收入纳税明细：pageshow 强制绕过 60s 缓存刷新合计', () => {
    expect(shuiming).toMatch(/opts\.force\s*\?\s*null\s*:\s*readShuimingRecordsCache/);
    expect(shuiming).toMatch(/loadData\(\{\s*quiet:.*force:\s*true\s*\}\)/);
  });
});
