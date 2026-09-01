/**
 * C 端个税记录填写页 · 体验满意度 + 不满意点 + 优化建议
 *
 * 规则：
 * - 正式提交：必须选 satisfaction（good/ok/bad）
 * - satisfaction 为 ok/bad 时：必须至少选 1 个 improve topic（可多选）
 * - good：improve / suggestion 可选
 * - 显式跳过：skipped=1，satisfaction 记为 skipped（不计入「满意」）
 * - 每账号最多 1 条
 * - improve_topic 存逗号分隔排序后的 topic keys
 */
const { getPool } = require('../shared/db');

var SATISFACTIONS = { good: 1, ok: 1, bad: 1 };
var IMPROVE_TOPICS = {
  start: 1,
  paste: 1,
  manual: 1,
  generate: 1,
  list: 1,
  calc: 1,
  other: 1
};
var IMPROVE_TOPIC_ORDER = ['start', 'paste', 'manual', 'generate', 'list', 'calc', 'other'];
var SKIP_SATISFACTION = 'skipped';
var SUGGESTION_MAX = 500;

function clean(s) {
  return String(s == null ? '' : s).trim();
}

function normalizeSatisfaction(v) {
  var s = clean(v).toLowerCase();
  return SATISFACTIONS[s] ? s : '';
}

function normalizeImproveTopic(v) {
  var s = clean(v).toLowerCase();
  return IMPROVE_TOPICS[s] ? s : '';
}

/** 解析单值 / 数组 / 逗号串 → 去重排序后的合法 topic 列表 */
function normalizeImproveTopics(raw) {
  var parts = [];
  if (Array.isArray(raw)) {
    parts = raw;
  } else if (raw != null && typeof raw === 'object' && Array.isArray(raw.topics)) {
    parts = raw.topics;
  } else if (typeof raw === 'string') {
    parts = raw.split(/[,，\s]+/);
  } else if (raw != null && raw !== '') {
    parts = [raw];
  }
  var seen = {};
  var out = [];
  parts.forEach(function (p) {
    var k = normalizeImproveTopic(p);
    if (k && !seen[k]) {
      seen[k] = 1;
      out.push(k);
    }
  });
  out.sort(function (a, b) {
    return IMPROVE_TOPIC_ORDER.indexOf(a) - IMPROVE_TOPIC_ORDER.indexOf(b);
  });
  return out;
}

function serializeImproveTopics(topics) {
  var list = normalizeImproveTopics(topics);
  return list.length ? list.join(',') : null;
}

function parseImproveTopicsStored(raw) {
  return normalizeImproveTopics(raw);
}

function normalizeSuggestion(v) {
  var s = clean(v).replace(/\s+/g, ' ');
  if (!s) return null;
  if (s.length > SUGGESTION_MAX) s = s.slice(0, SUGGESTION_MAX);
  return s;
}

function pctRate(part, total) {
  var t = Number(total) || 0;
  if (t < 1) return 0;
  return Math.round(((Number(part) || 0) / t) * 1000) / 10;
}

function emptyImproveCounts() {
  return {
    start: 0,
    paste: 0,
    manual: 0,
    generate: 0,
    list: 0,
    calc: 0,
    other: 0
  };
}

function emptySurveySummary() {
  return {
    total: 0,
    submitted: 0,
    skipped: 0,
    with_suggestion: 0,
    with_improve: 0,
    unhappy: 0,
    unhappy_with_improve: 0,
    satisfaction: { good: 0, ok: 0, bad: 0 },
    good_pct: 0,
    ok_pct: 0,
    bad_pct: 0,
    improve: emptyImproveCounts(),
    improve_unhappy: emptyImproveCounts(),
    recent: []
  };
}

