/**
 * 支付页定价：可配置目录（周卡 / 双周卡 / 月卡）。
 * 价格、时长、是否上架以后台「支付套餐」为准。
 * 历史 A/B/C 分流与 sticky 仍可读，新解析一律走 B（treatment）。
 * 小时卡 / 天卡 / 3天卡 / 永久档已下架，仅历史订单 / 已有专属价可解析。
 */
'use strict';

var SETTING_KEY_PRICING_AB = 'pricing_ab_json';
var SETTING_KEY_SKU_PRICES = 'sku_catalog_prices_json';
var SETTING_KEY_LANDING_AB = 'landing_ab_json';

/** 旧档：小时卡已下架，仅历史订单 / 已有专属价解析 */
var SKU_99_HOUR = {
  id: 'sku_99_1h',
  amount: '99.00',
  label: '小时卡',
  subject: '激活码·小时卡',
  grant_kind: 'trial',
  grant_hours: 1,
  grant_days: 0,
  grant_minutes: 0
};

/** 旧档：天卡已下架，仅历史订单 / 已有专属价解析 */
var SKU_249_DAY = {
  id: 'sku_249_1d',
  amount: '249.00',
  label: '天卡',
  subject: '激活码·天卡',
  grant_kind: 'trial',
  grant_hours: 0,
  grant_days: 1,
  grant_minutes: 0
};

/** 旧档：3天卡已下架，仅历史订单 / 已有专属价解析 */
var SKU_268_3DAY = {
  id: 'sku_268_3d',
  amount: '268.00',
  label: '3天卡',
  subject: '激活码·3天卡',
  grant_kind: 'trial',
  grant_hours: 0,
  grant_days: 3,
  grant_minutes: 0
};

/** 现售周卡：300 */
var SKU_300_WEEK = {
  id: 'sku_300_7d',
  amount: '300.00',
  label: '周卡',
  subject: '激活码·周卡',
  grant_kind: 'trial',
  grant_hours: 0,
  grant_days: 7,
  grant_minutes: 0
};

/** 现售双周卡：348 */
var SKU_348_2WEEK = {
  id: 'sku_348_14d',
  amount: '348.00',
  label: '双周卡',
  subject: '激活码·双周卡',
  grant_kind: 'trial',
  grant_hours: 0,
  grant_days: 14,
  grant_minutes: 0
};

/** 现售月卡：398 */
var SKU_398_MONTH = {
  id: 'sku_398_30d',
  amount: '398.00',
  label: '月卡',
  subject: '激活码·月卡',
  grant_kind: 'trial',
  grant_hours: 0,
  grant_days: 30,
  grant_minutes: 0
};

/** 旧档：永久 999 已下架，仅历史订单 / 已有专属价解析 */
var SKU_999_PERM = {
  id: 'sku_999_perm',
  amount: '999.00',
  label: '永久',
  subject: '激活码·永久',
  grant_kind: 'permanent',
  grant_hours: 0,
  grant_days: 0,
  grant_minutes: 0
};

/** 旧档：298 日卡 / 398 永久，仅历史订单 / 专属价解析 */
var SKU_298_DAY = {
  id: 'sku_298_1d',
  amount: '298.00',
  label: '日卡',
  subject: '激活码·日卡',
  grant_kind: 'trial',
  grant_hours: 0,
  grant_days: 1,
  grant_minutes: 0
};
var SKU_398_PERM = {
  id: 'sku_398_forever',
  amount: '398.00',
  label: '永久',
  subject: '激活码·永久',
  grant_kind: 'permanent',
  grant_hours: 0,
  grant_days: 0,
  grant_minutes: 0
};

/** 旧档：498 永久，仅历史订单 / 专属价解析 */
var SKU_CONTROL_600_PERM = {
  id: 'sku_600_perm',
  amount: '498.00',
  label: '永久',
  subject: '激活码·永久',
  grant_kind: 'permanent',
  grant_hours: 0,
  grant_days: 0,
  grant_minutes: 0
};

/** 兼容旧变量名 / 旧订单 id 查询 */
var SKU_CONTROL_320_WEEK = SKU_CONTROL_600_PERM;
var SKU_CONTROL_199_PERM = SKU_CONTROL_600_PERM;

/** 旧档：小时体验，仅历史订单 / 专属价解析 */
var SKU_199_HOUR = {
  id: 'sku_199_1h',
  amount: '199.00',
  label: '小时体验卡',
  subject: '激活码·小时体验',
  grant_kind: 'trial',
  grant_hours: 1,
  grant_days: 0,
  grant_minutes: 0
};

