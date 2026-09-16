'use strict';

const { isTransientDbError, connectWithRetry } = require('../../src/shared/waitForMysql');

describe('waitForMysql', () => {
  it('treats startup connection errors as transient', () => {
    expect(isTransientDbError({ code: 'ECONNREFUSED' })).toBe(true);
    expect(isTransientDbError({ code: 'ETIMEDOUT' })).toBe(true);
    expect(isTransientDbError({ code: 'PROTOCOL_CONNECTION_LOST' })).toBe(true);
    expect(isTransientDbError({ message: 'connect ECONNREFUSED 172.18.0.4:3306' })).toBe(true);
    expect(isTransientDbError({ code: 'ER_ACCESS_DENIED_ERROR' })).toBe(false);
    expect(isTransientDbError({ code: 'ER_BAD_DB_ERROR' })).toBe(false);
  });

  it('retries transient refusals then returns a connection', async () => {
    var calls = 0;
    var mysql = {
      createConnection: async function () {
        calls += 1;
        if (calls < 3) {
          var err = new Error('connect ECONNREFUSED');
          err.code = 'ECONNREFUSED';
          throw err;
        }
        return { ok: true, calls: calls };
      }
    };
    var logs = [];
    var conn = await connectWithRetry(
      mysql,
      { host: 'db' },
      { retries: 5, retryMs: 1, connectTimeoutMs: 50, log: function (m) { logs.push(m); } }
    );
    expect(conn.ok).toBe(true);
    expect(conn.calls).toBe(3);
    expect(logs.length).toBe(2);
    expect(logs[0]).toMatch(/bootstrap connect retry 1\/5/);
  });

  it('does not retry access-denied', async () => {
    var mysql = {
      createConnection: async function () {
        var err = new Error('Access denied');
        err.code = 'ER_ACCESS_DENIED_ERROR';
        throw err;
      }
    };
    await expect(
      connectWithRetry(mysql, { host: 'db' }, { retries: 4, retryMs: 1, connectTimeoutMs: 50 })
    ).rejects.toMatchObject({ code: 'ER_ACCESS_DENIED_ERROR' });
  });
});
