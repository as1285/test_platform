const { createPriceBids, normalizeBidConfig, DEFAULT_BID_CONFIG } = require('../../src/payments/priceBids');

function normalizeAmount(v) {
  var n = Number(String(v == null ? '' : v).trim());
  if (!isFinite(n) || n <= 0) return '';
  return n.toFixed(2);
}

function makeStubPool(state) {
  return {
    execute: async function (sql, params) {
      state.queries.push({ sql: sql, params: params || [] });
      if (sql.indexOf('CREATE TABLE') === 0) return [{}];
      if (sql.indexOf('SELECT setting_value') >= 0) {
        return [state.configRow ? [{ setting_value: state.configRow }] : []];
      }
      if (sql.indexOf("status = 'pending'") >= 0 && sql.indexOf('SELECT *') >= 0) {
        return [state.pendingRow ? [state.pendingRow] : []];
      }
      if (sql.indexOf("status = 'pending'") >= 0 && sql.indexOf('COUNT(*)') >= 0) {
        return [[{ n: state.pendingCount || 0 }]];
      }
      if (sql.indexOf('INTERVAL 1 DAY') >= 0 && sql.indexOf('COUNT(*)') >= 0) {
        return [[{ n: state.recentCount || 0 }]];
      }
      if (sql.indexOf('INSERT INTO user_price_bids') >= 0) {
        return [{ insertId: state.nextId || 7 }];
      }
      if (sql.indexOf('SELECT * FROM user_price_bids WHERE id') >= 0) {
        return [state.bidRow ? [state.bidRow] : []];
      }
      if (sql.indexOf('UPDATE user_price_bids') >= 0) return [{}];
      if (sql.indexOf('INSERT INTO app_settings') >= 0) return [{}];
      if (sql.indexOf('SELECT * FROM user_price_bids WHERE username') >= 0) return [[]];
      if (sql.indexOf("SUM(status='pending')") >= 0) {
        return [[{ pending: 0, accepted: 0, rejected: 0 }]];
      }
      if (sql.indexOf('SELECT * FROM user_price_bids') >= 0) return [[]];
      return [[]];
    }
  };
}

function makeStubOffers(calls) {
  return {
    listOfferableSkusLive: async function () {
      return [
        { id: 'sku_300_7d', amount: '300.00', label: '周卡' },
        { id: 'sku_398_30d', amount: '398.00', label: '月卡' }
      ];
    },
    upsertOffer: async function (username, input, createdBy) {
      calls.push({ username: username, input: input, createdBy: createdBy });
      return { username: username, amount: input.amount };
    }
  };
}

function makeApi(state, offerCalls, notifications) {
  return createPriceBids({
    pool: makeStubPool(state),
    normalizeAmount: normalizeAmount,
    offers: makeStubOffers(offerCalls),
    notifyUser: async function (username, title, body, link) {
      notifications.push({ username: username, title: title, body: body, link: link });
      return { email_sent: false, reason: 'no_email' };
    }
  });
}

describe('normalizeBidConfig', () => {
  it('falls back to defaults and clamps ranges', () => {
    expect(normalizeBidConfig(null)).toEqual(DEFAULT_BID_CONFIG);
    const cfg = normalizeBidConfig({ enabled: 0, floor_pct: 250, min_amount: 0, daily_limit: 99 });
    expect(cfg.enabled).toBe(false);
    expect(cfg.floor_pct).toBe(100);
    expect(cfg.min_amount).toBe(1);
    expect(cfg.daily_limit).toBe(10);
    expect(cfg.floor_by_sku.sku_300_7d).toBe(120);
    expect(cfg.floor_by_sku.sku_348_14d).toBe(199);
    expect(cfg.floor_by_sku.sku_398_30d).toBe(298);
  });
});

