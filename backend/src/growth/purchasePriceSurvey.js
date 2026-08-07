/**
 * 支付页首次退出 · 价格调研
 *
 * 规则：
 * - 正式提交：必须选 sentiment（expensive/fair/cheap）；expected_price 可选
 * - 显式跳过：skipped=1，sentiment 记为 skipped（不再默认 fair，避免污染「合适」）
 */
const { getPool } = require('../shared/db');

var SENTIMENTS = { expensive: 1, fair: 1, cheap: 1 };
var SKIP_SENTIMENT = 'skipped';

function clean(s) {
  return String(s == null ? '' : s).trim();
}

function parseMoney(v) {
  if (v == null || v === '') return null;
  var n = Number(v);
  if (!isFinite(n) || n < 0) return null;
  if (n > 999999) n = 999999;
  return Math.round(n * 100) / 100;
}

async function handlePurchasePriceSurveyStatus(req, res) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var pool = getPool();
    const [rows] = await pool.execute(
      'SELECT id FROM purchase_price_survey WHERE username = ? LIMIT 1',
      [String(req.authUserId)]
    );
    return res.json({
      code: 200,
      data: { done: !!(rows && rows.length) }
    });
  } catch (e) {
    console.error('[price-survey] status', e);
    return res.status(500).json({ code: 500, msg: '读取失败' });
  }
}

async function handlePurchasePriceSurveySubmit(req, res) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var b = req.body || {};
    var skipped = b.skipped === true || b.skipped === 1 || b.skipped === '1';
    var sentiment = clean(b.sentiment).toLowerCase();
    var expected = parseMoney(b.expected_price);
    var seenMin = parseMoney(b.seen_sku_min);
    var seenMax = parseMoney(b.seen_sku_max);
    var clientId = clean(b.client_id).slice(0, 64) || null;

    if (!skipped) {
      if (!SENTIMENTS[sentiment]) {
        return res.status(400).json({ code: 400, msg: '请选择觉得贵了还是便宜' });
      }
      /* 心理价位改为可选：只选态度也有统计价值 */
    } else {
      sentiment = SKIP_SENTIMENT;
      expected = null;
    }

    var uname = String(req.authUserId);
    var pool = getPool();
    try {
      await pool.execute(
        `INSERT INTO purchase_price_survey
           (username, sentiment, expected_price, seen_sku_min, seen_sku_max, skipped, client_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uname,
          sentiment || SKIP_SENTIMENT,
          expected,
          seenMin,
          seenMax,
          skipped ? 1 : 0,
          clientId
        ]
      );
    } catch (insErr) {
      if (insErr && (insErr.code === 'ER_DUP_ENTRY' || Number(insErr.errno) === 1062)) {
        return res.json({ code: 200, data: { done: true, already: true } });
      }
      throw insErr;
    }
    return res.json({ code: 200, data: { done: true } });
  } catch (e) {
    console.error('[price-survey] submit', e);
    return res.status(500).json({ code: 500, msg: '提交失败' });
  }
}

function getHandlers() {
  return {
    handlePurchasePriceSurveyStatus: handlePurchasePriceSurveyStatus,
    handlePurchasePriceSurveySubmit: handlePurchasePriceSurveySubmit
  };
}

module.exports = {
  getHandlers: getHandlers,
  /* 供单测 / 管理端口径复用 */
  SENTIMENTS: SENTIMENTS,
  SKIP_SENTIMENT: SKIP_SENTIMENT,
  parseMoney: parseMoney
};
