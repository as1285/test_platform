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

  it('builds inbox copy with feedback link', () => {
    const msg = feedback.buildReplyInbox('下个版本会修', '顶部应该是黑框，家庭成员按钮错位');
    expect(msg.title).toBe('兼容反馈已回复');
    expect(msg.content).toContain('【回复】');
    expect(msg.content).toContain('下个版本会修');
    expect(msg.content).toContain('@@link:compat_bug.html');
    expect(msg.company_name).toBe('系统通知');
  });
});
