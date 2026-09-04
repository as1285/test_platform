/**
 * 运营统计邮件：每晚 0 点（Asia/Shanghai）发送昨日日报；
 * 周一 0 点附上周周报；每月 1 日 0 点附上月月报。
 * 日报正文含本周累计 / 本月累计。
 *
 * CLI：node opsStatsReport.js --send
 *      node opsStatsReport.js --send --date 2026-08-12
 */
'use strict';

const mysql = require('mysql2/promise');
const mail = require('./mail');

const SETTING_DAILY = 'ops_stats_last_daily_sent';
const SETTING_WEEKLY = 'ops_stats_last_weekly_sent';
const SETTING_MONTHLY = 'ops_stats_last_monthly_sent';
const GUEST_PREFIX = '__guest_';
const USER_TYPE_GUEST = 2;
const CN_DATE_SQL = 'DATE(DATE_ADD({col}, INTERVAL 8 HOUR))';

/** 与管理台「支付分析」收入拆分同一套 SKU 口径 */
const LIZHI_CERT_SKU_ID = 'sku_lizhi_cert_50';
const ZAIZHI_CERT_SKU_ID = 'sku_zaizhi_cert_50';
const RENAME_FEE_SKU_ID = 'sku_rename_fee_10';
const TAX_EDIT_SINGLE_SKU_ID = 'sku_tax_edit_fee_20';
const TAX_EDIT_DAILY_SKU_ID = 'sku_tax_edit_unlimited_30';
const NAJILU_QR_SKU_ID = 'sku_najilu_qr_300';

function adminPanelRootUser() {
  return String(process.env.ADMIN_PANEL_USER || 'admin').trim() || 'admin';
}

/** 管理员激活折算：与 purchaseAnalyticsAdminActivationCreditRules 对齐 */
function adminActivationCreditRules() {
  return [
    { admin_username: '18933137956', unit_amount: 100, exclude_alipay: false, label_note: '' },
    { admin_username: '19106014552', unit_amount: 60, exclude_alipay: false, label_note: '' },
    {
      admin_username: adminPanelRootUser(),
      unit_amount: 100,
      exclude_alipay: true,
      label_note: '非支付宝'
    }
  ];
}

function statsReportEnabled() {
  var v = String(process.env.STATS_REPORT_ENABLED || '1').trim();
  return v !== '0' && v !== 'false' && v !== 'off';
}

function statsReportTo() {
  return String(
    process.env.STATS_REPORT_EMAIL || process.env.MONITOR_ALERT_EMAIL || '498771018@qq.com'
  ).trim();
}

