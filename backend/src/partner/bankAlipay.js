/**
 * 银行模拟器当面付中台：招行机不落支付宝密钥，统一走个税侧 APPID/密钥出码与回调。
 */
'use strict';

const crypto = require('crypto');
const alipay = require('../../alipay');
const { getPool } = require('../shared/db');
const {
  requirePartnerAuth,
  clean: cleanShared
} = require('./bankSalaryFlow');

const CMB_SKU_ID = 'sku_cmb_activate';
const CMB_GRANT_KIND = 'cmb_partner';
const CMB_VARIANT = 'cmb_partner';
const CMB_USERNAME_PREFIX = 'cmb:';

function clean(s) {
  if (typeof cleanShared === 'function') return cleanShared(s);
  return String(s == null ? '' : s).trim();
}

function envText(name) {
  return String(process.env[name] || '').trim();
}

function getBankProductConfig() {
  var title = envText('BANK_ALIPAY_PRODUCT_TITLE') || '招商银行模拟器激活';
  var amountRaw = envText('BANK_ALIPAY_PRODUCT_AMOUNT') || envText('ALIPAY_PRODUCT_AMOUNT');
  var amount = alipay.normalizeAmount(amountRaw);
  return {
    subject: String(title).slice(0, 128),
    amount: amount,
    sku_id: CMB_SKU_ID,
    grant_kind: CMB_GRANT_KIND
  };
}

function isBankAlipayReady() {
  var product = getBankProductConfig();
  return !!(alipay.isConfigured() && product.amount);
}

function isCmbPartnerOrderMeta(meta) {
  meta = meta || {};
  var sku = String(meta.sku_id || '');
  var grant = String(meta.grant_kind || '');
  var variant = String(meta.pricing_variant || '');
  return (
    sku.indexOf('sku_cmb_') === 0 ||
    grant === CMB_GRANT_KIND ||
    variant === CMB_VARIANT
  );
}

function partnerUsername(partnerUserId) {
  return CMB_USERNAME_PREFIX + String(partnerUserId);
}

function createCmbOutTradeNo() {
  var now = new Date();
  var stamp =
    now.getFullYear() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  return 'CMB' + stamp + crypto.randomBytes(8).toString('hex').toUpperCase();
}

function plainPartnerOrder(row) {
  if (!row) return null;
  var paidAt = '';
  if (row.paid_at instanceof Date) {
    paidAt = row.paid_at.toISOString();
  } else if (row.paid_at) {
    paidAt = String(row.paid_at);
  }
  return {
    out_trade_no: String(row.out_trade_no || ''),
    subject: String(row.subject || ''),
    amount: row.amount != null ? String(row.amount) : '',
    status: String(row.status || ''),
    paid_at: paidAt,
    sku_id: row.sku_id != null ? String(row.sku_id) : CMB_SKU_ID,
    grant_kind: row.grant_kind != null ? String(row.grant_kind) : CMB_GRANT_KIND,
    partner_user_id: String(row.username || '').replace(/^cmb:/i, '')
  };
}

async function insertCmbPaymentOrder(conn, row) {
  var tries = [
    {
      sql: `INSERT INTO payment_orders
        (out_trade_no, username, subject, amount, status, pricing_variant, sku_id, grant_kind)
        VALUES (?, ?, ?, ?, 'pending', ?, ?, ?)`,
      params: [
        row.out_trade_no,
        row.username,
        row.subject,
        row.amount,
        CMB_VARIANT,
        row.sku_id,
        row.grant_kind
      ]
    },
    {
      sql: `INSERT INTO payment_orders
        (out_trade_no, username, subject, amount, status, sku_id)
        VALUES (?, ?, ?, ?, 'pending', ?)`,
      params: [row.out_trade_no, row.username, row.subject, row.amount, row.sku_id]
    }
  ];
  var lastErr = null;
  for (var i = 0; i < tries.length; i++) {
    try {
      await conn.execute(tries[i].sql, tries[i].params);
      return;
    } catch (eIns) {
      lastErr = eIns;
      var badCol = eIns && eIns.errno === 1054;
      if (!badCol) throw eIns;
    }
  }
  throw lastErr;
}

