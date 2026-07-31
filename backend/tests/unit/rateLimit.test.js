'use strict';


describe('rateLimit memory', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.REDIS_URL;
    delete process.env.REDIS_HOST;
  });

  it('consumeMemoryRateLimit blocks after threshold', () => {
    const rl = require('../../src/shared/rateLimit');
    const key = 'unit-test-' + Date.now();
    expect(rl.consumeMemoryRateLimit('t', key, 2, 60000).ok).toBe(true);
    expect(rl.consumeMemoryRateLimit('t', key, 2, 60000).ok).toBe(true);
    const blocked = rl.consumeMemoryRateLimit('t', key, 2, 60000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retry_after_ms).toBeGreaterThan(0);
  });

  it('kv set/get/del works in memory', async () => {
    const rl = require('../../src/shared/rateLimit');
    const k = 'kv-unit-' + Date.now();
    await rl.kvSet(k, 'hello', 30000);
    expect(await rl.kvGet(k)).toBe('hello');
    await rl.kvDel(k);
    expect(await rl.kvGet(k)).toBe(null);
  });
});
