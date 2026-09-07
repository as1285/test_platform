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
      if (sql.indexOf("status = 'accepted'") >= 0 && sql.indexOf('SELECT * FROM user_price_bids') >= 0) {
        return [state.acceptedRows || []];
      }
      if (sql.indexOf('SELECT * FROM user_price_bids WHERE status = ?') >= 0) {
        var st = params && params[0];
        if (st === 'accepted') return [state.acceptedRows || []];
        if (st === 'pending') return [state.pendingRows || (state.pendingRow ? [state.pendingRow] : [])];
        if (st === 'rejected') return [state.rejectedRows || []];
        return [[]];
      }
      if (sql.indexOf('FROM users WHERE username IN') >= 0) {
        return [state.userRows || []];
      }
      if (sql.indexOf('FROM payment_orders po') >= 0 || sql.indexOf('MAX(id) AS mid FROM payment_orders') >= 0) {
        return [state.paidRows || []];
      }
      if (sql.indexOf('FROM payment_orders WHERE username = ?') >= 0) {
        return [state.paymentHistory || []];
      }
      if (sql.indexOf('FROM user_price_offers WHERE username IN') >= 0) {
        return [state.offerRows || []];
      }
      if (sql.indexOf('UPDATE user_price_bids') >= 0) return [{}];
      if (sql.indexOf('INSERT INTO app_settings') >= 0) return [{}];
      if (sql.indexOf('SELECT * FROM user_price_bids WHERE username') >= 0) return [[]];
      if (sql.indexOf("SUM(status='pending')") >= 0) {
        return [[{ pending: 0, accepted: 0, rejected: 0 }]];
      }
      if (sql.indexOf('SELECT * FROM user_price_bids') >= 0) return [[]];
      if (sql.indexOf('SELECT created_at FROM users') >= 0) {
        return [state.userCreatedAt ? [{ created_at: state.userCreatedAt }] : []];
      }
      if (sql.indexOf('user_page_events') >= 0 && sql.indexOf('COUNT(*)') >= 0) {
        return [[{ n: state.purchaseViewCount != null ? state.purchaseViewCount : 0 }]];
      }
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

