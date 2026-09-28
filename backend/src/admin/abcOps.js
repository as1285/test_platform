/**
 * ABC 渠道运营：转化漏斗、用户名单、支付明细。
 * 账号归因看 sales_promo_channel=abc；下载页看 install_guide 埋点 sales_ch=abc。
 */
'use strict';

const { getPool: defaultGetPool } = require('../shared/db');
const { adminUsernameKey, adminHasFullUserScope } = require('./fullUserScope');
const agentChannels = require('../legacy/agentChannels');
const { opsSkuGmvLabel } = require('./opsConversion');
const taxEditFeePolicy = require('../tax/taxEditFeePolicy');

var GUEST_PREFIX = '__guest_';
var HIGH_INCOME = 15000;
var ABC_CHANNEL_ADMIN_ONLY_SINCE_UTC = String(
  process.env.ABC_CHANNEL_ADMIN_ONLY_SINCE || '2026-09-07 02:41:00'
).trim();

function abcAdminOnlySinceUtc() {
  return ABC_CHANNEL_ADMIN_ONLY_SINCE_UTC || '2026-09-07 02:41:00';
}

function isAbcChannelViewerAdmin(admin) {
  return adminUsernameKey(admin) === 'admin';
}

function visibilityMeta(admin) {
  if (isAbcChannelViewerAdmin(admin)) {
    return { viewer: 'admin', sees_new_abc: true, since: abcAdminOnlySinceUtc() };
  }
  if (adminHasFullUserScope(admin)) {
    return { viewer: 'full', sees_new_abc: false, since: abcAdminOnlySinceUtc() };
  }
  return { viewer: 'limited', sees_new_abc: false, since: abcAdminOnlySinceUtc() };
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function chinaNowParts() {
  var now = new Date();
  var utc = now.getTime() + now.getTimezoneOffset() * 60000;
  var cn = new Date(utc + 8 * 3600000);
  return { year: cn.getFullYear(), month: cn.getMonth() + 1, day: cn.getDate() };
}

function monthRange(offset) {
  var cn = chinaNowParts();
  var dt = new Date(cn.year, cn.month - 1 - (offset || 0), 1);
  var y = dt.getFullYear();
  var m = dt.getMonth() + 1;
  var last = new Date(y, m, 0).getDate();
  return {
    start: y + '-' + pad2(m) + '-01',
    end: y + '-' + pad2(m) + '-' + pad2(last),
    days: last
  };
}

function parsePeriod(raw, fallbackDays) {
  var s = String(raw == null ? '' : raw).trim();
  if (s === 'month_current' || s === 'month_prev' || s === 'month_prev2') {
    var off = s === 'month_current' ? 0 : s === 'month_prev' ? 1 : 2;
    var mr = monthRange(off);
    return {
      mode: 'range',
      start: mr.start,
      end: mr.end,
      days: mr.days,
      period_key: s,
      label: s === 'month_current' ? '当月' : s === 'month_prev' ? '上月' : '上上月'
    };
  }
  var fixed = s.match(/^month_(\d{4})-(\d{2})$/);
  if (fixed) {
    var fy = parseInt(fixed[1], 10);
    var fm = parseInt(fixed[2], 10);
    if (fm >= 1 && fm <= 12 && fy >= 2026 && fy <= 2100) {
      var last = new Date(fy, fm, 0).getDate();
      return {
        mode: 'range',
        start: fy + '-' + pad2(fm) + '-01',
        end: fy + '-' + pad2(fm) + '-' + pad2(last),
        days: last,
        period_key: s,
        label: fy + '年' + fm + '月'
      };
    }
  }
  var range = s.match(/^range_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/);
  if (range) {
    return {
      mode: 'range',
      start: range[1],
      end: range[2],
      days: null,
      period_key: s,
      label: '自定义'
    };
  }
  var n = parseInt(s, 10);
  if (!isFinite(n) || n < 1) n = fallbackDays == null ? 7 : fallbackDays;
  if (n > 366) n = 366;
  return {
    mode: 'days',
    days: n,
    span: n - 1,
    period_key: String(n),
    label: n === 1 ? '今日' : '最近 ' + n + ' 天'
  };
}

function periodCnDateFilter(dateExpr, period) {
  if (period && period.mode === 'range') {
    return {
      sql: '(' + dateExpr + ' >= ? AND ' + dateExpr + ' <= ?)',
      params: [period.start, period.end]
    };
  }
  var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
  return {
    sql: '(' + dateExpr + ' >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY))',
    params: [period && period.span != null ? period.span : 6]
  };
}

function periodMeta(period) {
  return {
    days: period.period_key,
    period_label: period.label,
    period_start: period.mode === 'range' ? period.start : null,
    period_end: period.mode === 'range' ? period.end : null
  };
}

function abcChannelSql(alias) {
  var col = (alias ? alias + '.' : '') + 'sales_promo_channel';
  return "LOWER(TRIM(IFNULL(" + col + ", ''))) = 'abc'";
}

function abcInstallMetaSql(col) {
  var c = col || 'meta_json';
  return (
    "(LOWER(TRIM(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(" +
    c +
    ", '$.sales_ch')), ''))) = 'abc' OR LOWER(TRIM(IFNULL(JSON_UNQUOTE(JSON_EXTRACT(" +
    c +
    ", '$.ch')), ''))) = 'abc')"
  );
}

function nonGuestSql(alias) {
  var t = alias || 'users';
  return (
    'LEFT(' +
    t +
    ".username, " +
    GUEST_PREFIX.length +
    ") <> '" +
    GUEST_PREFIX +
    "' AND COALESCE(" +
    t +
    '.user_type, 0) <> 2'
  );
}

function hasTaxSql(userCol) {
  return (
    'EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = ' +
    userCol +
    ' AND tr.deleted_at IS NULL)'
  );
}

function sawPurchaseSql(userCol) {
  return (
    'EXISTS (SELECT 1 FROM user_page_events e WHERE e.username = ' +
    userCol +
    " AND (e.page_path LIKE '%purchase%' OR e.route_key LIKE '%track_purchase_page_view%'))"
  );
}

function monthIncomeSql(alias) {
  var t = alias || 'tr';
  return 'GREATEST(IFNULL(' + t + '.income_this_period, 0), IFNULL(' + t + '.income, 0))';
}

function highIncomeExistsSql(userCol) {
  return (
    'EXISTS (SELECT 1 FROM tax_records tr WHERE tr.user_id = ' +
    userCol +
    " AND tr.deleted_at IS NULL AND IFNULL(tr.company_name,'') NOT LIKE '%示例%' AND " +
    monthIncomeSql('tr') +
    ' > ' +
    HIGH_INCOME +
    ')'
  );
}

function paidExistsSql(userCol) {
  return (
    "EXISTS (SELECT 1 FROM payment_orders p WHERE p.username = " +
    userCol +
    " AND p.status = 'paid')"
  );
}

function taxEditSkuSql(alias) {
  var p = alias ? alias + '.' : '';
  return (
    '(' +
    p +
    "sku_id IN ('" +
    taxEditFeePolicy.TAX_EDIT_SINGLE_SKU_ID +
    "','" +
    taxEditFeePolicy.TAX_EDIT_DAILY_SKU_ID +
    "') OR " +
    p +
    "grant_kind IN ('tax_edit_single','tax_edit_daily'))"
  );
}

function n(row, key) {
  return Number(row && row[key]) || 0;
}

function money(v) {
  return Math.round(Number(v || 0) * 100) / 100;
}

function pct(num, den) {
  if (!den || den <= 0) return null;
  return Math.round((num / den) * 1000) / 10;
}

function pctText(num, den) {
  var p = pct(num, den);
  return p == null ? null : p.toFixed(1) + '%';
}

function formatDateKey(d) {
  if (!d) return '';
  if (d instanceof Date) {
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + '-' + pad2(m) + '-' + pad2(day);
  }
  var s = String(d);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function appendAbcUserVisibility(where, params, admin, alias) {
  var t = alias || 'users';
  if (isAbcChannelViewerAdmin(admin)) return;
  var chCol = t + '.sales_promo_channel';
  var createdCol = t + '.created_at';
  if (adminHasFullUserScope(admin)) {
    where.push(
      agentChannels.excludeUrlOnlySalesChannelSinceSql(
        chCol,
        createdCol,
        abcAdminOnlySinceUtc(),
        params
      )
    );
    return;
  }
  where.push(agentChannels.excludeUrlOnlySalesChannelSql(chCol, params));
}

function baseAbcUserWhere(admin, extra) {
  var where = ['users.list_hidden_at IS NULL', nonGuestSql('users'), abcChannelSql('users')];
  var params = [];
  appendAbcUserVisibility(where, params, admin, 'users');
  if (extra) extra(where, params);
  return { where: where, params: params };
}

function registerSourceLabel(ch) {
  var key = String(ch || '').trim();
  if (!key) return '未填';
  var map = {
    github: 'GitHub',
    douyin: '抖音',
    friend: '朋友介绍',
    bilibili: 'B站',
    tieba: '贴吧',
    zhihu: '知乎'
  };
  if (key.indexOf('other:') === 0) {
    var custom = key.slice(6).trim();
    return custom ? '其他：' + custom : '其他';
  }
  return map[key] || key;
}

function createAbcOps(deps) {
  var getPool = (deps && deps.getPool) || defaultGetPool;

  async function handleAbcOpsOverview(req, res) {
    try {
      var period = parsePeriod(req.query && req.query.days, 7);
      var vis = visibilityMeta(req.admin);
      var pool = getPool();
      var conn = await pool.getConnection();
      try {
        var cnDay = 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
        var cnUserDay = 'DATE(DATE_ADD(users.created_at, INTERVAL 8 HOUR))';
        var cnActDay = 'DATE(DATE_ADD(ac.last_used_at, INTERVAL 8 HOUR))';
        var cnPaidDay = 'DATE(DATE_ADD(COALESCE(p.paid_at, p.created_at), INTERVAL 8 HOUR))';
        var todayBjSql = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
        var pfInstall = periodCnDateFilter(cnDay, period);
        var pfUser = periodCnDateFilter(cnUserDay, period);
        var visitorExpr = "COALESCE(NULLIF(TRIM(ip), ''), NULLIF(client_id, ''), device_fp)";
        var downloadKeys = "event_key IN ('track_install_apk_click', 'track_install_ios_click')";
        var abcMeta = abcInstallMetaSql('meta_json');

        var userBuilt = baseAbcUserWhere(req.admin);
        var userWhereSql = ' WHERE ' + userBuilt.where.join(' AND ');

        const [todayRegRows] = await conn.query(
          `SELECT COUNT(*) AS register_today
           FROM users ${userWhereSql}
             AND ${cnUserDay} = ${todayBjSql}`,
          userBuilt.params
        );

        var actWhere = userBuilt.where.slice();
        var actParams = userBuilt.params.slice();
        actWhere.push('ac.last_used_at IS NOT NULL');
        actWhere.push('ac.used_count > 0');
        actWhere.push('(users.activation_cancelled_at IS NULL)');
        actWhere.push(cnActDay + ' = ' + todayBjSql);
        const [todayActRows] = await conn.query(
          'SELECT COUNT(DISTINCT ac.used_by_username) AS activate_today FROM users' +
            ' INNER JOIN activation_codes ac ON ac.used_by_username = users.username WHERE ' +
            actWhere.join(' AND '),
          actParams
        );

        var payJoinWhere = userBuilt.where.slice();
        var payJoinParams = userBuilt.params.slice();
        payJoinWhere.push("p.status = 'paid'");
        payJoinWhere.push(cnPaidDay + ' = ' + todayBjSql);
        var taxSql = taxEditSkuSql('p');
        const [todayPayRows] = await conn.query(
          `SELECT COUNT(*) AS pay_orders,
                  COALESCE(SUM(p.amount), 0) AS pay_gmv,
                  COALESCE(SUM(CASE WHEN ${taxSql} THEN 0 ELSE p.amount END), 0) AS pay_orders_gmv,
                  COALESCE(SUM(CASE WHEN ${taxSql} THEN p.amount ELSE 0 END), 0) AS tax_edit_gmv
           FROM payment_orders p
           INNER JOIN users ON users.username = p.username
           WHERE ` + payJoinWhere.join(' AND '),
          payJoinParams
        );
        const [todaySkuRows] = await conn.query(
          `SELECT COALESCE(NULLIF(TRIM(p.sku_id), ''), '(unknown)') AS sku_id,
                  MAX(p.subject) AS subject,
                  MAX(p.grant_kind) AS grant_kind,
                  COUNT(*) AS orders,
                  COALESCE(SUM(p.amount), 0) AS gmv
           FROM payment_orders p
           INNER JOIN users ON users.username = p.username
           WHERE ` +
            payJoinWhere.join(' AND ') +
            `
           GROUP BY COALESCE(NULLIF(TRIM(p.sku_id), ''), '(unknown)')
           ORDER BY gmv DESC, orders DESC`,
          payJoinParams
        );

        const [installSumRows] = await conn.query(
          `SELECT
              COUNT(CASE WHEN event_key = 'track_install_page_view' THEN 1 END) AS view_pv,
              COUNT(DISTINCT CASE WHEN event_key = 'track_install_page_view' THEN ${visitorExpr} END) AS view_uv,
              COUNT(CASE WHEN event_key = 'track_install_apk_click' THEN 1 END) AS apk_clicks,
              COUNT(DISTINCT CASE WHEN event_key = 'track_install_apk_click' THEN ${visitorExpr} END) AS apk_uv,
              COUNT(CASE WHEN event_key = 'track_install_ios_click' THEN 1 END) AS ios_clicks,
              COUNT(DISTINCT CASE WHEN event_key = 'track_install_ios_click' THEN ${visitorExpr} END) AS ios_uv,
              COUNT(CASE WHEN ${downloadKeys} THEN 1 END) AS download_clicks,
              COUNT(DISTINCT CASE WHEN ${downloadKeys} THEN ${visitorExpr} END) AS download_uv
           FROM install_guide_track_events
           WHERE ${pfInstall.sql} AND ${abcMeta}`,
          pfInstall.params
        );

        var cohortWhere = userBuilt.where.concat([pfUser.sql]);
        var cohortParams = userBuilt.params.concat(pfUser.params);
        var cohortSql = ' WHERE ' + cohortWhere.join(' AND ');
        const [cohortRows] = await conn.query(
          `SELECT
             COUNT(*) AS registered,
             SUM(users.account_active = 1) AS activated,
             SUM(users.account_active = 0 OR users.account_active IS NULL) AS unactivated,
             SUM(${sawPurchaseSql('users.username')}) AS saw_purchase,
             SUM(${hasTaxSql('users.username')}) AS has_tax,
             SUM(${highIncomeExistsSql('users.username')}) AS high_income,
             SUM(${paidExistsSql('users.username')}) AS paid_users,
             SUM((users.account_active = 0 OR users.account_active IS NULL) AND ${sawPurchaseSql('users.username')}) AS unact_saw_pay,
             SUM((users.account_active = 0 OR users.account_active IS NULL) AND ${hasTaxSql('users.username')}) AS unact_has_tax
           FROM users ${cohortSql}`,
          cohortParams
        );

        var periodPayWhere = userBuilt.where.slice();
        var periodPayParams = userBuilt.params.slice();
        periodPayWhere.push("p.status = 'paid'");
        var pfPaid = periodCnDateFilter(cnPaidDay, period);
        periodPayWhere.push(pfPaid.sql);
        periodPayParams = periodPayParams.concat(pfPaid.params);
        const [periodPayRows] = await conn.query(
          `SELECT COUNT(*) AS pay_orders,
                  COUNT(DISTINCT p.username) AS pay_users,
                  COALESCE(SUM(p.amount), 0) AS pay_gmv
           FROM payment_orders p
           INNER JOIN users ON users.username = p.username
           WHERE ` + periodPayWhere.join(' AND '),
          periodPayParams
        );

        var stockBuilt = baseAbcUserWhere(req.admin, function (where) {
          where.push('(users.account_active IS NULL OR users.account_active = 0)');
        });
        const [stockRows] = await conn.query(
          `SELECT
             COUNT(*) AS total,
             SUM(${hasTaxSql('users.username')}) AS has_tax,
             SUM(${sawPurchaseSql('users.username')}) AS saw_purchase,
             SUM(${highIncomeExistsSql('users.username')}) AS high_income,
             SUM(CASE WHEN users.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS in_7d
           FROM users WHERE ` + stockBuilt.where.join(' AND '),
          stockBuilt.params
        );

        const [dailyInstallRows] = await conn.query(
          `SELECT ${cnDay} AS d,
                  COUNT(DISTINCT CASE WHEN event_key = 'track_install_page_view' THEN ${visitorExpr} END) AS view_uv,
                  COUNT(DISTINCT CASE WHEN ${downloadKeys} THEN ${visitorExpr} END) AS download_uv,
                  COUNT(CASE WHEN event_key = 'track_install_page_view' THEN 1 END) AS view_pv,
                  COUNT(CASE WHEN ${downloadKeys} THEN 1 END) AS download_clicks
           FROM install_guide_track_events
           WHERE ${pfInstall.sql} AND ${abcMeta}
           GROUP BY ${cnDay}
           ORDER BY d ASC`,
          pfInstall.params
        );
        const [dailyRegRows] = await conn.query(
          `SELECT ${cnUserDay} AS d, COUNT(*) AS registered,
                  SUM(users.account_active = 1) AS activated
           FROM users ${cohortSql}
           GROUP BY ${cnUserDay}
           ORDER BY d ASC`,
          cohortParams
        );
        const [dailyPayRows] = await conn.query(
          `SELECT ${cnPaidDay} AS d,
                  COUNT(*) AS pay_orders,
                  COUNT(DISTINCT p.username) AS pay_users,
                  COALESCE(SUM(p.amount), 0) AS gmv
           FROM payment_orders p
           INNER JOIN users ON users.username = p.username
           WHERE ` +
            periodPayWhere.join(' AND ') +
            `
           GROUP BY ${cnPaidDay}
           ORDER BY d ASC`,
          periodPayParams
        );

        var install = installSumRows && installSumRows[0] ? installSumRows[0] : {};
        var cohort = cohortRows && cohortRows[0] ? cohortRows[0] : {};
        var periodPay = periodPayRows && periodPayRows[0] ? periodPayRows[0] : {};
        var stock = stockRows && stockRows[0] ? stockRows[0] : {};
        var todayReg = todayRegRows && todayRegRows[0] ? todayRegRows[0] : {};
        var todayAct = todayActRows && todayActRows[0] ? todayActRows[0] : {};
        var todayPay = todayPayRows && todayPayRows[0] ? todayPayRows[0] : {};

        var viewUv = n(install, 'view_uv');
        var dlUv = n(install, 'download_uv');
        var registered = n(cohort, 'registered');
        var activated = n(cohort, 'activated');
        var sawPurchase = n(cohort, 'saw_purchase');
        var paidUsers = n(cohort, 'paid_users');
        var payOrders = n(periodPay, 'pay_orders');
        var payGmv = money(periodPay.pay_gmv);

        var dayMap = Object.create(null);
        function touch(d) {
          var key = formatDateKey(d);
          if (!key) return null;
          if (!dayMap[key]) {
            dayMap[key] = {
              date: key,
              view_uv: 0,
              download_uv: 0,
              registered: 0,
              activated: 0,
              pay_orders: 0,
              pay_users: 0,
              gmv: 0
            };
          }
          return dayMap[key];
        }
        (dailyInstallRows || []).forEach(function (r) {
          var row = touch(r.d);
          if (!row) return;
          row.view_uv = n(r, 'view_uv');
          row.download_uv = n(r, 'download_uv');
        });
        (dailyRegRows || []).forEach(function (r) {
          var row = touch(r.d);
          if (!row) return;
          row.registered = n(r, 'registered');
          row.activated = n(r, 'activated');
        });
        (dailyPayRows || []).forEach(function (r) {
          var row = touch(r.d);
          if (!row) return;
          row.pay_orders = n(r, 'pay_orders');
          row.pay_users = n(r, 'pay_users');
          row.gmv = money(r.gmv);
        });
        var daily = Object.keys(dayMap)
          .sort()
          .map(function (k) {
            return dayMap[k];
          });

        res.json({
          code: 200,
          data: Object.assign(
            {
              channel: 'abc',
              landing_url: 'install_guide.html?ch=abc',
              definition:
                '下载页只统计 URL/包带 ch=abc 的浏览与下载。注册/开通/付费只统计账号 sales_promo_channel=abc。下载页 UV 与账号无法一一对应。',
              visibility: vis,
              today: {
                register: n(todayReg, 'register_today'),
                activate: n(todayAct, 'activate_today'),
                pay_orders: n(todayPay, 'pay_orders'),
                pay_gmv: money(todayPay.pay_gmv),
                pay_orders_gmv: money(todayPay.pay_orders_gmv),
                tax_edit_gmv: money(todayPay.tax_edit_gmv),
                gmv_by_sku: (todaySkuRows || []).map(function (r) {
                  return {
                    sku_id: String(r.sku_id || ''),
                    label: opsSkuGmvLabel(r),
                    orders: Number(r.orders) || 0,
                    gmv: money(r.gmv)
                  };
                })
              },
              funnel: {
                view_pv: n(install, 'view_pv'),
                view_uv: viewUv,
                download_clicks: n(install, 'download_clicks'),
                download_uv: dlUv,
                apk_uv: n(install, 'apk_uv'),
                ios_uv: n(install, 'ios_uv'),
                registered: registered,
                saw_purchase: sawPurchase,
                has_tax: n(cohort, 'has_tax'),
                high_income: n(cohort, 'high_income'),
                activated: activated,
                unactivated: n(cohort, 'unactivated'),
                paid_users: paidUsers,
                pay_orders: payOrders,
                pay_gmv: payGmv,
                pay_users_in_period: n(periodPay, 'pay_users'),
                unact_saw_pay: n(cohort, 'unact_saw_pay'),
                unact_has_tax: n(cohort, 'unact_has_tax')
              },
              rates: {
                download_of_view: pctText(dlUv, viewUv),
                register_of_download: pctText(registered, dlUv),
                register_of_view: pctText(registered, viewUv),
                purchase_of_register: pctText(sawPurchase, registered),
                activate_of_register: pctText(activated, registered),
                pay_of_register: pctText(paidUsers, registered),
                pay_of_activate: pctText(paidUsers, activated)
              },
              stock: {
                inactive: n(stock, 'total'),
                has_tax: n(stock, 'has_tax'),
                saw_purchase: n(stock, 'saw_purchase'),
                high_income: n(stock, 'high_income'),
                in_7d: n(stock, 'in_7d')
              },
              daily: daily
            },
            periodMeta(period)
          )
        });
      } finally {
        conn.release();
      }
    } catch (e) {
      console.error('[abc-ops-overview]', e);
      res.status(500).json({ code: 500, msg: String(e.message || '加载 ABC 转化失败') });
    }
  }

  async function handleAbcOpsUsers(req, res) {
    try {
      var page = parseInt(req.query && req.query.page, 10) || 1;
      var limit = parseInt(req.query && req.query.limit, 10) || 20;
      if (page < 1) page = 1;
      if (limit < 1) limit = 20;
      if (limit > 100) limit = 100;
      var offset = (page - 1) * limit;
      var daysRaw = String((req.query && req.query.days) || '').trim();
      var active = String((req.query && req.query.active) || '').trim();
      var q = String((req.query && req.query.q) || '').trim();
      var built = baseAbcUserWhere(req.admin, function (where, params) {
        if (daysRaw && daysRaw !== '0' && daysRaw !== 'all') {
          var period = parsePeriod(daysRaw, 0);
          if (period.mode === 'range' || (period.days && period.days > 0)) {
            var pf = periodCnDateFilter('DATE(DATE_ADD(users.created_at, INTERVAL 8 HOUR))', period);
            where.push(pf.sql);
            for (var i = 0; i < pf.params.length; i++) params.push(pf.params[i]);
          }
        }
        if (active === '0' || active === '1') {
          if (active === '1') where.push('users.account_active = 1');
          else where.push('(users.account_active IS NULL OR users.account_active = 0)');
        }
        if (q) {
          where.push('(users.username LIKE ? OR users.real_name LIKE ?)');
          params.push('%' + q + '%', '%' + q + '%');
        }
      });
      var whereSql = ' WHERE ' + built.where.join(' AND ');
      var pool = getPool();
      var conn = await pool.getConnection();
      try {
        const [countRows] = await conn.query(
          'SELECT COUNT(*) AS c FROM users' + whereSql,
          built.params
        );
        var total = n(countRows && countRows[0], 'c');
        const [pageRows] = await conn.query(
          `SELECT users.username, users.real_name, users.created_at, users.account_active,
                  users.register_source_channel, users.registered_from_install_guide,
                  users.last_login_city,
                  ${hasTaxSql('users.username')} AS has_tax,
                  ${sawPurchaseSql('users.username')} AS saw_purchase,
                  ${paidExistsSql('users.username')} AS paid,
                  (SELECT COALESCE(SUM(p.amount), 0) FROM payment_orders p
                    WHERE p.username = users.username AND p.status = 'paid') AS gmv
           FROM users ${whereSql}
           ORDER BY users.created_at DESC
           LIMIT ${limit} OFFSET ${offset}`,
          built.params
        );
        res.json({
          code: 200,
          data: {
            page: page,
            limit: limit,
            total: total,
            visibility: visibilityMeta(req.admin),
            items: (pageRows || []).map(function (r) {
              return {
                username: String(r.username || ''),
                real_name: String(r.real_name || ''),
                created_at: r.created_at || null,
                account_active: Number(r.account_active) === 1 ? 1 : 0,
                register_source: String(r.register_source_channel || ''),
                register_source_label: registerSourceLabel(r.register_source_channel),
                from_install: !!r.registered_from_install_guide,
                city: String(r.last_login_city || ''),
                has_tax: !!Number(r.has_tax),
                saw_purchase: !!Number(r.saw_purchase),
                paid: !!Number(r.paid),
                gmv: money(r.gmv)
              };
            })
          }
        });
      } finally {
        conn.release();
      }
    } catch (e) {
      console.error('[abc-ops-users]', e);
      res.status(500).json({ code: 500, msg: String(e.message || '加载 ABC 用户失败') });
    }
  }

  async function handleAbcOpsPayments(req, res) {
    try {
      var days = parseInt(req.query && req.query.days, 10);
      if (!isFinite(days) || days < 1) days = 1;
      if (days > 90) days = 90;
      var period = parsePeriod(String(days), days);
      var cnPaidDay = 'DATE(DATE_ADD(COALESCE(p.paid_at, p.created_at), INTERVAL 8 HOUR))';
      var pf = periodCnDateFilter(cnPaidDay, period);
      var built = baseAbcUserWhere(req.admin);
      var where = built.where.concat(["p.status = 'paid'", pf.sql]);
      var params = built.params.concat(pf.params);
      var pool = getPool();
      var conn = await pool.getConnection();
      try {
        const [rows] = await conn.query(
          `SELECT p.id, p.username, p.sku_id, p.subject, p.grant_kind, p.amount,
                  p.out_trade_no, p.alipay_trade_no, p.paid_at, p.created_at
           FROM payment_orders p
           INNER JOIN users ON users.username = p.username
           WHERE ` +
            where.join(' AND ') +
            `
           ORDER BY COALESCE(p.paid_at, p.created_at) DESC, p.id DESC
           LIMIT 500`,
          params
        );
        var list = (rows || []).map(function (r) {
          return {
            id: Number(r.id) || 0,
            username: String(r.username || ''),
            sku_id: String(r.sku_id || ''),
            label: opsSkuGmvLabel(r),
            subject: String(r.subject || ''),
            grant_kind: String(r.grant_kind || ''),
            amount: money(r.amount),
            out_trade_no: String(r.out_trade_no || ''),
            paid_at: r.paid_at || r.created_at || null
          };
        });
        var gmv = 0;
        for (var i = 0; i < list.length; i++) gmv += Number(list[i].amount) || 0;
        res.json({
          code: 200,
          data: {
            days: days,
            truncated: list.length >= 500,
            orders: list.length,
            gmv: money(gmv),
            visibility: visibilityMeta(req.admin),
            list: list
          }
        });
      } finally {
        conn.release();
      }
    } catch (e) {
      console.error('[abc-ops-payments]', e);
      res.status(500).json({ code: 500, msg: String(e.message || '加载 ABC 支付失败') });
    }
  }

  return {
    handleAbcOpsOverview: handleAbcOpsOverview,
    handleAbcOpsUsers: handleAbcOpsUsers,
    handleAbcOpsPayments: handleAbcOpsPayments,
    parsePeriod: parsePeriod,
    periodCnDateFilter: periodCnDateFilter,
    abcChannelSql: abcChannelSql,
    abcInstallMetaSql: abcInstallMetaSql,
    appendAbcUserVisibility: appendAbcUserVisibility,
    visibilityMeta: visibilityMeta,
    isAbcChannelViewerAdmin: isAbcChannelViewerAdmin,
    registerSourceLabel: registerSourceLabel
  };
}

function getHandlers() {
  var api = createAbcOps();
  return {
    handleAbcOpsOverview: api.handleAbcOpsOverview,
    handleAbcOpsUsers: api.handleAbcOpsUsers,
    handleAbcOpsPayments: api.handleAbcOpsPayments
  };
}

module.exports = {
  createAbcOps: createAbcOps,
  getHandlers: getHandlers,
  parsePeriod: parsePeriod,
  periodCnDateFilter: periodCnDateFilter,
  abcChannelSql: abcChannelSql,
  abcInstallMetaSql: abcInstallMetaSql,
  appendAbcUserVisibility: appendAbcUserVisibility,
  visibilityMeta: visibilityMeta,
  isAbcChannelViewerAdmin: isAbcChannelViewerAdmin,
  registerSourceLabel: registerSourceLabel,
  HIGH_INCOME: HIGH_INCOME
};
