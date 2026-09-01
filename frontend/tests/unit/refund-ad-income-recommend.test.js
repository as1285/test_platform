import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const guideSrc = readFileSync(
  resolve(__dirname, '../../public/js/conversion-guide.js'),
  'utf8'
);
const shuimingHtml = readFileSync(
  resolve(__dirname, '../../shuiming_result.html'),
  'utf8'
);
const consultHtml = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');
const consultCss = readFileSync(resolve(__dirname, '../../css/consult.css'), 'utf8');

describe('income ≥150k refund ad browse recommend', () => {
  it('wires soft recommend dialog and income hit helpers in conversion-guide', () => {
    expect(guideSrc).toContain('REFUND_AD_INCOME_RECOMMEND_KEY');
    expect(guideSrc).toContain('function primaryIncomeRefundHit');
    expect(guideSrc).toContain('function maybeRecommendIncomeRefundAd');
    expect(guideSrc).toContain('function showIncomeRefundAdRecommendDialog');
    expect(guideSrc).toContain('function syncShuimingIncomeBrowseCard');
    expect(guideSrc).toContain('去广告页看看');
    expect(guideSrc).toContain('track_refund_ad_income_recommend_show');
    expect(guideSrc).toContain('track_refund_ad_income_recommend_click');
    expect(guideSrc).toContain('track_refund_ad_income_recommend_dismiss');
    expect(guideSrc).toContain('REFUND_AD_MIN_YEAR_INCOME = 150000');
  });

  it('shows consult browse card for active high-income users (moved from shuiming)', () => {
    expect(consultHtml).toContain('id="consultRefundAdEntry"');
    expect(consultHtml).toContain('id="consultRefundAdTitle"');
    expect(consultCss).toContain('is-income-browse');
    expect(consultCss).toContain('#0f766e');
    expect(guideSrc).toContain("source: 'consult_card'");
    expect(guideSrc).toContain('年收入已超 15 万');
    expect(guideSrc).toMatch(/syncShuimingIncomeBrowseCard[\s\S]*card\.hidden = true/);
    expect(shuimingHtml).toContain('id="smRefundBrowseCard"');
    expect(shuimingHtml).toContain('syncRefundAdRecommendCards');
  });

  it('classifies year income ≥150000 as income hit', () => {
    const fnBody = `
      var REFUND_AD_MIN_TAX_REPORTED = 5000;
      var REFUND_AD_MIN_YEAR_INCOME = 150000;
      var REFUND_AD_TAX_YEARS = [2025, 2024, 2023];
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
        return { year: year || 0, tax_sum: 0, income_sum: 0, tax_hit: false, income_hit: false, reason: '' };
      }
      function yearRefundTotals(records, year) {
        var y = parseInt(String(year), 10);
        var tax = 0;
        var income = 0;
        if (!y || !records || !records.length) return emptyYearRefundTotals(y);
        records.forEach(function (r) {
          if (!r || isExampleCompanyRecord(r)) return;
          if (parseInt(String(r.year), 10) !== y) return;
          tax += parseTaxReportedAmount(r.tax_reported);
          income += recordMonthIncome(r);
        });
        tax = Math.round(tax * 100) / 100;
        income = Math.round(income * 100) / 100;
        var taxHit = tax > REFUND_AD_MIN_TAX_REPORTED;
        var incomeHit = income >= REFUND_AD_MIN_YEAR_INCOME;
        var reason = '';
        if (taxHit && incomeHit) reason = 'both';
        else if (taxHit) reason = 'tax';
        else if (incomeHit) reason = 'income';
        return { year: y, tax_sum: tax, income_sum: income, tax_hit: taxHit, income_hit: incomeHit, reason: reason };
      }
      function refundAdYearHits(records) {
        var hits = [];
        REFUND_AD_TAX_YEARS.forEach(function (y) {
          var row = yearRefundTotals(records, y);
          if (row.reason) hits.push(row);
        });
        return hits;
      }
      function primaryIncomeRefundHit(records) {
        var hits = refundAdYearHits(records || []);
        for (var i = 0; i < hits.length; i++) {
          if (hits[i] && (hits[i].reason === 'income' || hits[i].reason === 'both')) return hits[i];
        }
        return null;
      }
      return { yearRefundTotals: yearRefundTotals, primaryIncomeRefundHit: primaryIncomeRefundHit };
    `;
    // eslint-disable-next-line no-new-func
    const api = new Function(fnBody)();
    const low = api.yearRefundTotals(
      [{ year: 2024, income: '10000', tax_reported: '100', company_name: '甲公司' }],
      2024
    );
    expect(low.income_hit).toBe(false);
    expect(low.reason).toBe('');

    const months = [];
    for (var m = 1; m <= 12; m++) {
      months.push({
        year: 2024,
        month: m,
        income: '13000',
        tax_reported: '200',
        company_name: '乙公司'
      });
    }
    const high = api.yearRefundTotals(months, 2024);
    expect(high.income_sum).toBe(156000);
    expect(high.income_hit).toBe(true);
    expect(high.reason).toBe('income');
    expect(api.primaryIncomeRefundHit(months).year).toBe(2024);
  });
});
