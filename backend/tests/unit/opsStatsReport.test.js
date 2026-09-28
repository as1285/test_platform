'use strict';

const {
  addDays,
  mondayOf,
  sundayOf,
  monthStartOf,
  monthEndOf,
  yesterdayKey,
  reportsDue,
  weekdayMon0,
  lastCompletedWeek,
  lastCompletedMonth,
  htmlEscape,
  yuan,
  chinaParts,
  buildDailyEmail
} = require('../../opsStatsReport');

describe('opsStatsReport dates', () => {
  it('adds days across month bounds', () => {
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31');
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('resolves Monday-Sunday week', () => {
    expect(weekdayMon0('2026-08-10')).toBe(0);
    expect(mondayOf('2026-08-12')).toBe('2026-08-10');
    expect(sundayOf('2026-08-12')).toBe('2026-08-16');
  });

  it('month start/end', () => {
    expect(monthStartOf('2026-08-13')).toBe('2026-08-01');
    expect(monthEndOf('2026-08-13')).toBe('2026-08-31');
  });

  it('yesterday is previous China day', () => {
    var now = new Date('2026-08-13T04:00:00.000Z');
    expect(yesterdayKey(now)).toBe('2026-08-12');
  });

  it('last completed week on Thursday is previous Mon-Sun', () => {
    var w = lastCompletedWeek('2026-08-12');
    expect(w).toEqual({ start: '2026-08-03', end: '2026-08-09' });
  });

  it('last completed week on Sunday is that week', () => {
    var w = lastCompletedWeek('2026-08-09');
    expect(w).toEqual({ start: '2026-08-03', end: '2026-08-09' });
  });

  it('last completed month mid-August is July', () => {
    var m = lastCompletedMonth('2026-08-12');
    expect(m).toEqual({ start: '2026-07-01', end: '2026-07-31' });
  });

  it('reportsDue at Thursday 00:05 CN includes yesterday daily', () => {
    var due = reportsDue(new Date('2026-08-12T16:05:00.000Z'));
    expect(due.daily).toBe('2026-08-12');
    expect(due.weekly.end).toBe('2026-08-09');
    expect(due.monthly.end).toBe('2026-07-31');
  });

  it('chinaParts uses UTC+8', () => {
    var p = chinaParts(new Date('2026-08-12T16:00:00.000Z'));
    expect(p.key).toBe('2026-08-13');
    expect(p.h).toBe(0);
  });
});

describe('opsStatsReport format', () => {
  it('escapes html and formats yuan', () => {
    expect(htmlEscape('<a>&')).toBe('&lt;a&gt;&amp;');
    expect(yuan(12)).toBe('¥12.00');
  });

  it('daily email subject includes core metrics', () => {
    var day = {
      start: '2026-08-12',
      end: '2026-08-12',
      tot: {
        dau: 69,
        reg: 14,
        act: 4,
        act_admin: 3,
        act_other: 1,
        paid_n: 2,
        paid_uv: 2,
        paid_amt: 508,
        activation_n: 1,
        activation_amt: 498,
        lizhi_n: 0,
        lizhi_uv: 0,
        lizhi_amt: 0,
        rename_n: 1,
        rename_amt: 10,
        tax_edit_n: 0,
        tax_edit_amt: 0,
        admin_act_n: 2,
        admin_act_amt: 200,
        combined_amt: 708,
        combined_activation_n: 3,
        combined_activation_amt: 698,
        admin_act_by_admin: [
          { admin_username: '18933137956', unit_amount: 100, label_note: '', orders: 2, gmv: 200 }
        ],
        treat_n: 1,
        treat_amt: 498,
        dau_unique: 69,
        dau_avg: 69
      },
      daily: [
        {
          d: '2026-08-12',
          dau: 69,
          reg: 14,
          act: 4,
          act_admin: 3,
          act_other: 1,
          paid_n: 2,
          paid_amt: 508,
          activation_amt: 498,
          lizhi_amt: 0,
          tax_edit_amt: 0,
          admin_act_amt: 200,
          combined_amt: 708
        }
      ],
      skus: [{ sku: 'sku_600_perm', kind: 'permanent', n: 1, uv: 1, amt: 498 }]
    };
    var mail = buildDailyEmail(day, day, day);
    expect(mail.subject).toMatch(/日报 2026-08-12/);
    expect(mail.subject).toMatch(/日活 69/);
    expect(mail.subject).toMatch(/合计GMV ¥708\.00/);
    expect(mail.html).toMatch(/本周累计/);
    expect(mail.html).toMatch(/本月累计/);
    expect(mail.html).toMatch(/收入拆分（对齐支付分析）/);
    expect(mail.html).toMatch(/开通套餐（线上支付）/);
    expect(mail.html).toMatch(/离职证明/);
    expect(mail.html).toMatch(/管理员激活/);
    expect(mail.html).toMatch(/合计 GMV（含管理员激活）/);
    expect(mail.html).toMatch(/同行费用（每天无限）/);
  });
});
