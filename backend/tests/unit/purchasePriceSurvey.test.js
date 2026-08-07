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
});
