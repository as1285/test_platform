'use strict';

const {
  resolvePurchaseAbcVariant,
  resolvePricingAbVariant,
  abcToOfferVariant,
  offerVariantToAbc,
  resolveCoverLongerGrant,
  createPricingAb,
  DEFAULT_PRICING_AB,
  shouldOfferGithubEntry,
  isGithubChannel,
  applyGithubChannelCatalogPrices,
  applyChannelCatalogPrices,
  prependGithubEntrySku,
  SKU_98_3DAY
} = require('../../src/legacy/pricingAb');

describe('pricingAb allocation', () => {
  it('resolvePurchaseAbcVariant is stable for a seed', () => {
    const a = resolvePurchaseAbcVariant('user-1', 50, 50, 0);
    const b = resolvePurchaseAbcVariant('user-1', 50, 50, 0);
    expect(a).toBe(b);
    expect(['a', 'b', 'c']).toContain(a);
  });

  it('100% A always returns a', () => {
    expect(resolvePurchaseAbcVariant('anyone', 100, 0, 0)).toBe('a');
  });

  it('100% B always returns b', () => {
    expect(resolvePurchaseAbcVariant('anyone', 0, 100, 0)).toBe('b');
  });

  it('maps offer variants', () => {
    expect(abcToOfferVariant('b')).toBe('treatment');
    expect(abcToOfferVariant('a')).toBe('control');
    expect(offerVariantToAbc('treatment')).toBe('b');
    expect(offerVariantToAbc('control')).toBe('a');
    expect(offerVariantToAbc('c')).toBe('c');
  });

  it('resolvePricingAbVariant maps treatment percent', () => {
    expect(resolvePricingAbVariant('seed', 0)).toBe('control');
    expect(resolvePricingAbVariant('seed', 100)).toBe('treatment');
  });
});

describe('resolveCoverLongerGrant', () => {
  it('applies permanent', () => {
    const r = resolveCoverLongerGrant({ activation_kind: 'none' }, { grant_kind: 'permanent' });
    expect(r.applied).toBe(true);
    expect(r.kind).toBe('permanent');
  });

  it('keeps already permanent', () => {
    const r = resolveCoverLongerGrant({ activation_kind: 'permanent' }, {
      grant_kind: 'trial',
      grant_days: 30
    });
    expect(r.applied).toBe(false);
    expect(r.reason).toBe('already_permanent');
  });

  it('keeps longer existing trial', () => {
    const far = new Date(Date.now() + 90 * 86400000).toISOString();
    const r = resolveCoverLongerGrant(
      { activation_kind: 'trial', active_until: far },
      { grant_kind: 'trial', grant_days: 1 }
    );
    expect(r.applied).toBe(false);
    expect(r.reason).toBe('keep_longer_existing');
  });

  it('covers shorter trial', () => {
    const near = new Date(Date.now() + 1 * 86400000).toISOString();
    const r = resolveCoverLongerGrant(
      { activation_kind: 'trial', active_until: near },
      { grant_kind: 'trial', grant_days: 30 }
    );
    expect(r.applied).toBe(true);
    expect(r.kind).toBe('trial');
  });
});

