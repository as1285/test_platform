'use strict';

const feedback = require('../../src/user/compatFeedback');

describe('compatFeedback helpers', () => {
  it('rejects empty description', () => {
    expect(feedback.normalizeSubmitBody({}).error).toMatch(/问题描述/);
    expect(feedback.normalizeContent('   ').error).toMatch(/问题描述/);
  });

  it('rejects too-short description', () => {
    expect(feedback.normalizeSubmitBody({ content: '白屏' }).error).toMatch(/至少/);
  });

  it('accepts description and optional contact/device', () => {
    const row = feedback.normalizeSubmitBody({
      description: '  在我的页底部导航被挡住了  ',
      contact: '微信 abc',
      device: 'Redmi K80 Ultra · 1220x2712'
    });
    expect(row.error).toBeUndefined();
    expect(row.feedback_type).toBe('compat_bug');
    expect(row.content).toBe('在我的页底部导航被挡住了');
    expect(row.contact).toBe('微信 abc');
    expect(row.device_info).toBe('Redmi K80 Ultra · 1220x2712');
  });

  it('clamps long content', () => {
    const row = feedback.normalizeSubmitBody({ content: '问题' + 'x'.repeat(3000) });
    expect(row.error).toBeUndefined();
    expect(row.content.length).toBe(feedback.CONTENT_MAX);
  });

  it('parses image url json', () => {
    expect(feedback.parseImageUrls('["private/compat-feedback/a.jpg"]')).toEqual([
      'private/compat-feedback/a.jpg'
    ]);
    expect(feedback.parseImageUrls([' x ', ''])).toEqual(['x']);
    expect(feedback.parseImageUrls(null)).toEqual([]);
  });

  it('rejects empty reply', () => {
    expect(feedback.normalizeReply('').error).toMatch(/回复内容/);
    expect(feedback.normalizeReply('  ').error).toMatch(/回复内容/);
  });

  it('accepts and clamps reply', () => {
    expect(feedback.normalizeReply('已修').value).toBe('已修');
    const long = feedback.normalizeReply('修' + 'x'.repeat(3000));
    expect(long.error).toBeUndefined();
    expect(long.value.length).toBe(feedback.REPLY_MAX);
  });

  it('maps reply fields for admin list', () => {
    const item = feedback.toPublicItem({
      id: 32,
      user_id: 'wpj123456789',
      real_name_snapshot: 'aaa',
      content: '顶部应该是黑框',
      admin_reply: '下个版本会修',
      replied_at: '2026-09-09T12:00:00Z',
      replied_by: 'admin'
    });
    expect(item.has_reply).toBe(true);
    expect(item.admin_reply).toBe('下个版本会修');
    expect(item.replied_by).toBe('admin');
    expect(item.replied_at).toContain('2026-09-09');
  });

  it('maps activation status for admin list', () => {
    const active = feedback.toPublicItem(
      {
        id: 1,
        user_id: 'u1',
        joined_username: 'u1',
        account_active: 1,
        activation_kind: 'permanent'
      },
      { admin: true }
    );
    expect(active.activation_status).toBe('active');
    expect(active.currently_active).toBe(true);

    const inactive = feedback.toPublicItem(
      {
        id: 2,
        user_id: 'u2',
        joined_username: 'u2',
        account_active: 0
      },
      { admin: true }
    );
    expect(inactive.activation_status).toBe('inactive');
    expect(inactive.currently_active).toBe(false);

    const expired = feedback.toPublicItem(
      {
        id: 3,
        user_id: 'u3',
        joined_username: 'u3',
        account_active: 1,
        activation_kind: 'trial',
        active_until: '2020-01-01T00:00:00Z'
      },
      { admin: true }
    );
    expect(expired.activation_status).toBe('expired');
    expect(expired.currently_active).toBe(false);

    const missing = feedback.toPublicItem(
      { id: 4, user_id: 'gone', joined_username: null },
      { admin: true }
    );
    expect(missing.activation_status).toBe('');
  });

  it('builds inbox copy with feedback link', () => {
    const msg = feedback.buildReplyInbox('下个版本会修', '顶部应该是黑框，家庭成员按钮错位');
    expect(msg.title).toBe('兼容反馈已回复');
    expect(msg.content).toContain('【回复】');
    expect(msg.content).toContain('下个版本会修');
    expect(msg.content).toContain('@@link:compat_bug.html');
    expect(msg.company_name).toBe('系统通知');
  });

  it('builds email body from admin reply', () => {
    const mail = feedback.buildReplyEmail('下个版本会修\n请先更新 App');
    expect(mail.subject).toBe('兼容反馈已回复');
    expect(mail.text).toBe('下个版本会修\n请先更新 App');
    expect(mail.html).toContain('下个版本会修');
    expect(mail.html).toContain('请先更新 App');
  });

  it('skips email when SMTP is not configured', async () => {
    const out = await feedback.sendReplyEmail(
      { execute: async () => [[{ email: 'name@qq.com' }]] },
      'u1',
      '已修',
      { isMailConfigured: () => false, sendMail: async () => { throw new Error('should not send'); } }
    );
    expect(out.sent).toBe(false);
    expect(out.reason).toBe('no_smtp');
  });

  it('skips email when user has no mailbox', async () => {
    const out = await feedback.sendReplyEmail(
      { execute: async () => [[{ email: null }]] },
      'u1',
      '已修',
      { isMailConfigured: () => true, sendMail: async () => { throw new Error('should not send'); } }
    );
    expect(out.sent).toBe(false);
    expect(out.reason).toBe('no_email');
  });

  it('sends email with admin reply when user saved mailbox', async () => {
    const sent = [];
    const out = await feedback.sendReplyEmail(
      { execute: async () => [[{ email: 'name@qq.com' }]] },
      'u1',
      '下个版本会修',
      {
        isMailConfigured: () => true,
        sendMail: async (payload) => {
          sent.push(payload);
        }
      }
    );
    expect(out.sent).toBe(true);
    expect(out.email).toBe('name@qq.com');
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe('name@qq.com');
    expect(sent[0].subject).toBe('兼容反馈已回复');
    expect(sent[0].text).toBe('下个版本会修');
    expect(sent[0].html).toContain('下个版本会修');
  });
});
