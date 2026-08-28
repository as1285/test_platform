'use strict';

const survey = require('../../src/growth/taxFillSurvey');

describe('taxFillSurvey helpers', () => {
  it('normalizes satisfaction and improve topic', () => {
    expect(survey.normalizeSatisfaction('GOOD')).toBe('good');
    expect(survey.normalizeSatisfaction('meh')).toBe('');
    expect(survey.normalizeImproveTopic('paste')).toBe('paste');
    expect(survey.normalizeImproveTopic('unknown')).toBe('');
  });

  it('trims and clamps suggestion', () => {
    expect(survey.normalizeSuggestion('  想改工资  ')).toBe('想改工资');
    expect(survey.normalizeSuggestion('')).toBe(null);
    expect(survey.normalizeSuggestion('x'.repeat(600)).length).toBe(500);
  });

  it('keeps skip satisfaction distinct from good', () => {
    expect(survey.SKIP_SATISFACTION).toBe('skipped');
    expect(survey.SATISFACTIONS.good).toBe(1);
    expect(survey.SATISFACTIONS.skipped).toBeUndefined();
  });

  it('rejects submit without satisfaction', () => {
    expect(survey.normalizeSubmitBody({}).error).toMatch(/满意度/);
  });

  it('accepts complete submit', () => {
    const row = survey.normalizeSubmitBody({
      satisfaction: 'ok',
      improve_topic: 'paste',
      suggestion: '粘贴导入经常失败'
    });
    expect(row.error).toBeUndefined();
    expect(row.satisfaction).toBe('ok');
    expect(row.improve_topic).toBe('paste');
    expect(row.suggestion).toBe('粘贴导入经常失败');
    expect(row.skipped).toBe(0);
  });

  it('clears optional fields when skipped', () => {
    const row = survey.normalizeSubmitBody({
      skipped: 1,
      satisfaction: 'good',
      improve_topic: 'list',
      suggestion: '不要了'
    });
    expect(row.satisfaction).toBe('skipped');
    expect(row.improve_topic).toBe(null);
    expect(row.suggestion).toBe(null);
    expect(row.skipped).toBe(1);
  });

  it('summarize returns empty shape without conn', async () => {
    const empty = await survey.summarizeTaxFillSurvey(null, 7);
    expect(empty.total).toBe(0);
    expect(empty.satisfaction).toEqual({ good: 0, ok: 0, bad: 0 });
    expect(empty.recent).toEqual([]);
  });
});
