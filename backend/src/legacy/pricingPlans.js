/**
 * 新站 getjob68 支付方案 A/B：多方案、自定义价格/天数、按流量分流。
 * 默认方案现售仅周卡 ¥50 / 7天；月卡/年卡档位保留但默认下架（不含永久）。
 * 旧站目录价不走这里。
 */
'use strict';

var SETTING_KEY_PRICING_PLANS_GETJOB68 = 'pricing_plans_getjob68_json';
var PLAN_LETTERS = ['a', 'b', 'c', 'd', 'e', 'f'];
var MAX_CUSTOM_SKUS = 5;
var DEFAULT_PLAN_SLOTS = [
  { slot: 'week', label: '周卡', amount: '50.00', grant_days: 7, enabled: true },
  { slot: 'month', label: '月卡', amount: '150.00', grant_days: 30, enabled: false },
  { slot: 'year', label: '年卡', amount: '200.00', grant_days: 365, enabled: false }
];

function fail(msg) {
  var err = new Error(msg);
  err.statusCode = 400;
  throw err;
}

function normalizeAmount(raw) {
  var s = String(raw == null ? '' : raw)
    .replace(/,/g, '')
    .replace(/，/g, '')
    .trim();
  if (!s) return '';
  var n = Number(s);
  if (!isFinite(n) || n < 0.01 || n > 99999.99) return '';
  return n.toFixed(2);
}

function normalizeDays(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  var s = String(raw).trim();
  if (!/^\d+$/.test(s)) return null;
  var n = parseInt(s, 10);
  if (!isFinite(n) || n < 1 || n > 3650) return null;
  return n;
}

function normalizeWeight(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  var s = String(raw).trim();
  if (!/^\d+$/.test(s)) return null;
  var n = parseInt(s, 10);
  if (!isFinite(n) || n < 0 || n > 100) return null;
  return n;
}

function normalizeLabel(raw, fallback) {
  var s = String(raw == null ? '' : raw)
    .replace(/[\r\n\t]/g, ' ')
    .trim();
  if (!s) s = String(fallback || '').trim();
  if (!s) return '';
  return s.slice(0, 16);
}

function normalizeEnabled(raw, fallback) {
  if (raw == null || raw === '') return fallback !== false;
  return !(raw === false || raw === 0 || raw === '0');
}

function blankSku(slot, label, amount, days) {
  return {
    slot: slot,
    label: label,
    amount: amount,
    psych_amount: '',
    grant_days: days,
    enabled: true
  };
}

function defaultGetjob68Plans() {
  return {
    plans: [
      {
        id: 'a',
        name: '默认方案',
        weight: 100,
        is_default: true,
        skus: DEFAULT_PLAN_SLOTS.map(function (s) {
          var row = blankSku(s.slot, s.label, s.amount, s.grant_days);
          row.enabled = s.enabled !== false;
          return row;
        })
      }
    ]
  };
}

function defaultSlotById(slot) {
  var i;
  for (i = 0; i < DEFAULT_PLAN_SLOTS.length; i++) {
    if (DEFAULT_PLAN_SLOTS[i].slot === slot) return DEFAULT_PLAN_SLOTS[i];
  }
  return null;
}

function normalizeDefaultSkus(rawSkus) {
  var bySlot = {};
  var list = Array.isArray(rawSkus) ? rawSkus : [];
  var i;
  for (i = 0; i < list.length; i++) {
    var row = list[i];
    if (!row || typeof row !== 'object') continue;
    var slot = String(row.slot || '').trim();
    if (defaultSlotById(slot)) bySlot[slot] = row;
  }
  return DEFAULT_PLAN_SLOTS.map(function (def) {
    var src = bySlot[def.slot] || {};
    var label = normalizeLabel(src.label, def.label) || def.label;
    var amount = normalizeAmount(src.amount) || def.amount;
    var days = normalizeDays(src.grant_days);
    if (days == null) days = def.grant_days;
    var psych = '';
    if (src.psych_amount != null && String(src.psych_amount).trim() !== '') {
      psych = normalizeAmount(src.psych_amount);
      if (!psych) fail('默认方案「' + label + '」心理价须为 0.01～99999.99');
      if (!(Number(psych) < Number(amount))) {
        fail('默认方案「' + label + '」心理价须小于价格；不填则不启用心理价特惠');
      }
    }
    if (!normalizeAmount(src.amount) && src.amount != null && String(src.amount).trim() !== '') {
      fail('默认方案「' + label + '」价格须为 0.01～99999.99');
    }
    if (src.grant_days != null && String(src.grant_days).trim() !== '' && normalizeDays(src.grant_days) == null) {
      fail('默认方案「' + label + '」天数须为 1～3650');
    }
    return {
      slot: def.slot,
      label: label,
      amount: amount,
      psych_amount: psych,
      grant_days: days,
      enabled: normalizeEnabled(src.enabled, def.enabled !== false)
    };
  });
}

