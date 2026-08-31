'use strict';

const {
  resolveTargetRetainDays,
  DEFAULT_RETAIN_DAYS,
  PURGE_TARGETS
} = require('../../dbLogRetention');

describe('dbLogRetention', () => {
  const prev = { ...process.env };

  beforeEach(() => {
    process.env = { ...prev };
  });
  afterEach(() => {
    process.env = { ...prev };
  });

  it('includes ad page track events', () => {
    const t = PURGE_TARGETS.find((x) => x.table === 'ad_page_track_events');
    expect(t).toBeTruthy();
    expect(t.envVar).toBe('DB_RETAIN_AD_PAGE_TRACK_EVENTS_DAYS');
  });

  it('uses table defaultDays when set', () => {
    const t = PURGE_TARGETS.find((x) => x.defaultDays != null);
    expect(t).toBeTruthy();
    const days = resolveTargetRetainDays(t, DEFAULT_RETAIN_DAYS);
    expect(days).toBeGreaterThanOrEqual(7);
  });

  it('respects env override and clamps to [7, 3650]', () => {
    const t = PURGE_TARGETS.find((x) => x.envVar);
    expect(t).toBeTruthy();
    process.env[t.envVar] = '3';
    expect(resolveTargetRetainDays(t, 90)).toBe(7);
    process.env[t.envVar] = '30';
    expect(resolveTargetRetainDays(t, 90)).toBe(30);
    process.env[t.envVar] = '99999';
    expect(resolveTargetRetainDays(t, 90)).toBe(3650);
  });
});
