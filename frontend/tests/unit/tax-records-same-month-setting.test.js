import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');
const adminHtml = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const recordsSrc = readFileSync(resolve(__dirname, '../../public/js/consult-records.js'), 'utf8');
const batchSrc = readFileSync(resolve(__dirname, '../../public/js/consult-batch-tax.js'), 'utf8');
const policySrc = readFileSync(resolve(__dirname, '../../../backend/src/tax/taxRecordsPolicy.js'), 'utf8');

describe('same-month tax records setting', () => {
  it('exposes a settings button and checkbox on consult records', () => {
    expect(html).toContain('id="btnTaxRecordsSettings"');
    expect(html).toContain('id="taxAllowMultiplePerMonth"');
    expect(html).toContain('id="btnSaveTaxRecordsSettings"');
    expect(html).toContain('允许同一月份添加多条记录');
    expect(html).toContain('consult-records.js?v=20260914-same-month');
  });

  it('admin settings can turn the same flag on', () => {
    expect(adminHtml).toContain('id="taxAllowMultiplePerMonthAdmin"');
    expect(adminHtml).toContain('btnSaveTaxRecordsPolicy');
    expect(adminHtml).toContain('admin_panel.js?v=20260914-same-month');
  });

  it('client writes send allow_multiple_per_month and unique batch ids when enabled', () => {
    expect(recordsSrc).toContain('allow_multiple_per_month');
    expect(recordsSrc).toContain('save_records_policy');
    expect(recordsSrc).toContain('/api/public/tax-records-policy');
    expect(batchSrc).toContain('_batchSalaryIdSeq');
    expect(batchSrc).toContain('isAllowSameMonthTaxRecords');
  });

  it('backend policy key stays stable', () => {
    expect(policySrc).toContain("tax_records_policy_json");
    expect(policySrc).toContain('allow_multiple_per_month');
  });
});