async function markCmbOrderPaid(conn, order, info) {
  if (!order || !order.id || !info || !info.tradeNo) return false;
  await conn.beginTransaction();
  try {
    const [rows] = await conn.execute(
      `SELECT id, status, alipay_trade_no FROM payment_orders WHERE id = ? FOR UPDATE`,
      [order.id]
    );
    if (!rows.length) {
      await conn.rollback();
      return false;
    }
    var locked = rows[0];
    if (String(locked.status) === 'paid') {
      await conn.commit();
      return true;
    }
    if (String(locked.status) !== 'pending') {
      await conn.rollback();
      return false;
    }
    if (locked.alipay_trade_no && String(locked.alipay_trade_no) !== String(info.tradeNo)) {
      await conn.rollback();
      return false;
    }
    await conn.execute(
      `UPDATE payment_orders
       SET status = 'paid', alipay_trade_no = ?, buyer_logon_id = ?, paid_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        String(info.tradeNo),
        info.buyerLogonId ? String(info.buyerLogonId).slice(0, 128) : null,
        locked.id
      ]
    );
    await conn.commit();
    return true;
  } catch (e) {
    try {
      await conn.rollback();
    } catch (rollbackError) {}
    throw e;
  }
}

async function syncPendingFromAlipay(order) {
  if (!order || String(order.status) !== 'pending' || !alipay.isConfigured()) {
    return order;
  }
  try {
    var trade = await alipay.queryTrade(String(order.out_trade_no));
    if (
      trade &&
      (trade.tradeStatus === 'TRADE_SUCCESS' || trade.tradeStatus === 'TRADE_FINISHED') &&
      trade.tradeNo
    ) {
      var expectedAmount = alipay.normalizeAmount(order.amount);
      if (expectedAmount && trade.totalAmount && expectedAmount === trade.totalAmount) {
        var pool = getPool();
        var conn = await pool.getConnection();
        try {
          await markCmbOrderPaid(conn, order, {
            tradeNo: trade.tradeNo,
            buyerLogonId: trade.buyerLogonId || '',
            tradeStatus: trade.tradeStatus,
            source: 'partner_query'
          });
        } finally {
          conn.release();
        }
        const [fresh] = await pool.execute(
          `SELECT id, out_trade_no, username, subject, amount, status, paid_at, alipay_trade_no,
                  pricing_variant, sku_id, grant_kind
           FROM payment_orders WHERE id = ? LIMIT 1`,
          [order.id]
        );
        return fresh[0] || order;
      }
    }
  } catch (eSync) {
    console.warn('bank alipay status sync', eSync && eSync.message);
  }
  return order;
}

async function handleBankAlipayConfig(req, res) {
  try {
    if (!(await requirePartnerAuth(req, res))) return;
    var product = getBankProductConfig();
    var enabled = isBankAlipayReady();
    res.json({
      code: 200,
      msg: 'ok',
      data: {
        enabled: enabled,
        subject: product.subject,
        amount: product.amount || '',
        sku_id: product.sku_id,
        grant_kind: product.grant_kind,
        timeout_minutes: 30
      }
    });
  } catch (e) {
    console.error('handleBankAlipayConfig', e);
    if (!res.headersSent) res.status(500).json({ code: 500, msg: '服务异常' });
  }
}

async function handleBankAlipayCreate(req, res) {
  var conn = null;
  try {
    if (!(await requirePartnerAuth(req, res))) return;
    if (!isBankAlipayReady()) {
      return res.status(503).json({ code: 503, msg: '支付宝当面付未开通' });
    }
    var body = req.body || {};
    var partnerUserId = clean(body.partner_user_id || body.user_id || body.userId);
    if (!partnerUserId || !/^\d{1,20}$/.test(partnerUserId)) {
      return res.status(400).json({ code: 400, msg: 'partner_user_id 无效' });
    }
    var product = getBankProductConfig();
    var username = partnerUsername(partnerUserId);
    var pool = getPool();
    conn = await pool.getConnection();
    var order = null;
    try {
      await conn.beginTransaction();
      await conn.execute(
        `UPDATE payment_orders
         SET status = 'closed'
         WHERE username = ? AND status = 'pending' AND sku_id = ?
           AND created_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)`,
        [username, CMB_SKU_ID]
      );
      const [existingRows] = await conn.execute(
        `SELECT id, out_trade_no, subject, amount, status, paid_at, pricing_variant, sku_id, grant_kind
         FROM payment_orders
         WHERE username = ? AND status = 'pending' AND sku_id = ?
           AND created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 MINUTE)
         ORDER BY id DESC LIMIT 1 FOR UPDATE`,
        [username, CMB_SKU_ID]
      );
      if (existingRows.length) {
        var ex = existingRows[0];
        if (alipay.normalizeAmount(ex.amount) === product.amount) {
          order = ex;
        } else {
          await conn.execute(`UPDATE payment_orders SET status = 'closed' WHERE id = ?`, [ex.id]);
        }
      }
      if (!order) {
        order = {
          out_trade_no: createCmbOutTradeNo(),
          username: username,
          subject: product.subject,
          amount: product.amount,
          status: 'pending',
          sku_id: product.sku_id,
          grant_kind: product.grant_kind,
          pricing_variant: CMB_VARIANT
        };
        await insertCmbPaymentOrder(conn, order);
      }
      await conn.commit();
    } catch (eDb) {
      try {
        await conn.rollback();
      } catch (rollbackError) {}
      console.error('bank alipay create db', eDb);
      return res.status(500).json({ code: 500, msg: '创建订单失败' });
    }

    try {
      var precreate = await alipay.createFaceToFaceQr({
        outTradeNo: String(order.out_trade_no),
        subject: String(order.subject),
        amount: alipay.normalizeAmount(order.amount)
      });
      return res.json({
        code: 200,
        msg: 'ok',
        data: {
          order: plainPartnerOrder(order),
          qr_code: precreate.qrCode,
          payment_url: precreate.qrCode
        }
      });
    } catch (ePay) {
      console.error('bank alipay create precreate', ePay);
      var tip = ePay && ePay.message ? String(ePay.message) : '创建支付宝订单失败';
      if (/权限|permission|insufficient/i.test(tip)) {
        tip = '支付宝当面付权限异常，请稍后重试';
      }
      return res.status(500).json({
        code: 500,
        msg: tip.length > 80 ? '创建支付宝订单失败' : tip
      });
    }
  } catch (e) {
    console.error('handleBankAlipayCreate', e);
    if (!res.headersSent) res.status(500).json({ code: 500, msg: '服务异常' });
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (releaseErr) {}
    }
  }
}

async function handleBankAlipayStatus(req, res) {
  try {
    if (!(await requirePartnerAuth(req, res))) return;
    var outTradeNo = clean(
      (req.query && (req.query.out_trade_no || req.query.outTradeNo)) ||
        (req.body && (req.body.out_trade_no || req.body.outTradeNo))
    );
    var partnerUserId = clean(
      (req.query && (req.query.partner_user_id || req.query.user_id)) ||
        (req.body && (req.body.partner_user_id || req.body.user_id))
    );
    if (!outTradeNo && !partnerUserId) {
      return res.status(400).json({ code: 400, msg: '请提供 out_trade_no 或 partner_user_id' });
    }
    var pool = getPool();
    var order = null;
    if (outTradeNo) {
      const [rows] = await pool.execute(
        `SELECT id, out_trade_no, username, subject, amount, status, paid_at, alipay_trade_no,
                pricing_variant, sku_id, grant_kind
         FROM payment_orders WHERE out_trade_no = ? LIMIT 1`,
        [outTradeNo]
      );
      order = rows[0] || null;
      if (order && !isCmbPartnerOrderMeta(order)) {
        return res.status(403).json({ code: 403, msg: '非银行对接订单' });
      }
    } else {
      const [rows] = await pool.execute(
        `SELECT id, out_trade_no, username, subject, amount, status, paid_at, alipay_trade_no,
                pricing_variant, sku_id, grant_kind
         FROM payment_orders
         WHERE username = ? AND sku_id = ?
         ORDER BY id DESC LIMIT 1`,
        [partnerUsername(partnerUserId), CMB_SKU_ID]
      );
      order = rows[0] || null;
    }
    if (!order) {
      return res.status(404).json({ code: 404, msg: '订单不存在' });
    }
    if (partnerUserId && partnerUsername(partnerUserId) !== String(order.username || '')) {
      return res.status(403).json({ code: 403, msg: '订单与用户不匹配' });
    }
    order = await syncPendingFromAlipay(order);
    res.json({
      code: 200,
      msg: 'ok',
      data: {
        order: plainPartnerOrder(order),
        paid: String(order.status) === 'paid'
      }
    });
  } catch (e) {
    console.error('handleBankAlipayStatus', e);
    if (!res.headersSent) res.status(500).json({ code: 500, msg: '服务异常' });
  }
}

function getHandlers() {
  return {
    handleBankAlipayConfig: handleBankAlipayConfig,
    handleBankAlipayCreate: handleBankAlipayCreate,
    handleBankAlipayStatus: handleBankAlipayStatus
  };
}

module.exports = {
  getHandlers,
  handleBankAlipayConfig,
  handleBankAlipayCreate,
  handleBankAlipayStatus,
  getBankProductConfig,
  isBankAlipayReady,
  isCmbPartnerOrderMeta,
  partnerUsername,
  createCmbOutTradeNo,
  markCmbOrderPaid,
  CMB_SKU_ID,
  CMB_GRANT_KIND,
  CMB_VARIANT,
  CMB_USERNAME_PREFIX
};
