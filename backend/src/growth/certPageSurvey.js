/**
 * C 端离职/在职证明页首次退出 · 价格 + 体验调研
 *
 * 规则：
 * - 正式提交：必须选 sentiment（expensive/fair/cheap）；experience / improve / expected_price 可选
 * - 显式跳过：skipped=1，sentiment 记为 skipped（不计入「合适」）
 * - 每账号每种证明最多 1 条（uk_cps_user_product）
 */
const { getPool } = require('../shared/db');

var PRODUCTS = { lizhi: 1, zaizhi: 1 };
var SENTIMENTS = { expensive: 1, fair: 1, cheap: 1 };
var EXPERIENCES = { good: 1, ok: 1, bad: 1 };
var IMPROVE_TOPICS = { form: 1, preview: 1, share: 1, pay: 1, price: 1, other: 1 };
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

function normalizeProduct(v) {
  var p = clean(v).toLowerCase();
  return PRODUCTS[p] ? p : '';
}

function normalizeSentiment(v) {
  var s = clean(v).toLowerCase();
  return SENTIMENTS[s] ? s : '';
}

function normalizeExperience(v) {
  var s = clean(v).toLowerCase();
  return EXPERIENCES[s] ? s : '';
}

function normalizeImproveTopic(v) {
  var s = clean(v).toLowerCase();
  return IMPROVE_TOPICS[s] ? s : '';
}

function pctRate(part, total) {
  var t = Number(total) || 0;
  if (t < 1) return 0;
  return Math.round(((Number(part) || 0) / t) * 1000) / 10;
}

function emptySurveySummary() {
  return {
    total: 0,
    submitted: 0,
    skipped: 0,
    expensive: 0,
    fair: 0,
    cheap: 0,
    expensive_pct: 0,
    fair_pct: 0,
    cheap_pct: 0,
    experience: { good: 0, ok: 0, bad: 0 },
    improve: { form: 0, preview: 0, share: 0, pay: 0, price: 0, other: 0 },
    with_expected_price: 0,
    avg_expected_price: null,
    expected_price_buckets: [],
    recent: []
  };
}

function normalizeSubmitBody(b) {
  b = b || {};
  var product = normalizeProduct(b.product);
  if (!product) {
    return { error: '无效的证明类型' };
  }
  var skipped = b.skipped === true || b.skipped === 1 || b.skipped === '1';
  var sentiment = normalizeSentiment(b.sentiment);
  var expected = parseMoney(b.expected_price);
  var seenPrice = parseMoney(b.seen_price);
  var experience = normalizeExperience(b.experience) || null;
  var improveTopic = normalizeImproveTopic(b.improve_topic) || null;
  var unlocked = b.unlocked === true || b.unlocked === 1 || b.unlocked === '1' ? 1 : 0;
  var clientId = clean(b.client_id).slice(0, 64) || null;

  if (!skipped) {
    if (!sentiment) {
      return { error: '请选择觉得贵了还是便宜' };
    }
  } else {
    sentiment = SKIP_SENTIMENT;
    expected = null;
    experience = null;
    improveTopic = null;
  }

  return {
    product: product,
    sentiment: sentiment || SKIP_SENTIMENT,
    expected_price: expected,
    experience: experience,
    improve_topic: improveTopic,
    seen_price: seenPrice,
    unlocked: unlocked,
    skipped: skipped ? 1 : 0,
    client_id: clientId
  };
}

async function handleCertPageSurveyStatus(req, res) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var product = normalizeProduct(req.query && req.query.product);
    if (!product) {
      return res.status(400).json({ code: 400, msg: '无效的证明类型' });
    }
    var pool = getPool();
    const [rows] = await pool.execute(
      'SELECT id FROM cert_page_survey WHERE username = ? AND product = ? LIMIT 1',
      [String(req.authUserId), product]
    );
    return res.json({
      code: 200,
      data: { done: !!(rows && rows.length), product: product }
    });
  } catch (e) {
    console.error('[cert-survey] status', e);
    return res.status(500).json({ code: 500, msg: '读取失败' });
  }
}

