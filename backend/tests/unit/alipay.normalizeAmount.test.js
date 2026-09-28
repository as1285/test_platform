'use strict';


describe('alipay.normalizeAmount / isConfigured', () => {
  const prev = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...prev };
    delete process.env.ALIPAY_APP_ID;
    delete process.env.ALIPAY_PRIVATE_KEY;
    delete process.env.ALIPAY_PUBLIC_KEY;
    delete process.env.ALIPAY_NOTIFY_URL;
    delete process.env.ALIPAY_PRODUCT_AMOUNT;
  });

  afterEach(() => {
    process.env = { ...prev };
  });

  it('normalizes valid amounts to two decimals', () => {
    const alipay = require('../../alipay');
    expect(alipay.normalizeAmount('320')).toBe('320.00');
    expect(alipay.normalizeAmount('320.5')).toBe('320.50');
    expect(alipay.normalizeAmount('320.55')).toBe('320.55');
  });

  it('rejects glued env-like garbage and non-numeric strings', () => {
    const alipay = require('../../alipay');
    expect(alipay.normalizeAmount('320MONITOR_ALERT_EMAIL=x')).toBe('');
    expect(alipay.normalizeAmount('abc')).toBe('');
    expect(alipay.normalizeAmount('')).toBe('');
    expect(alipay.normalizeAmount('12.345')).toBe('');
    expect(alipay.normalizeAmount('0')).toBe('');
  });

  it('isConfigured is false when keys or amount missing', () => {
    const alipay = require('../../alipay');
    expect(alipay.isConfigured()).toBe(false);
    process.env.ALIPAY_APP_ID = 'app';
    process.env.ALIPAY_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMII=\n-----END PRIVATE KEY-----';
    process.env.ALIPAY_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMII=\n-----END PUBLIC KEY-----';
    process.env.ALIPAY_NOTIFY_URL = 'https://example.com/notify';
    process.env.ALIPAY_PRODUCT_AMOUNT = '320MONITOR';
    vi.resetModules();
    const alipay2 = require('../../alipay');
    expect(alipay2.isConfigured()).toBe(false);
  });

  it('isConfigured is true when amount and keys present', () => {
    process.env.ALIPAY_APP_ID = 'app';
    process.env.ALIPAY_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMII=\n-----END PRIVATE KEY-----';
    process.env.ALIPAY_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMII=\n-----END PUBLIC KEY-----';
    process.env.ALIPAY_NOTIFY_URL = 'https://example.com/notify';
    process.env.ALIPAY_PRODUCT_AMOUNT = '320';
    const alipay = require('../../alipay');
    expect(alipay.isConfigured()).toBe(true);
  });
});
