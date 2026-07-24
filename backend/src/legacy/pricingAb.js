/**
 * 支付页 A/B/C：
 * A(control)=199 永久 + 全渠道；B(treatment)=多档支付宝；C=仅下载+激活码。
 * Sticky：登录用户写入 pricing_ab_assignments；改占比只影响未分配用户。
 */
'use strict';

var SETTING_KEY_PRICING_AB = 'pricing_ab_json';
var SETTING_KEY_LANDING_AB = 'landing_ab_json';

var SKU_CONTROL_199_PERM = {
  id: 'sku_199_perm_legacy',
  amount: '199.00',
  label: '永久激活',
  subject: '激活码',
  grant_kind: 'permanent',
  grant_hours: 0,
  grant_days: 0,
  grant_minutes: 0
};

var SKU_9_9_30M = {
  id: 'sku_9_9_30m',
  amount: '9.90',
  label: '体验30分钟',
  subject: '激活码',
  grant_kind: 'trial',
  grant_hours: 0,
  grant_days: 0,
  grant_minutes: 30
};

var SKU_49_24H = {
  id: 'sku_49_24h',
  amount: '49.00',
  label: '24小时',
  subject: '激活码',
  grant_kind: 'trial',
  grant_hours: 24,
  grant_days: 0,
  grant_minutes: 0
};

var SKU_99_3D = {
  id: 'sku_99_3d',
  amount: '99.00',
  label: '3天',
  subject: '激活码',
  grant_kind: 'trial',
  grant_hours: 0,
  grant_days: 3,
  grant_minutes: 0
};

var SKU_199_1Y = {
  id: 'sku_199_1y',
  amount: '199.00',
  label: '1年',
  subject: '激活码',
  grant_kind: 'trial',
  grant_hours: 0,
  grant_days: 365,
  grant_minutes: 0
};

var SKU_499_PERM = {
  id: 'sku_499_perm',
  amount: '499.00',
  label: '永久',
  subject: '激活码',
  grant_kind: 'permanent',
  grant_hours: 0,
  grant_days: 0,
  grant_minutes: 0
};

