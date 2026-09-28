import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const indirectEval = eval;
const BATCH_JS = resolve(__dirname, '../../public/js/consult-batch-tax.js');

function loadMultiBonusHelpers() {
  const full = readFileSync(BATCH_JS, 'utf8');
  const start = full.indexOf('function nextBatchBonusMonthSuggestion');
  const end = full.indexOf('function collectBatchBonusSnapshot');
  const parseStart = full.indexOf('function parseBatchEmpIdxFromRecordId');
  const parseEnd = full.indexOf('\nfunction ', parseStart + 1);
  if (start < 0 || end < 0 || parseStart < 0 || parseEnd < 0) {
    throw new Error('multi-bonus helpers not found');
  }
  window.round2 = function (n) {
    var x = Number(n);
    if (Number.isNaN(x)) return 0;
    return Math.round(x * 100) / 100;
  };
  window.ymToKey = function (y, m) {
    return y * 100 + m;
  };
  window.bindBatchMonthInput = function () {};
  window.bindBatchYearInput = function () {};
  window.scheduleBatchTaxDraftSave = function () {};
  window.syncBatchEmpBonusMetaExpanded = function () {};
  window.setBatchEmpBonusMetaExpanded = function () {};
  // assignBonusRecordsToPayloads 依赖 empIdx 解析；切片外函数声明需一并注入
  indirectEval(full.slice(parseStart, parseEnd));
  indirectEval(full.slice(start, end));
}

function bonusTplHtml() {
  return (
    '<template id="batchEmpBonusItemTpl">' +
    '<div class="batch-emp-bonus-item">' +
    '<div class="batch-emp-bonus-item-head">' +
    '<span class="batch-emp-bonus-item-title">年终奖</span>' +
    '<button type="button" class="batch-emp-bonus-remove">删除这笔</button>' +
    '</div>' +
    '<input class="batch-emp-bonus" value="0">' +
    '<input class="batch-emp-bonus-year">' +
    '<input class="batch-emp-bonus-month" value="12">' +
    '</div></template>'
  );
}

describe('batch multi year-end bonus', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    loadMultiBonusHelpers();
  });

  it('suggests June after December and December otherwise', () => {
    expect(window.nextBatchBonusMonthSuggestion(12)).toBe(6);
    expect(window.nextBatchBonusMonthSuggestion(6)).toBe(12);
    expect(window.nextBatchBonusMonthSuggestion(1)).toBe(12);
  });

  it('reads every bonus item from a row', () => {
    document.body.innerHTML =
      '<div class="batch-emp-row">' +
      '<div class="batch-emp-bonus-item"><input class="batch-emp-bonus" value="12000"><input class="batch-emp-bonus-year" value="2025"><input class="batch-emp-bonus-month" value="6"></div>' +
      '<div class="batch-emp-bonus-item"><input class="batch-emp-bonus" value="30000"><input class="batch-emp-bonus-year" value="2025"><input class="batch-emp-bonus-month" value="12"></div>' +
      '</div>';
    expect(window.collectBatchEmpBonusesFromRow(document.querySelector('.batch-emp-row'))).toEqual([
      { amount: 12000, year: 2025, month: 6 },
      { amount: 30000, year: 2025, month: 12 }
    ]);
  });

  it('employmentBonusList prefers bonuses[] and falls back to extraBonuses', () => {
    expect(
      window.employmentBonusList({
        bonuses: [
          { amount: 10000, year: 2025, month: 6 },
          { amount: 0, year: 2025, month: 7 },
          { amount: 20000, year: 2025, month: 12 }
        ]
      })
    ).toEqual([
      { amount: 10000, year: 2025, month: 6 },
      { amount: 20000, year: 2025, month: 12 }
    ]);
    expect(
      window.employmentBonusList({
        yearEndBonus: 8000,
        bonusYear: 2024,
        bonusMonth: 12,
        extraBonuses: [{ amount: 5000, year: 2024, month: 6 }]
      })
    ).toEqual([
      { amount: 8000, year: 2024, month: 12 },
      { amount: 5000, year: 2024, month: 6 }
    ]);
  });

  it('assigns each bonus to the employment segment covering that month', () => {
    const payloads = [
      { rowData: { company: '甲公司', sy: 2024, sm: 1, ey: 2024, em: 12 } },
      { rowData: { company: '甲公司', sy: 2025, sm: 1, ey: 2025, em: 6 } },
      { rowData: { company: '乙公司', sy: 2025, sm: 1, ey: 2025, em: 12 } }
    ];
    const assigned = window.assignBonusRecordsToPayloads(payloads, [
      { company_name: '甲公司', year: 2024, month: 6, income: '15000' },
      { company_name: '甲公司', year: 2024, month: 12, income: '28000' },
      { company_name: '甲公司', year: 2025, month: 6, income: '9000' },
      { company_name: '乙公司', year: 2025, month: 12, income: '20000' }
    ]);
    expect(assigned[0]).toEqual([
      { amount: 15000, year: 2024, month: 6 },
      { amount: 28000, year: 2024, month: 12 }
    ]);
    expect(assigned[1]).toEqual([{ amount: 9000, year: 2025, month: 6 }]);
    expect(assigned[2]).toEqual([{ amount: 20000, year: 2025, month: 12 }]);
  });

  it('writes multiple bonus items onto a row', () => {
    document.body.innerHTML =
      bonusTplHtml() +
      '<div class="batch-emp-row"><input class="batch-emp-ey" value="2025"><div class="batch-emp-bonus-list"></div></div>';
    const row = document.querySelector('.batch-emp-row');
    window.setBatchEmpBonusesOnRow(row, [
      { amount: 12000, year: 2025, month: 6 },
      { amount: 30000, year: 2025, month: 12 }
    ]);
    const items = row.querySelectorAll('.batch-emp-bonus-item');
    expect(items.length).toBe(2);
    expect(items[0].querySelector('.batch-emp-bonus').value).toBe('12000');
    expect(items[1].querySelector('.batch-emp-bonus-month').value).toBe('12');
    expect(items[0].querySelector('.batch-emp-bonus-item-title').textContent).toBe('年终奖 1');
  });

  it('gives each bonus a distinct record id', () => {
    const full = readFileSync(BATCH_JS, 'utf8');
    const start = full.indexOf('function buildBatchYearEndBonusRecord');
    const end = full.indexOf('function postBatchTaxRecordsPromise');
    window.yearEndBonusTaxSeparate = function () {
      return 300;
    };
    window.taxPeriodFromYearMonth = function (y, m) {
      return y + '-' + m;
    };
    window.reportDateOneMonthAfterBelonging = function () {
      return '2026-01-15';
    };
    indirectEval(full.slice(start, end));
    const a = window.buildBatchYearEndBonusRecord('u', {}, { name: '甲' }, 2025, 6, 10000, 0, 0);
    const b = window.buildBatchYearEndBonusRecord('u', {}, { name: '甲' }, 2025, 12, 20000, 0, 1);
    expect(a.id).toBe('tr_u_2025_6_bonus_0_0');
    expect(b.id).toBe('tr_u_2025_12_bonus_0_1');
    expect(a.income_subtype).toBe('全年一次性奖金收入');
  });
});
