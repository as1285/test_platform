/**
 * 管理端 · 订单检索（账号 / 商户单号 / 支付宝单号 + 状态）
 */
'use strict';

const { getPool } = require('../shared/db');
const { opsSkuGmvLabel } = require('./opsConversion');
const taxEditFeePolicy = require('../tax/taxEditFeePolicy');
const najiluQrFeePolicy = require('../user/najiluQrFeePolicy');

var ADDON_KINDS = {
  lizhi_cert: 1,
  zaizhi_cert: 1,
  tax_edit_daily: 1,
  tax_edit_single: 1,
  tax_edit_unlimited: 1,
  rename_credit: 1
};

function addonSkuIds() {
  var out = {};
  out[taxEditFeePolicy.TAX_EDIT_DAILY_SKU_ID] = 1;
  out[taxEditFeePolicy.TAX_EDIT_SINGLE_SKU_ID] = 1;
  out[najiluQrFeePolicy.NAJILU_QR_SKU_ID] = 1;
  return out;
}

var ADDON_SKUS = addonSkuIds();

function isActivationProduct(row) {
  var kind = String((row && row.grant_kind) || '').trim();
  var sku = String((row && row.sku_id) || '').trim();
  if (ADDON_KINDS[kind] || ADDON_SKUS[sku]) return false;
  if (kind === 'trial' || kind === 'permanent') return true;
  if (sku.indexOf('sku_') === 0) return true;
  var subject = String((row && row.subject) || '');
  return /开通|激活|周卡|月卡|永久/.test(subject);
}

function isCurrentlyActive(user) {
  if (!user || Number(user.account_active) !== 1) return false;
  if (!user.active_until) return true;
  var t = new Date(user.active_until).getTime();
  if (!isFinite(t)) return true;
  return t > Date.now();
}

function parseListQuery(query) {
  query = query || {};
  var q = String(query.q || '').trim().slice(0, 80);
  var status = String(query.status || '').trim().toLowerCase();
  if (['pending', 'paid', 'closed', 'refunded'].indexOf(status) < 0) status = '';
  var issue = String(query.issue || '').trim();
  if (issue !== 'paid_not_active') issue = '';
  var days = parseInt(query.days, 10);
  if (!isFinite(days) || days < 0) days = 90;
  if (days > 365) days = 365;
  var page = parseInt(query.page, 10);
  if (!isFinite(page) || page < 1) page = 1;
  var limit = parseInt(query.limit, 10);
  if (!isFinite(limit) || limit < 1) limit = 20;
  if (limit > 100) limit = 100;
  return { q: q, status: status, issue: issue, days: days, page: page, limit: limit };
}

function buildWhere(opts, admin, appendScope) {
  var where = ['1=1'];
  var params = [];
  if (opts.q) {
    var like = '%' + opts.q + '%';
    where.push(
      '(po.username LIKE ? OR po.out_trade_no LIKE ? OR IFNULL(po.alipay_trade_no, \'\') LIKE ?)'
    );
    params.push(like, like, like);
  }
  if (opts.status) {
    where.push('po.status = ?');
    params.push(opts.status);
  }
  if (opts.days > 0) {
    where.push(
      'DATE(DATE_ADD(po.created_at, INTERVAL 8 HOUR)) >= DATE_SUB(DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)), INTERVAL ? DAY)'
    );
    params.push(opts.days);
  }
  if (opts.issue === 'paid_not_active') {
    where.push("po.status = 'paid'");
    where.push(
      "IFNULL(po.grant_kind, '') NOT IN ('lizhi_cert','zaizhi_cert','tax_edit_daily','tax_edit_single','rename_credit')"
    );
    where.push(
      "IFNULL(po.sku_id, '') NOT IN ('" +
        taxEditFeePolicy.TAX_EDIT_DAILY_SKU_ID +
        "','" +
        taxEditFeePolicy.TAX_EDIT_SINGLE_SKU_ID +
        "','" +
        najiluQrFeePolicy.NAJILU_QR_SKU_ID +
        "')"
    );
    where.push(
      '(u.account_active IS NULL OR u.account_active = 0 OR (u.active_until IS NOT NULL AND u.active_until < UTC_TIMESTAMP()))'
    );
  }
  if (typeof appendScope === 'function' && admin) {
    /* 必须用 users 别名：appendAdminUserScope / nonGuestUsernameSql 会读 alias.user_type、
       sales_promo_channel；payment_orders 无这些列（否则 Unknown column 'po.user_type'）。 */
    appendScope(where, params, admin, 'u.username');
  }
  return { sql: where.join(' AND '), params: params };
}