describe('submitBid auto accept vs pending', () => {
  it('auto-accepts at or above week-card floor (¥120) and writes offer', async () => {
    const state = { queries: [] };
    const offerCalls = [];
    const notes = [];
    const api = makeApi(state, offerCalls, notes);
    const out = await api.submitBid('u1', { sku_id: 'sku_300_7d', amount: '120' });
    expect(out.status).toBe('accepted');
    expect(out.accepted_amount).toBe('120.00');
    expect(offerCalls.length).toBe(1);
    expect(offerCalls[0].username).toBe('u1');
    expect(offerCalls[0].input.sku_id).toBe('sku_300_7d');
    expect(offerCalls[0].input.amount).toBe('120.00');
    expect(notes.length).toBe(1);
  });

  it('queues below-floor bids as pending without touching offers', async () => {
    const state = { queries: [] };
    const offerCalls = [];
    const api = makeApi(state, offerCalls, []);
    const out = await api.submitBid('u1', { sku_id: 'sku_300_7d', amount: '100' });
    expect(out.status).toBe('pending');
    expect(offerCalls.length).toBe(0);
  });

  it('rejects bids at or above list price', async () => {
    const api = makeApi({ queries: [] }, [], []);
    await expect(api.submitBid('u1', { sku_id: 'sku_300_7d', amount: '300' })).rejects.toThrow(
      /不低于现价/
    );
  });

  it('rejects bids below global min amount', async () => {
    const api = makeApi({ queries: [] }, [], []);
    await expect(api.submitBid('u1', { sku_id: 'sku_300_7d', amount: '5' })).rejects.toThrow(
      /不能低于 30/
    );
  });

  it('updates existing pending bid instead of blocking', async () => {
    const pendingRow = {
      id: 5,
      username: 'u1',
      sku_id: 'sku_300_7d',
      sku_label: '周卡',
      list_amount: '300.00',
      bid_amount: '80.00',
      status: 'pending'
    };
    const state = { queries: [], pendingRow: pendingRow };
    const offerCalls = [];
    const api = makeApi(state, offerCalls, []);
    const out = await api.submitBid('u1', { sku_id: 'sku_300_7d', amount: '100', note: '再加点' });
    expect(out.status).toBe('pending');
    expect(out.updated).toBe(true);
    expect(out.bid_amount).toBe('100.00');
    expect(offerCalls.length).toBe(0);
    const upd = state.queries.find(function (q) {
      return String(q.sql || '').indexOf('UPDATE user_price_bids SET sku_id') >= 0;
    });
    expect(upd).toBeTruthy();
    expect(upd.params[3]).toBe('100.00');
  });

  it('auto-accepts when revising pending bid up to floor', async () => {
    const pendingRow = {
      id: 6,
      username: 'u1',
      sku_id: 'sku_300_7d',
      sku_label: '周卡',
      list_amount: '300.00',
      bid_amount: '80.00',
      status: 'pending'
    };
    const offerCalls = [];
    const notes = [];
    const api = makeApi({ queries: [], pendingRow: pendingRow }, offerCalls, notes);
    const out = await api.submitBid('u1', { sku_id: 'sku_300_7d', amount: '120' });
    expect(out.status).toBe('accepted');
    expect(out.updated).toBe(true);
    expect(out.accepted_amount).toBe('120.00');
    expect(offerCalls.length).toBe(1);
    expect(notes.length).toBe(1);
  });

  it('enforces daily limit', async () => {
    const api = makeApi({ queries: [], recentCount: 1 }, [], []);
    await expect(api.submitBid('u1', { sku_id: 'sku_300_7d', amount: '200' })).rejects.toThrow(
      /次数已用完/
    );
  });
});

describe('reviewBid', () => {
  const pendingRow = {
    id: 9,
    username: 'u2',
    sku_id: 'sku_300_7d',
    sku_label: '周卡',
    list_amount: '300.00',
    bid_amount: '120.00',
    status: 'pending'
  };

  it('accepts with counter amount and writes offer', async () => {
    const offerCalls = [];
    const notes = [];
    const api = makeApi({ queries: [], bidRow: Object.assign({}, pendingRow) }, offerCalls, notes);
    const out = await api.reviewBid({ id: 9, action: 'accept', amount: '150', admin: 'boss' });
    expect(out.status).toBe('accepted');
    expect(out.accepted_amount).toBe('150.00');
    expect(out.email_sent).toBe(false);
    expect(out.email_reason).toBe('no_email');
    expect(offerCalls[0].input.amount).toBe('150.00');
    expect(offerCalls[0].createdBy).toBe('boss');
    expect(notes.length).toBe(1);
  });

  it('rejects and notifies user', async () => {
    const notes = [];
    const api = makeApi({ queries: [], bidRow: Object.assign({}, pendingRow) }, [], notes);
    const out = await api.reviewBid({ id: 9, action: 'reject', admin: 'boss' });
    expect(out.status).toBe('rejected');
    expect(out.email_sent).toBe(false);
    expect(notes.length).toBe(1);
  });

  it('refuses to re-review a settled bid', async () => {
    const settled = Object.assign({}, pendingRow, { status: 'accepted' });
    const api = makeApi({ queries: [], bidRow: settled }, [], []);
    await expect(api.reviewBid({ id: 9, action: 'reject' })).rejects.toThrow(/已处理/);
  });
});
