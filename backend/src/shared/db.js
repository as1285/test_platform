/**
 * 数据库连接池访问器。
 * 阶段 1：池仍由 legacy/monolith.initDatabase 创建；本模块仅提供统一取值入口，供后续域仓储使用。
 */
let _pool = null;

function setPool(pool) {
  _pool = pool || null;
}

function getPool() {
  if (!_pool) {
    throw new Error('Database pool is not initialized');
  }
  return _pool;
}

function getPoolOrNull() {
  return _pool;
}

module.exports = {
  setPool,
  getPool,
  getPoolOrNull
};