var SKU_268_DAY = {
  id: 'sku_268_1d',
  amount: '268.00',
  label: '日卡',
  subject: '激活码·日卡',
  grant_kind: 'trial',
  grant_hours: 0,
  grant_days: 1,
  grant_minutes: 0
};

var SKU_328_WEEK = {
  id: 'sku_328_7d',
  amount: '320.00',
  label: '周卡',
  subject: '激活码·周卡',
  grant_kind: 'trial',
  grant_hours: 0,
  grant_days: 7,
  grant_minutes: 0
};

var SKU_600_PERM = {
  id: 'sku_600_perm',
  amount: '498.00',
  label: '永久',
  subject: '激活码·永久',
  grant_kind: 'permanent',
  grant_hours: 0,
  grant_days: 0,
  grant_minutes: 0
};

/** 旧档：仅用于历史订单 sku_id 解析，不再出现在默认售卖列表 */
var SKU_398_WEEK = {
  id: 'sku_398_7d',
  amount: '398.00',
  label: '周卡',
  subject: '激活码·周卡',
  grant_kind: 'trial',
  grant_hours: 0,
  grant_days: 7,
  grant_minutes: 0
};
var SKU_498_MONTH = {
  id: 'sku_498_30d',
  amount: '498.00',
  label: '月卡',
  subject: '激活码·月卡',
  grant_kind: 'trial',
  grant_hours: 0,
  grant_days: 30,
  grant_minutes: 0
};
var SKU_698_YEAR = {
  id: 'sku_698_365d',
  amount: '698.00',
  label: '年卡',
  subject: '激活码·年卡',
  grant_kind: 'trial',
  grant_hours: 0,
  grant_days: 365,
  grant_minutes: 0
};
var SKU_998_PERM = {
  id: 'sku_998_perm',
  amount: '998.00',
  label: '永久',
  subject: '激活码·永久',
  grant_kind: 'permanent',
  grant_hours: 0,
  grant_days: 0,
  grant_minutes: 0
};
var SKU_398_PERM_LEGACY = {
  id: 'sku_398_perm',
  amount: '600.00',
  label: '永久',
  subject: '激活码·永久',
  grant_kind: 'permanent',
  grant_hours: 0,
  grant_days: 0,
  grant_minutes: 0
};

var LEGACY_CATALOG_SKUS = [
  SKU_99_HOUR,
  SKU_249_DAY,
  SKU_268_3DAY,
  SKU_999_PERM,
  SKU_298_DAY,
  SKU_398_PERM,
  SKU_398_WEEK,
  SKU_498_MONTH,
  SKU_698_YEAR,
  SKU_998_PERM,
  SKU_398_PERM_LEGACY
];

var CONFIGURABLE_CATALOG_SKUS = [
  SKU_300_WEEK,
  SKU_348_2WEEK,
  SKU_398_MONTH
];
var CONFIGURABLE_SKU_IDS = CONFIGURABLE_CATALOG_SKUS.map(function (s) {
  return s.id;
});
var LIVE_CATALOG_SKUS = CONFIGURABLE_CATALOG_SKUS.slice();
var LIVE_SKU_IDS = LIVE_CATALOG_SKUS.map(function (s) {
  return s.id;
});

function skuByConfigurableId(id) {
  var i;
  for (i = 0; i < CONFIGURABLE_CATALOG_SKUS.length; i++) {
    if (CONFIGURABLE_CATALOG_SKUS[i].id === id) return CONFIGURABLE_CATALOG_SKUS[i];
  }
  return null;
}

function defaultCatalogEnabled(id) {
  return CONFIGURABLE_SKU_IDS.indexOf(String(id || '')) >= 0;
}

function defaultCatalogConfig() {
  var map = {};
  var i;
  for (i = 0; i < CONFIGURABLE_CATALOG_SKUS.length; i++) {
    var s = CONFIGURABLE_CATALOG_SKUS[i];
    map[s.id] = {
      amount: String(s.amount),
      grant_days: parseInt(s.grant_days, 10) || 0,
      grant_hours: parseInt(s.grant_hours, 10) || 0,
      grant_minutes: parseInt(s.grant_minutes, 10) || 0,
      enabled: defaultCatalogEnabled(s.id)
    };
  }
  return map;
}

function defaultCatalogAmounts() {
  var cfg = defaultCatalogConfig();
  return catalogAmountsFromConfig(cfg);
}

