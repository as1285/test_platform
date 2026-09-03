'use strict';

const {
  splitBasicAndSpecialAdditionalDeduction,
  otherDeductionForDisplay,
  periodOtherDeductionForDetail
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
});