function nextCustomSlot(used) {
  var i;
  for (i = 0; i < MAX_CUSTOM_SKUS; i++) {
    var slot = 's' + i;
    if (!used[slot]) {
      used[slot] = true;
      return slot;
    }
  }
  return '';
}

function normalizeCustomSkus(rawSkus, planName) {
  var list = Array.isArray(rawSkus) ? rawSkus : [];
  var used = {};
  var out = [];
  var i;
  for (i = 0; i < list.length; i++) {
    var row = list[i];
    if (!row || typeof row !== 'object') continue;
    var labelRaw = row.label != null ? String(row.label).trim() : '';
    var amountRaw = row.amount != null ? String(row.amount).trim() : '';
    var daysRaw = row.grant_days != null ? String(row.grant_days).trim() : '';
    var psychRaw = row.psych_amount != null ? String(row.psych_amount).trim() : '';
    if (!labelRaw && !amountRaw && !daysRaw && !psychRaw) continue;
    if (out.length >= MAX_CUSTOM_SKUS) {
      fail((planName || '方案') + '最多 ' + MAX_CUSTOM_SKUS + ' 个套餐');
    }
    var label = normalizeLabel(labelRaw, '');
    if (!label) fail((planName || '方案') + '的套餐需要名称');
    var amount = normalizeAmount(amountRaw);
    if (!amount) fail((planName || '方案') + '「' + label + '」价格须为 0.01～99999.99');
    var days = normalizeDays(daysRaw);
    if (days == null) fail((planName || '方案') + '「' + label + '」天数须为 1～3650');
    var psych = '';
    if (psychRaw) {
      psych = normalizeAmount(psychRaw);
      if (!psych || !(Number(psych) < Number(amount))) {
        fail((planName || '方案') + '「' + label + '」心理价须小于价格，且为 0.01～99999.99');
      }
    }
    var requested = String(row.slot || '').trim();
    var slot = /^s[0-4]$/.test(requested) && !used[requested] ? requested : '';
    if (slot) used[slot] = true;
    else slot = nextCustomSlot(used);
    if (!slot) fail((planName || '方案') + '最多 ' + MAX_CUSTOM_SKUS + ' 个套餐');
    out.push({
      slot: slot,
      label: label,
      amount: amount,
      psych_amount: psych,
      grant_days: days,
      enabled: normalizeEnabled(row.enabled, true)
    });
  }
  if (!out.length) fail((planName || '方案') + '至少保留一个套餐');
  return out;
}

function planHasEnabledSku(plan) {
  var skus = (plan && plan.skus) || [];
  var i;
  for (i = 0; i < skus.length; i++) {
    if (skus[i] && skus[i].enabled !== false) return true;
  }
  return false;
}

/**
 * @param {object|array} raw
 * @returns {{ plans: object[] }}
 */
function normalizePricingPlans(raw) {
  var incoming = raw;
  if (Array.isArray(raw)) incoming = { plans: raw };
  if (!incoming || typeof incoming !== 'object') fail('请提供支付方案');
  var list = Array.isArray(incoming.plans) ? incoming.plans : null;
  if (!list || !list.length) fail('请至少保留默认方案');
  var defaultRaw = null;
  var customRaw = [];
  var seen = {};
  var i;
  for (i = 0; i < list.length; i++) {
    var row = list[i];
    if (!row || typeof row !== 'object') continue;
    var id = String(row.id || '')
      .trim()
      .toLowerCase();
    var isDefault = id === 'a' || row.is_default === true || row.is_default === 1 || row.is_default === '1';
    if (isDefault) {
      if (defaultRaw) fail('只能有一个默认方案');
      defaultRaw = row;
      continue;
    }
    if (id && !/^[b-f]$/.test(id)) fail('方案编号无效');
    if (id && seen[id]) fail('方案编号重复');
    if (id) seen[id] = true;
    customRaw.push(row);
  }
  if (!defaultRaw) fail('缺少默认方案');
  if (customRaw.length > PLAN_LETTERS.length - 1) fail('最多 6 个支付方案');

  var defaultName = normalizeLabel(defaultRaw.name, '默认方案') || '默认方案';
  var defaultWeight = normalizeWeight(defaultRaw.weight);
  if (defaultWeight == null) fail('默认方案流量须为 0～100 的整数');
  var defaultPlan = {
    id: 'a',
    name: defaultName,
    weight: defaultWeight,
    is_default: true,
    skus: normalizeDefaultSkus(defaultRaw.skus)
  };
  if (defaultWeight > 0 && !planHasEnabledSku(defaultPlan)) {
    fail('默认方案有流量时请至少上架一个套餐');
  }

  var plans = [defaultPlan];
  for (i = 0; i < customRaw.length; i++) {
    var src = customRaw[i];
    var cid = String(src.id || '')
      .trim()
      .toLowerCase();
    if (!cid) {
      var k;
      for (k = 1; k < PLAN_LETTERS.length; k++) {
        if (!seen[PLAN_LETTERS[k]]) {
          cid = PLAN_LETTERS[k];
          seen[cid] = true;
          break;
        }
      }
    }
    if (!cid) fail('最多 6 个支付方案');
    var name = normalizeLabel(src.name, '方案 ' + cid.toUpperCase());
    if (!name) fail('请填写方案名称');
    var weight = normalizeWeight(src.weight);
    if (weight == null) fail('「' + name + '」流量须为 0～100 的整数');
    var plan = {
      id: cid,
      name: name,
      weight: weight,
      is_default: false,
      skus: normalizeCustomSkus(src.skus, name)
    };
    if (weight > 0 && !planHasEnabledSku(plan)) {
      fail('「' + name + '」有流量时请至少上架一个套餐');
    }
    plans.push(plan);
  }

  var sum = 0;
  for (i = 0; i < plans.length; i++) sum += plans[i].weight;
  if (sum !== 100) fail('流量分配合计须为 100%，当前 ' + sum + '%');
  return { plans: plans };
}

