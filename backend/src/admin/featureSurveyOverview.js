/**
 * 管理端 · 功能调研总览
 * 合并支付离开问卷 / 个税填写 / 证明离开页；未接线功能标「C 端未接」。
 */
'use strict';

const { getPool } = require('../shared/db');
const purchasePriceSurvey = require('../growth/purchasePriceSurvey');
const taxFillSurvey = require('../growth/taxFillSurvey');
const certPageSurvey = require('../growth/certPageSurvey');

var TAX_IMPROVE_LABELS = {
  start: '开始方式',
  paste: '粘贴导入',
  manual: '手动填写',
  generate: '一键生成',
  list: '记录列表',
  calc: '计算说明',
  other: '其他'
};
var CERT_IMPROVE_LABELS = {
  form: '填写预填',
  preview: '预览效果',
  share: '分享保存',
  pay: '支付开通',
  price: '价格',
  other: '其他'
};

var FEATURE_DEFS = [
  {
    id: 'purchase',
    title: '开通套餐',
    wired: true,
    kind: 'price',
    detail_hash: 'analytics-purchase',
    note: '支付页离开问卷。疑虑芯片尚未落库。'
  },
  {
    id: 'tax_fill',
    title: '个税记录填写',
    wired: true,
    kind: 'usage',
    detail_hash: 'insights-product/survey',
    note: '满意度 + 优化项 + 文字建议。'
  },
  {
    id: 'lizhi_cert',
    title: '离职证明',
    wired: true,
    kind: 'price_usage',
    product: 'lizhi',
    detail_hash: 'lizhi-cert',
    note: '离开页价格 / 体验 / 优化。'
  },
  {
    id: 'zaizhi_cert',
    title: '在职证明',
    wired: true,
    kind: 'price_usage',
    product: 'zaizhi',
    detail_hash: 'lizhi-cert/zaizhi',
    note: '离开页价格 / 体验 / 优化。'
  },
  {
    id: 'sbdy_demo',
    title: '社保演示',
    wired: false,
    detail_hash: 'sbdy-demo'
  },
  {
    id: 'najilu',
    title: '完税二维码',
    wired: false,
    detail_hash: 'najilu-qr'
  },
  {
    id: 'ccb_flow',
    title: '工资流水',
    wired: false,
    detail_hash: 'ccb-flow'
  },
  {
    id: 'gjj_demo',
    title: '公积金演示',
    wired: false,
    detail_hash: 'sbdy-demo/gjj'
  }
];

function parseDays(raw) {
  var n = parseInt(raw, 10);
  if (!isFinite(n) || n < 1) n = 7;
  if (n > 366) n = 366;
  return n;
}

function pctRate(part, total) {
  var t = Number(total) || 0;
  if (t < 1) return null;
  return Math.round(((Number(part) || 0) / t) * 1000) / 10;
}

function topFromCounts(counts, labels, limit) {
  var n = limit == null ? 3 : limit;
  return Object.keys(counts || {})
    .map(function (key) {
      return {
        key: key,
        label: (labels && labels[key]) || key,
        count: Number(counts[key]) || 0
      };
    })
    .filter(function (row) {
      return row.count > 0;
    })
    .sort(function (a, b) {
      return b.count - a.count || a.key.localeCompare(b.key);
    })
    .slice(0, n);
}

function emptyFeatureRow(def) {
  return {
    id: def.id,
    title: def.title,
    wired: !!def.wired,
    status: def.wired ? 'live' : 'unwired',
    submitted: 0,
    skipped: 0,
    total: 0,
    expensive: null,
    expensive_pct: null,
    bad: null,
    bad_pct: null,
    top_concerns: [],
    suggestion_count: 0,
    detail_hash: def.detail_hash || '',
    note: def.wired ? def.note || '' : 'C 端未接，暂无数据'
  };
}

function mapPurchase(def, s) {
  var row = emptyFeatureRow(def);
  s = s || {};
  row.submitted = Number(s.submitted) || 0;
  row.skipped = Number(s.skipped) || 0;
  row.total = Number(s.total) || 0;
  row.expensive = Number(s.expensive) || 0;
  row.expensive_pct = pctRate(row.expensive, row.submitted);
  row.note = '疑虑芯片尚未落库；偏贵% 来自离开问卷态度。';
  return row;
}

