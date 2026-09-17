'use strict';

const {
  beijingYmdFromMs,
  weekdayCn,
  cstMidnightUtcMs,
  formatMysqlUtc,
  formatCstHm,
  buildSameClockPlan,
  summarizeUsers,
  cumulativeByHour
} = require('../../src/admin/opsBoardDau');

describe('opsBoardDau same-clock windows', () => {
  const now = Date.parse('2026-09-15T06:20:00.000Z');

  it('maps UTC instant to Beijing calendar date and clock', () => {
    expect(beijingYmdFromMs(now)).toBe('2026-09-15');
    expect(formatCstHm(now)).toBe('14:20');
    expect(formatMysqlUtc(cstMidnightUtcMs('2026-09-15'))).toBe('2026-09-14 16:00:00');
    expect(weekdayCn('2026-09-15')).toBe('二');
    expect(weekdayCn('2026-09-14')).toBe('一');
  });

  it('today single day cuts yesterday at the same elapsed time', () => {
    var plan = buildSameClockPlan('2026-09-15', '2026-09-15', now);
    expect(plan.mode).toBe('same_clock');
    expect(plan.live).toBe(true);
    expect(plan.as_of).toBe('14:20');
    expect(plan.elapsed_sec).toBe(14 * 3600 + 20 * 60);
    expect(formatMysqlUtc(plan.current.start)).toBe('2026-09-14 16:00:00');
    expect(formatMysqlUtc(plan.current.end)).toBe('2026-09-15 06:20:00');
    expect(formatMysqlUtc(plan.compare.start)).toBe('2026-09-13 16:00:00');
    expect(formatMysqlUtc(plan.compare.end)).toBe('2026-09-14 06:20:00');
    expect(plan.compare.date).toBe('2026-09-14');
    expect(plan.week.date).toBe('2026-09-08');
    expect(plan.history).toHaveLength(14);
    expect(plan.history[0].date).toBe('2026-09-02');
    expect(plan.history[13].date).toBe('2026-09-15');
  });

  it('past single day uses the full Beijing day', () => {
    var plan = buildSameClockPlan('2026-09-08', '2026-09-08', now);
    expect(plan.mode).toBe('full_day');
    expect(plan.live).toBe(false);
    expect(plan.as_of).toBe('');
    expect(plan.elapsed_sec).toBe(86400);
    expect(formatMysqlUtc(plan.current.start)).toBe('2026-09-07 16:00:00');
    expect(formatMysqlUtc(plan.current.end)).toBe('2026-09-08 16:00:00');
    expect(formatMysqlUtc(plan.compare.end)).toBe('2026-09-07 16:00:00');
  });

  it('date range keeps end-day clock and a previous equal-length window', () => {
    var plan = buildSameClockPlan('2026-09-10', '2026-09-15', now);
    expect(plan.mode).toBe('range');
    expect(plan.range).toBeTruthy();
    expect(formatMysqlUtc(plan.range.start)).toBe('2026-09-09 16:00:00');
    expect(formatMysqlUtc(plan.range.end)).toBe('2026-09-15 06:20:00');
    var span = plan.range.end - plan.range.start;
    expect(plan.range.prev_end).toBe(plan.range.start);
    expect(plan.range.prev_end - plan.range.prev_start).toBe(span);
  });

  it('summarizes IP-unique users and hourly cumulative', () => {
    var start = Date.parse('2026-09-14T16:00:00.000Z');
    var rows = [
      { username: 'a', first_ts: '2026-09-14 16:30:00', user_created_at: '2026-09-01 00:00:00', ip: '1.1.1.1' },
      { username: 'b', first_ts: '2026-09-15 00:59:00', user_created_at: '2026-09-14 18:00:00', ip: '1.1.1.1' },
      { username: 'c', first_ts: '2026-09-15 02:30:00', user_created_at: '2026-09-10 00:00:00', ip: '' }
    ];
    var sum = summarizeUsers(rows, start);
    expect(sum.accounts).toBe(3);
    expect(sum.dau_ip).toBe(2);
    expect(sum.new_users).toBe(1);
    expect(sum.returning).toBe(2);
    var hours = cumulativeByHour(sum.users, start, 11 * 3600000);
    expect(hours[0]).toEqual({ hour: 1, accounts: 1, dau_ip: 1 });
    expect(hours[hours.length - 1].hour).toBe(11);
    expect(hours[hours.length - 1].accounts).toBe(3);
    expect(hours[hours.length - 1].dau_ip).toBe(2);
  });
});
