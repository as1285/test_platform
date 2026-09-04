'use strict';

const {
  specialDeductionRefundEstimate,
  buildRefundAmountEmailCopy,
  formatRefundYuan,
  iitComprehensiveTax
} = require('../../src/admin/refundEstimate');

function monthsForYear(year, income, tax) {
  const rows = [];
  for (let m = 1; m <= 12; m++) {
    rows.push({
      year: year,
      month: m,
      income: String(income),
      tax_reported: String(tax),
      company_name: '甲公司'
    });
  }
  return rows;
}

describe('refundEstimate (email amount)', () => {
  it('matches ad-page 3-year capped refund', () => {
    expect(iitComprehensiveTax(96000)).toBe(7080);
    const threeYears = []
      .concat(monthsForYear(2023, '13000', '200'))
      .concat(monthsForYear(2024, '13000', '200'))
      .concat(monthsForYear(2025, '13000', '200'));
    const est = specialDeductionRefundEstimate(threeYears);
    expect(est.total).toBe(7200);
    expect(est.has_any_records).toBe(true);
    expect(est.years.map((y) => y.year)).toEqual([2025, 2024, 2023]);
    expect(est.years.every((y) => y.saved === 2400)).toBe(true);
  });

  it('returns 0 when there are no records', () => {
    const est = specialDeductionRefundEstimate([]);
    expect(est.total).toBe(0);
    expect(est.has_any_records).toBe(false);
  });

  it('skips 示例 companies', () => {
    const est = specialDeductionRefundEstimate([
      { year: 2024, month: 1, income: '20000', tax_reported: '800', company_name: '示例公司' }
    ]);
    expect(est.has_any_records).toBe(false);
    expect(est.total).toBe(0);
  });

  it('puts the amount in subject and body', () => {
    const threeYears = []
      .concat(monthsForYear(2023, '13000', '200'))
      .concat(monthsForYear(2024, '13000', '200'))
      .concat(monthsForYear(2025, '13000', '200'));
    const copy = buildRefundAmountEmailCopy(specialDeductionRefundEstimate(threeYears));
    expect(copy.subject).toBe('二次退税：测算约可退 ' + formatRefundYuan(7200));
    expect(copy.content).toContain('大约可退 ¥7,200');
    expect(copy.content).toContain('2025 年约 ¥2,400');
    expect(copy.content).toContain('2023 年约 ¥2,400');
    expect(copy.link_url).toBe('refund_ad.html?from=email_refund&est=7200');
    expect(copy.benefits).toContain('¥7,200');
  });

  it('zero-record copy still states ¥0', () => {
    const copy = buildRefundAmountEmailCopy(specialDeductionRefundEstimate([]));
    expect(copy.subject).toContain('¥0');
    expect(copy.content).toContain('约 ¥0');
    expect(copy.link_url).toBe('refund_ad.html?from=email_refund&est=0');
  });
});
