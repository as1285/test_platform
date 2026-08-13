'use strict';

const {
  unusedGeneralWhereSql,
  shouldPurgeNow,
  chinaParts
} = require('../../unusedActivationCodes');

describe('unusedActivationCodes where', () => {
  it('only unused general codes, keeps batch/weekly stock', () => {
    var w = unusedGeneralWhereSql({});
    expect(w.sql).toContain('used_count = 0');
    expect(w.sql).toContain('%批量%');
    expect(w.sql).toContain('%周卡%');
    expect(w.params).toEqual([]);
  });

  it('scopes to owner admin', () => {
    var w = unusedGeneralWhereSql({ ownerAdmin: 'alice' });
    expect(w.sql).toContain('owner_admin_username = ?');
    expect(w.params).toEqual(['alice']);
  });

  it('adds clamped min-age hours without binding INTERVAL', () => {
    var w = unusedGeneralWhereSql({ minAgeHours: 24 });
    expect(w.sql).toContain('INTERVAL 24 HOUR');
    expect(w.params).toEqual([]);
    var clamped = unusedGeneralWhereSql({ minAgeHours: 99999 });
    expect(clamped.sql).toContain('INTERVAL 8760 HOUR');
  });
});

describe('unusedActivationCodes schedule', () => {
  it('china day key is Asia/Shanghai', () => {
    var p = chinaParts(new Date('2026-08-13T16:10:00.000Z'));
    expect(p.key).toBe('2026-08-14');
    expect(p.h).toBe(0);
  });

  it('does not run twice the same China day', () => {
    var now = new Date('2026-08-13T20:00:00.000Z');
    expect(shouldPurgeNow(now, '2026-08-14', 3)).toBe(false);
  });

  it('waits until configured hour', () => {
    var before = new Date('2026-08-13T17:30:00.000Z');
    expect(chinaParts(before).h).toBe(1);
    expect(shouldPurgeNow(before, '2026-08-12', 3)).toBe(false);
  });

  it('runs after hour if not yet done today', () => {
    var after = new Date('2026-08-13T19:10:00.000Z');
    expect(chinaParts(after).h).toBe(3);
    expect(shouldPurgeNow(after, '2026-08-12', 3)).toBe(true);
    expect(shouldPurgeNow(after, '', 3)).toBe(true);
  });
});
