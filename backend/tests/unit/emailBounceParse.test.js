const { describe, it, expect } = require('vitest');
const parse = require('../../src/admin/emailBounceParse');

describe('emailBounceParse', () => {
  it('extracts Final-Recipient as hard bounce', () => {
    var out = parse.parseBounceMessage({
      from: 'Mail Delivery Subsystem <MAILER-DAEMON@qq.com>',
      subject: '投递失败：系统退信',
      text:
        'Final-Recipient: rfc822; cyr_010@qq.com\n' +
        'Action: failed\nStatus: 5.1.1\n550 User not found 邮箱不存在'
    });
    expect(out).toBeTruthy();
    expect(out.emails).toEqual(['cyr_010@qq.com']);
    expect(out.bounce_type).toBe('hard');
  });

  it('classifies mailbox full as soft', () => {
    expect(parse.classifyBounce('452 4.2.2 mailbox full 邮箱已满')).toBe('soft');
  });

  it('ignores ordinary mail', () => {
    expect(
      parse.parseBounceMessage({
        from: 'user@qq.com',
        subject: '你好',
        text: '普通通知 hello@example.com'
      })
    ).toBe(null);
  });

  it('normalizes email', () => {
    expect(parse.normalizeEmail(' <Cyr_010@QQ.com> ')).toBe('cyr_010@qq.com');
  });
});
