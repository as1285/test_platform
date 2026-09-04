const {
  isValidUserEmail,
  buildEmailBodies,
  buildCtaUrl,
  EMAIL_COPY_TEMPLATES,
  createUserEmailBulk
} = require('../../src/admin/userEmailBulk');

describe('userEmailBulk helpers', () => {
  test('isValidUserEmail accepts common addresses', () => {
    expect(isValidUserEmail('name@qq.com')).toBe(true);
    expect(isValidUserEmail('  name@126.com ')).toBe(true);
    expect(isValidUserEmail('user.name+tag@163.com')).toBe(true);
    expect(isValidUserEmail('13800138000@139.com')).toBe(true);
    expect(isValidUserEmail('bad')).toBe(false);
    expect(isValidUserEmail('a@b')).toBe(false);
    expect(isValidUserEmail('')).toBe(false);
    expect(isValidUserEmail('a@a.com')).toBe(false);
    expect(isValidUserEmail('test@test.com')).toBe(false);
    expect(isValidUserEmail('asdf@qq.com')).toBe(false);
    expect(isValidUserEmail('name@example.com')).toBe(false);
    expect(isValidUserEmail('foo..bar@qq.com')).toBe(false);
    expect(isValidUserEmail('.name@qq.com')).toBe(false);
    expect(isValidUserEmail('name@qq')).toBe(false);
    expect(isValidUserEmail('name@qq.c')).toBe(false);
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

  test('refund template points to refund ad page, not purchase', () => {
    expect(EMAIL_COPY_TEMPLATES.refund.link_url).toBe('refund_ad.html?from=email_refund');
    expect(EMAIL_COPY_TEMPLATES.refund.cta_label).toBe('打开二次退税说明');
    expect(EMAIL_COPY_TEMPLATES.refund.subject).toContain('二次退税');
    expect(EMAIL_COPY_TEMPLATES.refund.content).toContain('一键计算');
    expect(EMAIL_COPY_TEMPLATES.refund.content).toContain('未开通也可以先看');
    expect(EMAIL_COPY_TEMPLATES.refund.poster).toBe('refund');
  });

  test('sendBulk skipAlreadySent with campaign filters by campaign, not 7-day window', async () => {
    var sqls = [];
    var paramsList = [];
    var api = createUserEmailBulk({
      getPool: function () {
        return mockPool({
          execute: async function () {
            return [{}, []];
          },
          query: async function (sql, params) {
            sqls.push(sql);
            paramsList.push(params || []);
            if (/COUNT\(\*\)/.test(sql)) return [[{ total: 3 }], []];
            return [[], []];
          }
        });
      },
      mail: { isMailConfigured: function () { return true; }, sendMail: async function () {} }
    });
    var out = await api.sendBulk({
      audience: 'has_email_inactive',
      campaign: 'refund_ad_auto',
      skipAlreadySent: true,
      dryRun: true
    });
    expect(out.dry_run).toBe(true);
    expect(out.matched).toBe(3);
    expect(sqls[0]).toContain('s.audience = ?');
    expect(sqls[0]).not.toContain('INTERVAL 7 DAY');
    expect(paramsList[0]).toContain('refund_ad_auto');
    expect(sqls[0]).toContain('account_active');
  });

  test('sendBulk skipAlreadySent without campaign still uses 7-day window', async () => {
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
      mail: { isMailConfigured: function () { return true; }, sendMail: async function () {} }
    });
    await api.sendBulk({
      audience: 'has_email_inactive',
      skipAlreadySent: true,
      dryRun: true
    });
    expect(sqls[0]).toContain('INTERVAL 7 DAY');
    expect(sqls[0]).not.toContain('s.audience = ?');
  });

  test('sendBulk over cap throws unless allowPartial', async () => {
    var sendCalls = 0;
    function apiWithCount(total) {
      return createUserEmailBulk({
        getPool: function () {
          return mockPool({
            execute: async function () {
              return [{ affectedRows: 1 }, []];
            },
            query: async function (sql) {
              if (/COUNT\(\*\)/.test(sql)) return [[{ total: total }], []];
              return [[{ username: 'u1', email: 'a@qq.com' }], []];
            }
          });
        },
        mail: {
          isMailConfigured: function () {
            return true;
          },
          sendMail: async function () {
            sendCalls += 1;
          }
        }
      });
    }
    await expect(
      apiWithCount(201).sendBulk({
        audience: 'has_email_inactive',
        subject: '二次退税',
        content: '打开页面测算'
      })
    ).rejects.toMatchObject({ code: 400 });

    var out = await apiWithCount(201).sendBulk({
      audience: 'has_email_inactive',
      subject: '二次退税',
      content: '打开页面测算',
      campaign: 'refund_ad_auto',
      allowPartial: true
    });
    expect(out.sent).toBe(1);
    expect(out.matched).toBe(201);
    expect(sendCalls).toBe(1);
  });

  test('sendBulk skipHours uses campaign + interval window', async () => {
    var sqls = [];
    var api = createUserEmailBulk({
      getPool: function () {
        return mockPool({
          execute: async function () {
            return [{}, []];
          },
          query: async function (sql) {
            sqls.push(sql);
            if (/COUNT\(\*\)/.test(sql)) return [[{ total: 1 }], []];
            return [[], []];
          }
        });
      },
      mail: { isMailConfigured: function () { return true; }, sendMail: async function () {} }
    });
    await api.sendBulk({
      audience: 'has_email_inactive',
      campaign: 'refund_ad_amount',
      skipAlreadySent: true,
      skipHours: 24,
      dryRun: true
    });
    expect(sqls[0]).toContain('s.audience = ?');
    expect(sqls[0]).toContain('INTERVAL 24 HOUR');
    expect(sqls[0]).not.toContain('INTERVAL 7 DAY');
  });

  test('sendBulk personalizeRefundAmount puts that user refund into the mail', async () => {
    var mails = [];
    var api = createUserEmailBulk({
      getPool: function () {
        return mockPool({
          execute: async function () {
            return [{ affectedRows: 1 }, []];
          },
          query: async function (sql) {
            if (/COUNT\(\*\)/.test(sql)) return [[{ total: 1 }], []];
            if (/FROM tax_records/.test(sql)) {
              var rows = [];
              for (var y = 2023; y <= 2025; y++) {
                for (var m = 1; m <= 12; m++) {
                  rows.push({
                    user_id: 'u1',
                    year: y,
                    month: m,
                    income: '13000',
                    income_this_period: '13000',
                    tax_reported: '200',
                    company_name: '甲公司'
                  });
                }
              }
              return [rows, []];
            }
            return [[{ username: 'u1', email: 'a@qq.com' }], []];
          }
        });
      },
      mail: {
        isMailConfigured: function () {
          return true;
        },
        sendMail: async function (payload) {
          mails.push(payload);
        }
      }
    });
    var out = await api.sendBulk({
      audience: 'has_email_inactive',
      personalizeRefundAmount: true,
      campaign: 'refund_ad_amount',
      poster: 'refund',
      allowPartial: true
    });
    expect(out.sent).toBe(1);
    expect(out.personalized_refund).toBe(true);
    expect(mails[0].subject).toContain('¥7,200');
    expect(mails[0].text).toContain('大约可退 ¥7,200');
    expect(mails[0].text).toContain('2025 年约 ¥2,400');
    expect(mails[0].text).toContain('refund_ad.html?from=email_refund&est=7200');
    expect(mails[0].html).toContain('refund_ad.html?from=email_refund&amp;est=7200');
  });

  test('sendBulk personalizeRefundAmount skips users with no tax records', async () => {
    var mails = [];
    var api = createUserEmailBulk({
      getPool: function () {
        return mockPool({
          execute: async function () {
            return [{ affectedRows: 1 }, []];
          },
          query: async function (sql) {
            if (/COUNT\(\*\)/.test(sql)) return [[{ total: 1 }], []];
            if (/FROM tax_records/.test(sql)) return [[], []];
            return [[{ username: 'u1', email: 'a@qq.com' }], []];
          }
        });
      },
      mail: {
        isMailConfigured: function () {
          return true;
        },
        sendMail: async function (payload) {
          mails.push(payload);
        }
      }
    });
    var out = await api.sendBulk({
      audience: 'has_email_inactive',
      personalizeRefundAmount: true,
      campaign: 'refund_ad_amount'
    });
    expect(out.sent).toBe(0);
    expect(out.skipped).toBe(1);
    expect(mails.length).toBe(0);
  });

  test('campaignStats returns 7-day sent/failed/fail_rate for refund_ad_amount', async () => {
    var sqls = [];
    var api = createUserEmailBulk({
      getPool: function () {
        return mockPool({
          execute: async function () {
            return [{}, []];
          },
          query: async function (sql, params) {
            sqls.push({ sql: sql, params: params });
            return [
              [
                { status: 'sent', n: 8 },
                { status: 'failed', n: 2 }
              ],
              []
            ];
          }
        });
      }
    });
    var out = await api.campaignStats({
      campaign: 'refund_ad_amount',
      days: 7,
      admin: { username: 'admin' }
    });
    expect(out.campaign).toBe('refund_ad_amount');
    expect(out.days).toBe(7);
    expect(out.sent).toBe(8);
    expect(out.failed).toBe(2);
    expect(out.attempts).toBe(10);
    expect(out.fail_rate).toBe(20);
    expect(sqls[0].sql).toContain('s.audience = ?');
    expect(sqls[0].sql).toContain('INTERVAL 7 DAY');
    expect(sqls[0].params[0]).toBe('refund_ad_amount');
  });
});
