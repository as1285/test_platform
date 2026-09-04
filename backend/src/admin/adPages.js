/**
 * 广告页配置：微信号 / 三页开关与文案 / 海报，存 app_settings.ad_pages_json。
 */
'use strict';

const { getPool } = require('../shared/db');
const settingsPolicy = require('../shared/settingsPolicy');

var SETTING_KEY_AD_PAGES = 'ad_pages_json';
var DEFAULT_WECHAT_ID = 'Tangdong6832';
var LEDE_MAX = 800;
var REMARK_MAX = 40;
var POSTER_MAX = 500;
var CACHE_MS = 10000;
var _cache = null;
var _cacheAt = 0;

var DEFAULT_AD_PAGES = {
  wechat_id: DEFAULT_WECHAT_ID,
  refund: {
    enabled: true,
    lede:
      '先对照专项附加扣除：3 个子女每月 4500 元，赡养父母每月 3000 元。汇算清缴补报后，已经多缴的个税符合条件可以退回。复制微信号，备注「二次退税」咨询。',
    remark: '二次退税',
    poster_url: '/img/refund-ad.jpg'
  },
  gjj: {
    enabled: true,
    lede:
      '同一顾问也可问公积金：在职 / 离职 / 封存、大额 / 小额都可操作，不成功不收费，当天到账。复制微信号，备注「公积金提取」。',
    remark: '公积金提取',
    poster_url: '/img/gjj-extract-ad.jpg'
  },
  yuefu: {
    enabled: true,
    lede: '单笔最高 5 万，秒级到账，支持 3/6/12 期',
    remark: '月付大额',
    poster_url: ''
  }
};

var PAGE_KEYS = ['refund', 'gjj', 'yuefu'];

function cloneDefaults() {
  return {
    wechat_id: DEFAULT_AD_PAGES.wechat_id,
    refund: Object.assign({}, DEFAULT_AD_PAGES.refund),
    gjj: Object.assign({}, DEFAULT_AD_PAGES.gjj),
    yuefu: Object.assign({}, DEFAULT_AD_PAGES.yuefu)
  };
}

function clipText(raw, max) {
  var s = raw == null ? '' : String(raw).replace(/\r\n/g, '\n').trim();
  if (!s) return '';
  if (s.length > max) s = s.slice(0, max);
  return s;
}

function sanitizeWechatId(raw) {
  var s = raw == null ? '' : String(raw).trim();
  if (!/^[A-Za-z][A-Za-z0-9_-]{5,31}$/.test(s)) return DEFAULT_WECHAT_ID;
  return s;
}

