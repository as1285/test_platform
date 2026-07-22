/**
 * 定价 A/B：Control=199 永久；Treatment=49/24h · 99/3天 · 199/1年 · 499永久
 * 分流与 conversion_ab / landing_ab 独立。
 */
'use strict';

var SETTING_KEY_PRICING_AB = 'pricing_ab_json';

var SKU_CONTROL_199_PERM = {
  id: 'sku_199_perm_legacy',
  amount: '199.00',
  label: '永久激活',
  subject: '激活码',
  grant_kind: 'permanent',
  grant_hours: 0,
  grant_days: 0
};

var SKU_49_24H = {
  id: 'sku_49_24h',
  amount: '49.00',
  label: '24小时',
  subject: '激活码',
  grant_kind: 'trial',
  grant_hours: 24,
  grant_days: 0
};

var SKU_99_3D = {
  id: 'sku_99_3d',
  amount: '99.00',
  label: '3天',
  subject: '激活码',
  grant_kind: 'trial',
  grant_hours: 0,
  grant_days: 3
};

var SKU_199_1Y = {
  id: 'sku_199_1y',
  amount: '199.00',
  label: '1年',
  subject: '激活码',
  grant_kind: 'trial',
  grant_hours: 0,
  grant_days: 365
};

var SKU_499_PERM = {
  id: 'sku_499_perm',
  amount: '499.00',
  label: '永久',
  subject: '激活码',
  grant_kind: 'permanent',
  grant_hours: 0,
  grant_days: 0
};

var DEFAULT_PRICING_AB = {
  enabled: true,
  treatment_percent: 50,
  control_skus: [SKU_CONTROL_199_PERM],
  treatment_skus: [SKU_49_24H, SKU_99_3D, SKU_199_1Y, SKU_499_PERM]
};

function cloneSku(s) {
  return {
    id: String(s.id || ''),
    amount: String(s.amount || ''),
    label: String(s.label || ''),
    subject: String(s.subject || ''),
    grant_kind: s.grant_kind === 'permanent' ? 'permanent' : 'trial',
    grant_hours: parseInt(s.grant_hours, 10) || 0,
    grant_days: parseInt(s.grant_days, 10) || 0
  };
}

function normalizeSkuList(list, fallback) {
  if (!Array.isArray(list) || !list.length) {
    return (fallback || []).map(cloneSku);
  }
  return list.map(cloneSku).filter(function (s) {
    return s.id && s.amount;
  });
}