describe('pricingAb SKU mojibake repair via load', () => {
  it('repairs mojibake labels from defaults', async () => {
    const badLabel = 'æ—¥å¡¡';
    const setting = {
      enabled: true,
      a_percent: 50,
      b_percent: 50,
      c_percent: 0,
      treatment_skus: [
        {
          id: 'sku_199_1h',
          label: badLabel,
          subject: badLabel,
          amount: '199.00',
          grant_kind: 'trial',
          grant_hours: 1,
          grant_days: 0
        }
      ]
    };
    const conn = {
      execute: async (sql) => {
        if (String(sql).includes('pricing_ab_json') || String(sql).includes('?')) {
          return [[{ setting_value: JSON.stringify(setting) }]];
        }
        return [[]];
      },
      release: () => {}
    };
    const api = createPricingAb({
      pool: { getConnection: async () => conn },
      upsertAppSetting: async () => {},
      alipayNormalizeAmount: (v) => String(v || '')
    });
    const cfg = await api.loadPricingAbParsed(true);
    expect((cfg.treatment_skus || []).map((s) => s.id).join('|')).toBe(
      'sku_300_7d|sku_348_14d|sku_398_30d'
    );
    expect((cfg.control_skus || []).map((s) => s.amount).join('|')).toBe(
      '300.00|348.00|398.00'
    );
    expect(DEFAULT_PRICING_AB.treatment_skus.map((s) => s.label).join('|')).toBe(
      '周卡|双周卡|月卡'
    );
    expect(DEFAULT_PRICING_AB.treatment_skus.map((s) => s.amount).join('|')).toBe(
      '300.00|348.00|398.00'
    );
    expect(cfg.a_percent).toBe(0);
    expect(cfg.b_percent).toBe(100);
    expect(cfg.c_percent).toBe(0);
    expect(DEFAULT_PRICING_AB.a_percent).toBe(0);
    expect(DEFAULT_PRICING_AB.b_percent).toBe(100);
  });

  it('applies admin duration and listing to live skus', async () => {
    const catalog = {
      sku_99_1h: { amount: '59.00', grant_hours: 2, grant_days: 0, enabled: true },
      sku_249_1d: { amount: '188.00', grant_days: 1, grant_hours: 6, enabled: true },
      sku_268_3d: { amount: '258.00', grant_days: 3, enabled: true },
      sku_300_7d: { amount: '280.00', grant_days: 10, grant_hours: 6, enabled: true },
      sku_348_14d: { amount: '330.00', grant_days: 14, enabled: false },
      sku_398_30d: { amount: '360.00', grant_days: 30, enabled: true }
    };
    const conn = {
      execute: async (sql) => {
        if (String(sql).includes('sku_catalog_prices_json') || String(sql).includes('?')) {
          return [[{ setting_value: JSON.stringify(catalog) }]];
        }
        return [[]];
      },
      release: () => {}
    };
    const api = createPricingAb({
      pool: { getConnection: async () => conn },
      upsertAppSetting: async () => {},
      alipayNormalizeAmount: (v) => String(v || '')
    });
    const cfg = await api.loadPricingAbParsed(true);
    const ids = (cfg.treatment_skus || []).map((s) => s.id);
    expect(ids).not.toContain('sku_99_1h');
    expect(ids).not.toContain('sku_249_1d');
    expect(ids).not.toContain('sku_268_3d');
    expect(ids).not.toContain('sku_348_14d');
    expect(ids).toEqual(['sku_300_7d', 'sku_398_30d']);
    const week = cfg.treatment_skus.find((s) => s.id === 'sku_300_7d');
    expect(week.grant_days).toBe(10);
    expect(week.grant_hours).toBe(6);
    expect(week.amount).toBe('280.00');
  });
});

