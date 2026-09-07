import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const html = readFileSync(resolve(__dirname, '../../admin_panel.html'), 'utf8');
const loader = readFileSync(resolve(__dirname, '../../public/js/admin/loader.js'), 'utf8');
const src = readFileSync(resolve(__dirname, '../../public/js/admin/modules/feature-survey.js'), 'utf8');

describe('admin feature survey overview', () => {
  beforeEach(() => {
    delete window.AdminModules;
    document.body.innerHTML =
      '<div id="featureSurveyMount"></div>' +
      '<select id="featureSurveyDays"><option value="7" selected>7</option></select>';
    // eslint-disable-next-line no-eval
    eval(src);
  });

  it('ships page, loader and API', () => {
    expect(html).toContain('id="page-feature-survey"');
    expect(html).toContain('id="featureSurveyMount"');
    expect(html).toContain('href="#insights-product/features"');
    expect(loader).toContain('feature-survey.js?v=20260907-survey-ord');
    expect(src).toContain('api/admin/feature-survey/overview');
  });

  it('renders wired rates and unwired dash', () => {
    const mod = window.AdminModules['feature-survey'];
    expect(mod.topLabel([{ label: '粘贴导入', count: 3 }])).toBe('粘贴导入 3');
    mod.renderOverview({
      period: { label: '最近 7 天' },
      note: '已接线',
      features: [
        {
          id: 'purchase',
          title: '开通套餐',
          wired: true,
          submitted: 10,
          expensive_pct: 40,
          bad_pct: null,
          top_concerns: [],
          suggestion_count: 0,
          detail_hash: 'analytics-purchase'
        },
        {
          id: 'sbdy_demo',
          title: '社保演示',
          wired: false,
          detail_hash: 'sbdy-demo'
        }
      ],
      suggestions: [
        {
          created_at: '2026-09-07T01:00:00.000Z',
          feature_title: '个税记录填写',
          username: '2216955147',
          suggestion: '粘贴导入经常失败'
        }
      ]
    });
    const out = document.getElementById('featureSurveyMount').innerHTML;
    expect(out).toContain('开通套餐');
    expect(out).toContain('40%');
    expect(out).toContain('C 端未接');
    expect(out).toContain('粘贴导入经常失败');
    expect(out).toContain('2216955147');
    expect(out).toContain('#analytics-purchase');
  });
});
