#!/usr/bin/env bash
# 清理 90 天前的埋点 / 审计 / 登录流水（可 cron 每日执行）。
# 用法：
#   ./scripts/purge-old-db-logs.sh
#   RETAIN_DAYS=60 ./scripts/purge-old-db-logs.sh
#   ./scripts/purge-old-db-logs.sh --dry-run
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_CONTAINER="${DB_CONTAINER:-test_platform_db}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-password}"
DB_NAME="${DB_NAME:-personal_tax}"
RETAIN_DAYS="${RETAIN_DAYS:-90}"
BATCH_SIZE="${DB_LOG_PURGE_BATCH:-50000}"
DRY_RUN=0

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help)
      echo "Usage: $0 [--dry-run]"
      echo "  RETAIN_DAYS=${RETAIN_DAYS}  保留最近 N 天"
      echo "  DB_LOG_PURGE_BATCH=${BATCH_SIZE}  每批删除行数"
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

mysql_exec() {
  docker exec "$DB_CONTAINER" mysql -uroot -p"$DB_ROOT_PASSWORD" -N -s "$DB_NAME" -e "$1"
}

purge_table() {
  local table="$1"
  local col="$2"
  local label="$3"
  local total=0
  local affected=0

  if [[ "$DRY_RUN" -eq 1 ]]; then
    if [[ "$col" == "stat_date" ]]; then
      total="$(mysql_exec "SELECT COUNT(*) FROM \`${table}\` WHERE \`${col}\` < DATE_SUB(CURDATE(), INTERVAL ${RETAIN_DAYS} DAY);")"
    else
      total="$(mysql_exec "SELECT COUNT(*) FROM \`${table}\` WHERE \`${col}\` < DATE_SUB(NOW(), INTERVAL ${RETAIN_DAYS} DAY);")"
    fi
    echo "[purge-db-logs] [dry-run] ${label} (${table}): would delete ${total} rows"
    return 0
  fi

  while true; do
    if [[ "$col" == "stat_date" ]]; then
      affected="$(mysql_exec "DELETE FROM \`${table}\` WHERE \`${col}\` < DATE_SUB(CURDATE(), INTERVAL ${RETAIN_DAYS} DAY) LIMIT ${BATCH_SIZE}; SELECT ROW_COUNT();")"
    else
      affected="$(mysql_exec "DELETE FROM \`${table}\` WHERE \`${col}\` < DATE_SUB(NOW(), INTERVAL ${RETAIN_DAYS} DAY) LIMIT ${BATCH_SIZE}; SELECT ROW_COUNT();")"
    fi
    affected="${affected:-0}"
    total=$((total + affected))
    if [[ "$affected" -lt "$BATCH_SIZE" ]]; then
      break
    fi
  done
  echo "[purge-db-logs] ${label} (${table}): deleted ${total} rows"
}

echo "[purge-db-logs] retain_days=${RETAIN_DAYS} batch=${BATCH_SIZE} dry_run=${DRY_RUN}"

purge_table user_page_events created_at "用户页面埋点"
purge_table tax_record_change_logs changed_at "税务记录变更审计"
purge_table install_guide_track_events created_at "安装引导追踪"
purge_table admin_operation_logs created_at "管理操作日志"
purge_table admin_login_events created_at "管理登录流水"
purge_table user_login_events created_at "用户登录流水"
purge_table analytics_api_daily stat_date "接口日聚合"

if [[ "$DRY_RUN" -eq 0 ]]; then
  echo "[purge-db-logs] OPTIMIZE TABLE (lightweight, may take a minute)..."
  mysql_exec "OPTIMIZE TABLE user_page_events, tax_record_change_logs, install_guide_track_events, admin_operation_logs, admin_login_events, user_login_events, analytics_api_daily;" >/dev/null || true
fi

echo "[purge-db-logs] done"
