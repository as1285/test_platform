'use strict';

const {
  resolvePurchaseAbcVariant,
  resolvePricingAbVariant,
  abcToOfferVariant,
  offerVariantToAbc,
  resolveCoverLongerGrant,
  createPricingAb,
  DEFAULT_PRICING_AB
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
      'sku_249_1d|sku_268_3d|sku_300_7d|sku_348_14d|sku_398_30d'
    );
    expect((cfg.control_skus || []).map((s) => s.amount).join('|')).toBe(
      '249.00|268.00|300.00|348.00|398.00'
    );
    expect(DEFAULT_PRICING_AB.treatment_skus.map((s) => s.label).join('|')).toBe(
      '天卡|3天卡|周卡|双周卡|月卡'
    );
    expect(DEFAULT_PRICING_AB.treatment_skus.map((s) => s.amount).join('|')).toBe(
      '249.00|268.00|300.00|348.00|398.00'
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
      sku_268_3d: { amount: '258.00', grant_days: 3, enabled: false },
      sku_300_7d: { amount: '280.00', grant_days: 7, enabled: true },
      sku_348_14d: { amount: '330.00', grant_days: 14, enabled: true },
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
    expect(ids).toContain('sku_99_1h');
    expect(ids).not.toContain('sku_268_3d');
    const hour = cfg.treatment_skus.find((s) => s.id === 'sku_99_1h');
    expect(hour.grant_hours).toBe(2);
    expect(hour.amount).toBe('59.00');
    const day = cfg.treatment_skus.find((s) => s.id === 'sku_249_1d');
    expect(day.grant_days).toBe(1);
    expect(day.grant_hours).toBe(6);
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
      sku_999_perm: '888.5',
      sku_fake: '12'
    });
    expect(next['sku_99_1h']).toBe('88.00');
    expect(next['sku_249_1d']).toBe('199.00');
    expect(next['sku_268_3d']).toBe('258.50');
    expect(next['sku_300_7d']).toBe('300.00');
    expect(next['sku_348_14d']).toBe('348.00');
    expect(next['sku_398_30d']).toBe('398.00');
    expect(next['sku_999_perm']).toBeUndefined();
    expect(next.sku_fake).toBeUndefined();
  });

  it('parses duration and listing flags; hour stays off for legacy price-only saves', () => {
    const legacy = normalizeCatalogConfig({
      sku_249_1d: '199',
      sku_398_30d: '380'
    });
    expect(legacy['sku_99_1h'].enabled).toBe(false);
    expect(legacy['sku_99_1h'].grant_hours).toBe(1);
    expect(legacy['sku_249_1d'].enabled).toBe(true);
    expect(legacy['sku_249_1d'].grant_days).toBe(1);
    expect(legacy['sku_249_1d'].amount).toBe('199.00');

    const structured = normalizeCatalogConfig({
      sku_99_1h: { amount: '50', grant_hours: 3, grant_days: 0, enabled: true },
      sku_249_1d: { amount: '180', grant_days: 2, grant_hours: 12, enabled: true },
      sku_300_7d: { amount: '280', grant_days: 10, enabled: false }
    });
    expect(structured['sku_99_1h'].enabled).toBe(true);
    expect(structured['sku_99_1h'].grant_hours).toBe(3);
    expect(structured['sku_249_1d'].grant_days).toBe(2);
    expect(structured['sku_249_1d'].grant_hours).toBe(12);
    expect(structured['sku_300_7d'].enabled).toBe(false);
    expect(structured['sku_300_7d'].grant_days).toBe(10);
    expect(defaultCatalogConfig()['sku_99_1h'].enabled).toBe(false);
  });
});
