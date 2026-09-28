import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const indirectEval = eval;
const BATCH_JS = resolve(__dirname, '../../public/js/consult-batch-tax.js');
const CORE_JS = resolve(__dirname, '../../public/js/consult-core.js');
const CONSULT_HTML = resolve(__dirname, '../../consult.html');

function loadSeveranceHelpers() {
  const full = readFileSync(BATCH_JS, 'utf8');
  const start = full.indexOf('function defaultBatchSeveranceYearForRow');
  const end = full.indexOf('function appendAutoDedupedTip');
  if (start < 0 || end < 0) {
    throw new Error('severance helpers not found');
  }
  window.round2 = function (n) {
    var x = Number(n);
    if (Number.isNaN(x)) return 0;
    return Math.round(x * 100) / 100;
  };
  window.defaultBatchBonusYearForRow = function () {
    return new Date().getFullYear();
  };
  window.nextBatchBonusMonthSuggestion = function (lastMonth) {
    var m = parseInt(lastMonth, 10) || 0;
    if (m === 12) return 6;
    return 12;
  };
  window.normalizeBatchBonusItem = function (b) {
    if (!b || typeof b !== 'object') {
      return { amount: 0, year: 0, month: 0 };
    }
    var amount = parseFloat(b.amount != null ? b.amount : b.yearEndBonus);
    if (!isFinite(amount) || amount < 0) amount = 0;
    amount = window.round2(amount);
    var year = parseInt(b.year != null ? b.year : b.bonusYear, 10) || 0;
    var month = parseInt(b.month != null ? b.month : b.bonusMonth, 10) || 0;
    return { amount: amount, year: year, month: month };
  };
  window.filledBatchEmpBonuses = function (bonuses) {
    return (bonuses || [])
      .map(window.normalizeBatchBonusItem)
      .filter(function (b) {
        return b.amount > 0;
      });
  };
  window.bindBatchMonthInput = function () {};
  window.bindBatchYearInput = function () {};
  window.scheduleBatchTaxDraftSave = function () {};
  indirectEval(full.slice(start, end));
}

function loadSeveranceTaxFns() {
  const full = readFileSync(CORE_JS, 'utf8');
  const start = full.indexOf('var SEVERANCE_LOCAL_AVG_WAGE');
  const end = full.indexOf('/** 税额格式化为两位小数字符串。 */');
  if (start < 0 || end < 0) {
    throw new Error('severance tax helpers not found');
  }
  window.round2 = function (n) {
    var x = Number(n);
    if (Number.isNaN(x)) return 0;
    return Math.round(x * 100) / 100;
  };
  indirectEval(full.slice(start, end));
}

function severanceTplHtml() {
  return (
    '<template id="batchEmpSeveranceItemTpl">' +
    '<div class="batch-emp-severance-item">' +
    '<div class="batch-emp-severance-item-head">' +
    '<span class="batch-emp-severance-item-title">裁员补偿</span>' +
    '<button type="button" class="batch-emp-severance-remove">删除这笔</button>' +
    '</div>' +
    '<input class="batch-emp-severance" value="0">' +
    '<input class="batch-emp-severance-year">' +
    '<input class="batch-emp-severance-month" value="12">' +
    '</div></template>'
  );
}

