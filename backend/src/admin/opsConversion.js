/**
 * 转化运营：未激活用户明细、转化调研汇总。
 */
'use strict';

const { getPool } = require('../shared/db');
const taxEditFeePolicy = require('../tax/taxEditFeePolicy');

var HIGH_INCOME = 15000;
var GUEST_PREFIX = '__guest_';
var REFUND_AD_YEARS = [2025, 2024, 2023];
var REFUND_AD_MIN_TAX = 5000;
var REFUND_AD_MIN_INCOME = 150000;
var REFUND_COPY_KEYS = ['track_refund_ad_copy', 'track_purchase_refund_ad_copy'];
var REFUND_VIEW_KEYS = [
  'track_refund_ad_view',
  'track_refund_ad_after_tax_view',
  'track_purchase_refund_ad_view'
];

/** 看板 GMV 拆分用：已知 SKU 展示名 */
var OPS_SKU_LABELS = {
  sku_300_7d: '周卡',
  sku_348_14d: '双周卡',
  sku_398_30d: '月卡',
  sku_ch_t4: '档位4',
  sku_ch_t5: '档位5',
  sku_98_3d: '体验卡',
  sku_99_1h: '小时卡',
  sku_249_1d: '天卡',
  sku_268_3d: '3天卡',
  sku_600_perm: '永久',
  sku_999_perm: '永久'
};
OPS_SKU_LABELS[taxEditFeePolicy.TAX_EDIT_DAILY_SKU_ID] = '同行费用（每天无限）';
OPS_SKU_LABELS[taxEditFeePolicy.TAX_EDIT_SINGLE_SKU_ID] = '个税修改费';

function opsSkuGmvLabel(row) {
  var id = String((row && row.sku_id) || '').trim();
  var kind = String((row && row.grant_kind) || '').trim();
  if (kind === 'tax_edit_daily' || id === taxEditFeePolicy.TAX_EDIT_DAILY_SKU_ID) {
    return '同行费用（每天无限）';
  }
  if (kind === 'tax_edit_single' || id === taxEditFeePolicy.TAX_EDIT_SINGLE_SKU_ID) {
    return '个税修改费';
  }
  if (id && OPS_SKU_LABELS[id]) return OPS_SKU_LABELS[id];
  var subject = String((row && row.subject) || '').trim();
  if (subject) {
    return subject.replace(/^激活码[·•．.\s]*/, '') || subject;
  }
  return id || '其他';
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

function refundYearInSql() {
  return REFUND_AD_YEARS.join(', ');
}

function refundYearAggSql() {
  return (
    'SELECT tr.user_id, tr.year,' +
    ' SUM(IFNULL(tr.tax_reported, 0)) AS tax_sum,' +
    ' SUM(GREATEST(IFNULL(tr.income_this_period, 0), IFNULL(tr.income, 0))) AS income_sum' +
    ' FROM tax_records tr' +
    ' WHERE tr.deleted_at IS NULL' +
    " AND IFNULL(tr.company_name,'') NOT LIKE '%示例%'" +
    ' AND tr.year IN (' +
    refundYearInSql() +
    ')' +
    ' GROUP BY tr.user_id, tr.year' +
    ' HAVING SUM(IFNULL(tr.tax_reported, 0)) > ' +
    REFUND_AD_MIN_TAX +
    ' OR SUM(GREATEST(IFNULL(tr.income_this_period, 0), IFNULL(tr.income, 0))) >= ' +
    REFUND_AD_MIN_INCOME
  );
}

function refundEligibleSql(userCol) {
  return (
    'EXISTS (SELECT 1 FROM (' + refundYearAggSql() + ') ry WHERE ry.user_id = ' + userCol + ')'
  );
}

function refundHitReasonExpr(taxCol, incomeCol) {
  return (
    'CASE WHEN ' +
    taxCol +
    ' > ' +
    REFUND_AD_MIN_TAX +
    ' AND ' +
    incomeCol +
    ' >= ' +
    REFUND_AD_MIN_INCOME +
    " THEN 'both' WHEN " +
    taxCol +
    ' > ' +
    REFUND_AD_MIN_TAX +
    " THEN 'tax' ELSE 'income' END"
  );
}

function refundAdEventInSql(keys) {
  return keys
    .map(function () {
      return '?';
    })
    .join(', ');
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
    "EXISTS (SELECT 1 FROM user_page_events e WHERE e.username = " +
    userCol +
    " AND (e.page_path LIKE '%purchase%' OR e.route_key LIKE '%track_purchase_page_view%'))"
  );
}

function sawConsultSql(userCol) {
  return (
    "EXISTS (SELECT 1 FROM user_page_events e WHERE e.username = " +
    userCol +
    " AND e.page_path LIKE '%consult%')"
  );
}

function d1HasSql(alias) {
  var t = alias || 'users';
  return (
    'EXISTS (SELECT 1 FROM user_daily_activity d1 WHERE d1.username = ' +
    t +
    '.username AND d1.activity_date = DATE_ADD(DATE(' +
    t +
    '.created_at), INTERVAL 1 DAY))'
  );
}

