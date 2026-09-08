'use strict';

const {
  splitBasicAndSpecialAdditionalDeduction,
  otherDeductionForDisplay,
  periodOtherDeductionForDetail,
  isSeparateTaxIncomeSubtype,
  sumCumulativeWageIncome
} = require('../../src/tax/deductionSplit');

describe('deductionSplit', () => {
  it('maps other_deduction to special additional', () => {
    const rec = {
      income_subtype: '正常工资薪金',
      deduction_fee: '5000.00',
      other_deduction: '1500.00'
    };
    const sp = splitBasicAndSpecialAdditionalDeduction(rec);
    expect(sp.basic).toBe(5000);
    expect(sp.specialAdditional).toBe(1500);
    expect(otherDeductionForDisplay(rec, sp)).toBe(0);
    expect(periodOtherDeductionForDetail(rec)).toBe(0);
  });

  it('legacy: deduction_fee > 5000 splits into special additional', () => {
    const rec = {
      income_subtype: '正常工资薪金',
      deduction_fee: '6500.00',
      other_deduction: '0'
    };
    const sp = splitBasicAndSpecialAdditionalDeduction(rec);
    expect(sp.basic).toBe(5000);
    expect(sp.specialAdditional).toBe(1500);
    expect(otherDeductionForDisplay(rec, sp)).toBe(0);
  });

  it('does not double-count 1500 as both special additional and other', () => {
    const rows = [
      {
        income_subtype: '正常工资薪金',
        deduction_fee: '5000.00',
        other_deduction: '1500.00',
        special_deduction: '1125.00'
      }
    ];
    let totalSpecialAdditional = 0;
    let totalOtherDisplay = 0;
    rows.forEach(function (r) {
      const split = splitBasicAndSpecialAdditionalDeduction(r);
      totalSpecialAdditional += split.specialAdditional;
      totalOtherDisplay += otherDeductionForDisplay(r, split);
    });
    expect(totalSpecialAdditional).toBe(1500);
    expect(totalOtherDisplay).toBe(0);
  });

  it('year-end bonus keeps other_deduction as other', () => {
    const rec = {
      income_subtype: '全年一次性奖金收入',
      deduction_fee: '0',
      other_deduction: '100'
    };
    const sp = splitBasicAndSpecialAdditionalDeduction(rec);
    expect(sp.specialAdditional).toBe(0);
    expect(otherDeductionForDisplay(rec, sp)).toBe(100);
  });

  it('marks bonus and severance as separate-tax subtypes', () => {
    expect(isSeparateTaxIncomeSubtype('全年一次性奖金收入')).toBe(true);
    expect(isSeparateTaxIncomeSubtype('全年一次性奖金')).toBe(true);
    expect(isSeparateTaxIncomeSubtype('解除劳动合同一次性补偿收入')).toBe(true);
    expect(isSeparateTaxIncomeSubtype('裁员补偿金')).toBe(true);
    expect(isSeparateTaxIncomeSubtype('正常工资薪金')).toBe(false);
  });

  it('excludes January year-end bonus from cumulative wage income (keeps 3% path)', () => {
    const rows = [
      {
        income_subtype: '正常工资薪金',
        month: 1,
        income: '15000',
        income_this_period: '15000'
      },
      {
        income_subtype: '全年一次性奖金收入',
        month: 1,
        income: '100000',
        income_this_period: '100000'
      }
    ];
    expect(sumCumulativeWageIncome(rows)).toBe(15000);
  });
});