describe('sku catalog amounts', () => {
  const {
    normalizeCatalogAmounts,
    defaultCatalogAmounts,
    normalizeCatalogConfig,
    defaultCatalogConfig
  } = require('../../src/legacy/pricingAb');

  it('keeps defaults when raw is empty', () => {
    expect(normalizeCatalogAmounts(null)).toEqual(defaultCatalogAmounts());
  });

  it('overrides configurable sku prices and ignores junk', () => {
    const next = normalizeCatalogAmounts({
      sku_99_1h: '88',
      sku_249_1d: '199',
      sku_268_3d: '258.5',
      sku_300_7d: '0',
      sku_348_14d: '320.5',
      sku_999_perm: '888.5',
      sku_fake: '12'
    });
    expect(next['sku_99_1h']).toBeUndefined();
    expect(next['sku_249_1d']).toBeUndefined();
    expect(next['sku_268_3d']).toBeUndefined();
    expect(next['sku_300_7d']).toBe('300.00');
    expect(next['sku_348_14d']).toBe('320.50');
    expect(next['sku_398_30d']).toBe('398.00');
    expect(next['sku_999_perm']).toBeUndefined();
    expect(next.sku_fake).toBeUndefined();
  });

  it('parses duration and listing flags; hour card is no longer configurable', () => {
    const legacy = normalizeCatalogConfig({
      sku_249_1d: '199',
      sku_398_30d: '380'
    });
    expect(legacy['sku_99_1h']).toBeUndefined();
    expect(legacy['sku_249_1d']).toBeUndefined();
    expect(legacy['sku_268_3d']).toBeUndefined();
    expect(legacy['sku_398_30d'].enabled).toBe(true);
    expect(legacy['sku_398_30d'].grant_days).toBe(30);
    expect(legacy['sku_398_30d'].amount).toBe('380.00');

    const structured = normalizeCatalogConfig({
      sku_99_1h: { amount: '50', grant_hours: 3, grant_days: 0, enabled: true },
      sku_249_1d: { amount: '180', grant_days: 2, grant_hours: 12, enabled: true },
      sku_300_7d: { amount: '280', grant_days: 10, grant_hours: 12, enabled: false }
    });
    expect(structured['sku_99_1h']).toBeUndefined();
    expect(structured['sku_249_1d']).toBeUndefined();
    expect(structured['sku_300_7d'].enabled).toBe(false);
    expect(structured['sku_300_7d'].grant_days).toBe(10);
    expect(structured['sku_300_7d'].grant_hours).toBe(12);
    expect(defaultCatalogConfig()['sku_99_1h']).toBeUndefined();
    expect(defaultCatalogConfig()['sku_249_1d']).toBeUndefined();
    expect(defaultCatalogConfig()['sku_268_3d']).toBeUndefined();
  });

  it('applies psych_amount as shelf pay price with list_amount strike', () => {
    const { cloneLiveCatalog } = require('../../src/legacy/pricingAb');
    const cfg = normalizeCatalogConfig({
      sku_300_7d: { amount: '300', psych_amount: '120', grant_days: 7, enabled: true },
      sku_348_14d: { amount: '348', psych_amount: '', grant_days: 14, enabled: true },
      sku_398_30d: { amount: '398', psych_amount: '400', grant_days: 30, enabled: true }
    });
    expect(cfg['sku_300_7d'].psych_amount).toBe('120.00');
    expect(cfg['sku_348_14d'].psych_amount).toBe('');
    /* 心理价不低于原价时 normalize 仍保留数字，上架时不会套用 */
    expect(cfg['sku_398_30d'].psych_amount).toBe('400.00');
    const live = cloneLiveCatalog(cfg);
    const week = live.find((s) => s.id === 'sku_300_7d');
    expect(week.amount).toBe('120.00');
    expect(week.list_amount).toBe('300.00');
    expect(week.psych_offer).toBe(true);
    expect(week.label).toContain('心理价特惠');
    const two = live.find((s) => s.id === 'sku_348_14d');
    expect(two.amount).toBe('348.00');
    expect(two.psych_offer).toBeFalsy();
    const month = live.find((s) => s.id === 'sku_398_30d');
    expect(month.amount).toBe('398.00');
    expect(month.psych_offer).toBeFalsy();
  });
});