function catalogAmountsFromConfig(cfg) {
  var map = {};
  var i;
  for (i = 0; i < CONFIGURABLE_SKU_IDS.length; i++) {
    var id = CONFIGURABLE_SKU_IDS[i];
    if (cfg && cfg[id] && cfg[id].amount) map[id] = String(cfg[id].amount);
  }
  return map;
}

function normalizeCatalogAmount(raw) {
  var s = String(raw == null ? '' : raw).replace(/,/g, '').replace(/，/g, '').trim();
  if (!s) return '';
  var n = Number(s);
  if (!isFinite(n) || n < 0.01 || n > 99999.99) return '';
  return n.toFixed(2);
}

function normalizeGrantInt(raw, min, max) {
  if (raw == null || String(raw).trim() === '') return null;
  var n = parseInt(raw, 10);
  if (!isFinite(n) || n < min || n > max) return null;
  return n;
}

function catalogEntryHasGrant(entry) {
  if (!entry) return false;
  return (
    (parseInt(entry.grant_days, 10) || 0) +
      (parseInt(entry.grant_hours, 10) || 0) +
      (parseInt(entry.grant_minutes, 10) || 0) >
    0
  );
}

function normalizeCatalogEntry(raw, fallback) {
  var fb = fallback || {};
  var obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
  var amountRaw = obj ? obj.amount : raw;
  var amount = normalizeCatalogAmount(amountRaw) || String(fb.amount || '');
  var days = obj && obj.grant_days != null ? normalizeGrantInt(obj.grant_days, 0, 365) : null;
  var hours = obj && obj.grant_hours != null ? normalizeGrantInt(obj.grant_hours, 0, 720) : null;
  var minutes = obj && obj.grant_minutes != null ? normalizeGrantInt(obj.grant_minutes, 0, 59) : null;
  var enabled = fb.enabled !== false;
  if (obj && obj.enabled != null) {
    enabled = !(obj.enabled === false || obj.enabled === 0 || obj.enabled === '0');
  }
  return {
    amount: amount,
    grant_days: days != null ? days : parseInt(fb.grant_days, 10) || 0,
    grant_hours: hours != null ? hours : parseInt(fb.grant_hours, 10) || 0,
    grant_minutes: minutes != null ? minutes : parseInt(fb.grant_minutes, 10) || 0,
    enabled: enabled
  };
}

function normalizeCatalogConfig(raw) {
  var defaults = defaultCatalogConfig();
  var out = {};
  var i;
  for (i = 0; i < CONFIGURABLE_SKU_IDS.length; i++) {
    var id = CONFIGURABLE_SKU_IDS[i];
    var fb = Object.assign({}, defaults[id]);
    var src = raw && typeof raw === 'object' ? raw[id] : null;
    out[id] = normalizeCatalogEntry(src, fb);
  }
  return out;
}

function normalizeCatalogAmounts(raw) {
  return catalogAmountsFromConfig(normalizeCatalogConfig(raw));
}

var DEFAULT_PRICING_AB = {
  enabled: true,
  a_percent: 0,
  b_percent: 100,
  c_percent: 0,
  treatment_percent: 100,
  control_skus: LIVE_CATALOG_SKUS.slice(),
  treatment_skus: LIVE_CATALOG_SKUS.slice()
};

function cloneSku(s) {
  return {
    id: String(s.id || ''),
    amount: String(s.amount || ''),
    label: String(s.label || ''),
    subject: String(s.subject || ''),
    grant_kind: s.grant_kind === 'permanent' ? 'permanent' : 'trial',
    grant_hours: parseInt(s.grant_hours, 10) || 0,
    grant_days: parseInt(s.grant_days, 10) || 0,
    grant_minutes: parseInt(s.grant_minutes, 10) || 0
  };
}

function applyCatalogEntryToSku(sku, entry) {
  var c = cloneSku(sku);
  if (!entry) return c;
  if (entry.amount) c.amount = String(entry.amount);
  if (entry.grant_days != null) c.grant_days = parseInt(entry.grant_days, 10) || 0;
  if (entry.grant_hours != null) c.grant_hours = parseInt(entry.grant_hours, 10) || 0;
  if (entry.grant_minutes != null) c.grant_minutes = parseInt(entry.grant_minutes, 10) || 0;
  return c;
}

function cloneLiveCatalog(catalogOrAmounts) {
  var cfg = normalizeCatalogConfig(catalogOrAmounts);
  return CONFIGURABLE_CATALOG_SKUS.map(function (s) {
    var entry = cfg[s.id];
    if (!entry || entry.enabled === false) return null;
    return applyCatalogEntryToSku(s, entry);
  }).filter(Boolean);
}