function mapOrderRow(r) {
  var activation = isActivationProduct(r);
  var active = isCurrentlyActive(r);
  var status = String(r.status || '');
  return {
    id: Number(r.id) || 0,
    username: String(r.username || ''),
    real_name: r.real_name != null ? String(r.real_name) : '',
    subject: String(r.subject || ''),
    label: opsSkuGmvLabel(r),
    sku_id: String(r.sku_id || ''),
    grant_kind: String(r.grant_kind || ''),
    amount: Math.round(Number(r.amount || 0) * 100) / 100,
    status: status,
    out_trade_no: String(r.out_trade_no || ''),
    alipay_trade_no: r.alipay_trade_no != null ? String(r.alipay_trade_no) : '',
    paid_at: r.paid_at || null,
    created_at: r.created_at || null,
    account_active: Number(r.account_active) === 1,
    currently_active: active,
    is_activation: activation,
    paid_not_active: status === 'paid' && activation && !active
  };
}

function createHandlers(deps) {
  deps = deps || {};
  async function handleAdminPaymentOrders(req, res) {
    try {
      var opts = parseListQuery(req.query);
      var scoped = buildWhere(opts, req.admin, deps.appendAdminUserScope);
      var pool = getPool();
      var conn = await pool.getConnection();
      try {
        const [countRows] = await conn.query(
          `SELECT COUNT(*) AS c
           FROM payment_orders po
           LEFT JOIN users u
             ON u.username COLLATE utf8mb4_unicode_ci = po.username COLLATE utf8mb4_unicode_ci
           WHERE ` + scoped.sql,
          scoped.params
        );
        var total = Number(countRows && countRows[0] && countRows[0].c) || 0;
        var offset = (opts.page - 1) * opts.limit;
        const [rows] = await conn.query(
          `SELECT po.id, po.username, po.subject, po.amount, po.status, po.sku_id, po.grant_kind,
                  po.out_trade_no, po.alipay_trade_no, po.paid_at, po.created_at,
                  u.real_name, u.account_active, u.active_until
           FROM payment_orders po
           LEFT JOIN users u
             ON u.username COLLATE utf8mb4_unicode_ci = po.username COLLATE utf8mb4_unicode_ci
           WHERE ` +
            scoped.sql +
            `
           ORDER BY po.created_at DESC, po.id DESC
           LIMIT ? OFFSET ?`,
          scoped.params.concat([opts.limit, offset])
        );
        var list = (rows || []).map(mapOrderRow);
        return res.json({
          code: 200,
          data: {
            total: total,
            page: opts.page,
            limit: opts.limit,
            q: opts.q,
            status: opts.status,
            issue: opts.issue,
            days: opts.days,
            list: list
          }
        });
      } finally {
        conn.release();
      }
    } catch (e) {
      console.error('[payment-orders]', e);
      return res.status(500).json({ code: 500, msg: String(e.message || e) });
    }
  }
  return { handleAdminPaymentOrders: handleAdminPaymentOrders };
}

module.exports = {
  createHandlers: createHandlers,
  parseListQuery: parseListQuery,
  buildWhere: buildWhere,
  isActivationProduct: isActivationProduct,
  isCurrentlyActive: isCurrentlyActive,
  mapOrderRow: mapOrderRow,
  ADDON_KINDS: ADDON_KINDS
};