function siteLabel() {
  var raw = String(process.env.PUBLIC_SITE_URL || process.env.APP_URL || '').trim();
  if (!raw) return '个税平台';
  try {
    return new URL(raw).hostname || raw;
  } catch (e) {
    return raw.replace(/^https?:\/\//, '').replace(/\/+$/, '') || '个税平台';
  }
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function formatDateKey(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

/** 中国日历部件（不依赖主机 TZ） */
function chinaParts(now) {
  var t = now instanceof Date ? now : new Date();
  var utcMs = t.getTime() + t.getTimezoneOffset() * 60000;
  var cn = new Date(utcMs + 8 * 3600000);
  var key = formatDateKey(cn);
  return {
    y: cn.getFullYear(),
    m: cn.getMonth() + 1,
    d: cn.getDate(),
    h: cn.getHours(),
    min: cn.getMinutes(),
    weekday: cn.getDay(),
    key: key,
    date: cn
  };
}

function parseYmd(ymd) {
  var s = String(ymd || '');
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function ymdFromParts(y, m, d) {
  return y + '-' + pad2(m) + '-' + pad2(d);
}

function addDays(ymd, n) {
  var p = parseYmd(ymd);
  if (!p) return '';
  var dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return dt.getUTCFullYear() + '-' + pad2(dt.getUTCMonth() + 1) + '-' + pad2(dt.getUTCDate());
}

function weekdayMon0(ymd) {
  var p = parseYmd(ymd);
  if (!p) return 0;
  var dt = new Date(Date.UTC(p.y, p.m - 1, p.d));
  return (dt.getUTCDay() + 6) % 7;
}

function mondayOf(ymd) {
  return addDays(ymd, -weekdayMon0(ymd));
}

function sundayOf(ymd) {
  return addDays(mondayOf(ymd), 6);
}

function monthStartOf(ymd) {
  var p = parseYmd(ymd);
  if (!p) return '';
  return ymdFromParts(p.y, p.m, 1);
}

function monthEndOf(ymd) {
  var p = parseYmd(ymd);
  if (!p) return '';
  var dt = new Date(Date.UTC(p.y, p.m, 0));
  return dt.getUTCFullYear() + '-' + pad2(dt.getUTCMonth() + 1) + '-' + pad2(dt.getUTCDate());
}

function yesterdayKey(now) {
  return addDays(chinaParts(now).key, -1);
}

function isLastDayOfMonth(ymd) {
  return addDays(ymd, 1).slice(8) === '01';
}

function lastCompletedWeek(ymd) {
  if (weekdayMon0(ymd) === 6) {
    return { start: mondayOf(ymd), end: ymd };
  }
  var lastSun = addDays(mondayOf(ymd), -1);
  return { start: mondayOf(lastSun), end: lastSun };
}

function lastCompletedMonth(ymd) {
  if (isLastDayOfMonth(ymd)) {
    return { start: monthStartOf(ymd), end: ymd };
  }
  var prevEnd = addDays(monthStartOf(ymd), -1);
  return { start: monthStartOf(prevEnd), end: prevEnd };
}

/**
 * 在 now 时刻应补发的报表（昨日已结束；周/月取最近一个完整周期，便于宕机补发）。
 * @returns {{ daily: string, weekly: {start:string,end:string}|null, monthly: {start:string,end:string}|null }}
 */
function reportsDue(now) {
  var ymd = yesterdayKey(now);
  return {
    daily: ymd,
    weekly: lastCompletedWeek(ymd),
    monthly: lastCompletedMonth(ymd)
  };
}

function htmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function yuan(n) {
  var x = Number(n);
  if (!isFinite(x)) x = 0;
  return '¥' + x.toFixed(2);
}

function num(n) {
  var x = Number(n);
  if (!isFinite(x)) x = 0;
  return String(Math.round(x));
}

function emptyDay(d) {
  return {
    d: d,
    dau: 0,
    reg: 0,
    act: 0,
    act_admin: 0,
    act_other: 0,
    paid_n: 0,
    paid_uv: 0,
    paid_amt: 0,
    activation_n: 0,
    activation_amt: 0,
    lizhi_n: 0,
    lizhi_uv: 0,
    lizhi_amt: 0,
    rename_n: 0,
    rename_amt: 0,
    tax_edit_n: 0,
    tax_edit_amt: 0,
    admin_act_n: 0,
    admin_act_amt: 0,
    combined_amt: 0,
    combined_activation_n: 0,
    combined_activation_amt: 0,
    /* 兼容旧字段：治疗类 ≈ 开通套餐（试用+永久等线上开通） */
    treat_n: 0,
    treat_amt: 0
  };
}

function paymentSkuCaseSql() {
  var lizhi =
    "(sku_id = '" + LIZHI_CERT_SKU_ID + "' OR grant_kind = 'lizhi_cert')";
  var zaizhi =
    "(sku_id = '" + ZAIZHI_CERT_SKU_ID + "' OR grant_kind = 'zaizhi_cert')";
  var rename =
    "(sku_id = '" +
    RENAME_FEE_SKU_ID +
    "' OR sku_id LIKE 'sku_rename%' OR grant_kind = 'rename_credit')";
  var taxEdit =
    "(sku_id IN ('" +
    TAX_EDIT_SINGLE_SKU_ID +
    "','" +
    TAX_EDIT_DAILY_SKU_ID +
    "') OR sku_id LIKE 'sku_tax_edit%' OR grant_kind IN ('tax_edit_single','tax_edit_daily'))";
  var najilu =
    "(sku_id = '" + NAJILU_QR_SKU_ID + "' OR sku_id LIKE 'sku_najilu%' OR grant_kind = 'najilu_qr')";
  var addOn = lizhi + ' OR ' + zaizhi + ' OR ' + rename + ' OR ' + taxEdit + ' OR ' + najilu;
  return {
    lizhi: lizhi,
    zaizhi: zaizhi,
    rename: rename,
    taxEdit: taxEdit,
    najilu: najilu,
    activationOrder: 'CASE WHEN (' + addOn + ') THEN 0 ELSE 1 END',
    activationAmount: 'CASE WHEN (' + addOn + ') THEN 0 ELSE amount END'
  };
}

function enumerateDays(start, end) {
  var out = [];
  var cur = start;
  var guard = 0;
  while (cur && cur <= end && guard < 400) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard += 1;
  }
  return out;
}

function cnDateExpr(col) {
  return CN_DATE_SQL.replace('{col}', col);
}

function asYmd(v) {
  if (!v) return '';
  if (v instanceof Date) return formatDateKey(v);
  return String(v).slice(0, 10);
}

function indexByDate(rows, field) {
  var map = {};
  (rows || []).forEach(function (r) {
    var d = asYmd(r.d);
    if (d) map[d] = r;
  });
  return map;
}

async function collectRangeStats(conn, startYmd, endYmd) {
  var cnCreated = cnDateExpr('created_at');
  var cnPaid = cnDateExpr('COALESCE(paid_at, created_at)');
  var cnAct = cnDateExpr('last_used_at');
  var guestSql =
    "LEFT(username, " +
    GUEST_PREFIX.length +
    ") <> '" +
    GUEST_PREFIX +
    "' AND COALESCE(user_type, 0) <> " +
    USER_TYPE_GUEST;

  const [dauRows] = await conn.execute(
    'SELECT uda.activity_date AS d, COUNT(DISTINCT COALESCE(' +
      "NULLIF(TRIM((SELECT ule.ip FROM user_login_events ule WHERE ule.username = uda.username AND ule.ok = 1 AND DATE(ule.created_at) = uda.activity_date AND ule.ip IS NOT NULL AND TRIM(ule.ip) <> '' ORDER BY ule.created_at DESC, ule.id DESC LIMIT 1)), '')," +
      "NULLIF(TRIM((SELECT ule.ip FROM user_login_events ule WHERE ule.username = uda.username AND (ule.ok = 1 OR ule.reason LIKE 'register_%') AND ule.ip IS NOT NULL AND TRIM(ule.ip) <> '' ORDER BY ule.created_at DESC, ule.id DESC LIMIT 1)), '')," +
      "NULLIF(TRIM((SELECT ud.ip_last FROM user_devices ud WHERE ud.username = uda.username AND ud.ip_last IS NOT NULL AND TRIM(ud.ip_last) <> '' ORDER BY ud.last_seen DESC LIMIT 1)), '')," +
      "CONCAT('__nouip:', uda.username)" +
      ')) AS n FROM user_daily_activity uda ' +
      'WHERE uda.activity_date BETWEEN ? AND ? GROUP BY uda.activity_date',
    [startYmd, endYmd]
  );
  const [[dauUniq]] = await conn.execute(
    'SELECT COUNT(DISTINCT COALESCE(' +
      "NULLIF(TRIM((SELECT ule.ip FROM user_login_events ule WHERE ule.username = uda.username AND ule.ok = 1 AND DATE(ule.created_at) = uda.activity_date AND ule.ip IS NOT NULL AND TRIM(ule.ip) <> '' ORDER BY ule.created_at DESC, ule.id DESC LIMIT 1)), '')," +
      "NULLIF(TRIM((SELECT ule.ip FROM user_login_events ule WHERE ule.username = uda.username AND (ule.ok = 1 OR ule.reason LIKE 'register_%') AND ule.ip IS NOT NULL AND TRIM(ule.ip) <> '' ORDER BY ule.created_at DESC, ule.id DESC LIMIT 1)), '')," +
      "NULLIF(TRIM((SELECT ud.ip_last FROM user_devices ud WHERE ud.username = uda.username AND ud.ip_last IS NOT NULL AND TRIM(ud.ip_last) <> '' ORDER BY ud.last_seen DESC LIMIT 1)), '')," +
      "CONCAT('__nouip:', uda.username)" +
      ')) AS n FROM user_daily_activity uda WHERE uda.activity_date BETWEEN ? AND ?',
    [startYmd, endYmd]
  );
  const [regRows] = await conn.execute(
    'SELECT ' +
      cnCreated +
      ' AS d, COUNT(*) AS n FROM users WHERE ' +
      cnCreated +
      ' BETWEEN ? AND ? AND ' +
      guestSql +
      ' GROUP BY d',
    [startYmd, endYmd]
  );
  const [actRows] = await conn.execute(
    'SELECT ' +
      cnAct +
      ' AS d, COUNT(*) AS n, ' +
      "SUM(CASE WHEN owner_admin_username = 'admin' THEN 1 ELSE 0 END) AS admin_n, " +
      "SUM(CASE WHEN owner_admin_username = 'admin' THEN 0 ELSE 1 END) AS other_n " +
      'FROM activation_codes WHERE last_used_at IS NOT NULL AND ' +
      cnAct +
      ' BETWEEN ? AND ? GROUP BY d',
    [startYmd, endYmd]
  );
  const skuCase = paymentSkuCaseSql();
  const [payRows] = await conn.execute(
    'SELECT ' +
      cnPaid +
      ' AS d, COUNT(*) AS n, COUNT(DISTINCT username) AS uv, ' +
      'ROUND(SUM(amount), 2) AS amt, ' +
      'SUM(' +
      skuCase.activationOrder +
      ') AS activation_n, ' +
      'ROUND(SUM(' +
      skuCase.activationAmount +
      '), 2) AS activation_amt, ' +
      'SUM(CASE WHEN ' +
      skuCase.lizhi +
      ' THEN 1 ELSE 0 END) AS lizhi_n, ' +
      'COUNT(DISTINCT CASE WHEN ' +
      skuCase.lizhi +
      ' THEN username ELSE NULL END) AS lizhi_uv, ' +
      'ROUND(SUM(CASE WHEN ' +
      skuCase.lizhi +
      ' THEN amount ELSE 0 END), 2) AS lizhi_amt, ' +
      'SUM(CASE WHEN ' +
      skuCase.rename +
      ' THEN 1 ELSE 0 END) AS rename_n, ' +
      'ROUND(SUM(CASE WHEN ' +
      skuCase.rename +
      ' THEN amount ELSE 0 END), 2) AS rename_amt, ' +
      'SUM(CASE WHEN ' +
      skuCase.taxEdit +
      ' THEN 1 ELSE 0 END) AS tax_edit_n, ' +
      'ROUND(SUM(CASE WHEN ' +
      skuCase.taxEdit +
      ' THEN amount ELSE 0 END), 2) AS tax_edit_amt ' +
      "FROM payment_orders WHERE status = 'paid' AND " +
      cnPaid +
      ' BETWEEN ? AND ? GROUP BY d',
    [startYmd, endYmd]
  );
  const [skuRows] = await conn.execute(
    'SELECT COALESCE(NULLIF(sku_id, \"\"), \"(空)\") AS sku, COALESCE(NULLIF(grant_kind, \"\"), \"(空)\") AS kind, ' +
      'COUNT(*) AS n, COUNT(DISTINCT username) AS uv, ROUND(SUM(amount), 2) AS amt ' +
      "FROM payment_orders WHERE status = 'paid' AND " +
      cnPaid +
      ' BETWEEN ? AND ? GROUP BY sku, kind ORDER BY amt DESC',
    [startYmd, endYmd]
  );
  var adminAct = await collectAdminActivationCredits(conn, startYmd, endYmd);

  var dauMap = indexByDate(dauRows);
  var regMap = indexByDate(regRows);
  var actMap = indexByDate(actRows);
  var payMap = indexByDate(payRows);
  var adminDayMap = adminAct.dailyMap || {};
  var daily = enumerateDays(startYmd, endYmd).map(function (d) {
    var row = emptyDay(d);
    if (dauMap[d]) row.dau = Number(dauMap[d].n) || 0;
    if (regMap[d]) row.reg = Number(regMap[d].n) || 0;
    if (actMap[d]) {
      row.act = Number(actMap[d].n) || 0;
      row.act_admin = Number(actMap[d].admin_n) || 0;
      row.act_other = Number(actMap[d].other_n) || 0;
    }
    if (payMap[d]) {
      row.paid_n = Number(payMap[d].n) || 0;
      row.paid_uv = Number(payMap[d].uv) || 0;
      row.paid_amt = Number(payMap[d].amt) || 0;
      row.activation_n = Number(payMap[d].activation_n) || 0;
      row.activation_amt = Number(payMap[d].activation_amt) || 0;
      row.lizhi_n = Number(payMap[d].lizhi_n) || 0;
      row.lizhi_uv = Number(payMap[d].lizhi_uv) || 0;
      row.lizhi_amt = Number(payMap[d].lizhi_amt) || 0;
      row.rename_n = Number(payMap[d].rename_n) || 0;
      row.rename_amt = Number(payMap[d].rename_amt) || 0;
      row.tax_edit_n = Number(payMap[d].tax_edit_n) || 0;
      row.tax_edit_amt = Number(payMap[d].tax_edit_amt) || 0;
      row.treat_n = row.activation_n;
      row.treat_amt = row.activation_amt;
    }
    if (adminDayMap[d]) {
      row.admin_act_n = Number(adminDayMap[d].orders) || 0;
      row.admin_act_amt = Number(adminDayMap[d].gmv) || 0;
    }
    row.combined_amt = Math.round((row.paid_amt + row.admin_act_amt) * 100) / 100;
    row.combined_activation_n = row.activation_n + row.admin_act_n;
    row.combined_activation_amt =
      Math.round((row.activation_amt + row.admin_act_amt) * 100) / 100;
    return row;
  });

  var tot = daily.reduce(
    function (a, r) {
      a.dau += r.dau;
      a.reg += r.reg;
      a.act += r.act;
      a.act_admin += r.act_admin;
      a.act_other += r.act_other;
      a.paid_n += r.paid_n;
      a.paid_uv += r.paid_uv;
      a.paid_amt += r.paid_amt;
      a.activation_n += r.activation_n;
      a.activation_amt += r.activation_amt;
      a.lizhi_n += r.lizhi_n;
      a.lizhi_uv += r.lizhi_uv;
      a.lizhi_amt += r.lizhi_amt;
      a.rename_n += r.rename_n;
      a.rename_amt += r.rename_amt;
      a.tax_edit_n += r.tax_edit_n;
      a.tax_edit_amt += r.tax_edit_amt;
      a.admin_act_n += r.admin_act_n;
      a.admin_act_amt += r.admin_act_amt;
      a.treat_n += r.treat_n;
      a.treat_amt += r.treat_amt;
      return a;
    },
    emptyDay('')
  );
  /* paid_uv / lizhi_uv 跨日不能简单相加；区间去重用汇总查询结果 */
  tot.paid_uv = await countDistinctPaidUsers(conn, cnPaid, startYmd, endYmd, null);
  tot.lizhi_uv = await countDistinctPaidUsers(conn, cnPaid, startYmd, endYmd, skuCase.lizhi);
  tot.paid_amt = Math.round(tot.paid_amt * 100) / 100;
  tot.activation_amt = Math.round(tot.activation_amt * 100) / 100;
  tot.lizhi_amt = Math.round(tot.lizhi_amt * 100) / 100;
  tot.rename_amt = Math.round(tot.rename_amt * 100) / 100;
  tot.tax_edit_amt = Math.round(tot.tax_edit_amt * 100) / 100;
  tot.admin_act_n = adminAct.total_orders || 0;
  tot.admin_act_amt = adminAct.total_gmv || 0;
  tot.combined_amt = Math.round((tot.paid_amt + tot.admin_act_amt) * 100) / 100;
  tot.combined_activation_n = tot.activation_n + tot.admin_act_n;
  tot.combined_activation_amt =
    Math.round((tot.activation_amt + tot.admin_act_amt) * 100) / 100;
  tot.treat_n = tot.activation_n;
  tot.treat_amt = tot.activation_amt;
  tot.dau_unique = dauUniq && dauUniq.n != null ? Number(dauUniq.n) || 0 : tot.dau;
  tot.days = daily.length;
  tot.dau_avg = tot.days ? Math.round((tot.dau / tot.days) * 10) / 10 : 0;
  tot.admin_act_by_admin = adminAct.by_admin || [];

  return {
    start: startYmd,
    end: endYmd,
    daily: daily,
    tot: tot,
    skus: (skuRows || []).map(function (r) {
      return {
        sku: String(r.sku || ''),
        kind: String(r.kind || ''),
        n: Number(r.n) || 0,
        uv: Number(r.uv) || 0,
        amt: Number(r.amt) || 0
      };
    })
  };
}

async function countDistinctPaidUsers(conn, cnPaid, startYmd, endYmd, productSql) {
  var where =
    "status = 'paid' AND " + cnPaid + ' BETWEEN ? AND ?' + (productSql ? ' AND (' + productSql + ')' : '');
  try {
    const [[row]] = await conn.execute(
      'SELECT COUNT(DISTINCT username) AS n FROM payment_orders WHERE ' + where,
      [startYmd, endYmd]
    );
    return row && row.n != null ? Number(row.n) || 0 : 0;
  } catch (e) {
    return 0;
  }
}

async function collectAdminActivationCredits(conn, startYmd, endYmd) {
  var rules = adminActivationCreditRules();
  var byAdmin = rules.map(function (rule) {
    return {
      admin_username: rule.admin_username,
      unit_amount: rule.unit_amount,
      label_note: rule.label_note || '',
      orders: 0,
      gmv: 0
    };
  });
  var byAdminMap = {};
  byAdmin.forEach(function (row) {
    byAdminMap[row.admin_username] = row;
  });
  var dailyMap = {};
  var totalOrders = 0;
  var totalGmv = 0;
  var cnActDay = cnDateExpr('ac.last_used_at');
  var eligible =
    'u.activation_refunded_at IS NULL AND u.list_hidden_at IS NULL AND COALESCE(u.user_type, 0) <> ' +
    USER_TYPE_GUEST;

  for (var ri = 0; ri < rules.length; ri++) {
    var rule = rules[ri];
    var ownerSql = 'ac.owner_admin_username = ?';
    var ownerParams = [rule.admin_username];
    if (rule.exclude_alipay) {
      ownerSql +=
        " AND (COALESCE(NULLIF(TRIM(u.activation_source_channel), ''), '__none__') <> ?" +
        ' AND NOT (ac.note IS NOT NULL AND ac.note LIKE ?))';
      ownerParams = ownerParams.concat(['alipay', '%支付宝%']);
    }
    var baseWhere =
      "ac.last_used_at IS NOT NULL AND ac.used_count > 0 AND ac.used_by_username IS NOT NULL AND TRIM(ac.used_by_username) <> '' AND " +
      ownerSql +
      ' AND ' +
      cnActDay +
      ' BETWEEN ? AND ? AND ' +
      eligible;
    var baseParams = ownerParams.concat([startYmd, endYmd]);
    try {
      const [summaryRows] = await conn.execute(
        'SELECT COUNT(DISTINCT ac.used_by_username) AS cnt' +
          ' FROM activation_codes ac' +
          ' INNER JOIN users u ON u.username = ac.used_by_username' +
          ' WHERE ' +
          baseWhere,
        baseParams
      );
      var orders = Number((summaryRows[0] || {}).cnt) || 0;
      if (orders > 0) {
        var gmv = Math.round(orders * rule.unit_amount * 100) / 100;
        byAdminMap[rule.admin_username].orders = orders;
        byAdminMap[rule.admin_username].gmv = gmv;
        totalOrders += orders;
        totalGmv += gmv;
      }

      const [dailyRows] = await conn.execute(
        'SELECT ' +
          cnActDay +
          ' AS d, COUNT(DISTINCT ac.used_by_username) AS cnt' +
          ' FROM activation_codes ac' +
          ' INNER JOIN users u ON u.username = ac.used_by_username' +
          ' WHERE ' +
          baseWhere +
          ' GROUP BY d',
        baseParams
      );
      (dailyRows || []).forEach(function (r) {
        var dk = asYmd(r.d);
        var dayOrders = Number(r.cnt) || 0;
        if (!dk || dayOrders <= 0) return;
        if (!dailyMap[dk]) dailyMap[dk] = { orders: 0, gmv: 0 };
        var dayGmv = Math.round(dayOrders * rule.unit_amount * 100) / 100;
        dailyMap[dk].orders += dayOrders;
        dailyMap[dk].gmv = Math.round((dailyMap[dk].gmv + dayGmv) * 100) / 100;
      });
    } catch (eAdmin) {
      console.warn('[ops-stats] admin activation credit skipped', eAdmin && eAdmin.message);
    }
  }

  return {
    by_admin: byAdmin.filter(function (r) {
      return r.orders > 0;
    }),
    total_orders: totalOrders,
    total_gmv: Math.round(totalGmv * 100) / 100,
    dailyMap: dailyMap
  };
}

function kpiTable(tot, opts) {
  opts = opts || {};
  var adminActLabel =
    tot.admin_act_n > 0
      ? num(tot.admin_act_n) + ' 单 / ' + yuan(tot.admin_act_amt)
      : '0 单 / ' + yuan(0);
  var rows =
    tr(['日活合计（人次）', num(tot.dau)]) +
    (opts.showUnique ? tr(['活跃去重（人）', num(tot.dau_unique)]) : '') +
    (opts.showAvg ? tr(['日均日活', String(tot.dau_avg)]) : '') +
    tr(['新注册', num(tot.reg)]) +
    tr(['新激活', num(tot.act) + '（admin ' + num(tot.act_admin) + ' / 其他 ' + num(tot.act_other) + '）']) +
    tr(['线上已付', num(tot.paid_n) + ' 单 / ' + num(tot.paid_uv) + ' 人 / ' + yuan(tot.paid_amt)]) +
    tr(['开通套餐（线上）', num(tot.activation_n) + ' 单 / ' + yuan(tot.activation_amt)]) +
    tr(['离职证明', num(tot.lizhi_n) + ' 单 / ' + num(tot.lizhi_uv) + ' 人 / ' + yuan(tot.lizhi_amt)]) +
    tr(['改名费', num(tot.rename_n) + ' 单 / ' + yuan(tot.rename_amt)]) +
    tr(['同行费用（个税修改）', num(tot.tax_edit_n) + ' 单 / ' + yuan(tot.tax_edit_amt)]) +
    tr(['管理员激活', adminActLabel]) +
    tr([
      '开通合计（含管理员激活）',
      num(tot.combined_activation_n) + ' 单 / ' + yuan(tot.combined_activation_amt)
    ]) +
    tr(['合计 GMV（含管理员激活）', yuan(tot.combined_amt)]);
  return (
    '<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;font-size:14px;">' +
    rows +
    '</table>'
  );
}

function tr(cols) {
  return (
    '<tr>' +
    cols
      .map(function (c, i) {
        var tag = i === 0 ? 'th' : 'td';
        var align = i === 0 ? 'left' : 'right';
        return (
          '<' +
          tag +
          ' style="text-align:' +
          align +
          ';padding:6px 10px;">' +
          htmlEscape(c) +
          '</' +
          tag +
          '>'
        );
      })
      .join('') +
    '</tr>'
  );
}

function dailyBreakdownTable(daily) {
  var head = tr([
    '日期',
    '日活',
    '注册',
    '激活',
    '线上已付',
    '开通',
    '离职证明',
    '同行费',
    '管理员激活',
    '合计GMV'
  ]);
  var body = daily
    .map(function (r) {
      return tr([
        r.d.slice(5),
        num(r.dau),
        num(r.reg),
        num(r.act),
        num(r.paid_n),
        yuan(r.activation_amt),
        yuan(r.lizhi_amt),
        yuan(r.tax_edit_amt),
        yuan(r.admin_act_amt),
        yuan(r.combined_amt)
      ]);
    })
    .join('');
  return (
    '<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;font-size:13px;">' +
    '<thead>' +
    head +
    '</thead><tbody>' +
    body +
    '</tbody></table>'
  );
}

function paymentProductTable(tot) {
  var rows = [
    ['开通套餐（线上支付）', tot.activation_n, '—', tot.activation_amt]
  ];
  (tot.admin_act_by_admin || []).forEach(function (row) {
    if (!row || !(row.orders > 0)) return;
    var note =
      row.label_note && String(row.label_note).trim()
        ? ' · ' + String(row.label_note).trim()
        : '';
    rows.push([
      '管理员激活（' +
        (row.admin_username || '—') +
        ' · ¥' +
        (row.unit_amount != null ? row.unit_amount : 0) +
        '/单' +
        note +
        '）',
      row.orders,
      '—',
      row.gmv
    ]);
  });
  rows.push(
    ['离职证明', tot.lizhi_n, tot.lizhi_uv, tot.lizhi_amt],
    ['改名费', tot.rename_n, '—', tot.rename_amt],
    ['同行费用（每天无限）', tot.tax_edit_n, '—', tot.tax_edit_amt],
    [
      '开通合计（含管理员激活）',
      tot.combined_activation_n,
      '—',
      tot.combined_activation_amt
    ],
    ['合计（含管理员激活）', tot.paid_n, tot.paid_uv, tot.combined_amt]
  );
  var head = tr(['产品', '订单数', '去重用户', 'GMV']);
  var body = rows
    .map(function (r) {
      return tr([r[0], num(r[1]), r[2] === '—' ? '—' : num(r[2]), yuan(r[3])]);
    })
    .join('');
  return (
    '<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;font-size:13px;">' +
    head +
    body +
    '</table>'
  );
}

function skuTable(skus) {
  if (!skus || !skus.length) {
    return '<p style="color:#666;">本期无已付订单。</p>';
  }
  var head = tr(['SKU', '类型', '订单', '人数', '金额']);
  var body = skus
    .map(function (s) {
      return tr([s.sku, s.kind, num(s.n), num(s.uv), yuan(s.amt)]);
    })
    .join('');
  return (
    '<table cellpadding="6" cellspacing="0" border="1" style="border-collapse:collapse;font-size:13px;">' +
    head +
    body +
    '</table>'
  );
}

function wrapHtml(title, inner) {
  return (
    '<div style="font-family:Arial,sans-serif;color:#222;line-height:1.5;max-width:720px;">' +
    '<h2 style="margin:0 0 12px;">' +
    htmlEscape(title) +
    '</h2>' +
    inner +
    '<p style="color:#888;font-size:12px;margin-top:20px;">口径：日活 = user_daily_activity 按 IP 去重（同 IP 多账号计 1）；注册/激活/支付日 = 北京时间 UTC+8；游客已排除。支付拆分对齐管理台「支付分析」：开通套餐 = 线上已付中扣除离职/在职证明、改名、个税修改、完税码；管理员激活按 18933137956¥100 / 19106014552¥60 / admin 非支付宝¥100 折算并入合计 GMV。</p>' +
    '</div>'
  );
}

function h3(t) {
  return '<h3 style="margin:18px 0 8px;font-size:15px;">' + htmlEscape(t) + '</h3>';
}

function buildDailyEmail(dayStats, wtd, mtd) {
  var d = dayStats.end;
  var tot = dayStats.tot;
  var title = siteLabel() + ' 运营日报 ' + d;
  var subject =
    '[' +
    siteLabel() +
    '] 日报 ' +
    d +
    ' · 日活 ' +
    num(tot.dau) +
    ' / 注册 ' +
    num(tot.reg) +
    ' / 激活 ' +
    num(tot.act) +
    ' / 合计GMV ' +
    yuan(tot.combined_amt);
  var html = wrapHtml(
    title,
    h3('当日') +
      kpiTable(tot, {}) +
      h3('当日收入拆分（对齐支付分析）') +
      paymentProductTable(tot) +
      h3('当日已付 SKU') +
      skuTable(dayStats.skus) +
      h3('本周累计（' + wtd.start + ' ~ ' + wtd.end + '）') +
      kpiTable(wtd.tot, { showUnique: true, showAvg: true }) +
      h3('本周收入拆分') +
      paymentProductTable(wtd.tot) +
      h3('本周分日') +
      dailyBreakdownTable(wtd.daily) +
      h3('本月累计（' + mtd.start + ' ~ ' + mtd.end + '）') +
      kpiTable(mtd.tot, { showUnique: true, showAvg: true }) +
      h3('本月收入拆分') +
      paymentProductTable(mtd.tot)
  );
  var text =
    title +
    '\n日活 ' +
    tot.dau +
    '  注册 ' +
    tot.reg +
    '  激活 ' +
    tot.act +
    '（admin ' +
    tot.act_admin +
    '/其他 ' +
    tot.act_other +
    '）  线上实付 ' +
    yuan(tot.paid_amt) +
    '  合计GMV ' +
    yuan(tot.combined_amt) +
    '\n开通套餐 ' +
    tot.activation_n +
    '/' +
    yuan(tot.activation_amt) +
    '  离职证明 ' +
    tot.lizhi_n +
    '/' +
    yuan(tot.lizhi_amt) +
    '  同行费 ' +
    tot.tax_edit_n +
    '/' +
    yuan(tot.tax_edit_amt) +
    '  管理员激活 ' +
    tot.admin_act_n +
    '/' +
    yuan(tot.admin_act_amt) +
    '\n本周累计 日活' +
    wtd.tot.dau +
    ' 注册' +
    wtd.tot.reg +
    ' 激活' +
    wtd.tot.act +
    ' 合计GMV' +
    yuan(wtd.tot.combined_amt) +
    '\n本月累计 日活' +
    mtd.tot.dau +
    ' 注册' +
    mtd.tot.reg +
    ' 激活' +
    mtd.tot.act +
    ' 合计GMV' +
    yuan(mtd.tot.combined_amt) +
    '\n';
  return { subject: subject, html: html, text: text };
}

function buildPeriodEmail(kind, stats) {
  var label = kind === 'weekly' ? '周报' : '月报';
  var range = stats.start + ' ~ ' + stats.end;
  var title = siteLabel() + ' 运营' + label + ' ' + range;
  var tot = stats.tot;
  var subject =
    '[' +
    siteLabel() +
    '] ' +
    label +
    ' ' +
    range +
    ' · 日均日活 ' +
    tot.dau_avg +
    ' / 注册 ' +
    num(tot.reg) +
    ' / 激活 ' +
    num(tot.act) +
    ' / 合计GMV ' +
    yuan(tot.combined_amt);
  var html = wrapHtml(
    title,
    h3('汇总') +
      kpiTable(tot, { showUnique: true, showAvg: true }) +
      h3('收入拆分（对齐支付分析）') +
      paymentProductTable(tot) +
      h3('已付 SKU') +
      skuTable(stats.skus) +
      h3('分日明细') +
      dailyBreakdownTable(stats.daily)
  );
  var text =
    title +
    '\n日均日活 ' +
    tot.dau_avg +
    '  注册 ' +
    tot.reg +
    '  激活 ' +
    tot.act +
    '  线上实付 ' +
    yuan(tot.paid_amt) +
    '  合计GMV ' +
    yuan(tot.combined_amt) +
    '\n';
  return { subject: subject, html: html, text: text };
}

async function readSetting(conn, key) {
  const [rows] = await conn.execute(
    'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
    [key]
  );
  if (!rows.length || rows[0].setting_value == null) return '';
  return String(rows[0].setting_value).trim();
}

async function writeSetting(conn, key, value) {
  await conn.execute(
    'INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ' +
      'ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
    [key, String(value)]
  );
}

async function sendOne(to, payload) {
  await mail.sendMail({
    to: to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html
  });
}

async function gatherDailyBundle(conn, dayYmd) {
  var weekStart = mondayOf(dayYmd);
  var monthStart = monthStartOf(dayYmd);
  var dayStats = await collectRangeStats(conn, dayYmd, dayYmd);
  var wtd = await collectRangeStats(conn, weekStart, dayYmd);
  var mtd = await collectRangeStats(conn, monthStart, dayYmd);
  return { dayStats: dayStats, wtd: wtd, mtd: mtd, mail: buildDailyEmail(dayStats, wtd, mtd) };
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {{ force?: boolean, date?: string, kinds?: string[] }} opts
 */
async function runOpsStatsReport(pool, opts) {
  opts = opts || {};
  var to = statsReportTo();
  if (!to) throw new Error('未配置 STATS_REPORT_EMAIL / MONITOR_ALERT_EMAIL');
  if (!mail.isMailConfigured()) throw new Error('未配置 SMTP');
  var now = opts.now instanceof Date ? opts.now : new Date();
  var due = reportsDue(now);
  if (opts.date) {
    due = {
      daily: opts.date,
      weekly: lastCompletedWeek(opts.date),
      monthly: lastCompletedMonth(opts.date)
    };
  }
  var kinds = opts.kinds || ['daily', 'weekly', 'monthly'];
  var sent = [];
  var conn = await pool.getConnection();
  try {
    var lastDaily = await readSetting(conn, SETTING_DAILY);
    var lastWeekly = await readSetting(conn, SETTING_WEEKLY);
    var lastMonthly = await readSetting(conn, SETTING_MONTHLY);

    if (kinds.indexOf('daily') >= 0 && due.daily && (opts.force || lastDaily < due.daily)) {
      var bundle = await gatherDailyBundle(conn, due.daily);
      await sendOne(to, bundle.mail);
      await writeSetting(conn, SETTING_DAILY, due.daily);
      sent.push('daily:' + due.daily);
    }
    if (
      kinds.indexOf('weekly') >= 0 &&
      due.weekly &&
      (opts.force || lastWeekly < due.weekly.end)
    ) {
      var weekStats = await collectRangeStats(conn, due.weekly.start, due.weekly.end);
      await sendOne(to, buildPeriodEmail('weekly', weekStats));
      await writeSetting(conn, SETTING_WEEKLY, due.weekly.end);
      sent.push('weekly:' + due.weekly.start + '~' + due.weekly.end);
    }
    if (
      kinds.indexOf('monthly') >= 0 &&
      due.monthly &&
      (opts.force || lastMonthly < due.monthly.end)
    ) {
      var monthStats = await collectRangeStats(conn, due.monthly.start, due.monthly.end);
      await sendOne(to, buildPeriodEmail('monthly', monthStats));
      await writeSetting(conn, SETTING_MONTHLY, due.monthly.end);
      sent.push('monthly:' + due.monthly.start + '~' + due.monthly.end);
    }
  } finally {
    conn.release();
  }
  return { to: to, sent: sent, due: due };
}

var _running = false;
var _timer = null;

async function tickOpsStatsReport(pool, reason) {
  if (!statsReportEnabled() || !pool || _running) return null;
  if (!mail.isMailConfigured()) {
    console.warn('[ops-stats] skip ' + reason + ': SMTP 未配置');
    return null;
  }
  _running = true;
  try {
    var result = await runOpsStatsReport(pool, { force: false });
    if (result.sent.length) {
      console.log('[ops-stats] ' + reason + ' sent ' + result.sent.join(', ') + ' -> ' + result.to);
    }
    return result;
  } catch (e) {
    console.error('[ops-stats] ' + reason + ' failed', e);
    return null;
  } finally {
    _running = false;
  }
}

function scheduleOpsStatsReport(getPool) {
  if (!statsReportEnabled()) {
    console.log('[ops-stats] disabled (STATS_REPORT_ENABLED=0)');
    return;
  }
  var getter = typeof getPool === 'function' ? getPool : function () { return getPool; };
  setTimeout(function () {
    tickOpsStatsReport(getter(), 'startup');
  }, 90 * 1000);
  if (_timer) clearInterval(_timer);
  _timer = setInterval(function () {
    tickOpsStatsReport(getter(), 'interval');
  }, 60 * 1000);
  console.log('[ops-stats] scheduled nightly Asia/Shanghai 00:00 -> ' + statsReportTo());
}

async function createStandalonePool() {
  return mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'personal_tax',
    waitForConnections: true,
    connectionLimit: 4
  });
}

async function cliMain(argv) {
  var args = argv.slice(2);
  if (args.indexOf('--help') >= 0 || args.indexOf('-h') >= 0) {
    console.log('Usage: node opsStatsReport.js --send [--date YYYY-MM-DD] [--force] [--kinds daily,weekly,monthly]');
    return;
  }
  if (args.indexOf('--send') < 0) {
    console.log('pass --send to deliver reports');
    return;
  }
  var dateIdx = args.indexOf('--date');
  var date = dateIdx >= 0 ? args[dateIdx + 1] : '';
  var kindsArg = '';
  var ki = args.indexOf('--kinds');
  if (ki >= 0) kindsArg = args[ki + 1] || '';
  var kinds = kindsArg
    ? kindsArg.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
    : null;
  var pool = await createStandalonePool();
  try {
    var result = await runOpsStatsReport(pool, {
      force: args.indexOf('--force') >= 0,
      date: date || undefined,
      kinds: kinds || undefined
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  cliMain(process.argv).catch(function (e) {
    console.error(e);
    process.exit(1);
  });
}

module.exports = {
  chinaParts,
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
  buildDailyEmail,
  buildPeriodEmail,
  collectRangeStats,
  runOpsStatsReport,
  scheduleOpsStatsReport,
  tickOpsStatsReport,
  statsReportTo,
  statsReportEnabled
};
