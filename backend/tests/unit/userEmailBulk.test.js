const {
  isValidUserEmail,
  buildEmailBodies,
  buildCtaUrl
} = require('../../src/admin/userEmailBulk');

describe('userEmailBulk helpers', () => {
  test('isValidUserEmail accepts common addresses', () => {
    expect(isValidUserEmail('a@qq.com')).toBe(true);
    expect(isValidUserEmail('  name@126.com ')).toBe(true);
    expect(isValidUserEmail('bad')).toBe(false);
    expect(isValidUserEmail('a@b')).toBe(false);
    expect(isValidUserEmail('')).toBe(false);
  });

  test('buildEmailBodies includes CTA and unsubscribe hint', () => {
    var bodies = buildEmailBodies('标题', '正文一行', 'https://example.com/purchase.html', {
      posterUrl: 'https://example.com/img/email/email-poster-activate.jpg',
      ctaLabel: '立即开通'
    });
    expect(bodies.subject).toBe('标题');
    expect(bodies.text).toContain('立即开通：https://example.com/purchase.html');
    expect(bodies.html).toContain('立即开通');
    expect(bodies.html).toContain('email-poster-activate.jpg');
    expect(bodies.html).toContain('清空邮箱');
  });

  test('buildCtaUrl joins public origin', () => {
    expect(buildCtaUrl({ publicSiteUrl: 'https://a.example.com/' }, 'purchase.html')).toBe(
      'https://a.example.com/purchase.html'
    );
    expect(buildCtaUrl({ publicSiteUrl: '' }, 'purchase.html')).toBe('purchase.html');
  });
});

describe('userEmailBulk list/send API surface', () => {
  const { createUserEmailBulk } = require('../../src/admin/userEmailBulk');

  function mockPool(handlers) {
    return {
      execute: handlers.execute || (async () => [[], []]),
      query: handlers.query || (async () => [[], []])
    };
  }

  test('listUsers returns smtp_ready and mapped rows', async () => {
    var calls = [];
    var api = createUserEmailBulk({
      getPool: function () {
        return mockPool({
          execute: async function (sql) {
            calls.push(['execute', sql]);
            return [{ affectedRows: 0 }, []];
          },
          query: async function (sql) {
            calls.push(['query', sql]);
            if (/COUNT\(\*\)/.test(sql)) return [[{ total: 1 }], []];
            return [
              [
                {
                  username: 'u1',
                  real_name: '张三',
                  email: 'a@qq.com',
                  account_active: 0,
                  created_at: new Date('2026-01-01T00:00:00Z'),
                  register_source_channel: 'douyin',
                  last_email_at: null,
                  last_email_subject: null
                }
              ],
              []
            ];
          }
        });
      },
      mail: { isMailConfigured: function () { return true; }, sendMail: async function () {} },
      nonGuestUsernameSql: function (col) {
        return col + " NOT LIKE '__guest_%'";
      }
    });
    var out = await api.listUsers({ page: 1, limit: 20 });
    expect(out.total).toBe(1);
    expect(out.smtp_ready).toBe(true);
    expect(out.users[0].username).toBe('u1');
    expect(out.users[0].email).toBe('a@qq.com');
    expect(out.users[0].account_active).toBe(false);
  });

  test('sendToUsernames dryRun counts matched', async () => {
    var api = createUserEmailBulk({
      getPool: function () {
        return mockPool({
          execute: async function () {
            return [{}, []];
          },
          query: async function (sql) {
            if (/SELECT u\.username, u\.email/.test(sql)) {
              return [[{ username: 'u1', email: 'a@qq.com' }], []];
            }
            return [[], []];
          }
        });
      },
      mail: { isMailConfigured: function () { return true; }, sendMail: async function () {} }
    });
    var out = await api.sendToUsernames({
      usernames: ['u1', 'u1', ''],
      dryRun: true,
      subject: 't',
      content: 'c'
    });
    expect(out.dry_run).toBe(true);
    expect(out.matched).toBe(1);
    expect(out.requested).toBe(1);
  });

  test('sendToUsernames rejects empty selection', async () => {
    var api = createUserEmailBulk({
      getPool: function () {
        return mockPool({});
      },
      mail: { isMailConfigured: function () { return true; }, sendMail: async function () {} }
    });
    await expect(api.sendToUsernames({ usernames: [], subject: 't', content: 'c' })).rejects.toMatchObject({
      code: 400
    });
  });

  test('listSends scopes via users EXISTS (no s.user_type)', async () => {
    var sqls = [];
    var api = createUserEmailBulk({
      getPool: function () {
        return mockPool({
          execute: async function () {
            return [{}, []];
          },
          query: async function (sql) {
            sqls.push(sql);
            if (/COUNT\(\*\)/.test(sql)) return [[{ total: 0 }], []];
            return [[], []];
          }
        });
      },
      mail: { isMailConfigured: function () { return true; }, sendMail: async function () {} },
      appendAdminUserScope: function (where, params, admin, col) {
        where.push('LEFT(' + col + ", 8) <> '__guest_'");
        where.push('COALESCE(u.user_type, 0) <> 2');
      }
    });
    var out = await api.listSends({ page: 1, limit: 20, admin: { username: 'admin' } });
    expect(out.total).toBe(0);
    expect(sqls[0]).toContain('EXISTS (SELECT 1 FROM users u WHERE');
    expect(sqls[0]).not.toMatch(/s\.user_type/);
  });
});