function d1OnlySql(alias) {
  var t = alias || 'users';
  return (
    d1HasSql(t) +
    ' AND NOT EXISTS (SELECT 1 FROM user_daily_activity da WHERE da.username = ' +
    t +
    '.username AND da.activity_date > DATE_ADD(DATE(' +
    t +
    '.created_at), INTERVAL 1 DAY))'
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

function isFullScope(admin) {
  if (!admin) return false;
  if (admin.is_super) return true;
  var u = String(admin.username || '').trim();
  return u === '19106014552' || u === '13691947741' || u === '18671741907';
}

function appendRegisteredScope(where, params, admin, userCol) {
  var col = userCol || 'users.username';
  if (!admin || !admin.username) return;
  if (isFullScope(admin)) return;
  var uname = String(admin.username || '').trim();
  if (uname.toLowerCase() === 'admin') {
    var createdCol = String(col).replace(/\.username\s*$/i, '.created_at');
    if (createdCol === String(col)) createdCol = 'users.created_at';
    where.push(
      '(EXISTS (SELECT 1 FROM activation_codes ac WHERE ac.used_by_username = ' +
        col +
        ' AND ac.owner_admin_username = ?) OR ' +
        createdCol +
        ' >= ?)'
    );
    params.push(uname, process.env.ADMIN_OPS_SEE_REGISTERED_SINCE || '2026-07-23 15:10:00');
    return;
  }
  where.push(
    'EXISTS (SELECT 1 FROM activation_codes ac WHERE ac.used_by_username = ' +
      col +
      ' AND ac.owner_admin_username = ?)'
  );
  params.push(uname);
}

function parseDays(raw, fallback) {
  var n = parseInt(raw, 10);
  if (!isFinite(n) || n < 1) n = fallback == null ? 7 : fallback;
  if (n > 366) n = 366;
  return n;
}

function parseSegment(raw) {
  var s = String(raw || '').trim().toLowerCase();
  var ok = {
    all: 1,
    has_tax: 1,
    no_tax: 1,
    high_income: 1,
    d1_only: 1,
    saw_purchase: 1,
    purchase_no_pay: 1,
    no_consult: 1
  };
  return ok[s] ? s : 'all';
}

function appendSegment(where, params, segment) {
  if (segment === 'has_tax') {
    where.push(hasTaxSql('users.username'));
  } else if (segment === 'no_tax') {
    where.push('NOT ' + hasTaxSql('users.username'));
  } else if (segment === 'high_income') {
    where.push(highIncomeExistsSql('users.username'));
  } else if (segment === 'd1_only') {
    where.push(d1OnlySql('users'));
  } else if (segment === 'saw_purchase') {
    where.push(sawPurchaseSql('users.username'));
  } else if (segment === 'purchase_no_pay') {
    where.push(sawPurchaseSql('users.username'));
    where.push(
      "NOT EXISTS (SELECT 1 FROM user_page_events e WHERE e.username = users.username AND (e.route_key LIKE '%track_alipay_payment_success%' OR e.route_key LIKE '%track_purchase_activate_success%'))"
    );
  } else if (segment === 'no_consult') {
    where.push('NOT ' + sawConsultSql('users.username'));
  }
}

function baseInactiveWhere(admin, extra) {
  var where = [
    'users.list_hidden_at IS NULL',
    nonGuestSql('users'),
    '(users.account_active IS NULL OR users.account_active = 0)'
  ];
  var params = [];
  appendRegisteredScope(where, params, admin, 'users.username');
  if (extra) extra(where, params);
  return { where: where, params: params };
}

function n(row, key) {
  return Number(row && row[key]) || 0;
}

async function handleOpsInactiveSummary(req, res) {
  try {
    var days = parseDays(req.query && req.query.days, 0);
    var channel = String((req.query && req.query.channel) || '').trim();
    var built = baseInactiveWhere(req.admin, function (where, params) {
      if (days > 0) {
        where.push('users.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)');
        params.push(days);
      }
      if (channel === '(empty)') {
        where.push("(users.register_source_channel IS NULL OR TRIM(users.register_source_channel) = '')");
      } else if (channel) {
        where.push('users.register_source_channel = ?');
        params.push(channel);
      }
    });
    var whereSql = ' WHERE ' + built.where.join(' AND ');
    var pool = getPool();
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.query(
        `SELECT
           COUNT(*) AS total,
           SUM(${hasTaxSql('users.username')}) AS has_tax,
           SUM(NOT ${hasTaxSql('users.username')}) AS no_tax,
           SUM(${highIncomeExistsSql('users.username')}) AS high_income,
           SUM(${sawPurchaseSql('users.username')}) AS saw_purchase,
           SUM(${sawConsultSql('users.username')}) AS saw_consult,
           SUM(${d1OnlySql('users')}) AS d1_only,
           SUM(CASE WHEN users.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS in_7d,
           SUM(CASE WHEN ${sawPurchaseSql('users.username')} AND NOT EXISTS (
             SELECT 1 FROM user_page_events e
             WHERE e.username = users.username
               AND (e.route_key LIKE '%track_alipay_payment_success%'
                 OR e.route_key LIKE '%track_purchase_activate_success%')
           ) THEN 1 ELSE 0 END) AS purchase_no_pay
         FROM users ${whereSql}`,
        built.params
      );
      var r = rows && rows[0] ? rows[0] : {};
      res.json({
        code: 200,
        data: {
          threshold: HIGH_INCOME,
          days: days || null,
          channel: channel || '',
          stock: {
            total: n(r, 'total'),
            has_tax: n(r, 'has_tax'),
            no_tax: n(r, 'no_tax'),
            high_income: n(r, 'high_income'),
            saw_purchase: n(r, 'saw_purchase'),
            saw_consult: n(r, 'saw_consult'),
            d1_only: n(r, 'd1_only'),
            in_7d: n(r, 'in_7d'),
            purchase_no_pay: n(r, 'purchase_no_pay')
          }
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[ops-inactive-summary]', e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

/**
 * 运营看板：今日 KPI + 未激活库存 + 近 7 日转化卡点（一次返回）
 */
async function handleOpsBoard(req, res) {
  try {
    var researchDays = parseDays(req.query && req.query.days, 7);
    var pool = getPool();
    const conn = await pool.getConnection();
    try {
      var cnDay = 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
      var cnActDay = 'DATE(DATE_ADD(ac.last_used_at, INTERVAL 8 HOUR))';
      var cnPaidDay = 'DATE(DATE_ADD(COALESCE(paid_at, created_at), INTERVAL 8 HOUR))';
      var todayBjSql = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';

      var userWhere = [
        'users.list_hidden_at IS NULL',
        nonGuestSql('users')
      ];
      var userParams = [];
      appendRegisteredScope(userWhere, userParams, req.admin, 'users.username');
      var userWhereSql = ' WHERE ' + userWhere.join(' AND ');

      /* 今日注册按注册 IP 去重：同 IP 多账号只计 1；无注册 IP 的账号按用户名各计 1 */
      const [todayRows] = await conn.query(
        `SELECT COUNT(DISTINCT COALESCE(
           NULLIF(TRIM((
             SELECT ule.ip FROM user_login_events ule
             WHERE ule.username = users.username
               AND ule.reason = 'register_ok'
               AND ule.ip IS NOT NULL AND TRIM(ule.ip) <> ''
             ORDER BY ule.created_at ASC, ule.id ASC
             LIMIT 1
           )), ''),
           CONCAT('__nouip:', users.username)
         )) AS register_today
         FROM users ${userWhereSql}
           AND ${cnDay} = ${todayBjSql}`,
        userParams
      );

      var actWhere = [
        'ac.last_used_at IS NOT NULL',
        'ac.used_count > 0',
        "LEFT(COALESCE(ac.used_by_username,''), " + GUEST_PREFIX.length + ") <> '" + GUEST_PREFIX + "'"
      ];
      var actParams = [];
      if (req.admin && !isFullScope(req.admin)) {
        var uname = String(req.admin.username || '').trim();
        if (uname.toLowerCase() === 'admin') {
          actWhere.push('ac.owner_admin_username = ?');
          actParams.push(uname);
        } else if (uname) {
          actWhere.push('ac.owner_admin_username = ?');
          actParams.push(uname);
        }
      }
      actWhere.push(cnActDay + ' = ' + todayBjSql);
      const [actRows] = await conn.query(
        'SELECT COUNT(DISTINCT ac.used_by_username) AS activate_today FROM activation_codes ac WHERE ' +
          actWhere.join(' AND '),
        actParams
      );

      var payWhere = ["status = 'paid'", cnPaidDay + ' = ' + todayBjSql];
      var payParams = [];
      /* 与支付分析一致：个税修改费单独拆出，其余已付计入「付费了单」 */
      var taxEditSkuSql =
        "(sku_id IN ('" +
        taxEditFeePolicy.TAX_EDIT_SINGLE_SKU_ID +
        "','" +
        taxEditFeePolicy.TAX_EDIT_DAILY_SKU_ID +
        "') OR grant_kind IN ('tax_edit_single','tax_edit_daily'))";
      const [payRows] = await conn.query(
        `SELECT COUNT(*) AS pay_orders,
                COALESCE(SUM(amount), 0) AS pay_gmv,
                COALESCE(SUM(CASE WHEN ${taxEditSkuSql} THEN 0 ELSE amount END), 0) AS pay_orders_gmv,
                COALESCE(SUM(CASE WHEN ${taxEditSkuSql} THEN amount ELSE 0 END), 0) AS tax_edit_gmv
         FROM payment_orders WHERE ` + payWhere.join(' AND '),
        payParams
      );
      const [paySkuRows] = await conn.query(
        `SELECT COALESCE(NULLIF(TRIM(sku_id), ''), '(unknown)') AS sku_id,
                MAX(subject) AS subject,
                MAX(grant_kind) AS grant_kind,
                COUNT(*) AS orders,
                COALESCE(SUM(amount), 0) AS gmv
         FROM payment_orders
         WHERE ` +
          payWhere.join(' AND ') +
          `
         GROUP BY COALESCE(NULLIF(TRIM(sku_id), ''), '(unknown)')
         ORDER BY gmv DESC, orders DESC`,
        payParams
      );

      var stockBuilt = baseInactiveWhere(req.admin);
      var stockSql = ' WHERE ' + stockBuilt.where.join(' AND ');
      const [stockRows] = await conn.query(
        `SELECT
           COUNT(*) AS total,
           SUM(${hasTaxSql('users.username')}) AS has_tax,
           SUM(NOT ${hasTaxSql('users.username')}) AS no_tax,
           SUM(${highIncomeExistsSql('users.username')}) AS high_income,
           SUM(${sawPurchaseSql('users.username')}) AS saw_purchase,
           SUM(${sawConsultSql('users.username')}) AS saw_consult,
           SUM(${d1OnlySql('users')}) AS d1_only,
           SUM(CASE WHEN users.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 7 DAY) THEN 1 ELSE 0 END) AS in_7d,
           SUM(CASE WHEN ${sawPurchaseSql('users.username')} AND NOT EXISTS (
             SELECT 1 FROM user_page_events e
             WHERE e.username = users.username
               AND (e.route_key LIKE '%track_alipay_payment_success%'
                 OR e.route_key LIKE '%track_purchase_activate_success%')
           ) THEN 1 ELSE 0 END) AS purchase_no_pay
         FROM users ${stockSql}`,
        stockBuilt.params
      );

      var refundWhere = [
        'users.list_hidden_at IS NULL',
        nonGuestSql('users'),
        refundEligibleSql('users.username')
      ];
      var refundParams = [];
      appendRegisteredScope(refundWhere, refundParams, req.admin, 'users.username');
      const [refundRows] = await conn.query(
        'SELECT COUNT(*) AS refund_eligible FROM users WHERE ' + refundWhere.join(' AND '),
        refundParams
      );

      var researchWhere = [
        'users.list_hidden_at IS NULL',
        nonGuestSql('users'),
        'users.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)'
      ];
      var researchParams = [researchDays];
      appendRegisteredScope(researchWhere, researchParams, req.admin, 'users.username');
      var researchSql = ' WHERE ' + researchWhere.join(' AND ');
      const [funnelRows] = await conn.query(
        `SELECT
           COUNT(*) AS registered,
           SUM(users.account_active = 1) AS activated,
           SUM(users.account_active = 0 OR users.account_active IS NULL) AS unactivated,
           SUM((users.account_active = 0 OR users.account_active IS NULL) AND ${hasTaxSql('users.username')}) AS unact_has_tax,
           SUM((users.account_active = 0 OR users.account_active IS NULL) AND NOT ${hasTaxSql('users.username')}) AS unact_no_tax,
           SUM((users.account_active = 0 OR users.account_active IS NULL) AND ${sawPurchaseSql('users.username')}) AS unact_saw_pay,
           SUM((users.account_active = 0 OR users.account_active IS NULL) AND ${highIncomeExistsSql('users.username')}) AS unact_high_income,
           SUM((users.account_active = 0 OR users.account_active IS NULL) AND ${sawConsultSql('users.username')} AND NOT ${hasTaxSql('users.username')}) AS opened_fill_no_submit
         FROM users ${researchSql}`,
        researchParams
      );

      var f = funnelRows && funnelRows[0] ? funnelRows[0] : {};
      var s = stockRows && stockRows[0] ? stockRows[0] : {};
      var t = todayRows && todayRows[0] ? todayRows[0] : {};
      var a = actRows && actRows[0] ? actRows[0] : {};
      var p = payRows && payRows[0] ? payRows[0] : {};
      var rf = refundRows && refundRows[0] ? refundRows[0] : {};
      var registered = n(f, 'registered');
      var activated = n(f, 'activated');

      res.json({
        code: 200,
        data: {
          today: {
            register: n(t, 'register_today'),
            activate: n(a, 'activate_today'),
            pay_orders: n(p, 'pay_orders'),
            pay_gmv: Math.round(Number(p.pay_gmv || 0) * 100) / 100,
            pay_orders_gmv: Math.round(Number(p.pay_orders_gmv || 0) * 100) / 100,
            tax_edit_gmv: Math.round(Number(p.tax_edit_gmv || 0) * 100) / 100,
            gmv_by_sku: (paySkuRows || []).map(function (r) {
              return {
                sku_id: String(r.sku_id || ''),
                label: opsSkuGmvLabel(r),
                orders: Number(r.orders) || 0,
                gmv: Math.round(Number(r.gmv || 0) * 100) / 100
              };
            })
          },
          stock: {
            total: n(s, 'total'),
            has_tax: n(s, 'has_tax'),
            no_tax: n(s, 'no_tax'),
            high_income: n(s, 'high_income'),
            saw_purchase: n(s, 'saw_purchase'),
            saw_consult: n(s, 'saw_consult'),
            d1_only: n(s, 'd1_only'),
            in_7d: n(s, 'in_7d'),
            purchase_no_pay: n(s, 'purchase_no_pay'),
            refund_eligible: n(rf, 'refund_eligible')
          },
          research: {
            days: researchDays,
            funnel: {
              registered: registered,
              activated: activated,
              unactivated: n(f, 'unactivated'),
              activate_pct: pct(activated, registered),
              unact_has_tax: n(f, 'unact_has_tax'),
              unact_no_tax: n(f, 'unact_no_tax'),
              unact_saw_pay: n(f, 'unact_saw_pay'),
              unact_high_income: n(f, 'unact_high_income'),
              opened_fill_no_submit: n(f, 'opened_fill_no_submit')
            }
          }
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[ops-board]', e);
    res.status(500).json({ code: 500, msg: String(e.message || '加载运营看板失败') });
  }
}

async function handleOpsInactiveUsers(req, res) {
  try {
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(req.query.limit, 10) || 20;
    if (page < 1) page = 1;
    if (limit < 1) limit = 20;
    if (limit > 100) limit = 100;
    var offset = (page - 1) * limit;
    var days = parseDays(req.query && req.query.days, 0);
    var segment = parseSegment(req.query && req.query.segment);
    var channel = String((req.query && req.query.channel) || '').trim();
    var q = String((req.query && req.query.q) || '').trim();

    var built = baseInactiveWhere(req.admin, function (where, params) {
      if (days > 0) {
        where.push('users.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)');
        params.push(days);
      }
      if (channel === '(empty)') {
        where.push("(users.register_source_channel IS NULL OR TRIM(users.register_source_channel) = '')");
      } else if (channel) {
        where.push('users.register_source_channel = ?');
        params.push(channel);
      }
      if (q) {
        where.push('(users.username LIKE ? OR users.real_name LIKE ?)');
        params.push('%' + q + '%', '%' + q + '%');
      }
      appendSegment(where, params, segment);
    });
    var whereSql = ' WHERE ' + built.where.join(' AND ');
    var pool = getPool();
    const conn = await pool.getConnection();
    try {
      const [countRows] = await conn.execute(
        'SELECT COUNT(*) AS c FROM users' + whereSql,
        built.params
      );
      var total = Number(countRows[0] && countRows[0].c) || 0;
      const [pageRows] = await conn.query(
        `SELECT users.username, users.real_name, users.created_at, users.register_source_channel,
                users.last_login_city, users.registered_from_install_guide
         FROM users ${whereSql}
         ORDER BY users.created_at DESC
         LIMIT ${limit} OFFSET ${offset}`,
        built.params
      );
      var names = (pageRows || []).map(function (r) {
        return String(r.username || '');
      });
      var flags = await loadInactiveUserFlags(conn, names);
      var users = (pageRows || []).map(function (r) {
        var uname = String(r.username || '');
        var f = flags[uname] || {};
        return {
          username: uname,
          real_name: r.real_name != null ? String(r.real_name) : '',
          created_at: r.created_at ? new Date(r.created_at).toISOString() : '',
          register_source_channel:
            r.register_source_channel != null ? String(r.register_source_channel).trim() : '',
          last_login_city: r.last_login_city != null ? String(r.last_login_city).trim() : '',
          from_install: Number(r.registered_from_install_guide) === 1,
          has_tax: !!f.has_tax,
          max_month_income: f.max_month_income || 0,
          high_income: !!f.high_income,
          saw_consult: !!f.saw_consult,
          saw_purchase: !!f.saw_purchase,
          last_seen_at: f.last_seen_at || '',
          price_sentiment: f.price_sentiment || '',
          expected_price: f.expected_price,
          tax_fill_satisfaction: f.tax_fill_satisfaction || ''
        };
      });
      res.json({
        code: 200,
        data: {
          users: users,
          total: total,
          page: page,
          limit: limit,
          segment: segment,
          days: days || null,
          channel: channel || '',
          threshold: HIGH_INCOME
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[ops-inactive-users]', e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

async function loadInactiveUserFlags(conn, names) {
  var out = Object.create(null);
  if (!names.length) return out;
  names.forEach(function (u) {
    out[u] = {
      has_tax: false,
      max_month_income: 0,
      high_income: false,
      saw_consult: false,
      saw_purchase: false,
      last_seen_at: '',
      price_sentiment: '',
      expected_price: null,
      tax_fill_satisfaction: ''
    };
  });
  var ph = names.map(function () {
    return '?';
  }).join(',');
  const [incomeRows] = await conn.query(
    `SELECT user_id, MAX(${monthIncomeSql('tr')}) AS max_income
     FROM tax_records tr
     WHERE tr.deleted_at IS NULL
       AND IFNULL(tr.company_name,'') NOT LIKE '%示例%'
       AND user_id IN (${ph})
     GROUP BY user_id`,
    names
  );
  (incomeRows || []).forEach(function (row) {
    var u = String(row.user_id || '');
    if (!out[u]) return;
    var v = Number(row.max_income);
    if (isFinite(v) && v > 0) {
      out[u].has_tax = true;
      out[u].max_month_income = Math.round(v * 100) / 100;
      out[u].high_income = v > HIGH_INCOME;
    }
  });
  const [taxRows] = await conn.query(
    `SELECT DISTINCT user_id FROM tax_records WHERE deleted_at IS NULL AND user_id IN (${ph})`,
    names
  );
  (taxRows || []).forEach(function (row) {
    var u = String(row.user_id || '');
    if (out[u]) out[u].has_tax = true;
  });
  const [pageRows] = await conn.query(
    `SELECT username,
            MAX(page_path LIKE '%consult%') AS consult,
            MAX(page_path LIKE '%purchase%' OR route_key LIKE '%track_purchase_page_view%') AS purchase,
            MAX(created_at) AS last_seen
     FROM user_page_events
     WHERE username IN (${ph})
     GROUP BY username`,
    names
  );
  (pageRows || []).forEach(function (row) {
    var u = String(row.username || '');
    if (!out[u]) return;
    out[u].saw_consult = Number(row.consult) === 1;
    out[u].saw_purchase = Number(row.purchase) === 1;
    if (row.last_seen) {
      out[u].last_seen_at = new Date(row.last_seen).toISOString();
    }
  });
  try {
    const [priceRows] = await conn.query(
      `SELECT username, sentiment, expected_price
       FROM purchase_price_survey
       WHERE username COLLATE utf8mb4_unicode_ci IN (${ph})`,
      names
    );
    (priceRows || []).forEach(function (row) {
      var u = String(row.username || '');
      if (!out[u]) return;
      out[u].price_sentiment = row.sentiment != null ? String(row.sentiment) : '';
      if (row.expected_price != null && isFinite(Number(row.expected_price))) {
        out[u].expected_price = Math.round(Number(row.expected_price) * 100) / 100;
      }
    });
  } catch (e0) {}
  try {
    const [taxFillRows] = await conn.query(
      `SELECT username, satisfaction
       FROM tax_fill_survey
       WHERE username COLLATE utf8mb4_unicode_ci IN (${ph})`,
      names
    );
    (taxFillRows || []).forEach(function (row) {
      var u = String(row.username || '');
      if (!out[u]) return;
      out[u].tax_fill_satisfaction = row.satisfaction != null ? String(row.satisfaction) : '';
    });
  } catch (e1) {}
  return out;
}

function pct(num, den) {
  var a = Number(num) || 0;
  var b = Number(den) || 0;
  if (b <= 0) return null;
  return (Math.round((a / b) * 1000) / 10).toFixed(1) + '%';
}

async function handleOpsConversionResearch(req, res) {
  try {
    var days = parseDays(req.query && req.query.days, 7);
    var pool = getPool();
    const conn = await pool.getConnection();
    try {
      var where = [
        'users.list_hidden_at IS NULL',
        nonGuestSql('users'),
        'users.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)'
      ];
      var params = [days];
      appendRegisteredScope(where, params, req.admin, 'users.username');
      var whereSql = ' WHERE ' + where.join(' AND ');
      const [funnelRows] = await conn.query(
        `SELECT
           COUNT(*) AS registered,
           SUM(users.account_active = 1) AS activated,
           SUM(users.account_active = 0 OR users.account_active IS NULL) AS unactivated,
           SUM((users.account_active = 0 OR users.account_active IS NULL) AND ${hasTaxSql('users.username')}) AS unact_has_tax,
           SUM((users.account_active = 0 OR users.account_active IS NULL) AND NOT ${hasTaxSql('users.username')}) AS unact_no_tax,
           SUM((users.account_active = 0 OR users.account_active IS NULL) AND ${sawPurchaseSql('users.username')}) AS unact_saw_pay,
           SUM((users.account_active = 0 OR users.account_active IS NULL) AND ${highIncomeExistsSql('users.username')}) AS unact_high_income,
           SUM((users.account_active = 0 OR users.account_active IS NULL) AND ${sawConsultSql('users.username')} AND NOT ${hasTaxSql('users.username')}) AS opened_fill_no_submit
         FROM users ${whereSql}`,
        params
      );
      var f = funnelRows && funnelRows[0] ? funnelRows[0] : {};
      const [chRows] = await conn.query(
        `SELECT COALESCE(NULLIF(TRIM(users.register_source_channel), ''), '(empty)') AS ch,
                COUNT(*) AS registered,
                SUM(users.account_active = 1) AS activated,
                SUM(${hasTaxSql('users.username')}) AS has_tax
         FROM users ${whereSql}
         GROUP BY ch
         ORDER BY registered DESC
         LIMIT 12`,
        params
      );
      var price = { expensive: 0, fair: 0, cheap: 0, skipped: 0, expected: [] };
      try {
        const [priceRows] = await conn.query(
          `SELECT p.sentiment, p.skipped, p.expected_price
           FROM purchase_price_survey p
           INNER JOIN users u
             ON u.username COLLATE utf8mb4_unicode_ci = p.username COLLATE utf8mb4_unicode_ci
           WHERE p.created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
             AND u.list_hidden_at IS NULL
             AND (u.account_active IS NULL OR u.account_active = 0)`,
          [days]
        );
        (priceRows || []).forEach(function (row) {
          if (Number(row.skipped) === 1) {
            price.skipped += 1;
            return;
          }
          var s = String(row.sentiment || '').toLowerCase();
          if (price[s] != null) price[s] += 1;
          if (row.expected_price != null && isFinite(Number(row.expected_price))) {
            price.expected.push(Math.round(Number(row.expected_price) * 100) / 100);
          }
        });
      } catch (ePrice) {}
      var taxFill = { good: 0, ok: 0, bad: 0, skipped: 0 };
      try {
        const [tfRows] = await conn.query(
          `SELECT satisfaction, skipped, COUNT(*) AS c
           FROM tax_fill_survey
           WHERE created_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
           GROUP BY satisfaction, skipped`,
          [days]
        );
        (tfRows || []).forEach(function (row) {
          var c = Number(row.c) || 0;
          if (Number(row.skipped) === 1) {
            taxFill.skipped += c;
            return;
          }
          var s = String(row.satisfaction || '').toLowerCase();
          if (taxFill[s] != null) taxFill[s] += c;
        });
      } catch (eTf) {}
      var avgExpect = null;
      if (price.expected.length) {
        var sum = 0;
        price.expected.forEach(function (v) {
          sum += v;
        });
        avgExpect = Math.round((sum / price.expected.length) * 10) / 10;
      }
      var registered = n(f, 'registered');
      var activated = n(f, 'activated');
      var unactivated = n(f, 'unactivated');
      res.json({
        code: 200,
        data: {
          days: days,
          funnel: {
            registered: registered,
            activated: activated,
            unactivated: unactivated,
            activate_pct: pct(activated, registered),
            unact_has_tax: n(f, 'unact_has_tax'),
            unact_no_tax: n(f, 'unact_no_tax'),
            unact_saw_pay: n(f, 'unact_saw_pay'),
            unact_high_income: n(f, 'unact_high_income'),
            opened_fill_no_submit: n(f, 'opened_fill_no_submit'),
            tax_fill_pct: pct(n(f, 'unact_has_tax') + activated, registered)
          },
          channels: (chRows || []).map(function (r) {
            var reg = n(r, 'registered');
            var act = n(r, 'activated');
            return {
              channel: String(r.ch || ''),
              registered: reg,
              activated: act,
              has_tax: n(r, 'has_tax'),
              activate_pct: pct(act, reg)
            };
          }),
          price_survey: {
            expensive: price.expensive,
            fair: price.fair,
            cheap: price.cheap,
            skipped: price.skipped,
            avg_expected_price: avgExpect,
            expected_samples: price.expected.length
          },
          tax_fill_survey: taxFill,
          insights: buildResearchInsights({
            registered: registered,
            activated: activated,
            unactivated: unactivated,
            unactHasTax: n(f, 'unact_has_tax'),
            unactSawPay: n(f, 'unact_saw_pay'),
            openedFillNoSubmit: n(f, 'opened_fill_no_submit'),
            expensive: price.expensive,
            avgExpect: avgExpect
          })
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[ops-research]', e);
    res.status(500).json({ code: 500, msg: String(e.message) });
  }
}

function buildResearchInsights(x) {
  var lines = [];
  if (x.registered <= 0) {
    return ['所选区间没有注册用户。'];
  }
  if (x.unactivated > 0 && x.unactHasTax > 0) {
    lines.push(
      '未开通里已有 ' +
        x.unactHasTax +
        ' 人填过个税：核心功能已经用上，开通卖的是去水印。'
    );
  }
  if (x.openedFillNoSubmit > 0) {
    lines.push(
      x.openedFillNoSubmit + ' 人进过填写页但没留下个税，卡在提交而不是入口。'
    );
  }
  if (x.unactSawPay > 0 && x.expensive > 0) {
    lines.push(
      '看过开通页的未开通用户里，有 ' +
        x.expensive +
        ' 人明确觉得贵' +
        (x.avgExpect != null ? '，心理价大约 ' + x.avgExpect + ' 元' : '') +
        '。'
    );
  }
  if (x.activated === 0) {
    lines.push('这期间还没有开通，优先跟高收入未开通和看过支付页的人。');
  }
  if (!lines.length) {
    lines.push('按渠道拆开通率，把低开通渠道和高意向未开通分开跟。');
  }
  return lines;
}

function refundPrimaryHitSql() {
  return (
    'SELECT h.user_id, h.year AS hit_year, h.tax_sum, h.income_sum, ' +
    refundHitReasonExpr('h.tax_sum', 'h.income_sum') +
    ' AS hit_reason FROM (' +
    refundYearAggSql() +
    ') h INNER JOIN (SELECT user_id, MAX(year) AS hit_year FROM (' +
    refundYearAggSql() +
    ') z GROUP BY user_id) p ON p.user_id = h.user_id AND p.hit_year = h.year'
  );
}

async function handleOpsRefundEligible(req, res) {
  try {
    var page = parseInt(req.query && req.query.page, 10) || 1;
    var limit = parseInt(req.query && req.query.limit, 10) || 20;
    if (page < 1) page = 1;
    if (limit < 1) limit = 20;
    if (limit > 100) limit = 100;
    var offset = (page - 1) * limit;
    var q = String((req.query && req.query.q) || '').trim();
    var reason = String((req.query && req.query.reason) || '')
      .trim()
      .toLowerCase();
    var year = parseInt(req.query && req.query.year, 10);
    var copied = String((req.query && req.query.copied) || '')
      .trim()
      .toLowerCase();
    var active = String((req.query && req.query.active) || '').trim();

    var where = ['users.list_hidden_at IS NULL', nonGuestSql('users')];
    var params = [];
    appendRegisteredScope(where, params, req.admin, 'users.username');
    if (q) {
      where.push('(users.username LIKE ? OR users.real_name LIKE ?)');
      params.push('%' + q + '%', '%' + q + '%');
    }
    if (active === '1') {
      where.push('users.account_active = 1');
    } else if (active === '0') {
      where.push('(users.account_active IS NULL OR users.account_active = 0)');
    }
    if (copied === 'copied' || copied === '1') {
      where.push(
        'EXISTS (SELECT 1 FROM ad_page_track_events e WHERE e.username = users.username AND e.event_key IN (' +
          refundAdEventInSql(REFUND_COPY_KEYS) +
          '))'
      );
      params.push.apply(params, REFUND_COPY_KEYS);
    } else if (copied === 'none' || copied === '0') {
      where.push(
        'NOT EXISTS (SELECT 1 FROM ad_page_track_events e WHERE e.username = users.username AND e.event_key IN (' +
          refundAdEventInSql(REFUND_COPY_KEYS) +
          '))'
      );
      params.push.apply(params, REFUND_COPY_KEYS);
    }
    if (year === 2023 || year === 2024 || year === 2025) {
      where.push('hit.hit_year = ?');
      params.push(year);
    }
    if (reason === 'tax' || reason === 'income' || reason === 'both') {
      where.push('hit.hit_reason = ?');
      params.push(reason);
    }

    var fromSql =
      ' FROM users INNER JOIN (' + refundPrimaryHitSql() + ') hit ON hit.user_id = users.username ';
    var whereSql = ' WHERE ' + where.join(' AND ');
    var pool = getPool();
    const conn = await pool.getConnection();
    try {
      const [countRows] = await conn.query(
        'SELECT COUNT(*) AS c' + fromSql + whereSql,
        params
      );
      var total = n(countRows && countRows[0], 'c');
      const [sumRows] = await conn.query(
        `SELECT
            SUM(CASE WHEN hit.hit_reason = 'tax' THEN 1 ELSE 0 END) AS tax_only,
            SUM(CASE WHEN hit.hit_reason = 'income' THEN 1 ELSE 0 END) AS income_only,
            SUM(CASE WHEN hit.hit_reason = 'both' THEN 1 ELSE 0 END) AS both_hit
         ${fromSql} ${whereSql}`,
        params
      );
      const [pageRows] = await conn.query(
        `SELECT users.username, users.real_name, users.account_active,
                users.register_source_channel, users.last_login_city,
                hit.hit_year, hit.tax_sum, hit.income_sum, hit.hit_reason
         ${fromSql} ${whereSql}
         ORDER BY hit.hit_year DESC, hit.tax_sum DESC, users.username ASC
         LIMIT ${limit} OFFSET ${offset}`,
        params
      );
      var names = (pageRows || []).map(function (r) {
        return String(r.username || '');
      }).filter(Boolean);
      var flags = Object.create(null);
      if (names.length) {
        var ph = names
          .map(function () {
            return '?';
          })
          .join(',');
        const [evRows] = await conn.query(
          `SELECT username,
                  SUM(CASE WHEN event_key IN (${refundAdEventInSql(REFUND_VIEW_KEYS)}) THEN 1 ELSE 0 END) AS views,
                  SUM(CASE WHEN event_key IN (${refundAdEventInSql(REFUND_COPY_KEYS)}) THEN 1 ELSE 0 END) AS copies,
                  MAX(created_at) AS last_at
           FROM ad_page_track_events
           WHERE username IN (${ph})
           GROUP BY username`,
          [].concat(REFUND_VIEW_KEYS, REFUND_COPY_KEYS, names)
        );
        (evRows || []).forEach(function (row) {
          flags[String(row.username || '')] = {
            views: n(row, 'views'),
            copies: n(row, 'copies'),
            last_at: row.last_at ? new Date(row.last_at).toISOString() : ''
          };
        });
        const [actRows] = await conn.query(
          `SELECT username, MAX(created_at) AS last_at
           FROM user_page_events
           WHERE username IN (${ph})
           GROUP BY username`,
          names
        );
        (actRows || []).forEach(function (row) {
          var u = String(row.username || '');
          if (!flags[u]) flags[u] = { views: 0, copies: 0, last_at: '' };
          if (!flags[u].last_at && row.last_at) {
            flags[u].last_at = new Date(row.last_at).toISOString();
          }
        });
      }
      var sum = sumRows && sumRows[0] ? sumRows[0] : {};
      res.json({
        code: 200,
        data: {
          users: (pageRows || []).map(function (r) {
            var uname = String(r.username || '');
            var f = flags[uname] || {};
            return {
              username: uname,
              real_name: r.real_name != null ? String(r.real_name) : '',
              account_active: Number(r.account_active) === 1,
              channel:
                r.register_source_channel != null
                  ? String(r.register_source_channel).trim()
                  : '',
              last_login_city: r.last_login_city != null ? String(r.last_login_city).trim() : '',
              hit_year: Number(r.hit_year) || 0,
              tax_sum: Math.round((Number(r.tax_sum) || 0) * 100) / 100,
              income_sum: Math.round((Number(r.income_sum) || 0) * 100) / 100,
              reason: r.hit_reason != null ? String(r.hit_reason) : '',
              viewed: n(f, 'views') > 0,
              copies: n(f, 'copies'),
              last_at: f.last_at || ''
            };
          }),
          total: total,
          page: page,
          limit: limit,
          summary: {
            eligible: total,
            tax_only: n(sum, 'tax_only'),
            income_only: n(sum, 'income_only'),
            both: n(sum, 'both_hit')
          },
          thresholds: {
            years: REFUND_AD_YEARS.slice(),
            min_tax: REFUND_AD_MIN_TAX,
            min_income: REFUND_AD_MIN_INCOME
          }
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[ops-refund-eligible]', e);
    res.status(500).json({ code: 500, msg: String(e.message || '加载退税合格名单失败') });
  }
}

/**
 * 运营看板 GMV 详情：已付订单明细（默认今日，可 days=1..90）。
 * 与看板「今日 GMV」同一口径：status=paid，按北京日切。
 */
async function handleOpsBoardPayments(req, res) {
  try {
    var days = parseInt(req.query.days, 10);
    if (!isFinite(days) || days < 1) days = 1;
    if (days > 90) days = 90;
    var pool = getPool();
    var conn = await pool.getConnection();
    try {
      var cnPaidDay = 'DATE(DATE_ADD(COALESCE(paid_at, created_at), INTERVAL 8 HOUR))';
      var todayBjSql = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
      var payWhere = ["status = 'paid'"];
      var payParams = [];
      if (days === 1) {
        payWhere.push(cnPaidDay + ' = ' + todayBjSql);
      } else {
        payWhere.push(
          cnPaidDay + ' >= DATE_SUB(' + todayBjSql + ', INTERVAL ? DAY)'
        );
        payParams.push(days - 1);
      }
      const [rows] = await conn.query(
        `SELECT id, username, sku_id, subject, grant_kind, amount,
                out_trade_no, alipay_trade_no, paid_at, created_at
         FROM payment_orders
         WHERE ` +
          payWhere.join(' AND ') +
          `
         ORDER BY COALESCE(paid_at, created_at) DESC, id DESC
         LIMIT 500`,
        payParams
      );
      var list = (rows || []).map(function (r) {
        return {
          id: Number(r.id) || 0,
          username: String(r.username || ''),
          sku_id: String(r.sku_id || ''),
          label: opsSkuGmvLabel(r),
          subject: String(r.subject || ''),
          grant_kind: String(r.grant_kind || ''),
          amount: Math.round(Number(r.amount || 0) * 100) / 100,
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
          gmv: Math.round(gmv * 100) / 100,
          list: list
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[ops-board-payments]', e);
    res.status(500).json({ code: 500, msg: String(e.message || '加载支付明细失败') });
  }
}

function getHandlers() {
  return {
    handleOpsBoard: handleOpsBoard,
    handleOpsBoardPayments: handleOpsBoardPayments,
    handleOpsInactiveSummary: handleOpsInactiveSummary,
    handleOpsInactiveUsers: handleOpsInactiveUsers,
    handleOpsConversionResearch: handleOpsConversionResearch,
    handleOpsRefundEligible: handleOpsRefundEligible
  };
}

module.exports = {
  getHandlers: getHandlers,
  HIGH_INCOME: HIGH_INCOME,
  REFUND_AD_YEARS: REFUND_AD_YEARS,
  REFUND_AD_MIN_TAX: REFUND_AD_MIN_TAX,
  REFUND_AD_MIN_INCOME: REFUND_AD_MIN_INCOME,
  refundEligibleSql: refundEligibleSql,
  refundYearAggSql: refundYearAggSql,
  parseSegment: parseSegment,
  parseDays: parseDays,
  opsSkuGmvLabel: opsSkuGmvLabel
};
