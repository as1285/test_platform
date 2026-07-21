#!/usr/bin/env bash
# 清理过期埋点 / 审计 / 登录流水（与 backend/dbLogRetention.js 策略对齐）。
# 用法：
#   ./scripts/purge-old-db-logs.sh
#   RETAIN_DAYS=60 ./scripts/purge-old-db-logs.sh
#   DB_RETAIN_USER_PAGE_EVENTS_DAYS=60 ./scripts/purge-old-db-logs.sh
#   ./scripts/purge-old-db-logs.sh --dry-run
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_CONTAINER="${DB_CONTAINER:-test_platform_db}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-password}"
DB_NAME="${DB_NAME:-personal_tax}"
# 兼容旧名 RETAIN_DAYS 与服务端 DB_LOG_RETAIN_DAYS
RETAIN_DAYS="${RETAIN_DAYS:-${DB_LOG_RETAIN_DAYS:-90}}"
BATCH_SIZE="${DB_LOG_PURGE_BATCH:-50000}"
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      echo "Usage: $0 [--dry-run]"
      echo "  RETAIN_DAYS / DB_LOG_RETAIN_DAYS=${RETAIN_DAYS}  全局默认保留天数"
      echo "  DB_RETAIN_<TABLE>_DAYS  单表覆盖（见 docs/architecture-phase4）"
      echo "  DB_LOG_PURGE_BATCH=${BATCH_SIZE}"
      exit 0
      ;;
    *)
      echo "[purge-db-logs] unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "[purge-db-logs] MySQL 容器未运行: $DB_CONTAINER" >&2
  exit 1
fi

# 优先走后端 Node 实现（与线上定时任务一致）
if docker ps --format '{{.Names}}' | grep -qx "personal-tax-api"; then
  echo "[purge-db-logs] via personal-tax-api dbLogRetention (retain_default=${RETAIN_DAYS})"
  export DB_LOG_RETAIN_DAYS="$RETAIN_DAYS"
  export DB_LOG_PURGE_BATCH="$BATCH_SIZE"
  if [[ "$DRY_RUN" -eq 1 ]]; then
    docker exec -e DB_LOG_RETAIN_DAYS -e DB_LOG_PURGE_BATCH \
      -e DB_RETAIN_USER_PAGE_EVENTS_DAYS -e DB_RETAIN_INSTALL_GUIDE_TRACK_EVENTS_DAYS \
      -e DB_RETAIN_ANALYTICS_API_DAILY_DAYS -e DB_RETAIN_API_SLOW_EVENTS_DAYS \
      -e DB_RETAIN_API_ERROR_EVENTS_DAYS -e DB_RETAIN_USER_LOGIN_EVENTS_DAYS \
      -e DB_RETAIN_ADMIN_LOGIN_EVENTS_DAYS -e DB_RETAIN_ADMIN_OPERATION_LOGS_DAYS \
      -e DB_RETAIN_TAX_RECORD_CHANGE_LOGS_DAYS -e DB_RETAIN_USER_DAILY_ACTIVITY_DAYS \
      -e DB_RETAIN_SALES_CHANNEL_ATTRIBUTIONS_DAYS \
      personal-tax-api node -e '
        const mysql=require("mysql2/promise");
        const r=require("./dbLogRetention");
        (async()=>{
          const pool=mysql.createPool({
            host:process.env.DB_HOST||"db",
            port:Number(process.env.DB_PORT||3306),
            user:process.env.DB_USER||"root",
            password:process.env.DB_PASSWORD||"password",
            database:process.env.DB_DATABASE||"personal_tax"
          });
          try {
            const s=await r.purgeOldDbLogs(pool,{dryRun:true,retainDays:Number(process.env.DB_LOG_RETAIN_DAYS||90)});
            console.log(JSON.stringify(s,null,2));
          } finally { await pool.end(); }
        })().catch(e=>{console.error(e);process.exit(1);});
      '
  else
    docker exec -e DB_LOG_RETAIN_DAYS -e DB_LOG_PURGE_BATCH \
      -e DB_RETAIN_USER_PAGE_EVENTS_DAYS -e DB_RETAIN_INSTALL_GUIDE_TRACK_EVENTS_DAYS \
      -e DB_RETAIN_ANALYTICS_API_DAILY_DAYS -e DB_RETAIN_API_SLOW_EVENTS_DAYS \
      -e DB_RETAIN_API_ERROR_EVENTS_DAYS -e DB_RETAIN_USER_LOGIN_EVENTS_DAYS \
      -e DB_RETAIN_ADMIN_LOGIN_EVENTS_DAYS -e DB_RETAIN_ADMIN_OPERATION_LOGS_DAYS \
      -e DB_RETAIN_TAX_RECORD_CHANGE_LOGS_DAYS -e DB_RETAIN_USER_DAILY_ACTIVITY_DAYS \
      -e DB_RETAIN_SALES_CHANNEL_ATTRIBUTIONS_DAYS \
      personal-tax-api node -e '
        const mysql=require("mysql2/promise");
        const r=require("./dbLogRetention");
        (async()=>{
          const pool=mysql.createPool({
            host:process.env.DB_HOST||"db",
            port:Number(process.env.DB_PORT||3306),
            user:process.env.DB_USER||"root",
            password:process.env.DB_PASSWORD||"password",
            database:process.env.DB_DATABASE||"personal_tax"
          });
          try {
            const s=await r.purgeOldDbLogs(pool,{dryRun:false,retainDays:Number(process.env.DB_LOG_RETAIN_DAYS||90)});
            console.log(JSON.stringify(s,null,2));
          } finally { await pool.end(); }
        })().catch(e=>{console.error(e);process.exit(1);});
      '
  fi
  echo "[purge-db-logs] done"
  exit 0