function normalizeSubmitBody(b) {
  b = b || {};
  var skipped = b.skipped === true || b.skipped === 1 || b.skipped === '1';
  var satisfaction = normalizeSatisfaction(b.satisfaction);
  var topics = normalizeImproveTopics(
    b.improve_topics != null ? b.improve_topics : b.improve_topic
  );
  var suggestion = normalizeSuggestion(b.suggestion);
  var clientId = clean(b.client_id).slice(0, 64) || null;

  if (!skipped) {
    if (!satisfaction) {
      return { error: '请选择体验满意度' };
    }
    if ((satisfaction === 'ok' || satisfaction === 'bad') && !topics.length) {
      return {
        error: satisfaction === 'bad' ? '请选择哪里不满意（可多选）' : '请选择哪里一般（可多选）'
      };
    }
  } else {
    satisfaction = SKIP_SATISFACTION;
    topics = [];
    suggestion = null;
  }

  return {
    satisfaction: satisfaction || SKIP_SATISFACTION,
    improve_topic: serializeImproveTopics(topics),
    improve_topics: topics,
    suggestion: suggestion,
    skipped: skipped ? 1 : 0,
    client_id: clientId
  };
}

async function handleTaxFillSurveyStatus(req, res) {
  try {
    if (!req.authUserId) {
      return res.status(401).json({ code: 401, msg: '请先登录' });
    }
    var pool = getPool();
    const [rows] = await pool.execute(
      'SELECT id FROM tax_fill_survey WHERE username = ? LIMIT 1',
      [String(req.authUserId)]
    );
    return res.json({
      code: 200,
      data: { done: !!(rows && rows.length) }
    });
  } catch (e) {
    console.error('[tax-fill-survey] status', e);
    return res.status(500).json({ code: 500, msg: '读取失败' });
  }
}

