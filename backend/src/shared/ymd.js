/**
 * 日历日加减与区间展开（按 UTC 日历，不依赖本机时区）。
 */

/** ymd 加减天数 */
function addDaysToYmd(ymd, delta) {
  var p = String(ymd || '').split('-').map(Number);
  if (p.length < 3 || !isFinite(p[0]) || !isFinite(p[1]) || !isFinite(p[2])) return '';
  var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  dt.setUTCDate(dt.getUTCDate() + (parseInt(delta, 10) || 0));
  return (
    dt.getUTCFullYear() +
    '-' +
    String(dt.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(dt.getUTCDate()).padStart(2, '0')
  );
}

/** 统计区间展开为日期列表（含起止） */
function analyticsPeriodDateKeys(period, todayKey) {
  var start;
  var end;
  if (period && period.mode === 'range') {
    start = period.start;
    end = period.end;
  } else {
    end = todayKey;
    var span = period && period.span != null ? period.span : Math.max(0, ((period && period.days) || 1) - 1);
    start = addDaysToYmd(end, -span);
  }
  if (!start || !end || start > end) return [];
  var keys = [];
  var cur = start;
  var guard = 0;
  while (cur <= end && guard < 400) {
    keys.push(cur);
    cur = addDaysToYmd(cur, 1);
    guard++;
  }
  return keys;
}

module.exports = {
  addDaysToYmd,
  analyticsPeriodDateKeys
};
