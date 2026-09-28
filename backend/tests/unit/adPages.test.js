'use strict';

const {
  DEFAULT_WECHAT_ID,
  DEFAULT_AD_PAGES,
  sanitizeWechatId,
  sanitizePosterUrl,
  normalizeAdPagesConfig,
  toPublicAdPages
} = require('../../src/admin/adPages');

describe('adPages normalize', () => {
  it('defaults wechat id and three enabled pages', () => {
    var cfg = normalizeAdPagesConfig({});
    expect(cfg.wechat_id).toBe(DEFAULT_WECHAT_ID);
    expect(cfg.refund.enabled).toBe(true);
    expect(cfg.gjj.enabled).toBe(true);
    expect(cfg.yuefu.enabled).toBe(true);
    expect(cfg.refund.poster_url).toBe(DEFAULT_AD_PAGES.refund.poster_url);
    expect(cfg.refund.remark).toBe('二次退税');
  });

  it('rejects invalid wechat ids', () => {
    expect(sanitizeWechatId('')).toBe(DEFAULT_WECHAT_ID);
    expect(sanitizeWechatId('ab')).toBe(DEFAULT_WECHAT_ID);
    expect(sanitizeWechatId('bad id')).toBe(DEFAULT_WECHAT_ID);
    expect(sanitizeWechatId('<script>')).toBe(DEFAULT_WECHAT_ID);
    expect(sanitizeWechatId('Tangdong6832')).toBe('Tangdong6832');
    expect(sanitizeWechatId('wx_user-01')).toBe('wx_user-01');
  });

  it('allows uploads, /img and https posters', () => {
    expect(sanitizePosterUrl('uploads/foo.jpg', '')).toBe('/uploads/foo.jpg');
    expect(sanitizePosterUrl('/uploads/foo.jpg', '')).toBe('/uploads/foo.jpg');
    expect(sanitizePosterUrl('/img/refund-ad.jpg', '')).toBe('/img/refund-ad.jpg');
    expect(sanitizePosterUrl('https://cdn.example.com/a.jpg', '')).toBe('https://cdn.example.com/a.jpg');
    expect(sanitizePosterUrl('http://cdn.example.com/a.jpg', '/img/refund-ad.jpg')).toBe(
      '/img/refund-ad.jpg'
    );
    expect(sanitizePosterUrl('../etc/passwd', '/img/x.jpg')).toBe('/img/x.jpg');
    expect(sanitizePosterUrl('javascript:alert(1)', '')).toBe('');
  });

  it('truncates copy and honors disabled pages in public payload', () => {
    var long = new Array(900).join('啊');
    var cfg = normalizeAdPagesConfig({
      wechat_id: 'NewWxId888',
      refund: { enabled: false, lede: long, remark: '备注过长会被截断一二三四五六七八九十' },
      gjj: { enabled: true, poster_url: 'uploads/gjj.png' },
      yuefu: { enabled: 0 }
    });
    expect(cfg.wechat_id).toBe('NewWxId888');
    expect(cfg.refund.enabled).toBe(false);
    expect(cfg.refund.lede.length).toBe(800);
    expect(cfg.refund.remark.length).toBeLessThanOrEqual(40);
    expect(cfg.gjj.poster_url).toBe('/uploads/gjj.png');
    expect(cfg.yuefu.enabled).toBe(false);
    var pub = toPublicAdPages(cfg);
    expect(pub.wechat_id).toBe('NewWxId888');
    expect(pub.refund).toBeUndefined();
    expect(pub.yuefu).toBeUndefined();
    expect(pub.gjj.poster_url).toBe('/uploads/gjj.png');
    expect(pub.gjj.lede).toBeTruthy();
  });
});