describe('GitHub legacy helpers (no longer applied in resolveOfferForUser)', () => {
  it('shouldOfferGithubEntry still detects unactivated GitHub promo users', () => {
    expect(
      shouldOfferGithubEntry({ sales_promo_channel: 'github', register_source_channel: 'douyin', account_active: 0 })
    ).toBe(true);
    expect(
      shouldOfferGithubEntry({ sales_promo_channel: 'GitHub', register_source_channel: 'other', account_active: false })
    ).toBe(true);
    expect(
      shouldOfferGithubEntry({ sales_promo_channel: 'github', register_source_channel: 'github', account_active: 1 })
    ).toBe(false);
    expect(
      shouldOfferGithubEntry({ register_source_channel: 'github', account_active: 0 })
    ).toBe(false);
    expect(
      shouldOfferGithubEntry({ sales_promo_channel: 'douyin', register_source_channel: 'github', account_active: 0 })
    ).toBe(false);
    expect(shouldOfferGithubEntry(null)).toBe(false);
  });

  it('prepends the 98 experience SKU once', () => {
    expect(SKU_98_3DAY.amount).toBe('98.00');
    expect(SKU_98_3DAY.grant_days).toBe(3);
    const once = prependGithubEntrySku([{ id: 'sku_300_7d', amount: '300.00', label: '周卡' }]);
    expect(once[0].id).toBe('sku_98_3d');
    expect(once[0].amount).toBe('98.00');
    expect(once.length).toBe(2);
    const twice = prependGithubEntrySku(once);
    expect(twice.filter((s) => s.id === 'sku_98_3d').length).toBe(1);
  });

  it('rewrites week/biweek/month amounts for GitHub promo link only', () => {
    expect(isGithubChannel({ sales_promo_channel: 'github' })).toBe(true);
    expect(isGithubChannel({ register_source_channel: 'github' })).toBe(false);
    expect(isGithubChannel({ sales_promo_channel: 'douyin' })).toBe(false);
    const out = applyGithubChannelCatalogPrices([
      { id: 'sku_300_7d', amount: '300.00', label: '周卡' },
      { id: 'sku_348_14d', amount: '398.00', label: '双周卡' },
      { id: 'sku_398_30d', amount: '498.00', label: '月卡' },
      { id: 'sku_98_3d', amount: '98.00', label: '体验卡' }
    ]);
    expect(out.find((s) => s.id === 'sku_300_7d').amount).toBe('200.00');
    expect(out.find((s) => s.id === 'sku_348_14d').amount).toBe('300.00');
    expect(out.find((s) => s.id === 'sku_398_30d').amount).toBe('398.00');
    expect(out.find((s) => s.id === 'sku_98_3d').amount).toBe('98.00');
  });

  it('applyChannelCatalogPrices overlays only mapped skus', () => {
    const out = applyChannelCatalogPrices(
      [
        { id: 'sku_300_7d', amount: '300.00', label: '周卡', grant_days: 7, grant_hours: 0 },
        { id: 'sku_348_14d', amount: '348.00', label: '双周卡', grant_days: 14, grant_hours: 0 },
        { id: 'sku_398_30d', amount: '398.00', label: '月卡', grant_days: 30, grant_hours: 0 }
      ],
      { sku_300_7d: '199.00', sku_398_30d: '350.00' }
    );
    expect(out.find((s) => s.id === 'sku_300_7d').amount).toBe('199.00');
    expect(out.find((s) => s.id === 'sku_300_7d').channel_price).toBe(true);
    expect(out.find((s) => s.id === 'sku_348_14d').amount).toBe('348.00');
    expect(out.find((s) => s.id === 'sku_398_30d').amount).toBe('350.00');
  });

  it('applyChannelCatalogPrices overlays grant days and hours', () => {
    const out = applyChannelCatalogPrices(
      [{ id: 'sku_300_7d', amount: '300.00', label: '周卡', grant_days: 7, grant_hours: 0 }],
      {
        sku_300_7d: {
          amount: '88.00',
          grant_days: 1,
          grant_hours: 12,
          label: '体验'
        }
      }
    );
    const s = out[0];
    expect(s.amount).toBe('88.00');
    expect(s.grant_days).toBe(1);
    expect(s.grant_hours).toBe(12);
    expect(s.label).toBe('体验');
    expect(s.subject).toContain('体验');
  });

  it('applyChannelCatalogPrices appends 4th and 5th channel tiers', () => {
    const out = applyChannelCatalogPrices(
      [
        { id: 'sku_300_7d', amount: '300.00', label: '周卡', grant_days: 7, grant_hours: 0 },
        { id: 'sku_348_14d', amount: '348.00', label: '双周卡', grant_days: 14, grant_hours: 0 },
        { id: 'sku_398_30d', amount: '398.00', label: '月卡', grant_days: 30, grant_hours: 0 }
      ],
      {
        sku_ch_t4: { amount: '598.00', grant_days: 90, grant_hours: 0, label: '季卡' },
        sku_ch_t5: { amount: '998.00', grant_days: 365, grant_hours: 0, label: '年卡' }
      }
    );
    expect(out.map((s) => s.id)).toEqual([
      'sku_300_7d',
      'sku_348_14d',
      'sku_398_30d',
      'sku_ch_t4',
      'sku_ch_t5'
    ]);
    const t4 = out.find((s) => s.id === 'sku_ch_t4');
    expect(t4.amount).toBe('598.00');
    expect(t4.grant_days).toBe(90);
    expect(t4.label).toBe('季卡');
    expect(t4.channel_price).toBe(true);
    expect(out.find((s) => s.id === 'sku_ch_t5').label).toBe('年卡');
  });

  it('applyChannelCatalogPrices skips extra tier without amount or duration', () => {
    const out = applyChannelCatalogPrices(
      [{ id: 'sku_300_7d', amount: '300.00', label: '周卡', grant_days: 7, grant_hours: 0 }],
      {
        sku_ch_t4: { amount: '598.00', grant_days: 0, grant_hours: 0, label: '空档' },
        sku_ch_t5: { grant_days: 365, grant_hours: 0, label: '年卡' }
      }
    );
    expect(out.map((s) => s.id)).toEqual(['sku_300_7d']);
  });

  it('applyChannelCatalogPrices applies channel list_amount as strike anchor', () => {
    const out = applyChannelCatalogPrices(
      [
        {
          id: 'sku_300_7d',
          amount: '120.00',
          list_amount: '300.00',
          psych_offer: true,
          label: '周卡·心理价特惠',
          grant_days: 7,
          grant_hours: 0
        }
      ],
      {
        sku_300_7d: {
          amount: '199.00',
          list_amount: '399.00',
          label: '体验卡'
        }
      }
    );
    const s = out[0];
    expect(s.amount).toBe('199.00');
    expect(s.list_amount).toBe('399.00');
    expect(s.psych_offer).toBe(true);
    expect(s.label).toBe('体验卡·心理价特惠');
    expect(s.channel_price).toBe(true);
  });

  it('applyChannelCatalogPrices ignores list_amount not above pay price', () => {
    const out = applyChannelCatalogPrices(
      [{ id: 'sku_300_7d', amount: '300.00', label: '周卡', grant_days: 7, grant_hours: 0 }],
      { sku_300_7d: { amount: '199.00', list_amount: '150.00' } }
    );
    expect(out[0].amount).toBe('199.00');
    expect(out[0].list_amount).toBeUndefined();
    expect(out[0].psych_offer).toBeUndefined();
    expect(out[0].bid_min).toBe('150.00');
  });

  it('applyChannelCatalogPrices uses below-pay psych as C-end bid floor', () => {
    const out = applyChannelCatalogPrices(
      [
        { id: 'sku_300_7d', amount: '300.00', label: '周卡', grant_days: 7, grant_hours: 0 },
        { id: 'sku_348_14d', amount: '348.00', label: '双周卡', grant_days: 14, grant_hours: 0 },
        { id: 'sku_398_30d', amount: '398.00', label: '月卡', grant_days: 30, grant_hours: 0 }
      ],
      {
        sku_300_7d: { amount: '60.00', grant_days: 0, grant_hours: 1, label: '小时卡' },
        sku_348_14d: { amount: '200.00', list_amount: '100.00', grant_days: 7, label: '周卡' },
        sku_398_30d: { amount: '300.00', list_amount: '200.00', grant_days: 30, label: '月卡' },
        sku_ch_t4: { amount: '498.00', list_amount: '300.00', grant_days: 3650, label: '年卡' }
      }
    );
    const hour = out.find((s) => s.id === 'sku_300_7d');
    const week = out.find((s) => s.id === 'sku_348_14d');
    const month = out.find((s) => s.id === 'sku_398_30d');
    const year = out.find((s) => s.id === 'sku_ch_t4');
    expect(hour.bid_min).toBeUndefined();
    expect(week.bid_min).toBe('100.00');
    expect(week.list_amount).toBeUndefined();
    expect(month.bid_min).toBe('200.00');
    expect(year.bid_min).toBe('300.00');
    expect(year.amount).toBe('498.00');
  });

  it('applyChannelCatalogPrices blank psych clears site-wide strikethrough', () => {
    const out = applyChannelCatalogPrices(
      [
        {
          id: 'sku_300_7d',
          amount: '120.00',
          list_amount: '300.00',
          psych_offer: true,
          label: '周卡·心理价特惠',
          grant_days: 7,
          grant_hours: 0
        }
      ],
      { sku_300_7d: { amount: '99.00', grant_days: 0, grant_hours: 1, label: '小时卡' } }
    );
    const s = out[0];
    expect(s.amount).toBe('99.00');
    expect(s.channel_price).toBe(true);
    expect(s.list_amount).toBeUndefined();
    expect(s.psych_offer).toBeUndefined();
    expect(s.label).toBe('小时卡');
    expect(String(s.label)).not.toContain('心理价');
  });

  it('applyChannelCatalogPrices blank psych on duration-only override also clears site strikethrough', () => {
    const out = applyChannelCatalogPrices(
      [
        {
          id: 'sku_348_14d',
          amount: '200.00',
          list_amount: '348.00',
          psych_offer: true,
          label: '双周卡·心理价特惠',
          grant_days: 14,
          grant_hours: 0
        }
      ],
      { sku_348_14d: { grant_days: 30, grant_hours: 0, label: '月卡' } }
    );
    const s = out[0];
    expect(s.amount).toBe('200.00');
    expect(s.grant_days).toBe(30);
    expect(s.channel_price).toBe(true);
    expect(s.list_amount).toBeUndefined();
    expect(s.psych_offer).toBeUndefined();
    expect(s.label).toBe('月卡');
  });

  it('applyChannelCatalogPrices filled psych keeps channel strikethrough only', () => {
    const out = applyChannelCatalogPrices(
      [
        {
          id: 'sku_398_30d',
          amount: '300.00',
          list_amount: '398.00',
          psych_offer: true,
          label: '月卡·心理价特惠',
          grant_days: 30,
          grant_hours: 0
        }
      ],
      {
        sku_398_30d: {
          amount: '399.00',
          list_amount: '598.00',
          grant_days: 30,
          grant_hours: 0,
          label: '月卡'
        }
      }
    );
    const s = out[0];
    expect(s.amount).toBe('399.00');
    expect(s.list_amount).toBe('598.00');
    expect(s.psych_offer).toBe(true);
    expect(s.label).toContain('心理价');
    expect(s.bid_min).toBeUndefined();
  });

  it('applyChannelCatalogPrices appends extra tier with list_amount', () => {
    const out = applyChannelCatalogPrices(
      [{ id: 'sku_300_7d', amount: '300.00', label: '周卡', grant_days: 7, grant_hours: 0 }],
      {
        sku_ch_t4: {
          amount: '598.00',
          list_amount: '798.00',
          grant_days: 90,
          grant_hours: 0,
          label: '季卡'
        }
      }
    );
    const t4 = out.find((s) => s.id === 'sku_ch_t4');
    expect(t4.amount).toBe('598.00');
    expect(t4.list_amount).toBe('798.00');
    expect(t4.psych_offer).toBe(true);
    expect(t4.label).toContain('心理价');
  });

  it('channel permanent tier keeps own amount 1998, not year-card 998', () => {
    const base = [
      { id: 'sku_300_7d', amount: '300.00', label: '周卡', grant_days: 7, grant_hours: 0 },
      { id: 'sku_348_14d', amount: '348.00', label: '双周卡', grant_days: 14, grant_hours: 0 },
      { id: 'sku_398_30d', amount: '398.00', label: '月卡', grant_days: 30, grant_hours: 0 },
      /* 残留模板默认 998：旧逻辑在覆盖缺 amount 时会让永久档继续显示 998 */
      {
        id: 'sku_ch_t5',
        amount: '998.00',
        label: '档位5',
        grant_days: 365,
        grant_hours: 0,
        channel_price: true
      }
    ];
    const out = applyChannelCatalogPrices(base, {
      sku_300_7d: { amount: '99.00', grant_days: 0, grant_hours: 1, label: '小时卡' },
      sku_348_14d: { amount: '300.00', grant_days: 7, grant_hours: 0, label: '周卡' },
      sku_398_30d: { amount: '498.00', grant_days: 30, grant_hours: 0, label: '月卡' },
      sku_ch_t4: { amount: '998.00', grant_days: 365, grant_hours: 0, label: '年卡' },
      sku_ch_t5: {
        amount: '1998.00',
        list_amount: '2698.00',
        grant_days: 3650,
        grant_hours: 0,
        label: '永久'
      }
    });
    const year = out.find((s) => s.id === 'sku_ch_t4');
    const perm = out.find((s) => s.id === 'sku_ch_t5');
    expect(year.amount).toBe('998.00');
    expect(year.label).toBe('年卡');
    expect(perm.amount).toBe('1998.00');
    expect(perm.list_amount).toBe('2698.00');
    expect(perm.label).toContain('永久');
    expect(perm.grant_kind).toBe('permanent');
    expect(perm.channel_price).toBe(true);
    expect(perm.amount).not.toBe(year.amount);
  });

  it('channel permanent without amount is dropped instead of keeping stale 998', () => {
    const out = applyChannelCatalogPrices(
      [
        { id: 'sku_300_7d', amount: '300.00', label: '周卡', grant_days: 7, grant_hours: 0 },
        {
          id: 'sku_ch_t5',
          amount: '998.00',
          label: '档位5',
          grant_days: 365,
          grant_hours: 0
        }
      ],
      {
        sku_ch_t5: { grant_days: 3650, grant_hours: 0, label: '永久' }
      }
    );
    expect(out.find((s) => s.id === 'sku_ch_t5')).toBeUndefined();
    expect(out.map((s) => s.id)).toEqual(['sku_300_7d']);
  });

  it('channel permanent psych list_amount is per-tier and never copies year card', () => {
    const out = applyChannelCatalogPrices(
      [
        { id: 'sku_300_7d', amount: '300.00', label: '周卡', grant_days: 7, grant_hours: 0 }
      ],
      {
        sku_ch_t4: {
          amount: '998.00',
          list_amount: '1350.00',
          grant_days: 365,
          grant_hours: 0,
          label: '年卡'
        },
        sku_ch_t5: {
          amount: '1998.00',
          list_amount: '2700.00',
          grant_days: 3650,
          grant_hours: 0,
          label: '永久'
        }
      }
    );
    const year = out.find((s) => s.id === 'sku_ch_t4');
    const perm = out.find((s) => s.id === 'sku_ch_t5');
    expect(year.list_amount).toBe('1350.00');
    expect(perm.list_amount).toBe('2700.00');
    expect(perm.list_amount).not.toBe(year.list_amount);
    expect(perm.amount).toBe('1998.00');
  });
});
