'use strict';

const { createUserPriceOffers, applyHalfPriceToShelf } = require('../../src/payments/userPriceOffers');

function mockApi(row) {
  return createUserPriceOffers({
    pool: {
      execute: async function () {
        return [row ? [row] : []];
      }
    }
  });
}

const SITE_SHELF = [
  { id: 'sku_300_7d', amount: '300.00', label: '周卡', subject: '激活码·周卡', grant_kind: 'trial', grant_days: 7 },
  { id: 'sku_348_14d', amount: '398.00', label: '双周卡', subject: '激活码·双周卡', grant_kind: 'trial', grant_days: 14 },
  { id: 'sku_398_30d', amount: '498.00', label: '月卡', subject: '激活码·月卡', grant_kind: 'trial', grant_days: 30 }
];

describe('half-price offer covers the whole shelf', () => {
  it('halves every site package and keeps the pre-discount strike', () => {
    const out = applyHalfPriceToShelf(SITE_SHELF);
    expect(out.map((s) => s.id)).toEqual(['sku_300_7d', 'sku_348_14d', 'sku_398_30d']);
    expect(out.map((s) => s.amount)).toEqual(['150.00', '199.00', '249.00']);
    expect(out.map((s) => s.list_amount)).toEqual(['300.00', '398.00', '498.00']);
    expect(out.map((s) => s.label)).toEqual(['半价周卡', '半价双周卡', '半价月卡']);
    expect(out[0].grant_days).toBe(7);
    expect(out[1].subject).toMatch(/半价/);
  });

  it('halves a channel shelf instead of collapsing to the stored week card', async () => {
    const api = mockApi({
      username: 'wpj123456789',
      sku_id: 'sku_300_7d',
      amount: '150.00',
      label: '半价周卡',
      note: '注册超24h未激活 email半价',
      enabled: 1
    });
    const channelShelf = [
      { id: 'sku_300_7d', amount: '60.00', label: '小时卡', subject: '激活码·小时卡', grant_days: 0, grant_hours: 1, channel_price: true },
      { id: 'sku_348_14d', amount: '100.00', label: '日卡', subject: '激活码·日卡', grant_days: 1, channel_price: true },
      { id: 'sku_398_30d', amount: '200.00', label: '周卡', subject: '激活码·周卡', grant_days: 7, channel_price: true },
      { id: 'sku_ch_t4', amount: '300.00', label: '月卡', subject: '激活码·月卡', grant_days: 30, channel_price: true },
      { id: 'sku_ch_t5', amount: '498.00', label: '永久', subject: '激活码·永久', grant_kind: 'permanent', grant_days: 3650, channel_price: true }
    ];
    const applied = await api.applyOfferToPricingOffer('wpj123456789', { skus: channelShelf, variant: 'treatment' });
    expect(applied.halfPriceAll).toBe(true);
    expect(applied.offer.skus).toHaveLength(5);
    expect(applied.offer.skus.map((s) => s.amount)).toEqual(['30.00', '50.00', '100.00', '150.00', '249.00']);
    expect(applied.offer.skus.map((s) => s.label)).toEqual([
      '半价小时卡',
      '半价日卡',
      '半价周卡',
      '半价月卡',
      '半价永久'
    ]);
    expect(applied.offer.skus[2].list_amount).toBe('200.00');
    expect(applied.offer.skus[4].grant_kind).toBe('permanent');
  });

  it('still replaces the shelf with one sku for a psych offer', async () => {
    const api = mockApi({
      username: 'biduser',
      sku_id: 'sku_300_7d',
      amount: '100.00',
      label: '周卡·心理价特惠',
      note: '心理价#22 自动通过',
      enabled: 1
    });
    const applied = await api.applyOfferToPricingOffer('biduser', { skus: SITE_SHELF });
    expect(applied.halfPriceAll).toBe(false);
    expect(applied.offer.skus).toHaveLength(1);
    expect(applied.offer.skus[0].id).toBe('sku_300_7d');
    expect(applied.offer.skus[0].amount).toBe('100.00');
    expect(applied.offer.skus[0].psych_offer).toBe(true);
  });
});
