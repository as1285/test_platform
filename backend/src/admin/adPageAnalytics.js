/**
 * 广告页数据运营：停留时间与操作明细。
 */
'use strict';

const { getPool } = require('../shared/db');
const { refundYearAggSql } = require('./opsConversion');

var VIEW_KEYS = [
  'track_refund_ad_view',
  'track_refund_ad_after_tax_view',
  'track_purchase_refund_ad_view',
  'track_douyin_yuefu_ad_view',
  'track_gjj_extract_ad_view'
];
var COPY_KEYS = [
  'track_refund_ad_copy',
  'track_purchase_refund_ad_copy',
  'track_douyin_yuefu_ad_copy',
  'track_gjj_extract_ad_copy'
];
var LEAVE_KEYS = [
  'track_refund_ad_page_leave',
  'track_douyin_yuefu_ad_page_leave',
  'track_gjj_extract_ad_page_leave'
];

var EVENT_LABELS = {
  track_refund_ad_view: '进入广告页',
  track_refund_ad_page_leave: '离开广告页',
  track_refund_ad_copy: '复制微信号',
  track_refund_ad_poster_click: '点击海报',
  track_refund_ad_nav_click: '点底栏离开',
  track_refund_ad_after_tax_go: '填完跳转广告页',
  track_refund_ad_after_tax_view: '填完后看广告',
  track_refund_ad_after_tax_continue: '跳过广告回记录',
  track_purchase_refund_ad_view: '开通页看到广告',
  track_purchase_refund_ad_copy: '开通页复制微信',
  track_douyin_yuefu_ad_view: '进入月付广告页',
  track_douyin_yuefu_ad_page_leave: '离开月付广告页',
  track_douyin_yuefu_ad_copy: '复制月付微信号',
  track_douyin_yuefu_ad_promo_click: '点月付推广',
  track_douyin_yuefu_ad_back: '月付页返回',
  track_gjj_extract_ad_view: '进入公积金广告页',
  track_gjj_extract_ad_page_leave: '离开公积金广告页',
  track_gjj_extract_ad_copy: '复制公积金微信号',
  track_gjj_extract_ad_poster_click: '点击公积金海报',
  track_gjj_extract_ad_back: '公积金页返回'
};

var SOURCE_LABELS = {
  refund_ad_tab: '底栏退税',
  tax_done: '填完个税',
  purchase: '开通页',
  purchase_page: '开通页',
  consult: '填写页',
  consult_products: '咨询页增值',
  purchase_yuefu: '开通页月付入口',
  purchase_gjj: '开通页公积金入口',
  shuiming_result: '收入明细',
  msg_refund: '退税站内信',
  direct: '直接访问'
};

function eventLabel(key) {
  var k = String(key || '').trim();
  return EVENT_LABELS[k] || k;
}

function sourceLabel(src) {
  var s = String(src || '').trim();
  return SOURCE_LABELS[s] || s || '—';
}

function isAdPageTrackAction(action) {
  var act = String(action || '').trim().toLowerCase();
  return (
    act.indexOf('track_refund_ad_') === 0 ||
    act.indexOf('track_purchase_refund_ad_') === 0 ||
    act.indexOf('track_douyin_yuefu_ad_') === 0 ||
    act.indexOf('track_gjj_extract_ad_') === 0
  );
}

function n(row, key) {
  var v = row && row[key] != null ? Number(row[key]) : 0;
  return isFinite(v) ? v : 0;
}

function median(nums) {
  if (!nums || !nums.length) return null;
  var arr = nums.slice().sort(function (a, b) {
    return a - b;
  });
  var mid = Math.floor(arr.length / 2);
  if (arr.length % 2) return arr[mid];
  return Math.round((arr[mid - 1] + arr[mid]) / 2);
}

