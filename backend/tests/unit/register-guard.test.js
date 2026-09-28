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
      headers: { 'user-agent': 'TaxPlatformCordovaApp/1.0 TaxPlatformDistributor/abc' }
    };
    const r = guard.checkRegisterDistributorBlock(req);
    expect(r.ok).toBe(true);
    expect(r.msg).toBeUndefined();
  });

  it('allows plain Cordova UA to register', () => {
    const guard = require('../../register-guard');
    const req = {
      headers: { 'user-agent': 'TaxPlatformCordovaApp/1.0' }
    };
    expect(guard.checkRegisterDistributorBlock(req).ok).toBe(true);
  });

  it('does not ship distributor self-register block copy', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../../register-guard.js'), 'utf8');
    expect(src).not.toContain(
      '代理版 App 不支持自助注册，请使用代理提供的注册链接在浏览器中注册，或联系代理开通账号'
    );
    expect(src).not.toContain('请使用代理提供的注册链接');
    expect(src).not.toContain('联系代理开通账号');
    expect(src).not.toMatch(/代理版 App 不支持自助注册/);
  });
});