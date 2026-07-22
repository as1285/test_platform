/**
 * 清理过期埋点 / 审计 / 登录流水，减轻 MySQL 体积。
 * 供 monolith 定时任务与 scripts/purge-old-db-logs.sh 共用。
 * 阶段 4：支持按表覆盖保留天数（DB_RETAIN_<TABLE>_DAYS）。
 */
const DEFAULT_RETAIN_DAYS = parseInt(process.env.DB_LOG_RETAIN_DAYS || '90', 10);
const DEFAULT_BATCH_SIZE = parseInt(process.env.DB_LOG_PURGE_BATCH || '50000', 10);

/**
 * @typedef {{ table: string, dateColumn: string, label: string, envVar?: string, defaultDays?: number, mode?: 'age'|'expires' }} PurgeTarget
 */

/** @type {PurgeTarget[]} */
const PURGE_TARGETS = [
  {
    table: 'user_page_events',
    dateColumn: 'created_at',
    label: '用户页面埋点',
    envVar: 'DB_RETAIN_USER_PAGE_EVENTS_DAYS',
    defaultDays: 90
  },
  {
    table: 'tax_record_change_logs',
    dateColumn: 'changed_at',
    label: '税务记录变更审计',
    envVar: 'DB_RETAIN_TAX_RECORD_CHANGE_LOGS_DAYS',
    defaultDays: 365
  },
  {
    table: 'user_profile_change_logs',
    dateColumn: 'created_at',
    label: '用户资料变更（改名）',
    envVar: 'DB_RETAIN_USER_PROFILE_CHANGE_LOGS_DAYS',
    defaultDays: 365
  },
  {
    table: 'install_guide_track_events',
    dateColumn: 'created_at',
    label: '安装引导追踪',
    envVar: 'DB_RETAIN_INSTALL_GUIDE_TRACK_EVENTS_DAYS',
    defaultDays: 180
  },
  {
    table: 'admin_operation_logs',
    dateColumn: 'created_at',
    label: '管理操作日志',
    envVar: 'DB_RETAIN_ADMIN_OPERATION_LOGS_DAYS',
    defaultDays: 365
  },
  {
    table: 'admin_login_events',
    dateColumn: 'created_at',
    label: '管理登录流水',
    envVar: 'DB_RETAIN_ADMIN_LOGIN_EVENTS_DAYS',
    defaultDays: 365
  },
  {
    table: 'user_login_events',
    dateColumn: 'created_at',
    label: '用户登录流水',
    envVar: 'DB_RETAIN_USER_LOGIN_EVENTS_DAYS',
    defaultDays: 180
  },
  {
    table: 'analytics_api_daily',
    dateColumn: 'stat_date',
    label: '接口日聚合',
    envVar: 'DB_RETAIN_ANALYTICS_API_DAILY_DAYS',
    defaultDays: 365
  },
  {
    table: 'api_slow_events',
    dateColumn: 'created_at',
    label: '慢接口异常明细',
    envVar: 'DB_RETAIN_API_SLOW_EVENTS_DAYS',
    defaultDays: 90
  },
  {
    table: 'api_error_events',
    dateColumn: 'created_at',
    label: '接口错误明细',
    envVar: 'DB_RETAIN_API_ERROR_EVENTS_DAYS',
    defaultDays: 180
  },
  {
    table: 'user_daily_activity',
    dateColumn: 'activity_date',
    label: '用户日活',
    envVar: 'DB_RETAIN_USER_DAILY_ACTIVITY_DAYS',
    defaultDays: 730
  },
  {
    table: 'sales_channel_attributions',
    dateColumn: 'expires_at',
    label: '渠道归因（按 expires_at）',
    envVar: 'DB_RETAIN_SALES_CHANNEL_ATTRIBUTIONS_DAYS',
    defaultDays: 180,
    mode: 'expires'
  }
];

/** 规范化：RetainDays */
function normalizeRetainDays(days) {
  var n = parseInt(days, 10);
  if (!isFinite(n) || n < 7) return 7;
  if (n > 3650) return 3650;
  return n;
}

