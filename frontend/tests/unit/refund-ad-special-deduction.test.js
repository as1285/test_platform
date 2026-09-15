import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const guideSrc = readFileSync(
  resolve(__dirname, '../../public/js/conversion-guide.js'),
  'utf8'
);
const adHtml = readFileSync(resolve(__dirname, '../../refund_ad.html'), 'utf8');
const authSrc = readFileSync(resolve(__dirname, '../../public/js/auth.js'), 'utf8');

function loadEstimateApi() {
  const fnBody = `
      var REFUND_AD_MIN_TAX_REPORTED = 5000;
      var REFUND_AD_MIN_YEAR_INCOME = 150000;
      var REFUND_AD_TAX_YEARS = [2025, 2024, 2023];
      var REFUND_CHILD_MONTH = 4500;
      var REFUND_PARENT_MONTH = 3000;
      var REFUND_MONTHLY_EXTRA = REFUND_CHILD_MONTH + REFUND_PARENT_MONTH;
      var REFUND_BASIC_DEDUCTION = 60000;
      function parseTaxReportedAmount(val) {
        var n = parseFloat(String(val == null ? '' : val).replace(/,/g, ''));
        return isFinite(n) && n >= 0 ? n : 0;
      }
      function isExampleCompanyRecord(r) {
        return String((r && r.company_name) || '').indexOf('示例') >= 0;
      }
      function recordMonthIncome(r) {
        var a = parseTaxReportedAmount(r && r.income_this_period);
        var b = parseTaxReportedAmount(r && r.income);
        return a > b ? a : b;
      }
      function emptyYearRefundTotals(year) {
        return {
          year: year || 0,
          tax_sum: 0,
          income_sum: 0,
          month_count: 0,
          record_count: 0,
          tax_hit: false,
          income_hit: false,
          reason: ''
        };
      }
      function yearRefundTotals(records, year) {
        var y = parseInt(String(year), 10);
        var tax = 0;
        var income = 0;
        var recordCount = 0;
        var months = {};
        if (!y || !records || !records.length) return emptyYearRefundTotals(y);
        records.forEach(function (r) {
          if (!r || isExampleCompanyRecord(r)) return;
          if (parseInt(String(r.year), 10) !== y) return;
          recordCount += 1;
          tax += parseTaxReportedAmount(r.tax_reported);
          income += recordMonthIncome(r);
          var m = parseInt(String(r.month), 10);
          if (m >= 1 && m <= 12) months[m] = true;
        });
        tax = Math.round(tax * 100) / 100;
        income = Math.round(income * 100) / 100;
        var monthCount = Object.keys(months).length;
        if (!monthCount && recordCount > 0) monthCount = Math.min(12, recordCount);
        var taxHit = tax > REFUND_AD_MIN_TAX_REPORTED;
        var incomeHit = income >= REFUND_AD_MIN_YEAR_INCOME;
        var reason = '';
        if (taxHit && incomeHit) reason = 'both';
        else if (taxHit) reason = 'tax';
        else if (incomeHit) reason = 'income';
        return {
          year: y,
          tax_sum: tax,
          income_sum: income,
          month_count: monthCount,
          record_count: recordCount,
          tax_hit: taxHit,
          income_hit: incomeHit,
          reason: reason
        };
      }
      function roundRefundMoney(n) {
        return Math.round((Number(n) || 0) * 100) / 100;
      }
      function iitComprehensiveTax(taxable) {
        var t = Math.max(0, Number(taxable) || 0);
        var rate;
        var quick;
        if (t <= 36000) { rate = 0.03; quick = 0; }
        else if (t <= 144000) { rate = 0.1; quick = 2520; }
        else if (t <= 300000) { rate = 0.2; quick = 16920; }
        else if (t <= 420000) { rate = 0.25; quick = 31920; }
        else if (t <= 660000) { rate = 0.3; quick = 52920; }
        else if (t <= 960000) { rate = 0.35; quick = 85920; }
        else { rate = 0.45; quick = 181920; }
        return Math.max(0, roundRefundMoney(t * rate - quick));
      }
      function specialDeductionRefundEstimate(records) {
        var years = [];
        var total = 0;
        REFUND_AD_TAX_YEARS.forEach(function (y) {
          var row = yearRefundTotals(records, y);
          if (!(row.income_sum > 0 || row.tax_sum > 0)) return;
          var months = row.month_count || 0;
          if (!months) months = 12;
          var extra = REFUND_MONTHLY_EXTRA * months;
          var beforeTaxable = Math.max(0, row.income_sum - REFUND_BASIC_DEDUCTION);
          var afterTaxable = Math.max(0, row.income_sum - REFUND_BASIC_DEDUCTION - extra);
          var saved = roundRefundMoney(
            iitComprehensiveTax(beforeTaxable) - iitComprehensiveTax(afterTaxable)
          );
          if (row.tax_sum > 0) saved = Math.min(saved, row.tax_sum);
          saved = Math.max(0, roundRefundMoney(saved));
          years.push({
            year: y,
            months: months,
            income: row.income_sum,
            tax_reported: row.tax_sum,
            extra: extra,
            saved: saved
          });
          total += saved;
        });
        years.sort(function (a, b) { return b.year - a.year; });
        return { total: roundRefundMoney(total), years: years };
      }
      return {
        iitComprehensiveTax: iitComprehensiveTax,
        yearRefundTotals: yearRefundTotals,
        specialDeductionRefundEstimate: specialDeductionRefundEstimate
      };
    `;
  // eslint-disable-next-line no-new-func
  return new Function(fnBody)();
}

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

