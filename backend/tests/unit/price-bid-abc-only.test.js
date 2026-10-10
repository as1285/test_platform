'use strict';

const { readFileSync } = require('fs');
const { resolve } = require('path');

const priceBids = readFileSync(resolve(__dirname, '../../src/payments/priceBids.js'), 'utf8');
const routes = readFileSync(resolve(__dirname, '../../src/payments/routes.js'), 'utf8');

describe('心理价出价（渠道门控已放开）', () => {
  it('priceBids module still gates on cfg.enabled, not ABC-only', () => {
    expect(priceBids).toContain('function createPriceBids');
    expect(priceBids).toContain('if (!cfg.enabled)');
    expect(priceBids).toContain('当前暂未开放出价');
    expect(priceBids).not.toContain('userIsAbcSalesChannel');
    expect(priceBids).not.toContain('当前渠道暂未开放出价');
    expect(routes).toContain('/api/payments/price-bid');
  });
});
