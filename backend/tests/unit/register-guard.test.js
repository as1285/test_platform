'use strict';


describe('register-guard', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-31T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('issues and verifies captcha once', () => {
    const guard = require('../../register-guard');
    const issued = guard.issueRegisterCaptcha();
    expect(issued.captcha_id).toBeTruthy();
    const m = String(issued.question || '').match(/(\d+)\s*\+\s*(\d+)/);
    expect(m).toBeTruthy();
    const answer = String(Number(m[1]) + Number(m[2]));
    expect(guard.verifyRegisterCaptcha(issued.captcha_id, answer)).toBe(true);
    expect(guard.verifyRegisterCaptcha(issued.captcha_id, answer)).toBe(false);
  });

  it('expired captcha fails', () => {
    const guard = require('../../register-guard');
    const issued = guard.issueRegisterCaptcha();
    const m = String(issued.question || '').match(/(\d+)\s*\+\s*(\d+)/);
    const answer = String(Number(m[1]) + Number(m[2]));
    vi.advanceTimersByTime(6 * 60 * 1000);
    expect(guard.verifyRegisterCaptcha(issued.captcha_id, answer)).toBe(false);
  });

  it('looksLikeBotUsername detects 8-char alnum bots', () => {
    const guard = require('../../register-guard');
    expect(guard.looksLikeBotUsername('Ab12Cd34')).toBe(true);
    expect(guard.looksLikeBotUsername('张三')).toBe(false);
    expect(guard.looksLikeBotUsername('user_ok')).toBe(false);
    expect(guard.looksLikeBotUsername('toolong12')).toBe(false);
  });

  it('allows distributor Cordova UA to register', () => {
    const guard = require('../../register-guard');
    const req = {
      headers: { 'user-agent': 'TaxPlatformCordovaApp/1.0 TaxPlatformDistributor/agent1' }
    };
    const r = guard.checkRegisterDistributorBlock(req);
    expect(r.ok).toBe(true);
  });

  it('allows plain Cordova UA to register', () => {
    const guard = require('../../register-guard');
    const req = {
      headers: { 'user-agent': 'TaxPlatformCordovaApp/1.0' }
    };
    expect(guard.checkRegisterDistributorBlock(req).ok).toBe(true);
  });
});