function mapTaxFill(def, s) {
  var row = emptyFeatureRow(def);
  s = s || {};
  var sat = s.satisfaction || {};
  row.submitted = Number(s.submitted) || 0;
  row.skipped = Number(s.skipped) || 0;
  row.total = Number(s.total) || 0;
  row.bad = Number(sat.bad) || 0;
  row.bad_pct = pctRate(row.bad, row.submitted);
  row.top_concerns = topFromCounts(s.improve_unhappy || s.improve, TAX_IMPROVE_LABELS, 3);
  row.suggestion_count = Number(s.with_suggestion) || 0;
  return row;
}

function mapCert(def, s) {
  var row = emptyFeatureRow(def);
  s = s || {};
  var exp = s.experience || {};
  row.submitted = Number(s.submitted) || 0;
  row.skipped = Number(s.skipped) || 0;
  row.total = Number(s.total) || 0;
  row.expensive = Number(s.expensive) || 0;
  row.expensive_pct = pctRate(row.expensive, row.submitted);
  row.bad = Number(exp.bad) || 0;
  row.bad_pct = pctRate(row.bad, row.submitted);
  row.top_concerns = topFromCounts(s.improve, CERT_IMPROVE_LABELS, 3);
  return row;
}

function recentSuggestions(taxSummary) {
  var recent = (taxSummary && taxSummary.recent) || [];
  var out = [];
  recent.forEach(function (r) {
    var text = r && r.suggestion != null ? String(r.suggestion).trim() : '';
    if (!text || r.skipped) return;
    out.push({
      feature_id: 'tax_fill',
      feature_title: '个税记录填写',
      username: r.username != null ? String(r.username) : '',
      real_name: r.real_name != null ? String(r.real_name) : '',
      suggestion: text,
      created_at: r.created_at || ''
    });
  });
  return out.slice(0, 20);
}

async function buildFeatureSurveyOverview(conn, days) {
  var nDays = parseDays(days);
  var features = [];
  var taxSummary = taxFillSurvey.emptySurveySummary();
  var i;
  for (i = 0; i < FEATURE_DEFS.length; i++) {
    var def = FEATURE_DEFS[i];
    if (!def.wired) {
      features.push(emptyFeatureRow(def));
      continue;
    }
    if (def.id === 'purchase') {
      features.push(mapPurchase(def, await purchasePriceSurvey.summarizePurchasePriceSurvey(conn, nDays)));
    } else if (def.id === 'tax_fill') {
      taxSummary = await taxFillSurvey.summarizeTaxFillSurvey(conn, nDays);
      features.push(mapTaxFill(def, taxSummary));
    } else if (def.product) {
      features.push(mapCert(def, await certPageSurvey.summarizeCertPageSurvey(conn, def.product, nDays)));
    } else {
      features.push(emptyFeatureRow(def));
    }
  }
  return {
    period: {
      days: nDays,
      label: '最近 ' + nDays + ' 天',
      period_key: String(nDays)
    },
    note:
      '已接线：开通套餐、个税填写、离职/在职证明。疑虑芯片尚未落库，优化项作为 Top。社保 / 完税码 / 流水 / 公积金 C 端未接。',
    features: features,
    suggestions: recentSuggestions(taxSummary)
  };
}

async function handleAdminFeatureSurveyOverview(req, res) {
  try {
    var days = parseDays(req.query && req.query.days);
    var pool = getPool();
    var conn = await pool.getConnection();
    try {
      var data = await buildFeatureSurveyOverview(conn, days);
      return res.json({ code: 200, data: data });
    } finally {
      conn.release();
    }
  } catch (e) {
    console.error('[feature-survey] overview', e);
    return res.status(500).json({ code: 500, msg: String(e.message || e) });
  }
}

function getHandlers() {
  return {
    handleAdminFeatureSurveyOverview: handleAdminFeatureSurveyOverview
  };
}

module.exports = {
  getHandlers: getHandlers,
  FEATURE_DEFS: FEATURE_DEFS,
  parseDays: parseDays,
  pctRate: pctRate,
  topFromCounts: topFromCounts,
  emptyFeatureRow: emptyFeatureRow,
  mapPurchase: mapPurchase,
  mapTaxFill: mapTaxFill,
  mapCert: mapCert,
  recentSuggestions: recentSuggestions,
  buildFeatureSurveyOverview: buildFeatureSurveyOverview,
  TAX_IMPROVE_LABELS: TAX_IMPROVE_LABELS,
  CERT_IMPROVE_LABELS: CERT_IMPROVE_LABELS
};
