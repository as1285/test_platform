const {
  isValidUserEmail,
  isRefundEmailRequest,
  REFUND_EMAIL_STOPPED_MSG,
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

  test('makeTrackedCta builds per-send click URL', () => {
    const { makeTrackedCta, buildClickTrackUrl, safeDestRedirect } = require('../../src/admin/userEmailBulk');
    var deps = { publicSiteUrl: 'https://lkj.qiyun888.top' };
    var tracked = makeTrackedCta(deps, 'purchase.html?from=email_half');
    expect(tracked.token).toMatch(/^[a-f0-9]{32}$/);
    expect(tracked.destUrl).toBe('https://lkj.qiyun888.top/purchase.html?from=email_half');
    expect(tracked.trackUrl).toBe(
      'https://lkj.qiyun888.top/api/public/email-click/' + tracked.token
    );
    expect(buildClickTrackUrl(deps, tracked.token)).toBe(tracked.trackUrl);
    expect(safeDestRedirect(deps, tracked.destUrl)).toBe(tracked.destUrl);
    expect(safeDestRedirect(deps, 'https://evil.example/phish')).toBe(
      'https://lkj.qiyun888.top/purchase.html'
    );
  });
});

describe('userEmailBulk click consume', () => {
  test('consumeEmailClick increments and returns dest', async () => {
    var updates = [];
    var api = createUserEmailBulk({
      getPool: function () {
        return {
          execute: async function (sql, params) {
            if (/CREATE TABLE/i.test(sql) || /information_schema/i.test(sql) || /ALTER TABLE/i.test(sql)) {
              return [[{ c: 1 }], []];
            }
            if (/SELECT id, dest_url/.test(sql)) {
              return [[{ id: 9, dest_url: 'https://lkj.qiyun888.top/purchase.html?from=email_half' }], []];
            }
            if (/UPDATE user_email_sends/.test(sql)) {
              updates.push(params);
              return [{ affectedRows: 1 }, []];
            }
            return [[], []];
          },
          query: async function () {
            return [[], []];
          }
        };
      },
      publicSiteUrl: 'https://lkj.qiyun888.top',
      mail: { isMailConfigured: function () { return true; }, sendMail: async function () {} }
    });
    var token = 'a'.repeat(32);
    var out = await api.consumeEmailClick(token);
    expect(out.dest_url).toBe('https://lkj.qiyun888.top/purchase.html?from=email_half');
    expect(updates.length).toBe(1);
    expect(updates[0][0]).toBe(token);
    expect(await api.consumeEmailClick('bad')).toBeNull();
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
                  last_email_subject: null,
                  half_price_email_sent: 1
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
    expect(out.users[0].half_price_email_sent).toBe(true);
    expect(calls.some(function (c) {
      return c[0] === 'query' && String(c[1] || '').indexOf('half_price_email_sent') >= 0;
    })).toBe(true);
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

  test('sendToUsernames rejects refund emails', async () => {
    var api = createUserEmailBulk({
      getPool: function () {
        return mockPool({});
      },
      mail: { isMailConfigured: function () { return true; }, sendMail: async function () {} }
    });
    await expect(
      api.sendToUsernames({
        usernames: ['u1'],
        subject: '二次退税：测算约可退 ¥27,000',
        content: '打开二次退税页',
        linkUrl: 'refund_ad.html?from=email_refund'
      })
    ).rejects.toMatchObject({ message: REFUND_EMAIL_STOPPED_MSG, code: 400 });
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
        subject: '开通后去除水印',
        content: '打开支付页开通'
      })
    ).rejects.toMatchObject({ code: 400 });

    var out = await apiWithCount(201).sendBulk({
      audience: 'has_email_inactive',
      subject: '开通后去除水印',
      content: '打开支付页开通',
      campaign: 'ad_reach_activate',
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

  test('isRefundEmailRequest flags amount campaign and refund copy', () => {
    expect(isRefundEmailRequest({ personalizeRefundAmount: true })).toBe(true);
    expect(isRefundEmailRequest({ campaign: 'refund_ad_amount' })).toBe(true);
    expect(isRefundEmailRequest({ poster: 'refund' })).toBe(true);
    expect(isRefundEmailRequest({ subject: '二次退税：测算约可退 ¥27,000' })).toBe(true);
    expect(isRefundEmailRequest({ linkUrl: 'refund_ad.html?from=email_refund' })).toBe(true);
    expect(isRefundEmailRequest({ subject: '开通后去除水印', linkUrl: 'purchase.html' })).toBe(
      false
    );
  });

  test('sendBulk rejects refund emails', async () => {
    var mails = [];
    var api = createUserEmailBulk({
      getPool: function () {
        return mockPool({
          execute: async function () {
            return [{ affectedRows: 1 }, []];
          },
          query: async function () {
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
    await expect(
      api.sendBulk({
        audience: 'has_email_inactive',
        personalizeRefundAmount: true,
        campaign: 'refund_ad_amount',
        poster: 'refund',
        allowPartial: true
      })
    ).rejects.toMatchObject({ message: REFUND_EMAIL_STOPPED_MSG, code: 400 });
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
