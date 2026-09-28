'use strict';

const { currentPeriodDeclaredTax } = require('../../src/tax/withholdingCalc');

describe('withholdingCalc currentPeriodDeclaredTax', () => {
  it('matches 累计应纳税额 − 累计已缴 − 累计减免', () => {
    expect(currentPeriodDeclaredTax(11150.89, 8611.83, 0)).toBe(2539.06);
    expect(currentPeriodDeclaredTax(11150.89, 8611.83, 100)).toBe(2439.06);
  });

  it('allows negative when prepaid exceeds payable', () => {
    expect(currentPeriodDeclaredTax(100, 150, 0)).toBe(-50);
  });

  it('treats null/invalid as 0', () => {
    expect(currentPeriodDeclaredTax(null, null, null)).toBe(0);
    expect(currentPeriodDeclaredTax('12.34', '2.34', '0')).toBe(10);
  });
});
