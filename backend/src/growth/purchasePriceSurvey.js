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

/**
 * 点「偏贵」会先落调研（此时无金额），真正的心理价在出价表。
 * 仅用出价补 expensive 且调研未填价的行，不覆盖芯片/手填金额。
 */
function effectiveExpectedPrice(row, bidAmount) {
  var own = parseMoney(row && row.expected_price);
  if (own != null) return own;
  if (!row || Number(row.skipped) === 1) return null;
  if (String(row.sentiment || '').toLowerCase() !== 'expensive') return null;
  return parseMoney(bidAmount);
}

/** 最新一条出价 JOIN（按 username） */
function latestBidJoinSql(surveyAlias, bidAlias) {
  var s = surveyAlias || 's';
  var b = bidAlias || 'bid';
  return (
    'LEFT JOIN (' +
    ' SELECT ub.username, ub.bid_amount FROM user_price_bids ub' +
    ' INNER JOIN (SELECT username, MAX(id) AS max_id FROM user_price_bids GROUP BY username) latest' +
    ' ON latest.max_id = ub.id' +
    ') ' +
    b +
    ' ON ' +
    b +
    '.username COLLATE utf8mb4_unicode_ci = ' +
    s +
    '.username COLLATE utf8mb4_unicode_ci'
  );
}

function coalescedExpectedPriceSql(surveyAlias, bidAlias) {
  var s = surveyAlias || 's';
  var b = bidAlias || 'bid';
  return (
    'COALESCE(' +
    s +
    '.expected_price, CASE WHEN ' +
    s +
    '.skipped = 0 AND LOWER(' +
    s +
    ".sentiment) = 'expensive' THEN " +
    b +
    '.bid_amount END)'
  );
}

/** 出价成功后回写离开调研的 expected_price（每账号最多 1 条） */
async function attachExpectedPriceFromBid(username, amount, db) {
  var expected = parseMoney(amount);
  var uname = String(username || '').trim();
  if (!expected || !uname) return { updated: 0 };
  var pool = db || getPool();
  const [r] = await pool.execute(
    `UPDATE purchase_price_survey
        SET expected_price = ?
      WHERE username = ?
        AND skipped = 0
        AND sentiment = 'expensive'
        AND (expected_price IS NULL OR expected_price <> ?)`,
    [expected, uname, expected]
  );
  return { updated: r && r.affectedRows ? Number(r.affectedRows) : 0 };
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

function pctRate(part, total) {
  var t = Number(total) || 0;
  if (t < 1) return 0;
  return Math.round(((Number(part) || 0) / t) * 1000) / 10;
}

function emptyPurchaseSurveySummary() {
  return {
    total: 0,
    submitted: 0,
    skipped: 0,
    expensive: 0,
    fair: 0,
    cheap: 0,
    expensive_pct: 0,
    fair_pct: 0,
    cheap_pct: 0
  };
}

function parseDays(raw) {
  var n = parseInt(raw, 10);
  if (!isFinite(n) || n < 1) n = 7;
  if (n > 366) n = 366;
  return n;
}

/** 管理端：支付离开问卷态度汇总（不含出价金额） */
async function summarizePurchasePriceSurvey(conn, days) {
  var out = emptyPurchaseSurveySummary();
  if (!conn) return out;
  var nDays = parseDays(days);
  var cnCreatedDay = 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
  var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
  var sinceSql = cnCreatedDay + ' >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY)';
  try {
    const [rows] = await conn.execute(
      `SELECT skipped, sentiment, COUNT(*) AS cnt
       FROM purchase_price_survey
       WHERE ${sinceSql}
       GROUP BY skipped, sentiment`,
      [nDays]
    );
    (rows || []).forEach(function (r) {
      var c = Number(r.cnt) || 0;
      out.total += c;
      if (Number(r.skipped) === 1) {
        out.skipped += c;
        return;
      }
      out.submitted += c;
      var s = String(r.sentiment || '').toLowerCase();
      if (s === 'expensive') out.expensive += c;
      else if (s === 'cheap') out.cheap += c;
      else if (s === 'fair') out.fair += c;
    });
    out.expensive_pct = pctRate(out.expensive, out.submitted);
    out.fair_pct = pctRate(out.fair, out.submitted);
    out.cheap_pct = pctRate(out.cheap, out.submitted);
  } catch (e) {
    console.error('[price-survey] summarize', e && e.message);
  }
  return out;
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
  parseMoney: parseMoney,
  effectiveExpectedPrice: effectiveExpectedPrice,
  latestBidJoinSql: latestBidJoinSql,
  coalescedExpectedPriceSql: coalescedExpectedPriceSql,
  attachExpectedPriceFromBid: attachExpectedPriceFromBid,
  summarizePurchasePriceSurvey: summarizePurchasePriceSurvey,
  emptyPurchaseSurveySummary: emptyPurchaseSurveySummary,
  pctRate: pctRate
};