function makeApi(state, offerCalls, notifications, onBidRecorded, listPurchaseSkusForUser, notifyImpl) {
  return createPriceBids({
    pool: makeStubPool(state),
    normalizeAmount: normalizeAmount,
    offers: makeStubOffers(offerCalls),
    notifyUser:
      notifyImpl ||
      (async function (username, title, body, link) {
        notifications.push({ username: username, title: title, body: body, link: link });
        return { email_sent: false, reason: 'no_email' };
      }),
    onBidRecorded: onBidRecorded,
    listPurchaseSkusForUser: listPurchaseSkusForUser
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
    const recorded = [];
    const api = makeApi(state, offerCalls, [], async function (username, amount) {
      recorded.push({ username: username, amount: amount });
    });
    const out = await api.submitBid('u1', { sku_id: 'sku_300_7d', amount: '100' });
    expect(out.status).toBe('pending');
    expect(offerCalls.length).toBe(0);
    expect(recorded).toEqual([{ username: 'u1', amount: '100.00' }]);
  });

  it('rejects bids at or above list price', async () => {
    const api = makeApi({ queries: [] }, [], []);
    await expect(api.submitBid('u1', { sku_id: 'sku_300_7d', amount: '300' })).rejects.toThrow(
      /不低于现价/
    );
  });

  it('compares against selected year-card sale price, not cheapest week tier', async () => {
    const shelf = async function () {
      return [
        { id: 'sku_300_7d', amount: '300.00', label: '周卡' },
        { id: 'sku_ch_t4', amount: '998.00', label: '年卡', grant_days: 365 },
        { id: 'sku_ch_t5', amount: '1998.00', label: '永久', grant_kind: 'permanent' }
      ];
    };
    const api = makeApi({ queries: [] }, [], [], null, shelf);
    /* 300 < 年卡现价 998 → 应受理（低于默认底价线则进 pending） */
    const out = await api.submitBid('u1', { sku_id: 'sku_ch_t4', amount: '300' });
    expect(out.status).toBe('pending');
    expect(out.sku_label).toBe('年卡');
    /* 出价 >= 年卡现价才拒 */
    await expect(api.submitBid('u1', { sku_id: 'sku_ch_t4', amount: '998' })).rejects.toThrow(
      /不低于现价 ¥998/
    );
    /* 永久档同样用本档现价 */
    const perm = await api.submitBid('u1', { sku_id: 'sku_ch_t5', amount: '500' });
    expect(perm.status).toBe('pending');
    expect(perm.sku_label).toBe('永久');
    await expect(api.submitBid('u1', { sku_id: 'sku_ch_t5', amount: '1998' })).rejects.toThrow(
      /不低于现价 ¥1998/
    );
  });

  it('rejects unknown selected sku_id instead of falling back to cheapest live sku', async () => {
    const api = makeApi({ queries: [] }, [], []);
    await expect(api.submitBid('u1', { sku_id: 'sku_ch_t4', amount: '300' })).rejects.toThrow(
      /所选套餐不可出价/
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

describe('getBackPromptContext', () => {
  it('marks eligible within 48h after 2+ purchase views', async () => {
    const api = makeApi(
      {
        queries: [],
        userCreatedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
        purchaseViewCount: 2
      },
      [],
      []
    );
    const out = await api.getBackPromptContext('u1');
    expect(out.within_48h).toBe(true);
    expect(out.visit_count).toBe(2);
    expect(out.eligible).toBe(true);
  });

  it('not eligible on first visit or after 48h', async () => {
    const apiFresh = makeApi(
      {
        queries: [],
        userCreatedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        purchaseViewCount: 1
      },
      [],
      []
    );
    const fresh = await apiFresh.getBackPromptContext('u1');
    expect(fresh.eligible).toBe(false);

    const apiOld = makeApi(
      {
        queries: [],
        userCreatedAt: new Date(Date.now() - 60 * 3600 * 1000).toISOString(),
        purchaseViewCount: 5
      },
      [],
      []
    );
    const old = await apiOld.getBackPromptContext('u1');
    expect(old.within_48h).toBe(false);
    expect(old.eligible).toBe(false);
  });
});

describe('listFollowup and remindAccepted', () => {
  const acceptedUnpaid = {
    id: 11,
    username: 'u_unpaid',
    sku_id: 'sku_300_7d',
    sku_label: '周卡',
    list_amount: '300.00',
    bid_amount: '120.00',
    accepted_amount: '120.00',
    status: 'accepted',
    auto: 0,
    reviewed_at: '2026-09-01 10:00:00',
    created_at: '2026-09-01 09:00:00'
  };
  const acceptedPaid = {
    id: 12,
    username: 'u_paid',
    sku_id: 'sku_398_30d',
    sku_label: '月卡',
    list_amount: '398.00',
    bid_amount: '298.00',
    accepted_amount: '298.00',
    status: 'accepted',
    auto: 1,
    reviewed_at: '2026-09-02 10:00:00',
    created_at: '2026-09-02 09:00:00'
  };

  it('filters unpaid vs paid using account_active and paid orders', async () => {
    const state = {
      queries: [],
      acceptedRows: [acceptedUnpaid, acceptedPaid],
      userRows: [
        { username: 'u_unpaid', email: 'a@x.com', account_active: 0 },
        { username: 'u_paid', email: 'b@x.com', account_active: 1 }
      ],
      paidRows: [
        {
          username: 'u_paid',
          amount: '298.00',
          subject: '月卡',
          paid_at: '2026-09-02 12:00:00'
        }
      ],
      offerRows: [
        { username: 'u_unpaid', enabled: 1, amount: '120.00' },
        { username: 'u_paid', enabled: 1, amount: '298.00' }
      ]
    };
    const api = makeApi(state, [], []);
    const all = await api.listFollowup({ pay: 'all' });
    expect(all.counts).toEqual({ all: 2, unpaid: 1, paid: 1 });
    const unpaid = await api.listFollowup({ pay: 'unpaid' });
    expect(unpaid.items.length).toBe(1);
    expect(unpaid.items[0].username).toBe('u_unpaid');
    expect(unpaid.items[0].pay_status).toBe('unpaid');
    expect(unpaid.items[0].offer_enabled).toBe(true);
    const paid = await api.listFollowup({ pay: 'paid' });
    expect(paid.items.length).toBe(1);
    expect(paid.items[0].username).toBe('u_paid');
    expect(paid.items[0].paid_amount).toBe('298.00');
  });

  it('listBids includes pay_status on accepted rows', async () => {
    const state = {
      queries: [],
      acceptedRows: [acceptedUnpaid, acceptedPaid],
      userRows: [
        { username: 'u_unpaid', email: 'a@x.com', account_active: 0 },
        { username: 'u_paid', email: 'b@x.com', account_active: 1 }
      ],
      paidRows: [
        {
          username: 'u_paid',
          amount: '298.00',
          subject: '月卡',
          paid_at: '2026-09-02 12:00:00'
        }
      ],
      offerRows: []
    };
    const api = makeApi(state, [], []);
    const out = await api.listBids({ status: 'accepted' });
    expect(out.items.length).toBe(2);
    const byUser = {};
    out.items.forEach(function (row) {
      byUser[row.username] = row;
    });
    expect(byUser.u_unpaid.pay_status).toBe('unpaid');
    expect(byUser.u_paid.pay_status).toBe('paid');
    expect(byUser.u_paid.paid_amount).toBe('298.00');
  });

  it('remind skips already paid and no-email; sends when unpaid with email', async () => {
    const notes = [];
    const state = {
      queries: [],
      acceptedRows: [acceptedUnpaid, acceptedPaid],
      bidRow: Object.assign({}, acceptedUnpaid),
      userRows: [
        { username: 'u_unpaid', email: 'a@x.com', account_active: 0 },
        { username: 'u_paid', email: 'b@x.com', account_active: 1 }
      ],
      paidRows: [
        {
          username: 'u_paid',
          amount: '298.00',
          subject: '月卡',
          paid_at: '2026-09-02 12:00:00'
        }
      ],
      offerRows: [{ username: 'u_unpaid', enabled: 1, amount: '120.00' }],
      paymentHistory: []
    };
    const api = makeApi(state, [], notes, null, null, async function (username, title, body, link) {
      notes.push({ username: username, title: title, body: body, link: link });
      return { email_sent: true };
    });
    const one = await api.remindAccepted({ id: 11 });
    expect(one.sent).toBe(1);
    expect(one.skipped).toBe(0);
    expect(notes.length).toBe(1);
    expect(notes[0].link).toContain('email_offer');

    const bulk = await api.remindAccepted({ unpaid: true });
    expect(bulk.total).toBe(1);
    expect(bulk.sent).toBe(1);

    const noMailState = {
      queries: [],
      acceptedRows: [acceptedUnpaid],
      bidRow: Object.assign({}, acceptedUnpaid),
      userRows: [{ username: 'u_unpaid', email: '', account_active: 0 }],
      paidRows: [],
      offerRows: [],
      paymentHistory: []
    };
    const apiNoMail = makeApi(noMailState, [], []);
    const skipped = await apiNoMail.remindAccepted({ id: 11 });
    expect(skipped.sent).toBe(0);
    expect(skipped.skipped).toBe(1);
    expect(skipped.reasons[0].reason).toBe('no_email');
  });
});
