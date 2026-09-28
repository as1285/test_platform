'use strict';

const survey = require('../../src/growth/purchasePriceSurvey');

describe('purchasePriceSurvey helpers', () => {
  it('parseMoney normalizes and clamps', () => {
    expect(survey.parseMoney('98')).toBe(98);
    expect(survey.parseMoney('98.456')).toBe(98.46);
    expect(survey.parseMoney('')).toBe(null);
    expect(survey.parseMoney(-1)).toBe(null);
    expect(survey.parseMoney(2000000)).toBe(999999);
  });

  it('exports skip sentiment distinct from fair', () => {
    expect(survey.SKIP_SENTIMENT).toBe('skipped');
    expect(survey.SENTIMENTS.fair).toBe(1);
    expect(survey.SENTIMENTS.skipped).toBeUndefined();
  });

  it('joins latest bid with collation-safe username match', () => {
    expect(survey.latestBidJoinSql('s', 'bid')).toMatch(/utf8mb4_unicode_ci/);
    expect(survey.coalescedExpectedPriceSql('s', 'bid')).toMatch(/expensive/);
  });

  it('fills expensive survey price from bid when survey has none', () => {
    expect(
      survey.effectiveExpectedPrice({ sentiment: 'expensive', skipped: 0, expected_price: null }, 88)
    ).toBe(88);
    expect(
      survey.effectiveExpectedPrice({ sentiment: 'expensive', skipped: 0, expected_price: 50 }, 88)
    ).toBe(50);
    expect(
      survey.effectiveExpectedPrice({ sentiment: 'fair', skipped: 0, expected_price: null }, 88)
    ).toBe(null);
  });

  it('writes bid amount onto expensive survey rows', async () => {
    const calls = [];
    const db = {
      execute: async function (sql, params) {
        calls.push({ sql: sql, params: params });
        return [{ affectedRows: 1 }];
      }
    };
    const out = await survey.attachExpectedPriceFromBid('18336572351', '98', db);
    expect(out.updated).toBe(1);
    expect(calls[0].sql).toMatch(/UPDATE purchase_price_survey/);
    expect(calls[0].params).toEqual([98, '18336572351', 98]);
  });
});
