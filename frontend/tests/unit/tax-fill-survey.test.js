import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const moduleCode = readFileSync(
  resolve(__dirname, '../../public/js/tax-fill-survey.js'),
  'utf8'
);

function loadSurvey() {
  delete window.initTaxFillSurvey;
  delete window.TaxFillSurvey;
  // eslint-disable-next-line no-eval
  eval(moduleCode);
}

describe('tax-fill-survey', () => {
  beforeEach(() => {
    document.body.innerHTML = '<a id="consultBackLink" href="mine.html">返回</a>';
    localStorage.clear();
    sessionStorage.clear();
    loadSurvey();
  });

  it('is gated off and does not render UI', () => {
    const api = window.TaxFillSurvey;
    expect(api.ENABLED).toBe(false);
    expect(window.initTaxFillSurvey({})).toBeNull();
    expect(document.getElementById('taxFillSurveyModal')).toBeNull();
    expect(document.getElementById('taxFillSurveyStyle')).toBeNull();
  });

  it('normalizes fields and builds submit body', () => {
    const api = window.TaxFillSurvey;
    expect(api.normalizeSatisfaction('bad')).toBe('bad');
    expect(api.normalizeImproveTopic('GENERATE')).toBe('generate');
    expect(api.normalizeImproveTopics(['paste', 'calc', 'paste'])).toEqual(['paste', 'calc']);
    expect(api.normalizeSuggestion('  建议  ')).toBe('建议');
    expect(api.needsImproveTopics('bad')).toBe(true);
    expect(api.needsImproveTopics('good')).toBe(false);
    const body = api.buildSubmitBody({
      satisfaction: 'ok',
      improve_topics: ['paste', 'list'],
      suggestion: '导入失败'
    });
    expect(body.satisfaction).toBe('ok');
    expect(body.improve_topic).toBe('paste,list');
    expect(body.improve_topics).toEqual(['paste', 'list']);
    expect(body.suggestion).toBe('导入失败');
    expect(body.skipped).toBe(false);
  });

  it('rejects ok/bad without improve topics on client', () => {
    const api = window.TaxFillSurvey;
    expect(api.buildSubmitBody({ satisfaction: 'bad' }).error).toMatch(/不满意/);
  });

  it('consult tax-records page no longer mounts survey UI or script', () => {
    const html = readFileSync(resolve(__dirname, '../../consult.html'), 'utf8');
    expect(html).not.toContain('tax-fill-survey.js');
    expect(html).not.toContain('taxFillSurveyCard');
    expect(html).not.toContain('填写体验调研');
    expect(html).not.toContain('体验满意度');
    expect(html).toContain('consultBackLink');
    expect(html).toContain('compatBugRecordsEntry');
    expect(html).toContain('兼容问题反馈');
    expect(html).toContain('consult.css?v=20260914-same-month');
  });
});