function parsePeriod(daysRaw) {
  var s = String(daysRaw == null ? '7' : daysRaw).trim();
  var range = s.match(/^range_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
  if (range) {
    return {
      mode: 'range',
      start: range[1],
      end: range[2],
      label: range[1] + ' ~ ' + range[2],
      period_key: s
    };
  }
  var days = parseInt(s, 10);
  if (!isFinite(days) || days < 1) days = 7;
  if (days > 366) days = 366;
  return {
    mode: 'days',
    days: days,
    label: '近 ' + days + ' 天',
    period_key: String(days)
  };
}

function periodFilter(dateExpr, period) {
  if (period.mode === 'range') {
    return {
      sql: '(' + dateExpr + ' >= ? AND ' + dateExpr + ' <= ?)',
      params: [period.start, period.end]
    };
  }
  var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
  return {
    sql: '(' + dateExpr + ' >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY))',
    params: [Math.max(0, period.days - 1)]
  };
}

function inListSql(keys) {
  return keys
    .map(function () {
      return '?';
    })
    .join(', ');
}

function visitorExpr(alias) {
  var t = alias || 'e';
  return (
    'COALESCE(NULLIF(TRIM(' +
    t +
    '.username), \'\'), CONCAT(\'anon:\', COALESCE(NULLIF(TRIM(' +
    t +
    '.client_id), \'\'), NULLIF(TRIM(' +
    t +
    '.device_fp), \'\'), NULLIF(TRIM(' +
    t +
    '.ip), \'\'), \'unknown\')))'
  );
}

function parseMeta(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    var o = JSON.parse(String(raw));
    return o && typeof o === 'object' ? o : {};
  } catch (e0) {
    return {};
  }
}

function isoFromMysql(dt) {
  if (!dt) return '';
  if (dt instanceof Date) return dt.toISOString();
  return String(dt);
}

