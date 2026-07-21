/**
 * 数据库连接池访问器。
 * 阶段 1：池仍由 legacy/monolith.initDatabase 创建；本模块仅提供统一取值入口，供后续域仓储使用。
 */
let _pool = null;

/** 注入全局 MySQL 连接池 */
function setPool(pool) {
  _pool = pool || null;
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
  getPoolOrNull
};
