/**
 * MySQL 启动竞态：主机重启后 mysqladmin ping 可能已 healthy，
 * 但 InnoDB 尚未接受业务连接。此处按可恢复错误重试，避免进程直接退出。
 */
'use strict';

var TRANSIENT_CODES = {
  ECONNREFUSED: true,
  ETIMEDOUT: true,
  ECONNRESET: true,
  PROTOCOL_CONNECTION_LOST: true,
  ENOTFOUND: true,
  EAI_AGAIN: true,
  ER_SERVER_SHUTDOWN: true
};

function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

/** 判断是否为启动期可重试的数据库错误 */
function isTransientDbError(error) {
  var code = error && error.code != null ? String(error.code) : '';
  if (TRANSIENT_CODES[code]) return true;
  var msg = String((error && error.message) || '');
  return /ECONNREFUSED|ETIMEDOUT|ECONNRESET|PROTOCOL_CONNECTION_LOST/i.test(msg);
}

function readPositiveInt(raw, fallback) {
  var n = parseInt(raw, 10);
  if (!isFinite(n) || n < 1) return fallback;
  return n;
}

/**
 * 带退避的 mysql.createConnection。
 * @param {object} mysql mysql2/promise
 * @param {object} options 连接参数
 * @param {object} [retry] retries / retryMs / connectTimeoutMs / log
 */
async function connectWithRetry(mysql, options, retry) {
  var cfg = retry && typeof retry === 'object' ? retry : {};
  var attempts = readPositiveInt(cfg.retries, readPositiveInt(process.env.DB_CONNECT_RETRIES, 30));
  var delayMs = readPositiveInt(cfg.retryMs, readPositiveInt(process.env.DB_CONNECT_RETRY_MS, 1000));
  var connectTimeout = readPositiveInt(
    cfg.connectTimeoutMs,
    readPositiveInt(process.env.DB_CONNECT_TIMEOUT_MS, 3000)
  );
  var log = typeof cfg.log === 'function' ? cfg.log : console.warn.bind(console);
  var lastErr = null;
  var i;
  for (i = 1; i <= attempts; i++) {
    try {
      return await mysql.createConnection(
        Object.assign({}, options, { connectTimeout: connectTimeout })
      );
    } catch (error) {
      lastErr = error;
      if (!isTransientDbError(error) || i === attempts) {
        throw error;
      }
      log(
        '[db] bootstrap connect retry ' +
          i +
          '/' +
          attempts +
          ' code=' +
          (error && error.code) +
          ' wait_ms=' +
          delayMs
      );
      await sleep(delayMs);
    }
  }
  throw lastErr;
}

module.exports = {
  isTransientDbError,
  connectWithRetry,
  sleep
};
