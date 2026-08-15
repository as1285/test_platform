/**
 * 用户专属报价：后台为账号指定 SKU + 特价，支付配置与下单强制使用该金额。
 */
'use strict';

var LIVE_OFFERABLE_SKUS = [
  {
    id: 'sku_298_1d',
    amount: '298.00',
    label: '日卡',
    subject: '激活码·日卡',
    grant_kind: 'trial',
    grant_hours: 0,
    grant_days: 1,
    grant_minutes: 0
  },
  {
    id: 'sku_398_forever',
    amount: '398.00',
    label: '永久',
    subject: '激活码·永久',
    grant_kind: 'permanent',
    grant_hours: 0,
    grant_days: 0,
    grant_minutes: 0
  }
];

/** 旧档：已有专属价仍可解析，不再出现在新建下拉 */
var LEGACY_OFFERABLE_SKUS = [
  {
    id: 'sku_268_1d',
    amount: '268.00',
    label: '日卡',
    subject: '激活码·日卡',
    grant_kind: 'trial',
    grant_hours: 0,
    grant_days: 1,
    grant_minutes: 0
  },
  {
    id: 'sku_328_7d',
    amount: '320.00',
    label: '周卡',
    subject: '激活码·周卡',
    grant_kind: 'trial',
    grant_hours: 0,
    grant_days: 7,
    grant_minutes: 0
  },
  {
    id: 'sku_398_30d',
    amount: '398.00',
    label: '月卡',
    subject: '激活码·月卡',
    grant_kind: 'trial',
    grant_hours: 0,
    grant_days: 30,
    grant_minutes: 0
  },
  {
    id: 'sku_600_perm',
    amount: '498.00',
    label: '永久',
    subject: '激活码·永久',
    grant_kind: 'permanent',
    grant_hours: 0,
    grant_days: 0,
    grant_minutes: 0
  },
  {
    id: 'sku_199_1h',
    amount: '199.00',
    label: '小时体验卡',
    subject: '激活码·小时体验',
    grant_kind: 'trial',
    grant_hours: 1,
    grant_days: 0,
    grant_minutes: 0
  }
];

var OFFERABLE_SKUS = LIVE_OFFERABLE_SKUS.concat(LEGACY_OFFERABLE_SKUS);

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

function findOfferableSku(skuId) {
  var id = String(skuId || '').trim();
  for (var i = 0; i < OFFERABLE_SKUS.length; i++) {
    if (OFFERABLE_SKUS[i].id === id) return cloneSku(OFFERABLE_SKUS[i]);
  }
  return null;
}

function listOfferableSkus() {
  return LIVE_OFFERABLE_SKUS.map(cloneSku);
}

function normalizeOfferAmount(raw, normalizeAmountFn) {
  var n =
    typeof normalizeAmountFn === 'function'
      ? normalizeAmountFn(raw)
      : String(raw == null ? '' : raw).trim();
  if (!n) return '';
  var num = Number(n);
  if (!isFinite(num) || num < 0.01 || num > 99999.99) return '';
  return n;
}

function plainOfferRow(row) {
  if (!row) return null;
  var base = findOfferableSku(row.sku_id);
  return {
    username: String(row.username || ''),
    sku_id: String(row.sku_id || ''),
    amount: row.amount != null ? String(row.amount) : '',
    label: row.label != null ? String(row.label) : '',
    note: row.note != null ? String(row.note) : '',
    enabled: !(row.enabled === 0 || row.enabled === false || row.enabled === '0'),
    created_by: row.created_by != null ? String(row.created_by) : '',
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
    catalog_amount: base ? base.amount : '',
    catalog_label: base ? base.label : ''
  };
}

function buildSkuFromOffer(row) {
  var base = findOfferableSku(row && row.sku_id);
  if (!base) return null;
  var amount = row.amount != null ? String(row.amount) : '';
  if (!amount) return null;
  var customLabel = row.label != null ? String(row.label).trim() : '';
  base.amount = amount;
  base.label = customLabel || base.label + '（专属价）';
  base.subject = String(base.subject || '').replace(/·专属价$/, '') + '·专属价';
  if (base.subject.length > 128) base.subject = base.subject.slice(0, 128);
  return base;
}

