'use strict';

const {
  COOKIE_NAME,
  signValue,
  verifyValue,
  parseCookieHeader,
  setCookie,
  handleAssetAuth
} = require('../../src/admin/uiAssetCookie');

describe('admin UI asset cookie', () => {
  var secret = 'unit-test-secret';
  var now = 1_778_000_000;

  it('signs and verifies within ttl', () => {
    var val = signValue(now, secret);
    expect(val).toMatch(/^v1\.\d+\.[0-9a-f]{32}$/);
    expect(verifyValue(val, now + 60, secret)).toBe(true);
  });

  it('rejects expired or tampered values', () => {
    var val = signValue(now, secret);
    expect(verifyValue(val, now + 13 * 3600, secret)).toBe(false);
    expect(verifyValue(val.replace(/[0-9a-f]{4}$/, 'abcd'), now + 60, secret)).toBe(false);
    expect(verifyValue('', now, secret)).toBe(false);
  });

  it('parses the named cookie', () => {
    expect(parseCookieHeader('a=1; ' + COOKIE_NAME + '=v1.1.abc; b=2', COOKIE_NAME)).toBe('v1.1.abc');
    expect(parseCookieHeader('other=1', COOKIE_NAME)).toBe('');
  });

  it('asset-auth returns 204 / 401', () => {
    var val = signValue(Math.floor(Date.now() / 1000) - 10);
    var sent = [];
    var res204 = {
      status: function (c) {
        sent.push(c);
        return { end: function () {} };
      }
    };
    handleAssetAuth({ headers: { cookie: COOKIE_NAME + '=' + val } }, res204);
    expect(sent[0]).toBe(204);

    var sent2 = [];
    handleAssetAuth(
      { headers: {} },
      {
        status: function (c) {
          sent2.push(c);
          return { end: function () {} };
        }
      }
    );
    expect(sent2[0]).toBe(401);
  });

  it('setCookie writes HttpOnly admin_ui', () => {
    var headers = {};
    setCookie(
      {
        setHeader: function (k, v) {
          headers[k] = v;
        }
      },
      { headers: { 'x-forwarded-proto': 'https' } }
    );
    expect(headers['Set-Cookie']).toContain(COOKIE_NAME + '=');
    expect(headers['Set-Cookie']).toContain('HttpOnly');
    expect(headers['Set-Cookie']).toContain('Secure');
  });
});