function listConfigurableCatalog(catalogOrAmounts) {
  var cfg = normalizeCatalogConfig(catalogOrAmounts);
  return CONFIGURABLE_CATALOG_SKUS.map(function (s) {
    var entry = cfg[s.id] || {};
    var sku = applyCatalogEntryToSku(s, entry);
    sku.enabled = entry.enabled !== false;
    return sku;
  });
}

/** UTF-8 中文被当成 Latin-1 再存回时会出现 æ/å/Ã 等乱码 */
function looksMojibakeText(s) {
  var t = String(s || '');
  if (!t) return false;
  if (/[\u4e00-\u9fff]/.test(t)) return false;
  return /[æåøÃÂäé]/.test(t);
}

function defaultSkuById(id) {
  // 含旧档：DB/历史配置里仍可能残留 sku_199_1h 等，乱码修复需能命中
  var all = []
    .concat(DEFAULT_PRICING_AB.control_skus || [])
    .concat(DEFAULT_PRICING_AB.treatment_skus || [])
    .concat([SKU_99_HOUR, SKU_199_HOUR, SKU_249_DAY, SKU_268_3DAY, SKU_268_DAY, SKU_328_WEEK, SKU_398_MONTH, SKU_600_PERM])
    .concat(LEGACY_CATALOG_SKUS || []);
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === id) return cloneSku(all[i]);
  }
  return null;
}

function normalizeSkuList(list, fallback) {
  if (!Array.isArray(list) || !list.length) {
    return (fallback || []).map(cloneSku);
  }
  return list
    .map(function (raw) {
      var s = cloneSku(raw);
      if (!s.id || !s.amount) return null;
      if (looksMojibakeText(s.label) || looksMojibakeText(s.subject)) {
        var def = defaultSkuById(s.id);
        if (def) {
          if (looksMojibakeText(s.label)) s.label = def.label;
          if (looksMojibakeText(s.subject)) s.subject = def.subject;
        }
      }
      return s;
    })
    .filter(Boolean);
}

function clampPct(v, fallback) {
  var p = parseInt(v, 10);
  if (!isFinite(p)) p = fallback;
  if (p < 0) p = 0;
  if (p > 100) p = 100;
  return p;
}