var DEFAULT_PRICING_AB = {
  enabled: true,
  a_percent: 50,
  b_percent: 50,
  c_percent: 0,
  treatment_percent: 50,
  control_skus: [SKU_CONTROL_199_PERM],
  treatment_skus: [SKU_9_9_30M, SKU_49_24H, SKU_99_3D, SKU_199_1Y, SKU_499_PERM]
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

function normalizeSkuList(list, fallback) {
  if (!Array.isArray(list) || !list.length) {
    return (fallback || []).map(cloneSku);
  }
  return list.map(cloneSku).filter(function (s) {
    return s.id && s.amount;
  });
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
  if (abc === 'c') return 'c';
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

  async function loadPricingAbParsed(force) {
    var now = Date.now();
    if (!force && _cache && now - _cacheAt < 10000) return _cache;
    var out = {
      enabled: DEFAULT_PRICING_AB.enabled,
      a_percent: DEFAULT_PRICING_AB.a_percent,
      b_percent: DEFAULT_PRICING_AB.b_percent,
      c_percent: DEFAULT_PRICING_AB.c_percent,
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
          var landingC = 0;
          var needsLegacy =
            parsed.a_percent == null && parsed.b_percent == null && parsed.c_percent == null;
          if (needsLegacy) {
            landingC = await loadLandingCPercentHint(conn);
          }
          var pct = normalizeAbcPercents(parsed, landingC);
          out.a_percent = pct.a_percent;
          out.b_percent = pct.b_percent;
          out.c_percent = pct.c_percent;
          out.treatment_percent = pct.treatment_percent;
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
    var a = clampPct(body.a_percent != null ? body.a_percent : cur.a_percent, cur.a_percent);
    var b = clampPct(body.b_percent != null ? body.b_percent : cur.b_percent, cur.b_percent);
    var c = clampPct(body.c_percent != null ? body.c_percent : cur.c_percent, cur.c_percent);
    if (a + b + c !== 100) {
      var err = new Error('A/B/C 流量占比之和必须为 100（当前 ' + (a + b + c) + '）');
      err.statusCode = 400;
      throw err;
    }
    var next = {
      enabled: body.enabled !== false && body.enabled !== 0 && body.enabled !== '0',
      a_percent: a,
      b_percent: b,
      c_percent: c,
      treatment_percent: b,
      control_skus: normalizeSkuList(body.control_skus, cur.control_skus),
      treatment_skus: normalizeSkuList(body.treatment_skus, cur.treatment_skus)
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
      var v = String(rows[0].variant || '').toLowerCase();
      if (v !== 'a' && v !== 'b' && v !== 'c') return null;
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

  async function setStickyAbc(username, abc, source, force) {
    var u = String(username || '').trim();
    var v = String(abc || '').toLowerCase();
    if (!u || u === 'guest' || (v !== 'a' && v !== 'b' && v !== 'c') || !pool) return null;
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
    var v = String(abc || '').toLowerCase();
    if (!u || u === 'guest') {
      var err = new Error('请填写有效账号');
      err.statusCode = 400;
      throw err;
    }
    if (v !== 'a' && v !== 'b' && v !== 'c') {
      var err2 = new Error('方案须为 a / b / c');
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

  /**
   * 为用户解析可见 SKU 列表与变体。
   * preferredAbc: 客户端已 sticky 的 a|b|c，仅在服务端尚无记录时采纳。
   * 代理专属渠道可强制 default_pricing_abc（通常为 c）。
   */
  async function resolveOfferForUser(username, envFallbackAmount, envSubject, preferredAbc) {
    var cfg = await loadPricingAbParsed();
    var seed = String(username || '').trim() || 'guest';
    var forcedAbc = null;
    if (seed !== 'guest' && typeof deps.getForcedAbcForUser === 'function') {
      try {
        forcedAbc = await deps.getForcedAbcForUser(seed);
      } catch (eForce) {
        forcedAbc = null;
      }
      forcedAbc = String(forcedAbc || '').toLowerCase();
      if (forcedAbc !== 'a' && forcedAbc !== 'b' && forcedAbc !== 'c') {
        forcedAbc = null;
      }
    }
    if (!cfg.enabled) {
      var stickyOff = null;
      if (seed !== 'guest') {
        stickyOff = await getStickyAssignment(seed);
      }
      if (stickyOff && stickyOff.source === 'admin_force' && stickyOff.variant) {
        var adminAbc = stickyOff.variant;
        return {
          enabled: adminAbc !== 'c',
          variant: abcToOfferVariant(adminAbc),
          abc_variant: adminAbc,
          abc_source: 'admin_force',
          skus:
            adminAbc === 'c'
              ? []
              : adminAbc === 'b'
                ? cfg.treatment_skus.map(cloneSku)
                : cfg.control_skus.map(cloneSku),
          pricing_ab_enabled: false,
          forced_by_channel: false,
          force_client_abc: true
        };
      }
      if (forcedAbc === 'c') {
        if (seed !== 'guest') {
          await setStickyAbc(seed, 'c', 'agent_channel', true);
        }
        return {
          enabled: false,
          variant: 'c',
          abc_variant: 'c',
          abc_source: 'agent_channel',
          skus: [],
          pricing_ab_enabled: false,
          forced_by_channel: true,
          force_client_abc: true
        };
      }
      var amt = alipayNormalizeAmount(envFallbackAmount);
      var legacy = cloneSku(SKU_CONTROL_199_PERM);
      if (amt) legacy.amount = amt;
      if (envSubject) legacy.subject = String(envSubject).slice(0, 128);
      return {
        enabled: true,
        variant: 'control',
        abc_variant: 'a',
        abc_source: 'disabled',
        skus: [legacy],
        pricing_ab_enabled: false,
        forced_by_channel: false,
        force_client_abc: false
      };
    }

    var abc = null;
    var abcSource = '';
    var sticky = null;
    if (seed !== 'guest') {
      sticky = await getStickyAssignment(seed);
    }
    /* 管理端强制分配优先于代理渠道默认方案 */
    if (sticky && sticky.source === 'admin_force' && sticky.variant) {
      abc = sticky.variant;
      abcSource = 'admin_force';
    } else if (forcedAbc) {
      abc = forcedAbc;
      abcSource = 'agent_channel';
      if (seed !== 'guest') {
        await setStickyAbc(seed, abc, 'agent_channel', true);
      }
    } else if (sticky && sticky.variant) {
      abc = sticky.variant;
      abcSource = sticky.source || 'sticky';
    }
    if (!abc) {
      var pref = String(preferredAbc || '').toLowerCase();
      if (pref === 'a' || pref === 'b' || pref === 'c') {
        abc = pref;
        abcSource = 'client_sticky';
      } else {
        abc = resolvePurchaseAbcVariant(seed, cfg.a_percent, cfg.b_percent, cfg.c_percent);
        abcSource = 'allocation';
      }
      if (seed !== 'guest') {
        await setStickyAbc(seed, abc, preferredAbc ? 'client_sticky' : 'allocation');
      }
    }

    var variant = abcToOfferVariant(abc);
    var skus = [];
    if (abc === 'c') {
      skus = [];
    } else if (abc === 'b') {
      skus = cfg.treatment_skus.map(cloneSku);
    } else {
      skus = cfg.control_skus.map(cloneSku);
    }
    if (abc !== 'c' && !skus.length) {
      skus = [cloneSku(SKU_CONTROL_199_PERM)];
      variant = 'control';
      abc = 'a';
      abcSource = abcSource || 'fallback_a';
    }
    return {
      enabled: abc !== 'c',
      variant: variant,
      abc_variant: abc,
      abc_source: abcSource,
      skus: skus,
      pricing_ab_enabled: true,
      forced_by_channel: !!forcedAbc && abcSource === 'agent_channel',
      force_client_abc: abcSource === 'admin_force' || (!!forcedAbc && abcSource === 'agent_channel')
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

  /** 公开配置：供落地/支付页客户端分流（已分配设备自行 sticky） */
  async function publicAbcConfig() {
    var cfg = await loadPricingAbParsed();
    var enabled = cfg.enabled !== false;
    return {
      enabled: enabled,
      a_percent: enabled ? cfg.a_percent : 100,
      b_percent: enabled ? cfg.b_percent : 0,
      c_percent: enabled ? cfg.c_percent : 0,
      b_landing_percent: enabled ? cfg.a_percent + cfg.b_percent : 100,
      experiment: 'purchase_abc_v1',
      delegated: true
    };
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
  DEFAULT_PRICING_AB: DEFAULT_PRICING_AB,
  resolveCoverLongerGrant: resolveCoverLongerGrant,
  resolvePricingAbVariant: resolvePricingAbVariant,
  resolvePurchaseAbcVariant: resolvePurchaseAbcVariant,
  abcToOfferVariant: abcToOfferVariant,
  offerVariantToAbc: offerVariantToAbc
};