/** 规范化：BatchSize */
function normalizeBatchSize(size) {
  var n = parseInt(size, 10);
  if (!isFinite(n) || n < 1000) return 1000;
  if (n > 200000) return 200000;
  return n;
}

/**
 * 解析单表保留天数：专用 env → 表默认 → 全局 DB_LOG_RETAIN_DAYS
 * @param {PurgeTarget} target
 * @param {number} globalDays
 */
function resolveTargetRetainDays(target, globalDays) {
  var fromEnv = target.envVar ? parseInt(process.env[target.envVar] || '', 10) : NaN;
  if (isFinite(fromEnv) && fromEnv > 0) {
    return normalizeRetainDays(fromEnv);
  }
  if (target.defaultDays != null) {
    return normalizeRetainDays(target.defaultDays);
  }
  return normalizeRetainDays(globalDays);
}

/** 判断：DateOnlyColumn */
function isDateOnlyColumn(col) {
  return col === 'stat_date' || col === 'activity_date';
}

/**
 * @param {import('mysql2/promise').Pool|import('mysql2/promise').PoolConnection} conn
 * @param {PurgeTarget} target
 * @param {number} retainDays
 * @param {number} batchSize
 */
async function purgeTableBatch(conn, target, retainDays, batchSize) {
  var total = 0;
  var days = Number(retainDays);
  var lim = Number(batchSize);
  var runnable;
  if (target.mode === 'expires') {
    // 过期归因：expires_at 已过期，且创建时间早于保留窗口（双条件，避免误删刚过期但仍需排查的行可单独调天数）
    runnable =
      'DELETE FROM `' +
      target.table +
      '` WHERE `' +
      target.dateColumn +
      '` IS NOT NULL AND `' +
      target.dateColumn +
      '` < NOW() AND `created_at` < DATE_SUB(NOW(), INTERVAL ' +
      days +
      ' DAY) LIMIT ' +
      lim;
  } else if (isDateOnlyColumn(target.dateColumn)) {
    runnable =
      'DELETE FROM `' +
      target.table +
      '` WHERE `' +
      target.dateColumn +
      '` < DATE_SUB(CURDATE(), INTERVAL ' +
      days +
      ' DAY) LIMIT ' +
      lim;
  } else {
    runnable =
      'DELETE FROM `' +
      target.table +
      '` WHERE `' +
      target.dateColumn +
      '` < DATE_SUB(NOW(), INTERVAL ' +
      days +
      ' DAY) LIMIT ' +
      lim;
  }
  while (true) {
    var result = await conn.query(runnable);
    var affected = result[0].affectedRows || 0;
    total += affected;
    if (affected < lim) {
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
    retain_days_default: retainDays,
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
      var tableDays = resolveTargetRetainDays(target, retainDays);
      var wouldDelete = 0;
      if (dryRun) {
        var countSql;
        var countParams = [tableDays];
        if (target.mode === 'expires') {
          countSql =
            'SELECT COUNT(*) AS cnt FROM `' +
            target.table +
            '` WHERE `' +
            target.dateColumn +
            '` IS NOT NULL AND `' +
            target.dateColumn +
            '` < NOW() AND `created_at` < DATE_SUB(NOW(), INTERVAL ? DAY)';
        } else if (isDateOnlyColumn(target.dateColumn)) {
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
        var countRows = await conn.query(countSql, countParams);
        wouldDelete = Number(countRows[0][0].cnt) || 0;
      } else {
        try {
          wouldDelete = await purgeTableBatch(conn, target, tableDays, batchSize);
        } catch (e) {
          // 表不存在时跳过（旧库 / 未迁移）
          if (e && (e.code === 'ER_NO_SUCH_TABLE' || e.errno === 1146)) {
            summary.tables.push({
              table: target.table,
              label: target.label,
              retain_days: tableDays,
              deleted: 0,
              skipped: 'missing_table'
            });
            continue;
          }
          throw e;
        }
      }
      summary.tables.push({
        table: target.table,
        label: target.label,
        retain_days: tableDays,
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
  resolveTargetRetainDays,
  purgeOldDbLogs
};