describe('batch layoff / severance compensation', () => {
  it('consult form has a severance block like annual bonus', () => {
    const html = readFileSync(CONSULT_HTML, 'utf8');
    expect(html).toContain('batch-emp-severance-meta');
    expect(html).toContain('解除劳动合同补偿');
    expect(html).toContain('191367');
    expect(html).toContain('574101');
    expect(html).toContain('id="batchEmpSeveranceItemTpl"');
    expect(html).toContain('单独增加裁员补偿');
    expect(html).toContain('仅添加裁员补偿');
    const rowTpl = html.slice(html.indexOf('id="batchEmpRowTpl"'), html.indexOf('id="batchEmpBonusItemTpl"'));
    expect(rowTpl.indexOf('batch-emp-bonus-meta')).toBeLessThan(rowTpl.indexOf('batch-emp-severance-meta'));
  });

  describe('row helpers', () => {
    beforeEach(() => {
      document.body.innerHTML = '';
      loadSeveranceHelpers();
    });

    it('reads every severance item from a row', () => {
      document.body.innerHTML =
        '<div class="batch-emp-row">' +
        '<div class="batch-emp-severance-item"><input class="batch-emp-severance" value="200000"><input class="batch-emp-severance-year" value="2026"><input class="batch-emp-severance-month" value="6"></div>' +
        '<div class="batch-emp-severance-item"><input class="batch-emp-severance" value="360000"><input class="batch-emp-severance-year" value="2026"><input class="batch-emp-severance-month" value="9"></div>' +
        '</div>';
      expect(window.collectBatchEmpSeverancesFromRow(document.querySelector('.batch-emp-row'))).toEqual([
        { amount: 200000, year: 2026, month: 6 },
        { amount: 360000, year: 2026, month: 9 }
      ]);
    });

    it('employmentSeveranceList keeps filled amounts only', () => {
      expect(
        window.employmentSeveranceList({
          severances: [
            { amount: 180000, year: 2026, month: 3 },
            { amount: 0, year: 2026, month: 6 },
            { amount: 400000, year: 2026, month: 9 }
          ]
        })
      ).toEqual([
        { amount: 180000, year: 2026, month: 3 },
        { amount: 400000, year: 2026, month: 9 }
      ]);
    });

    it('writes multiple severance items onto a row', () => {
      document.body.innerHTML =
        severanceTplHtml() +
        '<div class="batch-emp-row"><input class="batch-emp-ey" value="2026"><input class="batch-emp-em" value="9"><div class="batch-emp-severance-list"></div></div>';
      const row = document.querySelector('.batch-emp-row');
      window.setBatchEmpSeverancesOnRow(row, [
        { amount: 200000, year: 2026, month: 6 },
        { amount: 360000, year: 2026, month: 9 }
      ]);
      const items = row.querySelectorAll('.batch-emp-severance-item');
      expect(items.length).toBe(2);
      expect(items[0].querySelector('.batch-emp-severance').value).toBe('200000');
      expect(items[1].querySelector('.batch-emp-severance-month').value).toBe('9');
      expect(items[0].querySelector('.batch-emp-severance-item-title').textContent).toBe('裁员补偿 1');
    });
  });

  describe('record builder and tax', () => {
    beforeEach(() => {
      loadSeveranceTaxFns();
      const full = readFileSync(BATCH_JS, 'utf8');
      const start = full.indexOf('function buildBatchSeveranceRecord');
      const end = full.indexOf('function postBatchTaxRecordsPromise');
      window.taxPeriodFromYearMonth = function (y, m) {
        return y + '-' + m;
      };
      window.reportDateOneMonthAfterBelonging = function () {
        return '2026-10-15';
      };
      indirectEval(full.slice(start, end));
    });

    it('gives each severance a distinct record id and official subtype', () => {
      const a = window.buildBatchSeveranceRecord('u', {}, { name: '甲' }, 2026, 6, 200000, 0, 0);
      const b = window.buildBatchSeveranceRecord('u', {}, { name: '甲' }, 2026, 9, 400000, 0, 1);
      expect(a.id).toBe('tr_u_2026_6_severance_0_0');
      expect(b.id).toBe('tr_u_2026_9_severance_0_1');
      expect(a.income_type).toBe('工资薪金');
      expect(a.income_subtype).toBe('解除劳动合同一次性补偿收入');
      expect(a.pension_insurance).toBe('0.00');
      expect(a.special_deduction).toBe('0.00');
    });

    it('treats compensation within 3x Shenzhen average wage as tax-free', () => {
      expect(window.SEVERANCE_LOCAL_AVG_WAGE).toBe(191367);
      expect(window.SEVERANCE_TAX_FREE_CAP).toBe(574101);
      expect(window.severanceCompensationTaxSeparate(200000)).toBe(0);
      expect(window.severanceCompensationTaxSeparate(574101)).toBe(0);
      expect(window.severanceTaxFreeIncome(200000)).toBe(200000);
      expect(window.severanceTaxFreeIncome(574101)).toBe(574101);
      const rec = window.buildBatchSeveranceRecord('u', {}, { name: '甲' }, 2026, 9, 200000, 0, 0);
      expect(rec.tax_reported).toBe('0');
      expect(rec.tax_free_income).toBe('200000');
    });

    it('taxes the excess with the annual comprehensive table', () => {
      // 614101 - 574101 = 40000 → 10% − 2520 = 1480
      expect(window.severanceCompensationTaxSeparate(614101)).toBe(1480);
      expect(window.severanceTaxFreeIncome(614101)).toBe(574101);
      const rec = window.buildBatchSeveranceRecord('u', {}, { name: '甲' }, 2026, 9, 614101, 1, 0);
      expect(rec.tax_reported).toBe('1480');
      expect(rec.tax_free_income).toBe('574101');
    });
  });
});
