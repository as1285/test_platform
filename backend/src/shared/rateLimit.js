/**
 * 分布式限流：优先 Redis（多实例/重启不丢），不可用时回退进程内存。
 * 键：rl:{bucket}:{key}，窗口内用 Lua 原子 INCR+PEXPIRE。
 */
var memoryRateBuckets = new Map();
var redisClient = null;
var redisTried = false;
var redisDisabled = false;
var _lastRedisWarnAt = 0;

/** Redis 错误日志节流，避免刷屏 */
function warnRedisThrottled(tag, err) {
  var now = Date.now();
  if (now - _lastRedisWarnAt < 30000) return;
  _lastRedisWarnAt = now;
  console.warn(tag, err && err.message ? err.message : err);
}

function pruneMemoryRateBuckets(now) {
  if (memoryRateBuckets.size < 20000) return;
  memoryRateBuckets.forEach(function (v, k) {
    if (!v || v.reset_at <= now) memoryRateBuckets.delete(k);
  });
}

function consumeMemoryRateLimit(bucket, key, max, windowMs) {
  var limit = Number(max) || 0;
  if (limit <= 0) return { ok: true, backend: 'memory' };
  var now = Date.now();
  pruneMemoryRateBuckets(now);
  var fullKey = bucket + ':' + String(key || 'unknown').substring(0, 160);
  var row = memoryRateBuckets.get(fullKey);
  if (!row || row.reset_at <= now) {
    row = { count: 0, reset_at: now + windowMs };
  }
  row.count += 1;
  memoryRateBuckets.set(fullKey, row);
  if (row.count > limit) {
    return {
      ok: false,
      retry_after_ms: Math.max(1000, row.reset_at - now),
      backend: 'memory'
    };
  }
  return { ok: true, backend: 'memory' };
}

/**
 * KEYS[1]=rate key
 * ARGV[1]=windowMs
 * returns {count, ttlMs}
 */
var RATE_LIMIT_LUA =
  "local n = redis.call('INCR', KEYS[1])\n" +
  "if n == 1 then\n" +
  "  redis.call('PEXPIRE', KEYS[1], ARGV[1])\n" +
  "end\n" +
  "local ttl = redis.call('PTTL', KEYS[1])\n" +
  "if ttl < 0 then\n" +
  "  redis.call('PEXPIRE', KEYS[1], ARGV[1])\n" +
  "  ttl = tonumber(ARGV[1])\n" +
  "end\n" +
  'return {n, ttl}';

function getRedisClient() {
  if (redisDisabled) return null;
  if (redisClient) return redisClient;
  if (redisTried) return redisClient;
  redisTried = true;
  var url = String(process.env.REDIS_URL || '').trim();
  var host = String(process.env.REDIS_HOST || '').trim();
  if (!url && !host) {
    redisDisabled = true;
    return null;
  }
  try {
    var Redis = require('ioredis');
    if (url) {
      redisClient = new Redis(url, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: false,
        connectTimeout: 2000
      });
    } else {
      redisClient = new Redis({
        host: host,
        port: parseInt(process.env.REDIS_PORT || '6379', 10) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: parseInt(process.env.REDIS_DB || '0', 10) || 0,
        maxRetriesPerRequest: 1,
        connectTimeout: 2000
      });
    }
    redisClient.on('error', function (err) {
      warnRedisThrottled('[rateLimit] redis error', err);
    });
    return redisClient;
  } catch (e) {
    warnRedisThrottled('[rateLimit] redis unavailable, using memory', e);
    redisDisabled = true;
    redisClient = null;
    return null;
  }
}

/**
 * @returns {Promise<{ok:boolean, retry_after_ms?:number, backend?:string}>}
 */
async function consumeRateLimit(bucket, key, max, windowMs) {
  var limit = Number(max) || 0;
  if (limit <= 0) return { ok: true, backend: 'none' };
  var win = Math.max(1000, Number(windowMs) || 60000);
  var r = getRedisClient();
  if (r) {
    try {
      var fullKey =
        'rl:' + String(bucket || 'x') + ':' + String(key || 'unknown').substring(0, 160);
      var ret = await r.eval(RATE_LIMIT_LUA, 1, fullKey, String(win));
      var n = Array.isArray(ret) ? Number(ret[0]) : Number(ret);
      var ttl = Array.isArray(ret) ? Number(ret[1]) : win;
      if (!Number.isFinite(n)) n = 0;
      if (!Number.isFinite(ttl) || ttl < 0) ttl = win;
      if (n > limit) {
        return {
          ok: false,
          retry_after_ms: Math.max(1000, ttl > 0 ? ttl : win),
          backend: 'redis'
        };
      }
      return { ok: true, backend: 'redis' };
    } catch (e) {
      warnRedisThrottled('[rateLimit] redis consume failed, fallback memory', e);
    }
  }
  return consumeMemoryRateLimit(bucket, key, max, win);
}

/** 读写通用 KV（OTP challenge / 锁定辅助），Redis 优先 */
async function kvSet(key, value, ttlMs) {
  var r = getRedisClient();
  var k = 'kv:' + String(key || '').substring(0, 200);
  var raw = typeof value === 'string' ? value : JSON.stringify(value);
  var ttl = Math.max(1000, Number(ttlMs) || 60000);
  if (r) {
    try {
      await r.set(k, raw, 'PX', ttl);
      return true;
    } catch (e) {
      warnRedisThrottled('[rateLimit] kvSet failed', e);
    }
  }
  memoryRateBuckets.set('kv:' + k, { count: 0, reset_at: Date.now() + ttl, payload: raw });
  return true;
}

/** SET if Not eXists；成功返回 true */
async function kvSetNx(key, value, ttlMs) {
  var r = getRedisClient();
  var k = 'kv:' + String(key || '').substring(0, 200);
  var raw = typeof value === 'string' ? value : JSON.stringify(value);
  var ttl = Math.max(1000, Number(ttlMs) || 60000);
  if (r) {
    try {
      var ok = await r.set(k, raw, 'PX', ttl, 'NX');
      return ok === 'OK';
    } catch (e) {
      warnRedisThrottled('[rateLimit] kvSetNx failed', e);
    }
  }
  var memKey = 'kv:' + k;
  var row = memoryRateBuckets.get(memKey);
  var now = Date.now();
  if (row && row.reset_at > now) return false;
  memoryRateBuckets.set(memKey, { count: 0, reset_at: now + ttl, payload: raw });
  return true;
}

async function kvGet(key) {
  var r = getRedisClient();
  var k = 'kv:' + String(key || '').substring(0, 200);
  if (r) {
    try {
      var v = await r.get(k);
      return v;
    } catch (e) {
      warnRedisThrottled('[rateLimit] kvGet failed', e);
    }
  }
  var row = memoryRateBuckets.get('kv:' + k);
  if (!row || row.reset_at <= Date.now()) return null;
  return row.payload != null ? String(row.payload) : null;
}

async function kvDel(key) {
  var r = getRedisClient();
  var k = 'kv:' + String(key || '').substring(0, 200);
  if (r) {
    try {
      await r.del(k);
    } catch (e) {
      warnRedisThrottled('[rateLimit] kvDel failed', e);
    }
  }
  memoryRateBuckets.delete('kv:' + k);
}

function rateLimitBackendLabel() {
  if (redisDisabled) return 'memory';
  if (getRedisClient()) return 'redis';
  return 'memory';
}

module.exports = {
  consumeRateLimit,
  consumeMemoryRateLimit,
  kvSet,
  kvSetNx,
  kvGet,
  kvDel,
  rateLimitBackendLabel,
  getRedisClient
};
