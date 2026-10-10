'use strict';

const { createPricingAb } = require('../../src/legacy/pricingAb');

const {
  defaultGetjob68Plans: defaultPlans,
  normalizePricingPlans: normalizePlans,
  pickPlanByWeight: pickPlan,
  planToLiveSkus: toSkus
} = require('../../src/legacy/pricingPlans');

describe('getjob68 pricing plans', () => {
  it('defaults to live week 50 only; month/year shelves disabled, no permanent', () => {
    const doc = defaultPlans();
    expect(doc.plans).toHaveLength(1);
    expect(doc.plans[0].id).toBe('a');
    expect(doc.plans[0].weight).toBe(100);
    expect(doc.plans[0].skus.map((s) => [s.label, s.amount, s.grant_days, s.enabled])).toEqual([
      ['周卡', '50.00', 7, true],
      ['月卡', '150.00', 30, false],
      ['年卡', '200.00', 365, false]
    ]);
    const live = toSkus(doc.plans[0]);
    expect(live.map((s) => s.id)).toEqual(['gj_a_week']);
    expect(live.map((s) => s.amount)).toEqual(['50.00']);
    expect(live.every((s) => s.grant_kind === 'trial')).toBe(true);
  });

  it('planToLiveSkus skips permanent-looking rows even if enabled', () => {
    const live = toSkus({
      id: 'a',
      skus: [
        { slot: 'week', label: '周卡', amount: '50.00', grant_days: 7, enabled: true },
        { slot: 'month', label: '永久', amount: '199.00', grant_days: 3650, enabled: true }
      ]
    });
    expect(live.map((s) => s.id)).toEqual(['gj_a_week']);
  });

  it('accepts custom labels on default plan and a custom plan with its own price and days', () => {
    const next = normalizePlans({
      plans: [
        {
          id: 'a',
          name: '默认方案',
          weight: 70,
          skus: [
            { slot: 'week', label: '体验周', amount: '100', grant_days: 7 },
            { slot: 'month', label: '月卡', amount: '150', grant_days: 30 },
            { slot: 'year', label: '年卡', amount: '200', grant_days: 365 }
          ]
        },
        {
          name: '低价方案',
          weight: 30,
          skus: [{ label: '三日卡', amount: '49', grant_days: 3, enabled: true }]
        }
      ]
    });
    expect(next.plans[0].skus[0].label).toBe('体验周');
    expect(next.plans[1].id).toBe('b');
    expect(next.plans[1].skus[0]).toMatchObject({
      label: '三日卡',
      amount: '49.00',
      grant_days: 3,
      slot: 's0'
    });
    expect(toSkus(next.plans[1])[0].id).toBe('gj_b_s0');
  });

  it('rejects traffic that does not add up to 100', () => {
    expect(() =>
      normalizePlans({
        plans: [
          {
            id: 'a',
            name: '默认方案',
            weight: 40,
            skus: defaultPlans().plans[0].skus
          }
        ]
      })
    ).toThrow(/100%/);
  });

  it('splits seeds by weight and stays stable', () => {
    const plans = [
      { id: 'a', weight: 50 },
      { id: 'b', weight: 50 }
    ];
    expect(pickPlan('same-user', plans).id).toBe(pickPlan('same-user', plans).id);
    let a = 0;
    for (let i = 0; i < 200; i++) {
      if (pickPlan('user-' + i, plans).id === 'a') a += 1;
    }
    expect(a).toBeGreaterThan(70);
    expect(a).toBeLessThan(130);
    expect(pickPlan('anyone', [{ id: 'a', weight: 100 }, { id: 'b', weight: 0 }]).id).toBe('a');
    expect(pickPlan('anyone', [{ id: 'a', weight: 0 }, { id: 'b', weight: 100 }]).id).toBe('b');
  });
});