function sanitizePosterUrl(raw, fallback) {
  var fb = fallback == null ? '' : String(fallback);
  var s = raw == null ? '' : String(raw).trim();
  if (!s) return fb;
  if (s.length > POSTER_MAX) return fb;
  if (/[\s<>"']/.test(s) || s.indexOf('..') >= 0) return fb;
  if (/^https:\/\//i.test(s)) {
    if (/^https:\/\/[^\s'"<>]+$/i.test(s)) return s;
    return fb;
  }
  if (/^\/?uploads\/[a-zA-Z0-9][a-zA-Z0-9_.\-\/]*$/.test(s)) {
    return s.charAt(0) === '/' ? s : '/' + s;
  }
  if (/^\/img\/[a-zA-Z0-9][a-zA-Z0-9_.\-\/]*$/.test(s)) return s;
  if (/^img\/[a-zA-Z0-9][a-zA-Z0-9_.\-\/]*$/.test(s)) return '/' + s;
  return fb;
}

function parseEnabled(raw, fallback) {
  if (raw === false || raw === 0 || raw === '0' || raw === 'false' || raw === 'off') return false;
  if (raw === true || raw === 1 || raw === '1' || raw === 'true' || raw === 'on') return true;
  return fallback !== false;
}

function normalizePage(src, defaults) {
  src = src && typeof src === 'object' ? src : {};
  var enabled = parseEnabled(src.enabled, defaults.enabled);
  return {
    enabled: enabled,
    lede: clipText(src.lede != null ? src.lede : defaults.lede, LEDE_MAX) || defaults.lede,
    remark: clipText(src.remark != null ? src.remark : defaults.remark, REMARK_MAX) || defaults.remark,
    poster_url: sanitizePosterUrl(src.poster_url, defaults.poster_url)
  };
}

function normalizeAdPagesConfig(raw) {
  var src = raw && typeof raw === 'object' ? raw : {};
  var out = cloneDefaults();
  out.wechat_id = sanitizeWechatId(src.wechat_id != null ? src.wechat_id : out.wechat_id);
  PAGE_KEYS.forEach(function (k) {
    out[k] = normalizePage(src[k], DEFAULT_AD_PAGES[k]);
  });
  return out;
}

function publicPagePayload(page) {
  return {
    lede: page.lede,
    remark: page.remark,
    poster_url: page.poster_url
  };
}

function toPublicAdPages(cfg) {
  cfg = normalizeAdPagesConfig(cfg);
  var out = { wechat_id: cfg.wechat_id };
  PAGE_KEYS.forEach(function (k) {
    if (cfg[k] && cfg[k].enabled) out[k] = publicPagePayload(cfg[k]);
  });
  return out;
}

function invalidateAdPagesCache() {
  _cache = null;
  _cacheAt = 0;
}

async function loadAdPagesParsed() {
  var now = Date.now();
  if (_cache && now - _cacheAt < CACHE_MS) return _cache;
  var out = cloneDefaults();
  try {
    var pool = getPool();
    const [rows] = await pool.execute(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      [SETTING_KEY_AD_PAGES]
    );
    if (rows.length && rows[0].setting_value) {
      out = normalizeAdPagesConfig(JSON.parse(String(rows[0].setting_value)));
    }
  } catch (e) {
    out = cloneDefaults();
  }
  _cache = out;
  _cacheAt = now;
  return out;
}

async function saveAdPagesConfig(cfg) {
  var next = normalizeAdPagesConfig(cfg);
  var classified = settingsPolicy.classifySettingKey(SETTING_KEY_AD_PAGES);
  if (classified.forbidden) {
    var err = new Error('禁止写入配置键');
    err.statusCode = 400;
    throw err;
  }
  var pool = getPool();
  await pool.execute(
    `INSERT INTO app_settings (setting_key, setting_value)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP`,
    [SETTING_KEY_AD_PAGES, JSON.stringify(next)]
  );
  _cache = next;
  _cacheAt = Date.now();
  return next;
}

async function handleAdminAdPagesGet(req, res) {
  try {
    var cfg = await loadAdPagesParsed();
    return res.json({ code: 200, data: cfg });
  } catch (e) {
    console.error('[admin ad-pages get]', e);
    return res.status(500).json({ code: 500, msg: String(e.message || '加载广告页配置失败') });
  }
}

async function handleAdminAdPagesPost(req, res) {
  try {
    var next = await saveAdPagesConfig(req.body || {});
    return res.json({ code: 200, data: next });
  } catch (e) {
    if (e && e.statusCode === 400) {
      return res.status(400).json({ code: 400, msg: String(e.message) });
    }
    console.error('[admin ad-pages post]', e);
    return res.status(500).json({ code: 500, msg: String(e.message || '保存广告页配置失败') });
  }
}

async function handlePublicAdPages(req, res) {
  try {
    var cfg = await loadAdPagesParsed();
    return res.json({ code: 200, data: toPublicAdPages(cfg) });
  } catch (e) {
    console.error('[public ad-pages]', e);
    return res.status(500).json({ code: 500, msg: String(e.message || '加载广告页配置失败') });
  }
}

function getHandlers() {
  return {
    handleAdminAdPagesGet: handleAdminAdPagesGet,
    handleAdminAdPagesPost: handleAdminAdPagesPost,
    handlePublicAdPages: handlePublicAdPages
  };
}

module.exports = {
  getHandlers: getHandlers,
  SETTING_KEY_AD_PAGES: SETTING_KEY_AD_PAGES,
  DEFAULT_WECHAT_ID: DEFAULT_WECHAT_ID,
  DEFAULT_AD_PAGES: DEFAULT_AD_PAGES,
  sanitizeWechatId: sanitizeWechatId,
  sanitizePosterUrl: sanitizePosterUrl,
  normalizeAdPagesConfig: normalizeAdPagesConfig,
  toPublicAdPages: toPublicAdPages,
  invalidateAdPagesCache: invalidateAdPagesCache
};