function resolvePricingAbVariant(seed, treatmentPercent) {
  var pct = parseInt(treatmentPercent, 10);
  if (!isFinite(pct) || pct < 0) pct = 50;
  if (pct > 100) pct = 100;
  var s = 'pricing|' + String(seed || 'guest');
  var h = 0;
  var i;
  for (i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  var bucket = Math.abs(h) % 100;
  return bucket < pct ? 'treatment' : 'control';
}

function grantDurationMs(sku) {
  if (!sku || sku.grant_kind === 'permanent') return Infinity;
  var days = parseInt(sku.grant_days, 10) || 0;
  var hours = parseInt(sku.grant_hours, 10) || 0;
  return days * 86400000 + hours * 3600000;
}

function findSkuById(cfg, skuId) {
  var id = String(skuId || '');
  var lists = [cfg.control_skus || [], cfg.treatment_skus || []];
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
 * 返回 { kind, active_until|null, applied, reason }
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

  async function loadPricingAbParsed(force) {
    var now = Date.now();
    if (!force && _cache && now - _cacheAt < 10000) return _cache;
    var out = {
      enabled: DEFAULT_PRICING_AB.enabled,
      treatment_percent: DEFAULT_PRICING_AB.treatment_percent,
      control_skus: DEFAULT_PRICING_AB.control_skus.map(cloneSku),
      treatment_skus: DEFAULT_PRICING_AB.treatment_skus.map(cloneSku)
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
          out.enabled = parsed.enabled !== false;
          if (parsed.treatment_percent != null) {
            var p = parseInt(parsed.treatment_percent, 10);
            if (isFinite(p) && p >= 0 && p <= 100) out.treatment_percent = p;
          }
          out.control_skus = normalizeSkuList(parsed.control_skus, DEFAULT_PRICING_AB.control_skus);
          out.treatment_skus = normalizeSkuList(
            parsed.treatment_skus,
            DEFAULT_PRICING_AB.treatment_skus
          );
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

  async function savePricingAbFromAdmin(body) {
    var cur = await loadPricingAbParsed(true);
    var next = {
      enabled: body.enabled !== false && body.enabled !== 0 && body.enabled !== '0',
      treatment_percent:
        body.treatment_percent != null
          ? parseInt(body.treatment_percent, 10)
          : cur.treatment_percent,
      control_skus: normalizeSkuList(body.control_skus, cur.control_skus),
      treatment_skus: normalizeSkuList(body.treatment_skus, cur.treatment_skus)
    };
    if (!isFinite(next.treatment_percent) || next.treatment_percent < 0) {
      next.treatment_percent = 50;
    }
    if (next.treatment_percent > 100) next.treatment_percent = 100;
    const conn = await pool.getConnection();
    try {
      await upsertAppSetting(conn, SETTING_KEY_PRICING_AB, JSON.stringify(next));
    } finally {
      conn.release();
    }
    invalidateCache();
    return loadPricingAbParsed(true);
  }

  /**
   * 为用户解析可见 SKU 列表与变体。
   * envFallbackAmount: 支付宝未配多档时的兜底金额（对照单品）。
   */
  async function resolveOfferForUser(username, envFallbackAmount, envSubject) {
    var cfg = await loadPricingAbParsed();
    var seed = String(username || '').trim() || 'guest';
    if (!cfg.enabled) {
      var amt = alipayNormalizeAmount(envFallbackAmount);
      var legacy = cloneSku(SKU_CONTROL_199_PERM);
      if (amt) legacy.amount = amt;
      if (envSubject) legacy.subject = String(envSubject).slice(0, 128);
      return {
        enabled: true,
        variant: 'control',
        skus: [legacy],
        pricing_ab_enabled: false
      };
    }
    var variant = resolvePricingAbVariant(seed, cfg.treatment_percent);
    var skus =
      variant === 'treatment'
        ? cfg.treatment_skus.map(cloneSku)
        : cfg.control_skus.map(cloneSku);
    if (!skus.length) {
      skus = [cloneSku(SKU_CONTROL_199_PERM)];
      variant = 'control';
    }
    return {
      enabled: true,
      variant: variant,
      skus: skus,
      pricing_ab_enabled: true
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
    /* 单 SKU 臂默认第一项；多 SKU 必须显式传 sku_id */
    if (offer.skus.length === 1) return offer.skus[0];
    return null;
  }

  return {
    SETTING_KEY_PRICING_AB: SETTING_KEY_PRICING_AB,
    DEFAULT_PRICING_AB: DEFAULT_PRICING_AB,
    loadPricingAbParsed: loadPricingAbParsed,
    savePricingAbFromAdmin: savePricingAbFromAdmin,
    invalidateCache: invalidateCache,
    resolveOfferForUser: resolveOfferForUser,
    pickSkuFromOffer: pickSkuFromOffer,
    findSkuById: findSkuById,
    resolveCoverLongerGrant: resolveCoverLongerGrant,
    grantDurationMs: grantDurationMs,
    resolvePricingAbVariant: resolvePricingAbVariant
  };
}

module.exports = {
  createPricingAb: createPricingAb,
  SETTING_KEY_PRICING_AB: SETTING_KEY_PRICING_AB,
  DEFAULT_PRICING_AB: DEFAULT_PRICING_AB,
  resolveCoverLongerGrant: resolveCoverLongerGrant,
  resolvePricingAbVariant: resolvePricingAbVariant
};
