'use strict';

const overview = require('../../src/admin/featureSurveyOverview');

describe('featureSurveyOverview', () => {
  it('maps purchase expensive rate and leaves usage empty', () => {
    const row = overview.mapPurchase(overview.FEATURE_DEFS[0], {
      submitted: 10,
      skipped: 2,
      total: 12,
      expensive: 4,
      fair: 5,
      cheap: 1
    });
    expect(row.wired).toBe(true);
    expect(row.expensive_pct).toBe(40);
    expect(row.bad_pct).toBe(null);
    expect(row.top_concerns).toEqual([]);
    expect(row.detail_hash).toBe('analytics-purchase');
  });

  it('maps tax fill bad rate and improve top', () => {
    const def = overview.FEATURE_DEFS.find((f) => f.id === 'tax_fill');
    const row = overview.mapTaxFill(def, {
      submitted: 8,
      skipped: 1,
      total: 9,
      with_suggestion: 2,
      satisfaction: { good: 5, ok: 1, bad: 2 },
      improve_unhappy: { paste: 3, calc: 1, start: 0 }
    });
    expect(row.bad).toBe(2);
    expect(row.bad_pct).toBe(25);
    expect(row.expensive_pct).toBe(null);
    expect(row.top_concerns[0]).toEqual({ key: 'paste', label: '粘贴导入', count: 3 });
    expect(row.suggestion_count).toBe(2);
  });

  it('maps cert price plus experience', () => {
    const def = overview.FEATURE_DEFS.find((f) => f.id === 'lizhi_cert');
    const row = overview.mapCert(def, {
      submitted: 5,
      skipped: 0,
      total: 5,
      expensive: 3,
      experience: { good: 1, ok: 2, bad: 2 },
      improve: { share: 2, form: 1 }
    });
    expect(row.expensive_pct).toBe(60);
    expect(row.bad_pct).toBe(40);
    expect(row.top_concerns.map((t) => t.key)).toEqual(['share', 'form']);
  });

  it('keeps unwired tools as C 端未接', () => {
    const def = overview.FEATURE_DEFS.find((f) => f.id === 'sbdy_demo');
    const row = overview.emptyFeatureRow(def);
    expect(row.wired).toBe(false);
    expect(row.status).toBe('unwired');
    expect(row.note).toMatch(/未接/);
  });

  it('lists recent tax fill suggestions', () => {
    const list = overview.recentSuggestions({
      recent: [
        { username: 'u1', suggestion: '粘贴失败', skipped: false, created_at: '2026-09-07T00:00:00.000Z' },
        { username: 'u2', suggestion: '  ', skipped: false },
        { username: 'u3', suggestion: '跳过的', skipped: true }
      ]
    });
    expect(list).toHaveLength(1);
    expect(list[0].username).toBe('u1');
    expect(list[0].feature_id).toBe('tax_fill');
  });

  it('covers eight catalog features', () => {
    expect(overview.FEATURE_DEFS.map((f) => f.id)).toEqual([
      'purchase',
      'tax_fill',
      'lizhi_cert',
      'zaizhi_cert',
      'sbdy_demo',
      'najilu',
      'ccb_flow',
      'gjj_demo'
    ]);
  });
});
