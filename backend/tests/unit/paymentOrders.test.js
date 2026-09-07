'use strict';

const {
  parseListQuery,
  buildWhere,
  isActivationProduct,
  isCurrentlyActive,
  mapOrderRow
} = require('../../src/admin/paymentOrders');

describe('paymentOrders helpers', () => {
  it('parses query defaults and clamps', () => {
    expect(parseListQuery({})).toEqual({
      q: '',
      status: '',
      issue: '',
      days: 90,
      page: 1,
      limit: 20
    });
    expect(parseListQuery({ status: 'PAID', issue: 'paid_not_active', days: '7', q: ' 2216 ' }).status).toBe(
      'paid'
    );
    expect(parseListQuery({ status: 'foo', days: '999', limit: '200' })).toMatchObject({
      status: '',
      days: 365,
      limit: 100
    });
  });

  it('searches username and trade nos together', () => {
    const scoped = buildWhere({ q: '2216955147', status: '', issue: '', days: 0 }, null, null);
    expect(scoped.sql).toMatch(/po\.username LIKE/);
    expect(scoped.sql).toMatch(/po\.out_trade_no LIKE/);
    expect(scoped.sql).toMatch(/alipay_trade_no/);
    expect(scoped.params).toEqual(['%2216955147%', '%2216955147%', '%2216955147%']);
  });

  it('filters paid_not_active to activation products', () => {
    const scoped = buildWhere(
      { q: '', status: '', issue: 'paid_not_active', days: 30 },
      null,
      null
    );
    expect(scoped.sql).toMatch(/po\.status = 'paid'/);
    expect(scoped.sql).toMatch(/lizhi_cert/);
    expect(scoped.sql).toMatch(/account_active/);
    expect(scoped.params).toEqual([30]);
  });

  it('applies admin user scope on users alias (not payment_orders)', () => {
    const calls = [];
    const scoped = buildWhere(
      { q: '', status: 'pending', issue: '', days: 0 },
      { username: 'op1' },
      function (where, params, admin, col) {
        calls.push({ admin: admin.username, col: col });
        /* 模拟 nonGuestUsernameSql：按表别名拼 user_type */
        var alias = String(col).split('.')[0];
        where.push('COALESCE(' + alias + '.user_type, 0) <> 2');
        where.push(col + ' = ?');
        params.push(admin.username);
      }
    );
    expect(calls[0]).toEqual({ admin: 'op1', col: 'u.username' });
    expect(scoped.sql).toMatch(/COALESCE\(u\.user_type, 0\) <> 2/);
    expect(scoped.sql).not.toMatch(/po\.user_type/);
    expect(scoped.sql).toMatch(/u\.username = \?/);
    expect(scoped.params).toEqual(['pending', 'op1']);
  });

  it('treats week card as activation and cert as addon', () => {
    expect(isActivationProduct({ grant_kind: 'trial', sku_id: 'sku_300_7d' })).toBe(true);
    expect(isActivationProduct({ grant_kind: 'lizhi_cert' })).toBe(false);
    expect(isActivationProduct({ sku_id: 'sku_najilu_qr_300' })).toBe(false);
    expect(isActivationProduct({ grant_kind: 'rename_credit' })).toBe(false);
  });

  it('flags paid activation without current access', () => {
    const row = mapOrderRow({
      id: 9,
      username: 'u1',
      real_name: '张三',
      subject: '周卡',
      sku_id: 'sku_300_7d',
      grant_kind: 'trial',
      amount: 120,
      status: 'paid',
      out_trade_no: 'T1',
      alipay_trade_no: 'A1',
      account_active: 0,
      active_until: null
    });
    expect(row.is_activation).toBe(true);
    expect(row.currently_active).toBe(false);
    expect(row.paid_not_active).toBe(true);
    expect(row.label).toBe('周卡');
  });

  it('treats unexpired active_until as currently active', () => {
    expect(
      isCurrentlyActive({
        account_active: 1,
        active_until: new Date(Date.now() + 86400000).toISOString()
      })
    ).toBe(true);
    expect(
      isCurrentlyActive({
        account_active: 1,
        active_until: new Date(Date.now() - 86400000).toISOString()
      })
    ).toBe(false);
  });
});