async function handleCertPageSurveySubmit(req, res) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var parsed = normalizeSubmitBody(req.body || {});
    if (parsed.error) {
      return res.status(400).json({ code: 400, msg: parsed.error });
    }
    var uname = String(req.authUserId);
    var pool = getPool();
    try {
      await pool.execute(
        `INSERT INTO cert_page_survey
           (username, product, sentiment, expected_price, experience, improve_topic,
            seen_price, unlocked, skipped, client_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uname,
          parsed.product,
          parsed.sentiment,
          parsed.expected_price,
          parsed.experience,
          parsed.improve_topic,
          parsed.seen_price,
          parsed.unlocked,
          parsed.skipped,
          parsed.client_id
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
    console.error('[cert-survey] submit', e);
    return res.status(500).json({ code: 500, msg: '提交失败' });
  }
}

function moneyOrNull(v) {
  var n = Number(v);
  return isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** 管理端：按证明类型 + 天数汇总离开调研 */
async function summarizeCertPageSurvey(conn, product, days) {
  var out = emptySurveySummary();
  var prod = normalizeProduct(product);
  var nDays = parseInt(days, 10);
  if (!prod || !conn) return out;
  if (!isFinite(nDays) || nDays < 1) nDays = 7;
  if (nDays > 366) nDays = 366;
  var cnCreatedDay = 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
  var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
  var sinceSql = cnCreatedDay + ' >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY)';
  try {
    const [rows] = await conn.execute(
      `SELECT skipped, sentiment, experience, improve_topic, COUNT(*) AS cnt
       FROM cert_page_survey
       WHERE product = ? AND ${sinceSql}
       GROUP BY skipped, sentiment, experience, improve_topic`,
      [prod, nDays]
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
      var exp = String(r.experience || '').toLowerCase();
      if (out.experience[exp] != null) out.experience[exp] += c;
      var imp = String(r.improve_topic || '').toLowerCase();
      if (out.improve[imp] != null) out.improve[imp] += c;
    });
    out.expensive_pct = pctRate(out.expensive, out.submitted);
    out.fair_pct = pctRate(out.fair, out.submitted);
    out.cheap_pct = pctRate(out.cheap, out.submitted);

    const [priceAgg] = await conn.execute(
      `SELECT COUNT(*) AS with_price, AVG(expected_price) AS avg_price
       FROM cert_page_survey
       WHERE product = ? AND ${sinceSql}
         AND skipped = 0
         AND expected_price IS NOT NULL`,
      [prod, nDays]
    );
    if (priceAgg && priceAgg[0]) {
      out.with_expected_price = Number(priceAgg[0].with_price) || 0;
      out.avg_expected_price = moneyOrNull(priceAgg[0].avg_price);
    }

    const [bucketRows] = await conn.execute(
      `SELECT expected_price AS price, COUNT(*) AS cnt
       FROM cert_page_survey
       WHERE product = ? AND ${sinceSql}
         AND skipped = 0
         AND expected_price IS NOT NULL
       GROUP BY expected_price
       ORDER BY cnt DESC, price ASC
       LIMIT 40`,
      [prod, nDays]
    );
    var knownPrices = { 9: 1, 19: 1, 29: 1, 39: 1, 50: 1, 68: 1, 88: 1, 98: 1 };
    var bucketMap = {
      '9': 0,
      '19': 0,
      '29': 0,
      '39': 0,
      '50': 0,
      '68': 0,
      '88': 0,
      '98': 0,
      other: 0
    };
    (bucketRows || []).forEach(function (r) {
      var p = Number(r.price);
      var c = Number(r.cnt) || 0;
      if (!isFinite(p) || c < 1) return;
      var key = String(Math.round(p));
      if (knownPrices[key]) bucketMap[key] += c;
      else bucketMap.other += c;
    });
    out.expected_price_buckets = [
      { label: '¥9', price: 9, count: bucketMap['9'] },
      { label: '¥19', price: 19, count: bucketMap['19'] },
      { label: '¥29', price: 29, count: bucketMap['29'] },
      { label: '¥39', price: 39, count: bucketMap['39'] },
      { label: '¥50', price: 50, count: bucketMap['50'] },
      { label: '¥68', price: 68, count: bucketMap['68'] },
      { label: '¥88', price: 88, count: bucketMap['88'] },
      { label: '¥98', price: 98, count: bucketMap['98'] },
      { label: '其他', price: null, count: bucketMap.other }
    ];

    const [recentRows] = await conn.execute(
      `SELECT s.username, s.sentiment, s.expected_price, s.experience, s.improve_topic,
              s.skipped, s.unlocked, s.created_at, u.real_name
       FROM cert_page_survey s
       LEFT JOIN users u
         ON u.username COLLATE utf8mb4_unicode_ci = s.username COLLATE utf8mb4_unicode_ci
       WHERE s.product = ? AND DATE(DATE_ADD(s.created_at, INTERVAL 8 HOUR))
             >= DATE_SUB(DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)), INTERVAL ? DAY)
       ORDER BY s.created_at DESC
       LIMIT 30`,
      [prod, nDays]
    );
    out.recent = (recentRows || []).map(function (r) {
      return {
        username: r.username != null ? String(r.username) : '',
        real_name: r.real_name != null ? String(r.real_name) : '',
        sentiment: r.sentiment != null ? String(r.sentiment) : '',
        expected_price: moneyOrNull(r.expected_price),
        experience: r.experience != null ? String(r.experience) : '',
        improve_topic: r.improve_topic != null ? String(r.improve_topic) : '',
        skipped: Number(r.skipped) === 1,
        unlocked: Number(r.unlocked) === 1,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : ''
      };
    });
  } catch (e) {
    console.error('[cert-survey] summarize', e && e.message);
  }
  return out;
}

function getHandlers() {
  return {
    handleCertPageSurveyStatus: handleCertPageSurveyStatus,
    handleCertPageSurveySubmit: handleCertPageSurveySubmit
  };
}

module.exports = {
  getHandlers: getHandlers,
  summarizeCertPageSurvey: summarizeCertPageSurvey,
  emptySurveySummary: emptySurveySummary,
  normalizeProduct: normalizeProduct,
  normalizeSentiment: normalizeSentiment,
  normalizeExperience: normalizeExperience,
  normalizeImproveTopic: normalizeImproveTopic,
  normalizeSubmitBody: normalizeSubmitBody,
  parseMoney: parseMoney,
  pctRate: pctRate,
  PRODUCTS: PRODUCTS,
  SENTIMENTS: SENTIMENTS,
  EXPERIENCES: EXPERIENCES,
  IMPROVE_TOPICS: IMPROVE_TOPICS,
  SKIP_SENTIMENT: SKIP_SENTIMENT
};