async function handleAdminAdPageStats(req, res) {
  try {
    var period = parsePeriod(req.query && req.query.days);
    var cnDay = 'DATE(DATE_ADD(e.created_at, INTERVAL 8 HOUR))';
    var pf = periodFilter(cnDay, period);
    var page = parseInt(req.query && req.query.page, 10) || 1;
    var limit = parseInt(req.query && req.query.limit, 10) || 20;
    if (page < 1) page = 1;
    if (limit < 1) limit = 20;
    if (limit > 100) limit = 100;
    var offset = (page - 1) * limit;
    var q = String((req.query && req.query.q) || '').trim();
    var copied = String((req.query && req.query.copied) || '').trim().toLowerCase();
    var source = String((req.query && req.query.source) || '').trim();

    var where = [pf.sql];
    var params = pf.params.slice();
    if (source) {
      where.push("JSON_UNQUOTE(JSON_EXTRACT(e.meta_json, '$.source')) = ?");
      params.push(source);
    }
    var whereSql = where.join(' AND ');
    var vis = visitorExpr('e');

    var pool = getPool();
    const conn = await pool.getConnection();
    try {
      const [sumRows] = await conn.query(
        `SELECT
            COUNT(*) AS event_cnt,
            COUNT(DISTINCT ${vis}) AS visitors,
            SUM(CASE WHEN e.event_key IN (${inListSql(VIEW_KEYS)}) THEN 1 ELSE 0 END) AS views,
            COUNT(DISTINCT CASE WHEN e.event_key IN (${inListSql(VIEW_KEYS)}) THEN ${vis} END) AS view_visitors,
            SUM(CASE WHEN e.event_key IN (${inListSql(COPY_KEYS)}) THEN 1 ELSE 0 END) AS copies,
            COUNT(DISTINCT CASE WHEN e.event_key IN (${inListSql(COPY_KEYS)}) THEN ${vis} END) AS copy_visitors,
            SUM(CASE WHEN e.event_key IN (${inListSql(LEAVE_KEYS)}) THEN 1 ELSE 0 END) AS leaves,
            AVG(CASE WHEN e.event_key IN (${inListSql(LEAVE_KEYS)}) THEN e.dwell_seconds END) AS avg_dwell,
            SUM(CASE WHEN e.event_key = 'track_refund_ad_after_tax_view' THEN 1 ELSE 0 END) AS after_tax_views,
            SUM(CASE WHEN e.event_key = 'track_refund_ad_after_tax_continue' THEN 1 ELSE 0 END) AS after_tax_continues,
            SUM(CASE WHEN e.event_key = 'track_refund_ad_after_tax_go' THEN 1 ELSE 0 END) AS after_tax_go,
            SUM(CASE WHEN e.event_key = 'track_purchase_refund_ad_view' THEN 1 ELSE 0 END) AS purchase_views,
            SUM(CASE WHEN e.event_key = 'track_purchase_refund_ad_copy' THEN 1 ELSE 0 END) AS purchase_copies
         FROM ad_page_track_events e
         WHERE ${whereSql}`,
        [].concat(VIEW_KEYS, VIEW_KEYS, COPY_KEYS, COPY_KEYS, LEAVE_KEYS, LEAVE_KEYS, params)
      );
      const [dwellRows] = await conn.query(
        `SELECT e.dwell_seconds
         FROM ad_page_track_events e
         WHERE ${whereSql}
           AND e.event_key IN (${inListSql(LEAVE_KEYS)})
           AND e.dwell_seconds IS NOT NULL
         ORDER BY e.dwell_seconds ASC
         LIMIT 8000`,
        params.concat(LEAVE_KEYS)
      );
      const [actionRows] = await conn.query(
        `SELECT e.event_key,
                COUNT(*) AS total,
                COUNT(DISTINCT ${vis}) AS visitors
         FROM ad_page_track_events e
         WHERE ${whereSql}
         GROUP BY e.event_key
         ORDER BY total DESC`,
        params
      );
      const [dailyRows] = await conn.query(
        `SELECT ${cnDay} AS d,
                SUM(CASE WHEN e.event_key IN (${inListSql(VIEW_KEYS)}) THEN 1 ELSE 0 END) AS views,
                COUNT(DISTINCT CASE WHEN e.event_key IN (${inListSql(VIEW_KEYS)}) THEN ${vis} END) AS visitors,
                SUM(CASE WHEN e.event_key IN (${inListSql(COPY_KEYS)}) THEN 1 ELSE 0 END) AS copies,
                AVG(CASE WHEN e.event_key IN (${inListSql(LEAVE_KEYS)}) THEN e.dwell_seconds END) AS avg_dwell
         FROM ad_page_track_events e
         WHERE ${whereSql}
         GROUP BY ${cnDay}
         ORDER BY d ASC`,
        [].concat(VIEW_KEYS, VIEW_KEYS, COPY_KEYS, LEAVE_KEYS, params)
      );

      var userWhere = [whereSql];
      var userParams = params.slice();
      if (q) {
        var like = '%' + q + '%';
        userWhere.push(
          '(e.username LIKE ? OR EXISTS (SELECT 1 FROM users u0 WHERE u0.username = e.username AND u0.real_name LIKE ?))'
        );
        userParams.push(like, like);
      }
      var userWhereSql = userWhere.join(' AND ');
      var having = [];
      if (copied === '1' || copied === 'copied') {
        having.push('copies > 0');
      } else if (copied === '0' || copied === 'none') {
        having.push('copies = 0');
      }
      var havingSql = having.length ? ' HAVING ' + having.join(' AND ') : '';

      const [countRows] = await conn.query(
        `SELECT COUNT(*) AS total FROM (
           SELECT ${vis} AS visitor_key,
                  SUM(CASE WHEN e.event_key IN (${inListSql(COPY_KEYS)}) THEN 1 ELSE 0 END) AS copies
           FROM ad_page_track_events e
           WHERE ${userWhereSql}
           GROUP BY ${vis}
           ${havingSql}
         ) t`,
        COPY_KEYS.concat(userParams)
      );

      const [userRows] = await conn.query(
        `SELECT
            ${vis} AS visitor_key,
            MAX(NULLIF(TRIM(e.username), '')) AS username,
            SUM(CASE WHEN e.event_key IN (${inListSql(VIEW_KEYS)}) THEN 1 ELSE 0 END) AS views,
            SUM(CASE WHEN e.event_key IN (${inListSql(COPY_KEYS)}) THEN 1 ELSE 0 END) AS copies,
            SUM(CASE WHEN e.event_key = 'track_refund_ad_after_tax_continue' THEN 1 ELSE 0 END) AS continues,
            SUM(CASE WHEN e.event_key IN (${inListSql(LEAVE_KEYS)}) THEN 1 ELSE 0 END) AS leaves,
            SUM(CASE WHEN e.event_key IN (${inListSql(LEAVE_KEYS)}) THEN IFNULL(e.dwell_seconds, 0) ELSE 0 END) AS total_dwell,
            AVG(CASE WHEN e.event_key IN (${inListSql(LEAVE_KEYS)}) THEN e.dwell_seconds END) AS avg_dwell,
            MAX(CASE WHEN e.event_key IN (${inListSql(LEAVE_KEYS)}) THEN e.dwell_seconds END) AS max_dwell,
            SUBSTRING_INDEX(GROUP_CONCAT(e.event_key ORDER BY e.created_at DESC SEPARATOR ','), ',', 8) AS recent_keys,
            MAX(e.created_at) AS last_at,
            MIN(e.created_at) AS first_at
         FROM ad_page_track_events e
         WHERE ${userWhereSql}
         GROUP BY ${vis}
         ${havingSql}
         ORDER BY last_at DESC
         LIMIT ? OFFSET ?`,
        [].concat(
          VIEW_KEYS,
          COPY_KEYS,
          LEAVE_KEYS,
          LEAVE_KEYS,
          LEAVE_KEYS,
          LEAVE_KEYS,
          userParams,
          [limit, offset]
        )
      );

      var usernames = [];
      userRows.forEach(function (r) {
        if (r.username) usernames.push(String(r.username));
      });
      var userMap = Object.create(null);
      if (usernames.length) {
        const [profiles] = await conn.query(
          `SELECT username, real_name, account_active, user_type, register_source_channel
           FROM users WHERE username IN (${usernames.map(function () { return '?'; }).join(',')})`,
          usernames
        );
        profiles.forEach(function (p) {
          userMap[String(p.username)] = p;
        });
      }

      var sum = sumRows && sumRows[0] ? sumRows[0] : {};
      var viewVisitors = n(sum, 'view_visitors');
      var copyVisitors = n(sum, 'copy_visitors');
      var dwells = (dwellRows || [])
        .map(function (r) {
          return Number(r.dwell_seconds);
        })
        .filter(function (v) {
          return isFinite(v);
        });
      var avgDwell = sum.avg_dwell != null ? Math.round(Number(sum.avg_dwell)) : null;
      if (!isFinite(avgDwell)) avgDwell = null;

      var refundEligible = 0;
      var refundEligibleCopied = 0;
      try {
        const [eligRows] = await conn.query(
          'SELECT COUNT(DISTINCT ry.user_id) AS c FROM (' + refundYearAggSql() + ') ry'
        );
        refundEligible = n(eligRows && eligRows[0], 'c');
        var refundCopyKeys = ['track_refund_ad_copy', 'track_purchase_refund_ad_copy'];
        const [eligCopyRows] = await conn.query(
          `SELECT COUNT(DISTINCT e.username) AS c
           FROM ad_page_track_events e
           INNER JOIN (${refundYearAggSql()}) ry ON ry.user_id = e.username
           WHERE e.event_key IN (${inListSql(refundCopyKeys)})`,
          refundCopyKeys
        );
        refundEligibleCopied = n(eligCopyRows && eligCopyRows[0], 'c');
      } catch (eElig) {
        console.error('[ad-page-stats] refund eligible funnel', eElig);
      }

      res.json({
        code: 200,
        data: {
          period: {
            days: period.period_key,
            label: period.label
          },
          summary: {
            event_cnt: n(sum, 'event_cnt'),
            visitors: n(sum, 'visitors'),
            views: n(sum, 'views'),
            view_visitors: viewVisitors,
            copies: n(sum, 'copies'),
            copy_visitors: copyVisitors,
            copy_rate: viewVisitors > 0 ? Math.round((copyVisitors / viewVisitors) * 1000) / 10 : 0,
            leaves: n(sum, 'leaves'),
            avg_dwell_seconds: avgDwell,
            median_dwell_seconds: median(dwells),
            after_tax_views: n(sum, 'after_tax_views'),
            after_tax_continues: n(sum, 'after_tax_continues'),
            after_tax_go: n(sum, 'after_tax_go'),
            purchase_views: n(sum, 'purchase_views'),
            purchase_copies: n(sum, 'purchase_copies'),
            refund_eligible: refundEligible,
            refund_eligible_copied: refundEligibleCopied,
            refund_eligible_copy_rate:
              refundEligible > 0
                ? Math.round((refundEligibleCopied / refundEligible) * 1000) / 10
                : 0
          },
          actions: (actionRows || []).map(function (r) {
            return {
              event_key: r.event_key,
              label: eventLabel(r.event_key),
              total: n(r, 'total'),
              visitors: n(r, 'visitors')
            };
          }),
          daily: (dailyRows || []).map(function (r) {
            var avg = r.avg_dwell != null ? Math.round(Number(r.avg_dwell)) : null;
            return {
              date: r.d ? String(r.d).slice(0, 10) : '',
              views: n(r, 'views'),
              visitors: n(r, 'visitors'),
              copies: n(r, 'copies'),
              avg_dwell_seconds: isFinite(avg) ? avg : null
            };
          }),
          users: (userRows || []).map(function (r) {
            var uname = r.username ? String(r.username) : '';
            var p = uname && userMap[uname] ? userMap[uname] : null;
            var keys = String(r.recent_keys || '')
              .split(',')
              .filter(Boolean);
            return {
              visitor_key: String(r.visitor_key || ''),
              username: uname,
              real_name: p && p.real_name ? String(p.real_name) : '',
              account_active: p ? Number(p.account_active) === 1 : null,
              channel: p && p.register_source_channel ? String(p.register_source_channel) : '',
              views: n(r, 'views'),
              copies: n(r, 'copies'),
              continues: n(r, 'continues'),
              leaves: n(r, 'leaves'),
              total_dwell_seconds: n(r, 'total_dwell'),
              avg_dwell_seconds:
                r.avg_dwell != null && isFinite(Number(r.avg_dwell))
                  ? Math.round(Number(r.avg_dwell))
                  : null,
              max_dwell_seconds:
                r.max_dwell != null && isFinite(Number(r.max_dwell))
                  ? Number(r.max_dwell)
                  : null,
              recent_actions: keys.map(eventLabel),
              first_at: isoFromMysql(r.first_at),
              last_at: isoFromMysql(r.last_at)
            };
          }),
          total: n(countRows && countRows[0], 'total'),
          page: page,
          limit: limit
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[ad-page-stats]', e);
    res.status(500).json({ code: 500, msg: String(e.message || '加载广告页统计失败') });
  }
}

async function handleAdminAdPageUserEvents(req, res) {
  try {
    var period = parsePeriod(req.query && req.query.days);
    var cnDay = 'DATE(DATE_ADD(e.created_at, INTERVAL 8 HOUR))';
    var pf = periodFilter(cnDay, period);
    var username = String((req.query && req.query.username) || '').trim();
    var visitor = String((req.query && req.query.visitor) || '').trim();
    if (!username && !visitor) {
      return res.status(400).json({ code: 400, msg: '需要 username 或 visitor' });
    }
    var where = [pf.sql];
    var params = pf.params.slice();
    if (username) {
      where.push('e.username = ?');
      params.push(username);
    } else {
      where.push(visitorExpr('e') + ' = ?');
      params.push(visitor);
    }
    var pool = getPool();
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(
        `SELECT e.id, e.username, e.client_id, e.event_key, e.dwell_seconds, e.meta_json,
                e.ip, e.created_at
         FROM ad_page_track_events e
         WHERE ${where.join(' AND ')}
         ORDER BY e.created_at DESC
         LIMIT 200`,
        params
      );
      var profile = null;
      var uname = username || (rows[0] && rows[0].username) || '';
      if (uname) {
        const [users] = await conn.query(
          'SELECT username, real_name, account_active, register_source_channel FROM users WHERE username = ? LIMIT 1',
          [uname]
        );
        if (users[0]) {
          profile = {
            username: String(users[0].username),
            real_name: users[0].real_name || '',
            account_active: Number(users[0].account_active) === 1,
            channel: users[0].register_source_channel || ''
          };
        }
      }
      res.json({
        code: 200,
        data: {
          period: { days: period.period_key, label: period.label },
          user: profile,
          events: (rows || []).map(function (r) {
            var meta = parseMeta(r.meta_json);
            return {
              id: r.id,
              event_key: r.event_key,
              label: eventLabel(r.event_key),
              dwell_seconds: r.dwell_seconds != null ? Number(r.dwell_seconds) : null,
              source: sourceLabel(meta.source),
              source_key: meta.source || '',
              page: meta.page || '',
              target: meta.target || '',
              copied: meta.copied != null ? Number(meta.copied) : null,
              year: meta.year || '',
              created_at: isoFromMysql(r.created_at),
              ip: r.ip || ''
            };
          })
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[ad-page-user-events]', e);
    res.status(500).json({ code: 500, msg: String(e.message || '加载用户广告操作失败') });
  }
}

function getHandlers() {
  return {
    handleAdminAdPageStats: handleAdminAdPageStats,
    handleAdminAdPageUserEvents: handleAdminAdPageUserEvents
  };
}

module.exports = {
  getHandlers: getHandlers,
  isAdPageTrackAction: isAdPageTrackAction,
  eventLabel: eventLabel,
  sourceLabel: sourceLabel,
  parsePeriod: parsePeriod,
  EVENT_LABELS: EVENT_LABELS,
  VIEW_KEYS: VIEW_KEYS,
  COPY_KEYS: COPY_KEYS,
  LEAVE_KEYS: LEAVE_KEYS
};
