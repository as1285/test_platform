/**
 * 数据库连接池访问器。
 * 阶段 1：池仍由 legacy/monolith.initDatabase 创建；本模块仅提供统一取值入口，供后续域仓储使用。
 */
let _pool = null;
let _ready = false;

/** 注入全局 MySQL 连接池 */
function setPool(pool) {
  _pool = pool || null;
  if (!_pool) {
    _ready = false;
  }
}

/** 标记库表初始化完成，此后才放行业务请求 */
function markReady(ready) {
  _ready = ready !== false && !!_pool;
}

/** 业务请求是否可访问数据库 */
function isReady() {
  return _ready;
}

/**
 * 启动期闸门：库未就绪时立即 503，避免 nginx 空等 10–15s。
 * 须挂在所有业务中间件之前。
 */
function databaseReadyMiddleware(req, res, next) {
  if (_ready) {
    return next();
  }
  var p = String((req && req.path) || '');
  if (p === '/health' || p === '/api/health') {
    return res.status(503).json({ ok: false, starting: true });
  }
  return res.status(503).json({ code: 503, msg: '服务启动中，请稍后重试' });
}

/** 获取已初始化的连接池（未初始化则抛错） */
function getPool() {
  if (!_pool) {
    throw new Error('Database pool is not initialized');
  }
  return _pool;
}

/** 获取连接池，未初始化时返回 null */
function getPoolOrNull() {
  return _pool;
}

module.exports = {
  setPool,
  getPool,
  getPoolOrNull,
  markReady,
  isReady,
  databaseReadyMiddleware
};