describe('special deduction refund estimate + force dialog removed', () => {
  it('keeps estimate helpers and disables the locked refund force dialog', () => {
    expect(guideSrc).toContain('REFUND_CHILD_MONTH = 4500');
    expect(guideSrc).toContain('REFUND_PARENT_MONTH = 3000');
    expect(guideSrc).toContain('REFUND_MONTHLY_EXTRA');
    expect(guideSrc).toContain('function iitComprehensiveTax');
    expect(guideSrc).toContain('function specialDeductionRefundEstimate');
    expect(guideSrc).toContain('function showSpecialDeductionRefundDialog');
    expect(guideSrc).toContain('function maybeGoRefundAdAfterTax');
    expect(guideSrc).toContain('已关闭强制退税弹框');
    expect(guideSrc).not.toContain('cg-refund-force-overlay');
    expect(guideSrc).not.toContain('cgRefundForceGo');
    expect(guideSrc).not.toContain('track_refund_ad_after_tax_show');
    expect(authSrc).toContain('conversion-guide.js?v=20260915-consult-not-preview');
  });

  it('uses comprehensive IIT brackets and caps refund by tax paid', () => {
    const api = loadEstimateApi();
    expect(api.iitComprehensiveTax(0)).toBe(0);
    expect(api.iitComprehensiveTax(36000)).toBe(1080);
    expect(api.iitComprehensiveTax(96000)).toBe(7080);

    const oneYear = monthsForYear(2024, '13000', '200');
    const row = api.yearRefundTotals(oneYear, 2024);
    expect(row.income_sum).toBe(156000);
    expect(row.month_count).toBe(12);
    expect(row.tax_sum).toBe(2400);

    const est = api.specialDeductionRefundEstimate(oneYear);
    expect(est.years).toHaveLength(1);
    expect(est.years[0].extra).toBe(7500 * 12);
    expect(est.years[0].saved).toBe(2400);
    expect(est.total).toBe(2400);

    const uncapped = api.specialDeductionRefundEstimate(
      monthsForYear(2024, '13000', '0')
    );
    expect(uncapped.total).toBe(6900);

    const threeYears = []
      .concat(monthsForYear(2023, '13000', '200'))
      .concat(monthsForYear(2024, '13000', '200'))
      .concat(monthsForYear(2025, '13000', '200'));
    const all = api.specialDeductionRefundEstimate(threeYears);
    expect(all.total).toBe(7200);
    expect(all.years.map((y) => y.year)).toEqual([2025, 2024, 2023]);
  });

  it('skips 示例 records and counts unique months', () => {
    const api = loadEstimateApi();
    const mixed = [
      { year: 2025, month: 1, income: '20000', tax_reported: '800', company_name: '示例公司' },
      { year: 2025, month: 3, income: '20000', tax_reported: '800', company_name: '乙公司' },
      { year: 2025, month: 6, income: '20000', tax_reported: '800', company_name: '乙公司' }
    ];
    const row = api.yearRefundTotals(mixed, 2025);
    expect(row.month_count).toBe(2);
    expect(row.income_sum).toBe(40000);
    expect(row.tax_sum).toBe(1600);
  });
});

