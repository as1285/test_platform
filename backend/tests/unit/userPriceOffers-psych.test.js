'use strict';

const { buildSkuFromOffer } = require('../../src/payments/userPriceOffers');

describe('userPriceOffers psych bid sku', () => {
  it('marks 心理价特惠 as psych_offer and keeps catalog strike', () => {
    const sku = buildSkuFromOffer({
      sku_id: 'sku_300_7d',
      amount: '100.00',
      label: '周卡·心理价特惠',
      note: '心理价#110 自动通过'
    });
    expect(sku).toBeTruthy();
    expect(sku.id).toBe('sku_300_7d');
    expect(sku.amount).toBe('100.00');
    expect(sku.psych_offer).toBe(true);
    expect(Number(sku.list_amount)).toBeGreaterThan(100);
    expect(sku.subject).toMatch(/专属价/);
  });

  it('does not mark a plain exclusive price as psych_offer', () => {
    const sku = buildSkuFromOffer({
      sku_id: 'sku_300_7d',
      amount: '180.00',
      label: '周卡（专属价）',
      note: '后台改价'
    });
    expect(sku.psych_offer).toBeFalsy();
    expect(sku.amount).toBe('180.00');
  });
});
