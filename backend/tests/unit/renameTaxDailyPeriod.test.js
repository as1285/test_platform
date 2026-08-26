'use strict';

const { addDaysToYmd, analyticsPeriodDateKeys } = require('../../src/shared/ymd');

describe('rename-tax-daily period dates', () => {
  it('addDaysToYmd walks calendar days in UTC', () => {
    expect(addDaysToYmd('2026-08-01', 0)).toBe('2026-08-01');
    expect(addDaysToYmd('2026-08-01', 1)).toBe('2026-08-02');
    expect(addDaysToYmd('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDaysToYmd('2026-08-25', -7)).toBe('2026-08-18');
  });

  it('analyticsPeriodDateKeys expands a closed range', () => {
    const keys = analyticsPeriodDateKeys({
      mode: 'range',
      start: '2026-08-23',
      end: '2026-08-25'
    });
    expect(keys).toEqual(['2026-08-23', '2026-08-24', '2026-08-25']);
  });

  it('analyticsPeriodDateKeys uses span for rolling days', () => {
    const keys = analyticsPeriodDateKeys(
      {
        mode: 'days',
        days: 3,
        span: 2
      },
      '2026-08-25'
    );
    expect(keys).toEqual(['2026-08-23', '2026-08-24', '2026-08-25']);
  });
});
