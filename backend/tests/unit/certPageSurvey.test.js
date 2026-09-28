'use strict';

const survey = require('../../src/growth/certPageSurvey');

describe('certPageSurvey helpers', () => {
  it('parseMoney normalizes and clamps', () => {
    expect(survey.parseMoney('29')).toBe(29);
    expect(survey.parseMoney('29.456')).toBe(29.46);
    expect(survey.parseMoney('')).toBe(null);
    expect(survey.parseMoney(-1)).toBe(null);
    expect(survey.parseMoney(2000000)).toBe(999999);
  });

  it('normalizes product / sentiment / experience / improve', () => {
    expect(survey.normalizeProduct('lizhi')).toBe('lizhi');
    expect(survey.normalizeProduct('ZAIZHI')).toBe('zaizhi');
    expect(survey.normalizeProduct('other')).toBe('');
    expect(survey.normalizeSentiment('expensive')).toBe('expensive');
    expect(survey.normalizeExperience('GOOD')).toBe('good');
    expect(survey.normalizeImproveTopic('share')).toBe('share');
    expect(survey.normalizeImproveTopic('unknown')).toBe('');
  });

  it('keeps skip sentiment distinct from fair', () => {
    expect(survey.SKIP_SENTIMENT).toBe('skipped');
    expect(survey.SENTIMENTS.fair).toBe(1);
    expect(survey.SENTIMENTS.skipped).toBeUndefined();
  });

  it('rejects submit without product or sentiment', () => {
    expect(survey.normalizeSubmitBody({ sentiment: 'fair' }).error).toMatch(/证明类型/);
    expect(survey.normalizeSubmitBody({ product: 'lizhi' }).error).toMatch(/贵了还是便宜/);
  });

  it('accepts complete submit and optional fields', () => {
    const row = survey.normalizeSubmitBody({
      product: 'zaizhi',
      sentiment: 'expensive',
      expected_price: '29',
      experience: 'ok',
      improve_topic: 'share',
      seen_price: '50',
      unlocked: 0
    });
    expect(row.error).toBeUndefined();
    expect(row.product).toBe('zaizhi');
    expect(row.sentiment).toBe('expensive');
    expect(row.expected_price).toBe(29);
    expect(row.experience).toBe('ok');
    expect(row.improve_topic).toBe('share');
    expect(row.skipped).toBe(0);
  });

  it('clears optional fields when skipped', () => {
    const row = survey.normalizeSubmitBody({
      product: 'lizhi',
      skipped: 1,
      sentiment: 'fair',
      expected_price: 19,
      experience: 'good',
      improve_topic: 'price'
    });
    expect(row.sentiment).toBe('skipped');
    expect(row.expected_price).toBe(null);
    expect(row.experience).toBe(null);
    expect(row.improve_topic).toBe(null);
    expect(row.skipped).toBe(1);
  });

  it('summarize returns empty shape when product missing', async () => {
    const empty = await survey.summarizeCertPageSurvey({}, '', 7);
    expect(empty.total).toBe(0);
    expect(empty.experience).toEqual({ good: 0, ok: 0, bad: 0 });
    expect(empty.recent).toEqual([]);
  });
});
