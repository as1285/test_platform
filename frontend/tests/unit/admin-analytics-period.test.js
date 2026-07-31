import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

beforeAll(() => {
  const code = readFileSync(
    resolve(__dirname, '../../public/js/admin-analytics-period.js'),
    'utf8'
  );
  // eslint-disable-next-line no-eval
  eval(code);
});

describe('AdminAnalyticsPeriod', () => {
  it('exposes project start', () => {
    expect(window.AdminAnalyticsPeriod.PROJECT_START_YMD).toBe('2026-04-01');
  });

  it('hintHtml escapes and formats', () => {
    const html = window.AdminAnalyticsPeriod.hintHtml({
      period_label: '近7日',
      period_start: '2026-07-01',
      period_end: '2026-07-07'
    });
    expect(html).toContain('近7日');
    expect(html).toContain('2026-07-01');
    const evil = window.AdminAnalyticsPeriod.hintHtml({
      period_label: '<img>',
      period_start: '2026-07-01',
      period_end: '2026-07-02'
    });
    expect(evil).toContain('&lt;img&gt;');
    expect(evil).not.toContain('<img>');
  });

  it('getValue without el returns range_ today', () => {
    const v = window.AdminAnalyticsPeriod.getValue(null);
    expect(v).toMatch(/^range_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/);
  });
});