function createUserPriceOffers(deps) {
  var pool = deps.pool;
  var normalizeAmount = deps.normalizeAmount;

  async function getOffer(username, opts) {
    var u = String(username || '').trim();
    if (!u) return null;
    var onlyEnabled = !opts || opts.enabledOnly !== false;
    const [rows] = await pool.execute(
      onlyEnabled
        ? `SELECT username, sku_id, amount, label, note, enabled, created_by, created_at, updated_at
           FROM user_price_offers WHERE username = ? AND enabled = 1 LIMIT 1`
        : `SELECT username, sku_id, amount, label, note, enabled, created_by, created_at, updated_at
           FROM user_price_offers WHERE username = ? LIMIT 1`,
      [u]
    );
    return rows.length ? plainOfferRow(rows[0]) : null;
  }

  async function upsertOffer(username, input, createdBy) {
    var u = String(username || '').trim();
    var skuId = String((input && input.sku_id) || '').trim();
    var base = findOfferableSku(skuId);
    if (!u) {
      var e0 = new Error('请填写账号');
      e0.statusCode = 400;
      throw e0;
    }
    if (!base) {
      var e1 = new Error('请选择有效套餐（日卡/永久）');
      e1.statusCode = 400;
      throw e1;
    }
    var amount = normalizeOfferAmount(input && input.amount, normalizeAmount);
    if (!amount) {
      var e2 = new Error('请填写有效金额（0.01～99999.99）');
      e2.statusCode = 400;
      throw e2;
    }
    var label = input && input.label != null ? String(input.label).trim().slice(0, 64) : '';
    var note = input && input.note != null ? String(input.note).trim().slice(0, 255) : '';
    var admin = createdBy != null ? String(createdBy).trim().slice(0, 64) : '';
    await pool.execute(
      `INSERT INTO user_price_offers
         (username, sku_id, amount, label, note, enabled, created_by)
       VALUES (?, ?, ?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE
         sku_id = VALUES(sku_id),
         amount = VALUES(amount),
         label = VALUES(label),
         note = VALUES(note),
         enabled = 1,
         created_by = VALUES(created_by),
         updated_at = CURRENT_TIMESTAMP`,
      [u, skuId, amount, label || null, note || null, admin || null]
    );
    return getOffer(u, { enabledOnly: false });
  }

  async function clearOffer(username) {
    var u = String(username || '').trim();
    if (!u) {
      var e = new Error('请填写账号');
      e.statusCode = 400;
      throw e;
    }
    const [result] = await pool.execute(
      `UPDATE user_price_offers SET enabled = 0, updated_at = CURRENT_TIMESTAMP
       WHERE username = ? AND enabled = 1`,
      [u]
    );
    var affected = result && (result.affectedRows || result.changedRows) ? true : false;
    return { username: u, cleared: affected, offer: await getOffer(u, { enabledOnly: false }) };
  }

  /**
   * 若有启用中的专属价，覆盖 offer.skus 为单档特价。
   * 返回 { offer, customOffer }；无专属价时原样返回。
   */
  async function applyOfferToPricingOffer(username, pricingOffer) {
    var row = await getOffer(username, { enabledOnly: true });
    if (!row) {
      return { offer: pricingOffer, customOffer: null };
    }
    var sku = buildSkuFromOffer(row);
    if (!sku) {
      return { offer: pricingOffer, customOffer: null };
    }
    var next = Object.assign({}, pricingOffer || {}, {
      skus: [sku],
      custom_offer: true,
      abc_source: 'user_price_offer',
      force_client_abc: true
    });
    return { offer: next, customOffer: row };
  }

  return {
    OFFERABLE_SKUS: OFFERABLE_SKUS,
    listOfferableSkus: listOfferableSkus,
    findOfferableSku: findOfferableSku,
    buildSkuFromOffer: buildSkuFromOffer,
    getOffer: getOffer,
    upsertOffer: upsertOffer,
    clearOffer: clearOffer,
    applyOfferToPricingOffer: applyOfferToPricingOffer
  };
}

module.exports = {
  createUserPriceOffers: createUserPriceOffers,
  listOfferableSkus: listOfferableSkus,
  findOfferableSku: findOfferableSku,
  buildSkuFromOffer: buildSkuFromOffer
};
