/**
 * 清理过期埋点 / 审计 / 登录流水，减轻 MySQL 体积。
 * 供 server.js 定时任务与 scripts/purge-old-db-logs.sh 共用同一保留策略。
 */
const DEFAULT_RETAIN_DAYS = parseInt(process.env.DB_LOG_RETAIN_DAYS || '90', 10);
const DEFAULT_BATCH_SIZE = parseInt(process.env.DB_LOG_PURGE_BATCH || '50000', 10);

/** @type {{ table: string, dateColumn: string, label: string }[]} */
const PURGE_TARGETS = [
  { table: 'user_page_events', dateColumn: 'created_at', label: '用户页面埋点' },
  { table: 'tax_record_change_logs', dateColumn: 'changed_at', label: '税务记录变更审计' },
  { table: 'install_guide_track_events', dateColumn: 'created_at', label: '安装引导追踪' },
  { table: 'admin_operation_logs', dateColumn: 'created_at', label: '管理操作日志' },
  { table: 'admin_login_events', dateColumn: 'created_at', label: '管理登录流水' },
  { table: 'user_login_events', dateColumn: 'created_at', label: '用户登录流水' },
  { table: 'analytics_api_daily', dateColumn: 'stat_date', label: '接口日聚合' }
];

function normalizeRetainDays(days) {
  var n = parseInt(days, 10);
  if (!isFinite(n) || n < 7) return 7;
  if (n > 3650) return 3650;
  return n;
}

function normalizeBatchSize(size) {
  var n = parseInt(size, 10);
  if (!isFinite(n) || n < 1000) return 1000;
  if (n > 200000) return 200000;
  return n;
}

/**
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} conn
 * @param {{ table: string, dateColumn: string, label: string }} target
 * @param {number} retainDays
 * @param {number} batchSize
 */
async function purgeTableBatch(conn, target, retainDays, batchSize) {
  var total = 0;
  var sql;
  if (target.dateColumn === 'stat_date') {
    sql =
      'DELETE FROM `' +
      target.table +
      '` WHERE `' +
      target.dateColumn +
      '` < DATE_SUB(CURDATE(), INTERVAL ? DAY) LIMIT ?';
  } else {
    sql =
      'DELETE FROM `' +
      target.table +
      '` WHERE `' +
      target.dateColumn +
      '` < DATE_SUB(NOW(), INTERVAL ? DAY) LIMIT ?';
  }
  while (true) {
    var result = await conn.execute(sql, [retainDays, batchSize]);
    var affected = result[0].affectedRows || 0;
    total += affected;
    if (affected < batchSize) {
      break;
    }
  }
  return total;
}

/**
 * @param {import('mysql2/promise').Pool} pool
 * @param {{ retainDays?: number, batchSize?: number, dryRun?: boolean }} [opts]
 */
async function purgeOldDbLogs(pool, opts) {
  if (!pool) {
    throw new Error('数据库连接池未初始化');
  }
  var retainDays = normalizeRetainDays(opts && opts.retainDays != null ? opts.retainDays : DEFAULT_RETAIN_DAYS);
  var batchSize = normalizeBatchSize(opts && opts.batchSize != null ? opts.batchSize : DEFAULT_BATCH_SIZE);
  var dryRun = !!(opts && opts.dryRun);
  var summary = {
    retain_days: retainDays,
    batch_size: batchSize,
    dry_run: dryRun,
    tables: [],
    deleted_total: 0,
    started_at: new Date().toISOString(),
    finished_at: null
  };

  var conn = await pool.getConnection();
  try {
    for (var i = 0; i < PURGE_TARGETS.length; i++) {
      var target = PURGE_TARGETS[i];
      var wouldDelete = 0;
      if (dryRun) {
        var countSql;
        if (target.dateColumn === 'stat_date') {
          countSql =
            'SELECT COUNT(*) AS cnt FROM `' +
            target.table +
            '` WHERE `' +
            target.dateColumn +
            '` < DATE_SUB(CURDATE(), INTERVAL ? DAY)';
        } else {
          countSql =
            'SELECT COUNT(*) AS cnt FROM `' +
            target.table +
            '` WHERE `' +
            target.dateColumn +
            '` < DATE_SUB(NOW(), INTERVAL ? DAY)';
        }
        var countRows = await conn.query(countSql, [retainDays]);
        wouldDelete = Number(countRows[0][0].cnt) || 0;
      } else {
        wouldDelete = await purgeTableBatch(conn, target, retainDays, batchSize);
      }
      summary.tables.push({
        table: target.table,
        label: target.label,
        deleted: wouldDelete
      });
      summary.deleted_total += wouldDelete;
    }
  } finally {
    conn.release();
  }

  summary.finished_at = new Date().toISOString();
  return summary;
}

module.exports = {
  PURGE_TARGETS,
  DEFAULT_RETAIN_DAYS,
  DEFAULT_BATCH_SIZE,
  purgeOldDbLogs
};