async function handleTaxFillSurveySubmit(req, res) {
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
        `INSERT INTO tax_fill_survey
           (username, satisfaction, improve_topic, suggestion, skipped, client_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uname,
          parsed.satisfaction,
          parsed.improve_topic,
          parsed.suggestion,
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
    console.error('[tax-fill-survey] submit', e);
    return res.status(500).json({ code: 500, msg: '提交失败' });
  }
}

function parseDays(raw) {
  var n = parseInt(raw, 10);
  if (!isFinite(n) || n < 1) n = 7;
  if (n > 366) n = 366;
  return n;
}

function bumpImproveCounts(bucket, topics, c) {
  (topics || []).forEach(function (t) {
    if (bucket[t] != null) bucket[t] += c;
  });
}

async function summarizeTaxFillSurvey(conn, days) {
  var out = emptySurveySummary();
  if (!conn) return out;
  var nDays = parseDays(days);
  var cnCreatedDay = 'DATE(DATE_ADD(created_at, INTERVAL 8 HOUR))';
  var cnToday = 'DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR))';
  var sinceSql = cnCreatedDay + ' >= DATE_SUB(' + cnToday + ', INTERVAL ? DAY)';
  try {
    const [rows] = await conn.execute(
      `SELECT skipped, satisfaction, improve_topic,
              SUM(CASE WHEN suggestion IS NOT NULL AND suggestion <> '' THEN 1 ELSE 0 END) AS with_text,
              COUNT(*) AS cnt
       FROM tax_fill_survey
       WHERE ${sinceSql}
       GROUP BY skipped, satisfaction, improve_topic`,
      [nDays]
    );
    (rows || []).forEach(function (r) {
      var c = Number(r.cnt) || 0;
      out.total += c;
      out.with_suggestion += Number(r.with_text) || 0;
      if (Number(r.skipped) === 1) {
        out.skipped += c;
        return;
      }
      out.submitted += c;
      var sat = String(r.satisfaction || '').toLowerCase();
      if (out.satisfaction[sat] != null) out.satisfaction[sat] += c;
      var topics = parseImproveTopicsStored(r.improve_topic);
      if (topics.length) {
        out.with_improve += c;
        bumpImproveCounts(out.improve, topics, c);
      }
      if (sat === 'ok' || sat === 'bad') {
        out.unhappy += c;
        if (topics.length) {
          out.unhappy_with_improve += c;
          bumpImproveCounts(out.improve_unhappy, topics, c);
        }
      }
    });
    out.good_pct = pctRate(out.satisfaction.good, out.submitted);
    out.ok_pct = pctRate(out.satisfaction.ok, out.submitted);
    out.bad_pct = pctRate(out.satisfaction.bad, out.submitted);

    const [recentRows] = await conn.execute(
      `SELECT s.username, s.satisfaction, s.improve_topic, s.suggestion,
              s.skipped, s.created_at, u.real_name
       FROM tax_fill_survey s
       LEFT JOIN users u
         ON u.username COLLATE utf8mb4_unicode_ci = s.username COLLATE utf8mb4_unicode_ci
       WHERE DATE(DATE_ADD(s.created_at, INTERVAL 8 HOUR))
             >= DATE_SUB(DATE(DATE_ADD(UTC_TIMESTAMP(), INTERVAL 8 HOUR)), INTERVAL ? DAY)
       ORDER BY s.created_at DESC
       LIMIT 80`,
      [nDays]
    );
    out.recent = (recentRows || []).map(function (r) {
      var topics = parseImproveTopicsStored(r.improve_topic);
      return {
        username: r.username != null ? String(r.username) : '',
        real_name: r.real_name != null ? String(r.real_name) : '',
        satisfaction: r.satisfaction != null ? String(r.satisfaction) : '',
        improve_topic: topics.length ? topics.join(',') : '',
        improve_topics: topics,
        suggestion: r.suggestion != null ? String(r.suggestion) : '',
        skipped: Number(r.skipped) === 1,
        created_at: r.created_at ? new Date(r.created_at).toISOString() : ''
      };
    });
  } catch (e) {
    console.error('[tax-fill-survey] summarize', e && e.message);
  }
  return out;
}

async function handleAdminTaxFillSurveyStats(req, res) {
  try {
    var days = parseDays(req.query && req.query.days);
    var pool = getPool();
    const conn = await pool.getConnection();
    try {
      var survey = await summarizeTaxFillSurvey(conn, days);
      return res.json({
        code: 200,
        data: {
          period: {
            days: days,
            label: '最近 ' + days + ' 天',
            period_key: String(days)
          },
          note:
            'C 端税务记录填写页问卷：满意度 + 不满意点（一般/不满意必选，可多选）+ 文字建议。每账号最多 1 条。',
          survey: survey
        }
      });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[tax-fill-survey] admin stats', e);
    return res.status(500).json({ code: 500, msg: String(e.message || e) });
  }
}

function getHandlers() {
  return {
    handleTaxFillSurveyStatus: handleTaxFillSurveyStatus,
    handleTaxFillSurveySubmit: handleTaxFillSurveySubmit,
    handleAdminTaxFillSurveyStats: handleAdminTaxFillSurveyStats
  };
}

module.exports = {
  getHandlers: getHandlers,
  summarizeTaxFillSurvey: summarizeTaxFillSurvey,
  emptySurveySummary: emptySurveySummary,
  normalizeSatisfaction: normalizeSatisfaction,
  normalizeImproveTopic: normalizeImproveTopic,
  normalizeImproveTopics: normalizeImproveTopics,
  parseImproveTopicsStored: parseImproveTopicsStored,
  serializeImproveTopics: serializeImproveTopics,
  normalizeSuggestion: normalizeSuggestion,
  normalizeSubmitBody: normalizeSubmitBody,
  SATISFACTIONS: SATISFACTIONS,
  IMPROVE_TOPICS: IMPROVE_TOPICS,
  IMPROVE_TOPIC_ORDER: IMPROVE_TOPIC_ORDER,
  SKIP_SATISFACTION: SKIP_SATISFACTION,
  SUGGESTION_MAX: SUGGESTION_MAX
};