function pricingPlansOrDefault(raw) {
  try {
    return normalizePricingPlans(raw);
  } catch (e) {
    return defaultGetjob68Plans();
  }
}

function hashPlanBucket(seed) {
  var s = 'pricing_plan_v1|' + String(seed || 'guest');
  var h = 0;
  var i;
  for (i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 100;
}

/** 按权重稳定分桶。weights 不必预加总为 100，会按比例落到 0–99。 */
function pickPlanByWeight(seed, plans) {
  var list = (Array.isArray(plans) ? plans : []).filter(function (p) {
    return p && (parseInt(p.weight, 10) || 0) > 0;
  });
  if (!list.length) return null;
  var weights = list.map(function (p) {
    return parseInt(p.weight, 10) || 0;
  });
  var sum = 0;
  var i;
  for (i = 0; i < weights.length; i++) sum += weights[i];
  if (sum <= 0) return list[0];
  var bucket = hashPlanBucket(seed);
  var cursor = 0;
  for (i = 0; i < list.length; i++) {
    var share =
      i === list.length - 1 ? 100 - cursor : Math.round((weights[i] * 100) / sum);
    if (share < 0) share = 0;
    if (bucket < cursor + share) return list[i];
    cursor += share;
    if (cursor > 100) cursor = 100;
  }
  return list[list.length - 1];
}

function applyPsychToSku(sku, psych) {
  var pay = String(psych || '');
  var listN = Number(sku.amount);
  var psychN = Number(pay);
  if (!(pay && isFinite(psychN) && psychN > 0 && isFinite(listN) && listN > 0 && psychN < listN)) {
    return sku;
  }
  sku.list_amount = String(sku.amount);
  sku.amount = pay;
  sku.psych_offer = true;
  if (sku.label && String(sku.label).indexOf('心理价') < 0) {
    sku.label = String(sku.label) + '·心理价特惠';
  }
  sku.subject = '激活码·' + sku.label;
  return sku;
}

function planToLiveSkus(plan) {
  if (!plan || !Array.isArray(plan.skus)) return [];
  var planId = String(plan.id || 'a');
  var out = [];
  var i;
  for (i = 0; i < plan.skus.length; i++) {
    var row = plan.skus[i];
    if (!row || row.enabled === false) continue;
    /* 现售货架不含永久：名称含永久或天数≥3650 跳过 */
    var labelProbe = String(row.label || '').trim();
    var daysProbe = parseInt(row.grant_days, 10) || 0;
    if (labelProbe === '永久' || labelProbe.indexOf('永久') === 0 || daysProbe >= 3650) continue;
    var label = String(row.label || '套餐');
    var sku = {
      id: 'gj_' + planId + '_' + String(row.slot || 's' + i),
      amount: String(row.amount || ''),
      label: label,
      subject: '激活码·' + label,
      grant_kind: 'trial',
      grant_hours: 0,
      grant_days: parseInt(row.grant_days, 10) || 0,
      grant_minutes: 0,
      pricing_plan_id: planId
    };
    applyPsychToSku(sku, row.psych_amount);
    out.push(sku);
  }
  return out;
}

function findPlan(plans, id) {
  var want = String(id || '').trim().toLowerCase();
  var list = (plans && plans.plans) || plans || [];
  var i;
  for (i = 0; i < list.length; i++) {
    if (list[i] && String(list[i].id) === want && (parseInt(list[i].weight, 10) || 0) > 0) {
      return list[i];
    }
  }
  return null;
}

module.exports = {
  SETTING_KEY_PRICING_PLANS_GETJOB68: SETTING_KEY_PRICING_PLANS_GETJOB68,
  DEFAULT_PLAN_SLOTS: DEFAULT_PLAN_SLOTS,
  defaultGetjob68Plans: defaultGetjob68Plans,
  normalizePricingPlans: normalizePricingPlans,
  pricingPlansOrDefault: pricingPlansOrDefault,
  hashPlanBucket: hashPlanBucket,
  pickPlanByWeight: pickPlanByWeight,
  planToLiveSkus: planToLiveSkus,
  findPlan: findPlan,
  planHasEnabledSku: planHasEnabledSku
};
