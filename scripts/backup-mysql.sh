#!/usr/bin/env bash
# 备份 Docker MySQL 中的 personal_tax 库为 gzip sql。
# 用法：
#   ./scripts/backup-mysql.sh                 # 写入 data/db-backups/
#   ./scripts/backup-mysql.sh --stdout        # 输出到 stdout（供管道使用）
#   ./scripts/backup-mysql.sh --install-cron  # 幂等安装：每 15 分钟备份（默认 48h / 200 份）
#
# 默认：每 15 分钟一份；保留 48 小时，最多 200 份（≈ 2 天热备）。
# 更长保留见 scripts/sync-backup-offsite.sh（日备 14 天 / 周备 8 周）。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_PATH="$ROOT/scripts/backup-mysql.sh"
DB_CONTAINER="${DB_CONTAINER:-test_platform_db}"
DB_NAME="${DB_NAME:-personal_tax}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/data/db-backups}"
RETAIN_HOURS="${RETAIN_HOURS:-48}"
MAX_BACKUPS="${MAX_BACKUPS:-200}"
LOG_FILE="${MYSQL_BACKUP_LOG:-/var/log/test_platform-mysql-backup.log}"
LOCK_FILE="${MYSQL_BACKUP_LOCK:-/var/lock/test_platform-mysql-backup.lock}"
CRON_EXPR="*/15 * * * *"
CRON_LINE="${CRON_EXPR} /usr/bin/flock -xn ${LOCK_FILE} -c '/bin/bash ${SCRIPT_PATH}' >> ${LOG_FILE} 2>&1"

resolve_db_password() {
  if [[ -n "${DB_ROOT_PASSWORD:-}" ]]; then
    echo "$DB_ROOT_PASSWORD"
    return 0
  fi
  if docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
    docker exec "$DB_CONTAINER" printenv MYSQL_ROOT_PASSWORD 2>/dev/null || true
  fi
}

install_cron() {
  local tmp
  tmp="$(mktemp)"
  crontab -l 2>/dev/null | grep -v 'scripts/backup-mysql.sh' >"$tmp" || true
  printf '%s\n' "$CRON_LINE" >>"$tmp"
  crontab "$tmp"
  rm -f "$tmp"
  echo "[backup] crontab installed: $CRON_LINE"
  crontab -l 2>/dev/null | grep -F 'backup-mysql.sh' || true
}

if [[ "${1:-}" == "--install-cron" ]]; then
  install_cron
  exit 0
fi

STDOUT=0
if [[ "${1:-}" == "--stdout" ]]; then
  STDOUT=1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "[backup] MySQL 容器未运行: $DB_CONTAINER" >&2
  exit 1
fi

DB_ROOT_PASSWORD="$(resolve_db_password)"
if [[ -z "$DB_ROOT_PASSWORD" ]]; then
  echo "[backup] 无法读取 MySQL root 密码（设 DB_ROOT_PASSWORD 或确保容器 ${DB_CONTAINER} 可访问）" >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/${DB_NAME}-${STAMP}.sql.gz"

DUMP_ARGS=(
  -uroot "-p$DB_ROOT_PASSWORD"
  --default-character-set=utf8mb4
  --single-transaction --routines --triggers --databases "$DB_NAME"
)

if [[ "$STDOUT" -eq 1 ]]; then
  docker exec "$DB_CONTAINER" mysqldump "${DUMP_ARGS[@]}" | gzip -c
  exit 0
fi

mkdir -p "$BACKUP_DIR"
TMP_OUT="${OUT}.tmp.$$"
cleanup_tmp() { rm -f "$TMP_OUT"; }
trap cleanup_tmp EXIT
docker exec "$DB_CONTAINER" mysqldump "${DUMP_ARGS[@]}" | gzip -c > "$TMP_OUT"

# 空备份或异常小文件视为失败（避免静默写出几 KB 废文件）
MIN_BYTES="${BACKUP_MIN_BYTES:-4096}"
SZ="$(wc -c < "$TMP_OUT" | tr -d ' ')"
if [[ "$SZ" -lt "$MIN_BYTES" ]]; then
  echo "[backup] ERROR: 备份过小 (${SZ} bytes): $TMP_OUT" >&2
  exit 1
fi
if ! gzip -t "$TMP_OUT" 2>/dev/null; then
  echo "[backup] ERROR: gzip 校验失败: $TMP_OUT" >&2
  exit 1
fi
mv -f "$TMP_OUT" "$OUT"
trap - EXIT

echo "[backup] 已写入 $OUT ($(du -h "$OUT" | awk '{print $1}'))"

# 按小时清理（默认 48h；find -mmin 单位为分钟）
RETAIN_MINS=$((RETAIN_HOURS * 60))
find "$BACKUP_DIR" -name "${DB_NAME}-[0-9]*.sql.gz" -mmin +"$RETAIN_MINS" -delete 2>/dev/null || true

# 按份数上限清理（保留最新 MAX_BACKUPS 份）
mapfile -t OLD_FILES < <(ls -1t "$BACKUP_DIR"/${DB_NAME}-[0-9]*.sql.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) || true)
if ((${#OLD_FILES[@]})); then
  rm -f "${OLD_FILES[@]}"
  echo "[backup] 已按上限清理旧备份 ${#OLD_FILES[@]} 份（最多保留 ${MAX_BACKUPS}）"
fi

COUNT="$(ls -1 "$BACKUP_DIR"/${DB_NAME}-[0-9]*.sql.gz 2>/dev/null | wc -l | tr -d ' ')"
DISK="$(du -sh "$BACKUP_DIR" | awk '{print $1}')"
echo "[backup] 当前 ${COUNT} 份 / ${DISK}；保留 ${RETAIN_HOURS} 小时且最多 ${MAX_BACKUPS} 份；目录: $BACKUP_DIR"
