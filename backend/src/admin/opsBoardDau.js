/**
 * 运营看板：北京同时点日活（登录成功 ∪ 页面埋点，按 IP 去重）。
 * 事件 DATETIME 按 UTC 存储；窗口换算为 CST。
 */
'use strict';

var GUEST_PREFIX = '__guest_';
var HISTORY_DAYS = 14;
var WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六'];

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function beijingYmdFromMs(ms) {
  var bj = new Date(Number(ms) + 8 * 3600000);
  return bj.getUTCFullYear() + '-' + pad2(bj.getUTCMonth() + 1) + '-' + pad2(bj.getUTCDate());
}

function ymdToUtcMs(s) {
  var parts = String(s || '').split('-');
  return Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function addDaysYmd(s, delta) {
  var d = new Date(ymdToUtcMs(s) + delta * 86400000);
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}

function weekdayCn(ymd) {
  return WEEKDAY_CN[new Date(ymdToUtcMs(ymd)).getUTCDay()] || '';
}

/** 该北京日 00:00 对应的 UTC 毫秒 */
function cstMidnightUtcMs(ymd) {
  return ymdToUtcMs(ymd) - 8 * 3600000;
}

function formatMysqlUtc(ms) {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function formatCstHm(ms) {
  var bj = new Date(Number(ms) + 8 * 3600000);
  return pad2(bj.getUTCHours()) + ':' + pad2(bj.getUTCMinutes());
}

function ymdFromSql(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  return String(v || '').slice(0, 10);
}

function firstTsMs(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v.getTime();
  var t = Date.parse(String(v || '').replace(' ', 'T') + 'Z');
  return isFinite(t) ? t : 0;
}

function dauUsernameSql(col) {
  var c = col || 'username';
  return (
    'LEFT(' +
    c +
    ', ' +
    GUEST_PREFIX.length +
    ") <> '" +
    GUEST_PREFIX +
    "' AND " +
    c +
    " NOT IN ('__monitor_no__', '__selftest_no__') AND " +
    c +
    " NOT REGEXP '^__[A-Za-z0-9._-]+_no__$'"
  );
}

function secIntoCstDaySql(col) {
  var c = col || 'created_at';
  return (
    'TIMESTAMPDIFF(SECOND, DATE_SUB(DATE(DATE_ADD(' +
    c +
    ', INTERVAL 8 HOUR)), INTERVAL 8 HOUR), ' +
    c +
    ')'
  );
}

function cstDaySql(col) {
  return 'DATE(DATE_ADD(' + (col || 'created_at') + ', INTERVAL 8 HOUR))';
}

/**
 * 以 date_to 为对照日：今天则切到当前时刻，历史日则全天。
 * 对比日、上周同星期、近 14 日都用同一截点时长。
 */
function buildSameClockPlan(from, to, nowMs) {
  var now = Number(nowMs) || Date.now();
  var today = beijingYmdFromMs(now);
  var toStart = cstMidnightUtcMs(to);
  var toNext = toStart + 86400000;
  var live = to === today;
  var curEnd = live ? Math.min(now, toNext) : toNext;
  if (curEnd < toStart) curEnd = toStart;
  var elapsed = curEnd - toStart;
  var elapsedSec = Math.max(0, Math.ceil(elapsed / 1000));
  var history = [];
  var i;
  for (i = HISTORY_DAYS - 1; i >= 0; i--) {
    var d = addDaysYmd(to, -i);
    var s = cstMidnightUtcMs(d);
    var e = s + elapsed;
    if (d === today) e = Math.min(e, now);
    if (e < s) e = s;
    history.push({ date: d, start: s, end: e });
  }
  var yday = addDaysYmd(to, -1);
  var week = addDaysYmd(to, -7);
  var single = from === to;
  var rangeStart = cstMidnightUtcMs(from);
  var rangeEnd = curEnd;
  var rangeSpan = Math.max(0, rangeEnd - rangeStart);
  return {
    mode: live && single ? 'same_clock' : single ? 'full_day' : 'range',
    live: live,
    single: single,
    today: today,
    elapsed_sec: elapsedSec,
    as_of: live ? formatCstHm(curEnd) : '',
    current: { date: to, start: toStart, end: curEnd },
    compare: {
      date: yday,
      start: toStart - 86400000,
      end: toStart - 86400000 + elapsed
    },
    week: {
      date: week,
      start: toStart - 7 * 86400000,
      end: toStart - 7 * 86400000 + elapsed
    },
    range: single
      ? null
      : {
          start: rangeStart,
          end: rangeEnd,
          prev_start: rangeStart - rangeSpan,
          prev_end: rangeStart
        },
    history: history,
    hist_start: history.length ? history[0].start : toStart,
    hist_end: curEnd
  };
}

function summarizeUsers(rows, windowStartMs) {
  var ips = Object.create(null);
  var accounts = 0;
  var returning = 0;
  var newUsers = 0;
  var list = [];
  (rows || []).forEach(function (r) {
    var username = String(r.username || '');
    if (!username) return;
    var ip = String(r.ip || '').trim();
    var ipKey = ip || '__nouip:' + username;
    ips[ipKey] = 1;
    accounts += 1;
    var created = firstTsMs(r.user_created_at);
    var isNew = created > 0 && created >= windowStartMs;
    if (isNew) newUsers += 1;
    else returning += 1;
    list.push({
      username: username,
      firstMs: firstTsMs(r.first_ts),
      ip: ipKey
    });
  });
  return {
    accounts: accounts,
    dau_ip: Object.keys(ips).length,
    returning: returning,
    new_users: newUsers,
    users: list
  };
}

function cumulativeByHour(users, dayStartMs, elapsedMs) {
  var lastH = Math.floor(elapsedMs / 3600000);
  if (lastH > 24) lastH = 24;
  var hours = [];
  var h;
  for (h = 1; h <= lastH; h++) {
    var cut = dayStartMs + h * 3600000;
    var acc = 0;
    var seen = Object.create(null);
    (users || []).forEach(function (u) {
      if (u.firstMs > 0 && u.firstMs < cut) {
        acc += 1;
        seen[u.ip] = 1;
      }
    });
    hours.push({ hour: h, accounts: acc, dau_ip: Object.keys(seen).length });
  }
  return hours;
}

function pct(cur, prev) {
  var a = Number(cur) || 0;
  var b = Number(prev) || 0;
  if (b <= 0) return null;
  return Math.round((a / b) * 100);
}

function pointFromSummary(date, sum) {
  return {
    date: date,
    weekday: weekdayCn(date),
    dau_ip: sum.dau_ip,
    accounts: sum.accounts,
    returning: sum.returning,
    new_users: sum.new_users
  };
}

async function queryWindowPeople(conn, startMs, endMs) {
  var start = formatMysqlUtc(startMs);
  var end = formatMysqlUtc(endMs);
  var userSql = dauUsernameSql('username');
  const [rows] = await conn.query(
    `SELECT ev.username,
            MIN(ev.created_at) AS first_ts,
            MIN(u.created_at) AS user_created_at,
            SUBSTRING_INDEX(
              GROUP_CONCAT(NULLIF(TRIM(ev.login_ip), '') ORDER BY ev.created_at DESC, ev.ord DESC),
              ',',
              1
            ) AS ip
     FROM (
       SELECT username, created_at, ip AS login_ip, id AS ord
       FROM user_login_events
       WHERE ok = 1 AND created_at >= ? AND created_at < ?
         AND ${userSql}
       UNION ALL
       SELECT username, created_at, NULL AS login_ip, 0 AS ord
       FROM user_page_events
       WHERE created_at >= ? AND created_at < ?
         AND ${userSql}
     ) ev
     LEFT JOIN users u ON u.username = ev.username
     WHERE COALESCE(u.user_type, 0) <> 2
       AND u.list_hidden_at IS NULL
     GROUP BY ev.username`,
    [start, end, start, end]
  );
  return rows || [];
}

async function queryHistoryPeople(conn, plan) {
  var start = formatMysqlUtc(plan.hist_start);
  var end = formatMysqlUtc(plan.hist_end);
  var elapsed = plan.elapsed_sec;
  var userSql = dauUsernameSql('username');
  var secSql = secIntoCstDaySql('created_at');
  const [rows] = await conn.query(
    `SELECT ${cstDaySql('ev.created_at')} AS cst_d,
            ev.username,
            MIN(ev.created_at) AS first_ts,
            MIN(u.created_at) AS user_created_at,
            SUBSTRING_INDEX(
              GROUP_CONCAT(NULLIF(TRIM(ev.login_ip), '') ORDER BY ev.created_at DESC, ev.ord DESC),
              ',',
              1
            ) AS ip
     FROM (
       SELECT username, created_at, ip AS login_ip, id AS ord
       FROM user_login_events
       WHERE ok = 1 AND created_at >= ? AND created_at < ?
         AND ${secSql} < ?
         AND ${userSql}
       UNION ALL
       SELECT username, created_at, NULL AS login_ip, 0 AS ord
       FROM user_page_events
       WHERE created_at >= ? AND created_at < ?
         AND ${secSql} < ?
         AND ${userSql}
     ) ev
     LEFT JOIN users u ON u.username = ev.username
     WHERE COALESCE(u.user_type, 0) <> 2
       AND u.list_hidden_at IS NULL
     GROUP BY cst_d, ev.username`,
    [start, end, elapsed, start, end, elapsed]
  );
  return rows || [];
}

async function loadOpsBoardDau(conn, kpiRange, nowMs) {
  var plan = buildSameClockPlan(kpiRange.from, kpiRange.to, nowMs || Date.now());
  await conn.query('SET SESSION group_concat_max_len = 4096');
  var histRows = await queryHistoryPeople(conn, plan);
  var byDay = Object.create(null);
  histRows.forEach(function (r) {
    var d = ymdFromSql(r.cst_d);
    if (!d) return;
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(r);
  });

  function daySummary(date, startMs) {
    return summarizeUsers(byDay[date] || [], startMs);
  }

  var curSum = daySummary(plan.current.date, plan.current.start);
  var cmpSum = daySummary(plan.compare.date, plan.compare.start);
  var weekSum = daySummary(plan.week.date, plan.week.start);

  var history = plan.history.map(function (h) {
    var s = daySummary(h.date, h.start);
    return {
      date: h.date,
      weekday: weekdayCn(h.date),
      dau_ip: s.dau_ip,
      accounts: s.accounts
    };
  });

  var elapsedMs = plan.current.end - plan.current.start;
  var curHours = cumulativeByHour(curSum.users, plan.current.start, elapsedMs);
  var cmpHours = cumulativeByHour(cmpSum.users, plan.compare.start, elapsedMs);
  var hourly = null;
  if (curHours.length) {
    hourly = {
      hours: curHours.map(function (x) {
        return x.hour;
      }),
      current: curHours.map(function (x) {
        return x.dau_ip;
      }),
      compare: cmpHours.map(function (x) {
        return x.dau_ip;
      })
    };
  }

  var range = null;
  if (plan.range) {
    var rangeRows = await queryWindowPeople(conn, plan.range.start, plan.range.end);
    var prevRows = await queryWindowPeople(conn, plan.range.prev_start, plan.range.prev_end);
    var rangeSum = summarizeUsers(rangeRows, plan.range.start);
    var prevSum = summarizeUsers(prevRows, plan.range.prev_start);
    range = {
      dau_ip: rangeSum.dau_ip,
      accounts: rangeSum.accounts,
      prev_dau_ip: prevSum.dau_ip,
      prev_accounts: prevSum.accounts,
      vs_prev_pct: pct(rangeSum.dau_ip, prevSum.dau_ip)
    };
  }

  var caption =
    plan.mode === 'same_clock'
      ? '同时点 = 北京当天 0:00 到现在。登录成功或页面埋点，按 IP 去重，游客不计。官方日活表按 UTC 日，不能直接对比今天。'
      : plan.mode === 'full_day'
        ? '当日日活 = 该北京日 0:00–24:00。登录成功或页面埋点，按 IP 去重，游客不计。'
        : '区间日活按所选北京日起止；对照日仍用结束日的同时点/全天口径。登录成功或页面埋点，按 IP 去重。';

  return {
    mode: plan.mode,
    live: plan.live,
    as_of: plan.as_of,
    elapsed_sec: plan.elapsed_sec,
    current: pointFromSummary(plan.current.date, curSum),
    compare: pointFromSummary(plan.compare.date, cmpSum),
    week: pointFromSummary(plan.week.date, weekSum),
    vs_compare_pct: pct(curSum.dau_ip, cmpSum.dau_ip),
    vs_week_pct: pct(curSum.dau_ip, weekSum.dau_ip),
    hourly: hourly,
    history: history,
    range: range,
    caption: caption
  };
}

module.exports = {
  HISTORY_DAYS: HISTORY_DAYS,
  beijingYmdFromMs: beijingYmdFromMs,
  addDaysYmd: addDaysYmd,
  weekdayCn: weekdayCn,
  cstMidnightUtcMs: cstMidnightUtcMs,
  formatMysqlUtc: formatMysqlUtc,
  formatCstHm: formatCstHm,
  buildSameClockPlan: buildSameClockPlan,
  summarizeUsers: summarizeUsers,
  cumulativeByHour: cumulativeByHour,
  loadOpsBoardDau: loadOpsBoardDau
};
