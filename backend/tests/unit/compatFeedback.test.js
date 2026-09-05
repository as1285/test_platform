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
});
