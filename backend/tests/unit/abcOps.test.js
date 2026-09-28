'use strict';

const fs = require('fs');
const path = require('path');
const {
  parsePeriod,
  periodCnDateFilter,
  abcChannelSql,
  abcInstallMetaSql,
  appendAbcUserVisibility,
  visibilityMeta,
  isAbcChannelViewerAdmin,
  registerSourceLabel,
  createAbcOps
} = require('../../src/admin/abcOps');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status: function (code) {
      this.statusCode = code;
      return this;
    },
    json: function (body) {
      this.body = body;
      return this;
    }
  };
}

function emptyPool() {
  return {
    getConnection: async function () {
      return {
        query: async function () {
          return [[]];
        },
        release: function () {}
      };
    }
  };
}

describe('abcOps helpers', () => {
  it('parses day / month / custom range periods', () => {
    expect(parsePeriod('7', 7)).toEqual(
      expect.objectContaining({ mode: 'days', days: 7, span: 6, label: '最近 7 天' })
    );
    expect(parsePeriod('1', 7).label).toBe('今日');
    expect(parsePeriod('month_current', 7).mode).toBe('range');
    expect(parsePeriod('month_2026-08', 7)).toEqual(
      expect.objectContaining({
        mode: 'range',
        start: '2026-08-01',
        end: '2026-08-31',
        label: '2026年8月'
      })
    );
    expect(parsePeriod('range_2026-09-01_2026-09-07', 7)).toEqual(
      expect.objectContaining({
        mode: 'range',
        start: '2026-09-01',
        end: '2026-09-07',
        label: '自定义'
      })
    );
    expect(parsePeriod('9999', 7).days).toBe(366);
  });

  it('builds beijing-day SQL filters', () => {
    var days = periodCnDateFilter('d', parsePeriod('7', 7));
    expect(days.sql).toContain('DATE_SUB');
    expect(days.params).toEqual([6]);
    var range = periodCnDateFilter('d', parsePeriod('range_2026-09-01_2026-09-07', 7));
    expect(range.sql).toContain('>= ?');
    expect(range.params).toEqual(['2026-09-01', '2026-09-07']);
  });

  it('matches abc channel and install meta', () => {
    expect(abcChannelSql('users')).toContain("sales_promo_channel");
    expect(abcChannelSql('users')).toContain("'abc'");
    expect(abcInstallMetaSql('meta_json')).toContain('$.sales_ch');
    expect(abcInstallMetaSql('meta_json')).toContain('$.ch');
  });

  it('only username=admin sees new abc users', () => {
    expect(isAbcChannelViewerAdmin({ username: 'admin' })).toBe(true);
    expect(isAbcChannelViewerAdmin({ username: 'Admin' })).toBe(true);
    expect(isAbcChannelViewerAdmin({ username: '19106014552', is_super: true })).toBe(false);
    expect(visibilityMeta({ username: 'admin' }).sees_new_abc).toBe(true);
    expect(visibilityMeta({ username: '19106014552', is_super: true }).sees_new_abc).toBe(false);
    expect(visibilityMeta({ username: 'sub' }).viewer).toBe('limited');
  });

  it('visibility SQL hides new abc from non-admin', () => {
    var adminWhere = [];
    var adminParams = [];
    appendAbcUserVisibility(adminWhere, adminParams, { username: 'admin' }, 'users');
    expect(adminWhere).toEqual([]);

    var fullWhere = [];
    var fullParams = [];
    appendAbcUserVisibility(fullWhere, fullParams, { username: '19106014552', is_super: true }, 'users');
    expect(fullWhere.join(' ')).toContain('NOT');
    expect(fullParams.length).toBeGreaterThan(0);

    var subWhere = [];
    var subParams = [];
    appendAbcUserVisibility(subWhere, subParams, { username: 'agent1' }, 'users');
    expect(subWhere.join(' ')).toContain('NOT IN');
    expect(subParams).toContain('abc');
  });

  it('labels register source', () => {
    expect(registerSourceLabel('')).toBe('未填');
    expect(registerSourceLabel('github')).toBe('GitHub');
    expect(registerSourceLabel('other:小红书')).toBe('其他：小红书');
  });
});

describe('abcOps handlers', () => {
  it('overview returns empty funnel for empty db', async () => {
    var api = createAbcOps({ getPool: emptyPool });
    var res = mockRes();
    await api.handleAbcOpsOverview(
      { query: { days: '7' }, admin: { username: 'admin', is_super: true } },
      res
    );
    expect(res.body.code).toBe(200);
    expect(res.body.data.channel).toBe('abc');
    expect(res.body.data.funnel.registered).toBe(0);
    expect(res.body.data.today.register).toBe(0);
    expect(res.body.data.landing_url).toContain('ch=abc');
    expect(res.body.data.visibility.sees_new_abc).toBe(true);
  });

  it('users list returns empty page', async () => {
    var api = createAbcOps({ getPool: emptyPool });
    var res = mockRes();
    await api.handleAbcOpsUsers(
      { query: { page: '1', days: '7' }, admin: { username: 'admin' } },
      res
    );
    expect(res.body.code).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.total).toBe(0);
  });

  it('registers admin routes', () => {
    var routes = fs.readFileSync(path.join(__dirname, '../../src/admin/routes.js'), 'utf8');
    expect(routes).toContain("'/api/admin/ops/abc/overview'");
    expect(routes).toContain("'/api/admin/ops/abc/users'");
    expect(routes).toContain("'/api/admin/ops/abc/payments'");
    expect(routes).toContain('handleAbcOpsOverview');
  });

  it('payments list returns empty page', async () => {
    var api = createAbcOps({ getPool: emptyPool });
    var res = mockRes();
    await api.handleAbcOpsPayments({ query: { days: '1' }, admin: { username: 'admin' } }, res);
    expect(res.body.code).toBe(200);
    expect(res.body.data.list).toEqual([]);
    expect(res.body.data.gmv).toBe(0);
  });
});