fi

echo "[purge-db-logs] backend container missing; fallback to SQL (global RETAIN_DAYS only)" >&2

mysql_exec() {
  docker exec "$DB_CONTAINER" mysql -uroot -p"$DB_ROOT_PASSWORD" -N -s "$DB_NAME" -e "$1"
}

purge_table() {
  local table="$1"
  local col="$2"
  local label="$3"
  local days="${4:-$RETAIN_DAYS}"
  local mode="${5:-age}"
  local total=0
  local affected=0

  if [[ "$DRY_RUN" -eq 1 ]]; then
    if [[ "$mode" == "expires" ]]; then
      total="$(mysql_exec "SELECT COUNT(*) FROM \`${table}\` WHERE \`${col}\` IS NOT NULL AND \`${col}\` < NOW() AND created_at < DATE_SUB(NOW(), INTERVAL ${days} DAY);")"
    elif [[ "$col" == "stat_date" || "$col" == "activity_date" ]]; then
      total="$(mysql_exec "SELECT COUNT(*) FROM \`${table}\` WHERE \`${col}\` < DATE_SUB(CURDATE(), INTERVAL ${days} DAY);")"
    else
      total="$(mysql_exec "SELECT COUNT(*) FROM \`${table}\` WHERE \`${col}\` < DATE_SUB(NOW(), INTERVAL ${days} DAY);")"
    fi
    echo "[purge-db-logs] [dry-run] ${label} (${table}): would delete ${total} rows (retain=${days})"
    return 0
  fi

  while true; do
    if [[ "$mode" == "expires" ]]; then
      affected="$(mysql_exec "DELETE FROM \`${table}\` WHERE \`${col}\` IS NOT NULL AND \`${col}\` < NOW() AND created_at < DATE_SUB(NOW(), INTERVAL ${days} DAY) LIMIT ${BATCH_SIZE}; SELECT ROW_COUNT();")"
    elif [[ "$col" == "stat_date" || "$col" == "activity_date" ]]; then
      affected="$(mysql_exec "DELETE FROM \`${table}\` WHERE \`${col}\` < DATE_SUB(CURDATE(), INTERVAL ${days} DAY) LIMIT ${BATCH_SIZE}; SELECT ROW_COUNT();")"
    else
      affected="$(mysql_exec "DELETE FROM \`${table}\` WHERE \`${col}\` < DATE_SUB(NOW(), INTERVAL ${days} DAY) LIMIT ${BATCH_SIZE}; SELECT ROW_COUNT();")"
    fi
    affected="${affected:-0}"
    total=$((total + affected))
    if [[ "$affected" -lt "$BATCH_SIZE" ]]; then
      break
    fi
  done
  echo "[purge-db-logs] ${label} (${table}): deleted ${total} rows (retain=${days})"
}

echo "[purge-db-logs] retain_days=${RETAIN_DAYS} batch=${BATCH_SIZE} dry_run=${DRY_RUN}"

days_for() {
  local env_name="$1"
  local fallback="$2"
  local v="${!env_name:-}"
  if [[ -n "$v" ]]; then echo "$v"; else echo "$fallback"; fi
}

purge_table user_page_events created_at "用户页面埋点" "$(days_for DB_RETAIN_USER_PAGE_EVENTS_DAYS 90)"
purge_table tax_record_change_logs changed_at "税务记录变更审计" "$(days_for DB_RETAIN_TAX_RECORD_CHANGE_LOGS_DAYS 365)"
purge_table install_guide_track_events created_at "安装引导追踪" "$(days_for DB_RETAIN_INSTALL_GUIDE_TRACK_EVENTS_DAYS 180)"
purge_table admin_operation_logs created_at "管理操作日志" "$(days_for DB_RETAIN_ADMIN_OPERATION_LOGS_DAYS 365)"
purge_table admin_login_events created_at "管理登录流水" "$(days_for DB_RETAIN_ADMIN_LOGIN_EVENTS_DAYS 365)"
purge_table user_login_events created_at "用户登录流水" "$(days_for DB_RETAIN_USER_LOGIN_EVENTS_DAYS 180)"
purge_table analytics_api_daily stat_date "接口日聚合" "$(days_for DB_RETAIN_ANALYTICS_API_DAILY_DAYS 365)"
purge_table api_slow_events created_at "慢接口异常明细" "$(days_for DB_RETAIN_API_SLOW_EVENTS_DAYS 90)"
purge_table api_error_events created_at "接口错误明细" "$(days_for DB_RETAIN_API_ERROR_EVENTS_DAYS 180)"
purge_table user_daily_activity activity_date "用户日活" "$(days_for DB_RETAIN_USER_DAILY_ACTIVITY_DAYS 730)"
purge_table sales_channel_attributions expires_at "渠道归因" "$(days_for DB_RETAIN_SALES_CHANNEL_ATTRIBUTIONS_DAYS 180)" expires

echo "[purge-db-logs] done"
