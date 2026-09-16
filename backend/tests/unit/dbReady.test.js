'use strict';

const sharedDb = require('../../src/shared/db');

function mockRes() {
  var out = { statusCode: 0, body: null };
  out.status = function (code) {
    out.statusCode = code;
    return out;
  };
  out.json = function (body) {
    out.body = body;
    return out;
  };
  return out;
}

describe('databaseReadyMiddleware', () => {
  afterEach(() => {
    sharedDb.setPool(null);
    sharedDb.markReady(false);
  });

  it('returns 503 before the pool is marked ready', () => {
    var res = mockRes();
    var nextCalled = false;
    sharedDb.databaseReadyMiddleware({ path: '/api/user' }, res, function () {
      nextCalled = true;
    });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ code: 503, msg: '服务启动中，请稍后重试' });
  });

  it('returns starting health 503 before ready', () => {
    var res = mockRes();
    sharedDb.databaseReadyMiddleware({ path: '/api/health' }, res, function () {});
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ ok: false, starting: true });
  });

  it('passes through after markReady', () => {
    sharedDb.setPool({ fake: true });
    sharedDb.markReady(true);
    var nextCalled = false;
    sharedDb.databaseReadyMiddleware({ path: '/api/user' }, mockRes(), function () {
      nextCalled = true;
    });
    expect(nextCalled).toBe(true);
    expect(sharedDb.isReady()).toBe(true);
  });

  it('does not become ready without a pool', () => {
    sharedDb.setPool(null);
    sharedDb.markReady(true);
    expect(sharedDb.isReady()).toBe(false);
  });
});