describe('getjob68 offer assignment', () => {
  function apiWith(store) {
    const conn = {
      execute: async (sql, params) => {
        const text = String(sql);
        const key = params && params[0];
        if (text.includes('CREATE TABLE')) return [[]];
        if (key === 'pricing_plans_getjob68_json') {
          const doc = store.saved || store.plans;
          return doc ? [[{ setting_value: JSON.stringify(doc) }]] : [[]];
        }
        if (text.includes('pricing_ab_assignments') && text.includes('SELECT')) {
          const row = store.sticky[params[0]];
          return row ? [[row]] : [[]];
        }
        if (text.includes('INSERT INTO pricing_ab_assignments')) {
          store.sticky[params[0]] = {
            variant: params[1],
            source: params[2],
            assigned_at: new Date()
          };
          return [[]];
        }
        if (key === 'sku_catalog_prices_json') return [[]];
        return [[]];
      },
      release() {}
    };
    return createPricingAb({
      pool: { getConnection: async () => conn },
      upsertAppSetting: async (_conn, key, value) => {
        store.savedKey = key;
        store.saved = JSON.parse(value);
      },
      alipayNormalizeAmount: (v) => String(v || '')
    });
  }

  it('assigns a new user to a weighted plan and keeps them there', async () => {
    const plans = normalizePlans({
      plans: [
        { id: 'a', name: '默认方案', weight: 0, skus: defaultPlans().plans[0].skus },
        {
          id: 'b',
          name: '方案 B',
          weight: 100,
          skus: [{ slot: 's0', label: '周卡', amount: '80', grant_days: 5 }]
        }
      ]
    });
    const store = { plans, sticky: {} };
    const api = apiWith(store);
    const first = await api.resolveOfferForUser('alice', 'getjob68');
    expect(first.pricing_plan_id).toBe('b');
    expect(first.abc_variant).toBe('b');
    expect(first.skip_channel_prices).toBe(true);
    expect(first.skus.map((s) => [s.id, s.amount, s.grant_days])).toEqual([['gj_b_s0', '80.00', 5]]);
    expect(store.sticky.alice.variant).toBe('b');
    expect(store.sticky.alice.source).toBe('allocation');
    const again = await apiWith(store).resolveOfferForUser('alice', 'getjob68');
    expect(again.pricing_plan_id).toBe('b');
    expect(again.skus[0].amount).toBe('80.00');
    expect(again.abc_source).toBe('allocation');
  });

  it('reassigns users stuck on the old single plan', async () => {
    const store = {
      plans: null,
      sticky: { bob: { variant: 'b', source: 'single_plan' } }
    };
    const api = apiWith(store);
    const offer = await api.resolveOfferForUser('bob', { site: 'getjob68' });
    expect(offer.pricing_plan_id).toBe('a');
    expect(offer.skus.map((s) => s.amount)).toEqual(['50.00']);
    expect(store.sticky.bob.source).toBe('allocation');
    expect(store.sticky.bob.variant).toBe('a');
  });

  it('leaves the old site on one catalog', async () => {
    const store = { plans: null, sticky: {} };
    const api = apiWith(store);
    const offer = await api.resolveOfferForUser('carol', 'lkj');
    expect(offer.pricing_site).toBe('lkj');
    expect(offer.variant).toBe('treatment');
    expect(offer.skus.map((s) => s.id)).toEqual(['sku_300_7d', 'sku_348_14d', 'sku_398_30d']);
    expect(offer.pricing_plan_id).toBeUndefined();
  });

  it('saves plans from admin', async () => {
    const store = { plans: null, sticky: {} };
    const api = apiWith(store);
    const saved = await api.savePricingPlansFromAdmin({
      plans: [
        {
          id: 'a',
          name: '默认方案',
          weight: 80,
          skus: [
            { slot: 'week', amount: '110', grant_days: 7 },
            { slot: 'month', amount: '160', grant_days: 30 },
            { slot: 'year', amount: '210', grant_days: 365 }
          ]
        },
        {
          id: 'c',
          name: '年卡试验',
          weight: 20,
          skus: [{ label: '半年卡', amount: '180', grant_days: 180 }]
        }
      ]
    });
    expect(store.savedKey).toBe('pricing_plans_getjob68_json');
    expect(saved.plans.map((p) => p.id)).toEqual(['a', 'c']);
    expect(saved.plans[0].skus[0].amount).toBe('110.00');
    expect(saved.plans[1].skus[0].grant_days).toBe(180);
    const loaded = await api.loadPricingPlans(true);
    expect(loaded.plans[1].name).toBe('年卡试验');
    expect(loaded.plans[1].skus[0].amount).toBe('180.00');
  });
});