function hashBucket(seed) {
  var s = 'purchase_abc|' + String(seed || 'guest');
  var h = 0;
  var i;
  for (i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 100;
}

/** 三档分桶：a / b / c */
function resolvePurchaseAbcVariant(seed, aPercent, bPercent, cPercent) {
  var a = clampPct(aPercent, 0);
  var b = clampPct(bPercent, 0);
  var c = clampPct(cPercent, 0);
  var sum = a + b + c;
  if (sum !== 100) {
    if (sum <= 0) {
      a = 100;
      b = 0;
      c = 0;
    } else {
      a = Math.round((a * 100) / sum);
      b = Math.round((b * 100) / sum);
      c = 100 - a - b;
      if (c < 0) {
        b = Math.max(0, b + c);
        c = 0;
      }
    }
  }
  var bucket = hashBucket(seed);
  if (bucket < a) return 'a';
  if (bucket < a + b) return 'b';
  return 'c';
}

/** 兼容旧二档 API：treatment_percent → treatment|control */
function resolvePricingAbVariant(seed, treatmentPercent) {
  var abc = resolvePurchaseAbcVariant(seed, 100 - clampPct(treatmentPercent, 50), clampPct(treatmentPercent, 50), 0);
  return abc === 'b' ? 'treatment' : 'control';
}

function abcToOfferVariant(abc) {
  if (abc === 'b') return 'treatment';
  return 'control';
}

function offerVariantToAbc(v) {
  var s = String(v || '').toLowerCase();
  if (s === 'treatment' || s === 'b') return 'b';
  if (s === 'c') return 'c';
  if (s === 'a' || s === 'control') return 'a';
  return '';
}

function normalizeAbcPercents(raw, landingCPercent) {
  var hasAbc =
    raw &&
    (raw.a_percent != null || raw.b_percent != null || raw.c_percent != null);
  var a;
  var b;
  var c;
  if (hasAbc) {
    a = clampPct(raw.a_percent, 0);
    b = clampPct(raw.b_percent, 0);
    c = clampPct(raw.c_percent, 0);
  } else {
    b = clampPct(raw && raw.treatment_percent != null ? raw.treatment_percent : 50, 50);
    c = clampPct(landingCPercent != null ? landingCPercent : 0, 0);
    if (b + c > 100) {
      c = Math.max(0, 100 - b);
    }
    a = 100 - b - c;
  }
  var sum = a + b + c;
  if (sum !== 100) {
    if (sum <= 0) {
      a = 100;
      b = 0;
      c = 0;
    } else {
      a = Math.round((a * 100) / sum);
      b = Math.round((b * 100) / sum);
      c = 100 - a - b;
      if (c < 0) {
        b = Math.max(0, b + c);
        c = 0;
        a = 100 - b - c;
      }
    }
  }
  c = 0;
  if (a + b === 0) {
    a = 100;
    b = 0;
  } else if (a + b !== 100) {
    var rest = 100 - a;
    b = rest;
  }
  return {
    a_percent: a,
    b_percent: b,
    c_percent: c,
    treatment_percent: b
  };
}

function grantDurationMs(sku) {
  if (!sku || sku.grant_kind === 'permanent') return Infinity;
  var days = parseInt(sku.grant_days, 10) || 0;
  var hours = parseInt(sku.grant_hours, 10) || 0;
  var minutes = parseInt(sku.grant_minutes, 10) || 0;
  return days * 86400000 + hours * 3600000 + minutes * 60000;
}

function findSkuById(cfg, skuId) {
  var id = String(skuId || '');
  /* 旧订单 SKU id → 新档 */
  var legacyMap = {
    sku_199_perm_legacy: 'sku_600_perm',
    sku_499_perm: 'sku_398_30d',
    sku_199_1y: 'sku_398_30d'
  };
  if (legacyMap[id]) id = legacyMap[id];
  var lists = [
    cfg.control_skus || [],
    cfg.treatment_skus || [],
    [SKU_99_HOUR, SKU_249_DAY, SKU_268_3DAY, SKU_300_WEEK, SKU_348_2WEEK, SKU_398_MONTH, SKU_999_PERM, SKU_298_DAY, SKU_398_PERM, SKU_268_DAY, SKU_199_HOUR, SKU_328_WEEK, SKU_600_PERM].concat(
      LEGACY_CATALOG_SKUS
    )
  ];
  var i;
  var j;
  for (i = 0; i < lists.length; i++) {
    for (j = 0; j < lists[i].length; j++) {
      if (lists[i][j].id === id) return lists[i][j];
    }
  }
  return null;
}

/**
 * 覆盖为更长档：新权益不短于当前剩余则覆盖；永久覆盖一切。
 */
function resolveCoverLongerGrant(userRow, sku) {
  var now = Date.now();
  if (!sku) {
    return { kind: 'none', active_until: null, applied: false, reason: 'no_sku' };
  }
  if (sku.grant_kind === 'permanent') {
    return { kind: 'permanent', active_until: null, applied: true, reason: 'permanent' };
  }
  var newMs = grantDurationMs(sku);
  if (!isFinite(newMs) || newMs < 1) {
    return { kind: 'none', active_until: null, applied: false, reason: 'bad_duration' };
  }
  var newUntil = new Date(now + newMs);
  var kind = userRow && userRow.activation_kind != null ? String(userRow.activation_kind) : '';
  if (kind === 'permanent') {
    return { kind: 'permanent', active_until: null, applied: false, reason: 'already_permanent' };
  }
  if (kind === 'trial' && userRow && userRow.active_until) {
    var prev = new Date(userRow.active_until).getTime();
    if (isFinite(prev) && prev > newUntil.getTime()) {
      return {
        kind: 'trial',
        active_until: userRow.active_until,
        applied: false,
        reason: 'keep_longer_existing'
      };
    }
  }
  return { kind: 'trial', active_until: newUntil, applied: true, reason: 'cover' };
}

function createPricingAb(deps) {
  var pool = deps.pool;
  var upsertAppSetting = deps.upsertAppSetting;
  var alipayNormalizeAmount = deps.alipayNormalizeAmount;
  var _cache = null;
  var _cacheAt = 0;
  var _priceCache = null;
  var _priceCacheAt = 0;
  var _catalogCache = null;
  var _catalogCacheAt = 0;
  var _tableReady = false;

  async function ensureAssignmentsTable(conn) {
    if (_tableReady) return;
    await conn.execute(
      `CREATE TABLE IF NOT EXISTS pricing_ab_assignments (
        username VARCHAR(64) NOT NULL,
        variant VARCHAR(8) NOT NULL,
        source VARCHAR(32) NULL,
        assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
    );
    _tableReady = true;
  }

  async function loadLandingCPercentHint(conn) {
    try {
      const [rows] = await conn.execute(
        'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
        [SETTING_KEY_LANDING_AB]
      );
      if (!rows.length || !rows[0].setting_value) return 0;
      var parsed = JSON.parse(String(rows[0].setting_value));
      if (!parsed || typeof parsed !== 'object') return 0;
      if (parsed.enabled === false) return 0;
      return clampPct(parsed.c_percent, 0);
    } catch (e) {
      return 0;
    }
  }

  async function loadCatalogConfig(force) {
    var now = Date.now();
    if (!force && _catalogCache && now - _catalogCacheAt < 10000) return _catalogCache;
    var out = defaultCatalogConfig();
    if (!pool) {
      _catalogCache = out;
      _catalogCacheAt = now;
      _priceCache = catalogAmountsFromConfig(out);
      _priceCacheAt = now;
      return out;
    }
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
        [SETTING_KEY_SKU_PRICES]
      );
      if (rows.length && rows[0].setting_value) {
        out = normalizeCatalogConfig(JSON.parse(String(rows[0].setting_value)));
      }
    } catch (e) {
      /* keep defaults */
    } finally {
      conn.release();
    }
    _catalogCache = out;
    _catalogCacheAt = now;
    _priceCache = catalogAmountsFromConfig(out);
    _priceCacheAt = now;
    return out;
  }

  async function loadCatalogAmounts(force) {
    var cfg = await loadCatalogConfig(force);
    return catalogAmountsFromConfig(cfg);
  }

  async function saveCatalogAmountsFromAdmin(body) {
    var incoming = body && typeof body === 'object' ? body : {};
    var current = await loadCatalogConfig(true);
    var merged = {};
    var i;
    for (i = 0; i < CONFIGURABLE_SKU_IDS.length; i++) {
      var id = CONFIGURABLE_SKU_IDS[i];
      var cur = current[id] || defaultCatalogConfig()[id];
      var inc = incoming[id];
      if (inc && typeof inc === 'object' && !Array.isArray(inc)) {
        merged[id] = Object.assign({}, cur, inc);
      } else if (inc != null && String(inc).trim() !== '') {
        merged[id] = Object.assign({}, cur, { amount: inc });
      } else {
        merged[id] = cur;
      }
    }
    var next = normalizeCatalogConfig(merged);
    var missing = CONFIGURABLE_SKU_IDS.filter(function (id) {
      return !normalizeCatalogAmount(next[id] && next[id].amount);
    });
    if (missing.length) {
      var err = new Error('套餐价格无效，请填写 0.01～99999.99');
      err.statusCode = 400;
      throw err;
    }
    var badGrant = CONFIGURABLE_SKU_IDS.filter(function (id) {
      return !catalogEntryHasGrant(next[id]);
    });
    if (badGrant.length) {
      var errGrant = new Error('套餐时长无效，请至少填写天数或小时（天数 0–365，小时 0–720）');
      errGrant.statusCode = 400;
      throw errGrant;
    }
    var enabledCount = CONFIGURABLE_SKU_IDS.filter(function (id) {
      return next[id] && next[id].enabled !== false;
    }).length;
    if (!enabledCount) {
      var errOff = new Error('请至少上架一个套餐');
      errOff.statusCode = 400;
      throw errOff;
    }
    if (!pool || typeof upsertAppSetting !== 'function') {
      var err2 = new Error('无法保存套餐');
      err2.statusCode = 500;
      throw err2;
    }
    const conn = await pool.getConnection();
    try {
      await upsertAppSetting(conn, SETTING_KEY_SKU_PRICES, JSON.stringify(next));
    } finally {
      conn.release();
    }
    _catalogCache = next;
    _catalogCacheAt = Date.now();
    _priceCache = catalogAmountsFromConfig(next);
    _priceCacheAt = Date.now();
    invalidateCache();
    return next;
  }

  async function loadPricingAbParsed(force) {
    var now = Date.now();
    if (!force && _cache && now - _cacheAt < 10000) return _cache;
    var catalog = await loadCatalogConfig(force);
    var amounts = catalogAmountsFromConfig(catalog);
    var live = cloneLiveCatalog(catalog);
    var out = {
      enabled: DEFAULT_PRICING_AB.enabled,
      a_percent: DEFAULT_PRICING_AB.a_percent,
      b_percent: DEFAULT_PRICING_AB.b_percent,
      c_percent: DEFAULT_PRICING_AB.c_percent,
      treatment_percent: DEFAULT_PRICING_AB.treatment_percent,
      control_skus: live.map(cloneSku),
      treatment_skus: live.map(cloneSku),
      catalog_amounts: amounts,
      sku_catalog: catalog
    };
    if (!pool) {
      _cache = out;
      _cacheAt = now;
      return out;
    }
    const conn = await pool.getConnection();
    try {
      const [rows] = await conn.execute(
        'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
        [SETTING_KEY_PRICING_AB]
      );
      if (rows.length && rows[0].setting_value) {
        var parsed = JSON.parse(String(rows[0].setting_value));
        if (parsed && typeof parsed === 'object') {
          out.enabled = true;
          out.a_percent = 0;
          out.b_percent = 100;
          out.c_percent = 0;
          out.treatment_percent = 100;
          /* 售卖目录与金额、时长以后台「支付套餐」为准 */
          out.control_skus = cloneLiveCatalog(catalog);
          out.treatment_skus = cloneLiveCatalog(catalog);
          out.catalog_amounts = amounts;
          out.sku_catalog = catalog;
        }
      }
    } catch (e) {
      /* keep defaults */
    } finally {
      conn.release();
    }
    _cache = out;
    _cacheAt = now;
    return out;
  }

  function invalidateCache() {
    _cache = null;
    _cacheAt = 0;
  }

  async function savePricingAbFromAdmin() {
    var catalog = await loadCatalogConfig(true);
    var amounts = catalogAmountsFromConfig(catalog);
    var next = {
      enabled: true,
      a_percent: 0,
      b_percent: 100,
      c_percent: 0,
      treatment_percent: 100,
      control_skus: cloneLiveCatalog(catalog),
      treatment_skus: cloneLiveCatalog(catalog),
      catalog_amounts: amounts,
      sku_catalog: catalog
    };
    const conn = await pool.getConnection();
    try {
      await upsertAppSetting(conn, SETTING_KEY_PRICING_AB, JSON.stringify(next));
    } finally {
      conn.release();
    }
    invalidateCache();
    return loadPricingAbParsed(true);
  }

  async function getStickyAssignment(username) {
    var u = String(username || '').trim();
    if (!u || u === 'guest' || !pool) return null;
    const conn = await pool.getConnection();
    try {
      await ensureAssignmentsTable(conn);
      const [rows] = await conn.execute(
        'SELECT variant, source, assigned_at FROM pricing_ab_assignments WHERE username = ? LIMIT 1',
        [u]
      );
      if (!rows.length) return null;
      var v = normalizeAbcToken(rows[0].variant);
      if (!v) return null;
      return {
        variant: v,
        source: String(rows[0].source || '').substring(0, 32),
        assigned_at: rows[0].assigned_at || null
      };
    } catch (e) {
      return null;
    } finally {
      conn.release();
    }
  }

  async function getStickyAbc(username) {
    var row = await getStickyAssignment(username);
    return row ? row.variant : null;
  }

  function normalizeAbcToken(raw) {
    var s = String(raw == null ? '' : raw).trim();
    try {
      if (typeof s.normalize === 'function') s = s.normalize('NFKC');
    } catch (eNfkc) {}
    s = s.toLowerCase();
    if (s === 'a' || s === 'control') return 'a';
    if (s === 'b' || s === 'treatment') return 'b';
    if (s === 'c') return 'c';
    return '';
  }

  async function setStickyAbc(username, abc, source, force) {
    var u = String(username || '').trim();
    var v = normalizeAbcToken(abc);
    if (!u || u === 'guest' || !v || !pool) return null;
    const conn = await pool.getConnection();
    try {
      await ensureAssignmentsTable(conn);
      if (force) {
        await conn.execute(
          `INSERT INTO pricing_ab_assignments (username, variant, source, assigned_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON DUPLICATE KEY UPDATE
             variant = VALUES(variant),
             source = VALUES(source),
             assigned_at = CURRENT_TIMESTAMP`,
          [u, v, String(source || 'allocation').substring(0, 32)]
        );
      } else {
        await conn.execute(
          `INSERT INTO pricing_ab_assignments (username, variant, source)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE username = username`,
          [u, v, String(source || 'allocation').substring(0, 32)]
        );
      }
      return v;
    } catch (e) {
      console.error('setStickyAbc', e);
      return null;
    } finally {
      conn.release();
    }
  }

  /** 管理端指定账号方案：强制覆盖，优先于代理渠道锁定 */
  async function assignAbcForAdmin(username, abc) {
    var u = String(username || '').trim();
    var v = normalizeAbcToken(abc);
    if (!u || u === 'guest') {
      var err = new Error('请填写有效账号');
      err.statusCode = 400;
      throw err;
    }
    if (!v) {
      var err2 = new Error('方案须为 a / b / c（大小写均可）');
      err2.statusCode = 400;
      throw err2;
    }
    var ok = await setStickyAbc(u, v, 'admin_force', true);
    if (!ok) {
      var err3 = new Error('分配失败');
      err3.statusCode = 500;
      throw err3;
    }
    return getStickyAssignment(u);
  }

  async function resolveOfferForUser(username) {
    var cfg = await loadPricingAbParsed();
    var seed = String(username || '').trim() || 'guest';
    var skus =
      cfg.treatment_skus && cfg.treatment_skus.length
        ? cfg.treatment_skus.map(cloneSku)
        : cloneLiveCatalog(cfg.sku_catalog || cfg.catalog_amounts);
    if (seed !== 'guest') {
      await setStickyAbc(seed, 'b', 'single_plan', true);
    }
    return {
      enabled: true,
      variant: 'treatment',
      abc_variant: 'b',
      abc_source: 'single_plan',
      skus: skus,
      pricing_ab_enabled: false,
      forced_by_channel: false,
      force_client_abc: true
    };
  }

  function pickSkuFromOffer(offer, skuId) {
    if (!offer || !offer.skus || !offer.skus.length) return null;
    if (skuId) {
      var i;
      for (i = 0; i < offer.skus.length; i++) {
        if (offer.skus[i].id === String(skuId)) return offer.skus[i];
      }
    }
    if (offer.skus.length === 1) return offer.skus[0];
    return null;
  }

  /** 公开配置：全站只走一套支付页，客户端不再分流 */
  async function publicAbcConfig() {
    return {
      enabled: true,
      a_percent: 0,
      b_percent: 100,
      c_percent: 0,
      b_landing_percent: 100,
      experiment: 'purchase_abc_v1',
      delegated: true
    };
  }

  return {
    SETTING_KEY_PRICING_AB: SETTING_KEY_PRICING_AB,
    DEFAULT_PRICING_AB: DEFAULT_PRICING_AB,
    loadPricingAbParsed: loadPricingAbParsed,
    savePricingAbFromAdmin: savePricingAbFromAdmin,
    loadCatalogAmounts: loadCatalogAmounts,
    loadCatalogConfig: loadCatalogConfig,
    saveCatalogAmountsFromAdmin: saveCatalogAmountsFromAdmin,
    invalidateCache: invalidateCache,
    resolveOfferForUser: resolveOfferForUser,
    pickSkuFromOffer: pickSkuFromOffer,
    findSkuById: findSkuById,
    resolveCoverLongerGrant: resolveCoverLongerGrant,
    grantDurationMs: grantDurationMs,
    resolvePricingAbVariant: resolvePricingAbVariant,
    resolvePurchaseAbcVariant: resolvePurchaseAbcVariant,
    abcToOfferVariant: abcToOfferVariant,
    offerVariantToAbc: offerVariantToAbc,
    getStickyAbc: getStickyAbc,
    getStickyAssignment: getStickyAssignment,
    setStickyAbc: setStickyAbc,
    assignAbcForAdmin: assignAbcForAdmin,
    publicAbcConfig: publicAbcConfig
  };
}

module.exports = {
  createPricingAb: createPricingAb,
  SETTING_KEY_PRICING_AB: SETTING_KEY_PRICING_AB,
  SETTING_KEY_SKU_PRICES: SETTING_KEY_SKU_PRICES,
  LIVE_SKU_IDS: LIVE_SKU_IDS,
  CONFIGURABLE_SKU_IDS: CONFIGURABLE_SKU_IDS,
  defaultCatalogAmounts: defaultCatalogAmounts,
  defaultCatalogConfig: defaultCatalogConfig,
  normalizeCatalogAmounts: normalizeCatalogAmounts,
  normalizeCatalogConfig: normalizeCatalogConfig,
  catalogAmountsFromConfig: catalogAmountsFromConfig,
  DEFAULT_PRICING_AB: DEFAULT_PRICING_AB,
  resolveCoverLongerGrant: resolveCoverLongerGrant,
  resolvePricingAbVariant: resolvePricingAbVariant,
  resolvePurchaseAbcVariant: resolvePurchaseAbcVariant,
  abcToOfferVariant: abcToOfferVariant,
  offerVariantToAbc: offerVariantToAbc
};