function loadRealGuide() {
  window.__cgCapturePrivacyBound = false;
  delete window.ConversionGuide;
  window.trackUserAction = vi.fn();
  window.fetch = vi.fn(() => Promise.reject(new Error('offline')));
  // eslint-disable-next-line no-eval
  eval(guideSrc);
  return window.ConversionGuide;
}

describe('ConversionGuide runtime: force popup disabled', () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    vi.stubGlobal('location', {
      href: 'http://localhost/consult.html',
      pathname: '/consult.html',
      search: '',
      assign: vi.fn()
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.getElementById('cg-refund-force-overlay')?.remove();
    document.getElementById('conversion-guide-styles')?.remove();
  });

  it('computes the same 3-year capped refund from the live module', () => {
    const CG = loadRealGuide();
    localStorage.setItem('token', 't');
    const threeYears = []
      .concat(monthsForYear(2023, '13000', '200'))
      .concat(monthsForYear(2024, '13000', '200'))
      .concat(monthsForYear(2025, '13000', '200'));
    const est = CG.specialDeductionRefundEstimate(threeYears);
    expect(est.total).toBe(7200);
    expect(est.child_month).toBe(4500);
    expect(est.parent_month).toBe(3000);
    expect(est.monthly_extra).toBe(7500);
    expect(CG.formatRefundYuan(7200)).toBe('¥7,200');
    expect(CG.iitComprehensiveTax(96000)).toBe(7080);
  });

  it('does not show the locked refund force dialog after tax fill', () => {
    const CG = loadRealGuide();
    localStorage.setItem('token', 't');
    const threeYears = []
      .concat(monthsForYear(2023, '13000', '200'))
      .concat(monthsForYear(2024, '13000', '200'))
      .concat(monthsForYear(2025, '13000', '200'));
    expect(CG.maybeGoRefundAdAfterTax({ source: 'batch' }, 2025, threeYears)).toBe(
      false
    );
    expect(document.getElementById('cg-refund-force-overlay')).toBeFalsy();
    expect(window.trackUserAction).not.toHaveBeenCalledWith(
      'track_refund_ad_after_tax_show',
      expect.anything()
    );
  });

  it('stays quiet for single_save / logged-out / already-seen / low income', () => {
    const records = monthsForYear(2024, '13000', '200');
    const CG = loadRealGuide();
    expect(CG.maybeGoRefundAdAfterTax({ source: 'batch' }, 2024, records)).toBe(false);

    localStorage.setItem('token', 't');
    expect(CG.maybeGoRefundAdAfterTax({ source: 'single_save' }, 2024, records)).toBe(
      false
    );

    localStorage.setItem('refund_ad_after_tax_v1', '1');
    expect(CG.maybeGoRefundAdAfterTax({ source: 'batch' }, 2024, records)).toBe(false);

    const low = monthsForYear(2024, '4000', '50');
    expect(CG.specialDeductionRefundEstimate(low).total).toBe(0);
    expect(CG.maybeGoRefundAdAfterTax({ source: 'batch' }, 2024, low)).toBe(false);
    expect(document.getElementById('cg-refund-force-overlay')).toBeFalsy();
  });
});

describe('refund ad page highlights principle and amount', () => {
  it('puts estimate card and 二次退税原理 above the poster', () => {
    expect(adHtml).toContain('id="refundEstCard"');
    expect(adHtml).toContain('二次退税怎么来的');
    expect(adHtml).toContain('3 个子女每月');
    expect(adHtml).toContain('4500 元');
    expect(adHtml).toContain('3000 元');
    expect(adHtml).toContain('7500 元');
    expect(adHtml).toContain('refund_ad_estimate_v1');
    expect(adHtml).toContain('qs.get(\'est\')');
    expect(adHtml).toContain('id="refundEstAmt"');
    expect(adHtml).toContain('id="btnCalcRefundEst"');
    expect(adHtml).toContain('联系客服进行退税');
    const cardIdx = adHtml.indexOf('id="refundEstCard"');
    const posterIdx = adHtml.indexOf('refund-ad.jpg');
    const copyIdx = adHtml.indexOf('id="btnCopyRefundWechat"');
    const gridIdx = adHtml.indexOf('class="ad-services-top"');
    expect(cardIdx).toBeGreaterThan(0);
    expect(cardIdx).toBeLessThan(posterIdx);
    expect(copyIdx).toBeGreaterThan(0);
    expect(copyIdx).toBeLessThan(gridIdx);
    expect(adHtml).toContain('id="refundHeroWx"');
  });
});
