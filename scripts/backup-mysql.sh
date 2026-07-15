#!/usr/bin/env bash
# 备份 Docker MySQL 中的 personal_tax 库为 gzip sql。
# 用法：
#   ./scripts/backup-mysql.sh              # 写入 data/db-backups/
#   ./scripts/backup-mysql.sh --stdout     # 输出到 stdout（供 GitHub Actions / 管道使用）
#
# 高频本地备份（防攻击回滚）：默认保留约 5 天，最多 300 份。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_CONTAINER="${DB_CONTAINER:-test_platform_db}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-password}"
DB_NAME="${DB_NAME:-personal_tax}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/data/db-backups}"
RETAIN_DAYS="${RETAIN_DAYS:-5}"
MAX_BACKUPS="${MAX_BACKUPS:-300}"
STDOUT=0
if [[ "${1:-}" == "--stdout" ]]; then
  STDOUT=1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "[backup] MySQL 容器未运行: $DB_CONTAINER" >&2
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
docker exec "$DB_CONTAINER" mysqldump "${DUMP_ARGS[@]}" | gzip -c > "$OUT"

# 空备份或异常小文件视为失败（避免静默写出几 KB 废文件）
MIN_BYTES="${BACKUP_MIN_BYTES:-4096}"
SZ="$(wc -c < "$OUT" | tr -d ' ')"
if [[ "$SZ" -lt "$MIN_BYTES" ]]; then
  echo "[backup] ERROR: 备份过小 (${SZ} bytes): $OUT" >&2
  rm -f "$OUT"
  exit 1
fi

echo "[backup] 已写入 $OUT ($(du -h "$OUT" | awk '{print $1}'))"

# 按天数清理
find "$BACKUP_DIR" -name "${DB_NAME}-[0-9]*.sql.gz" -mtime +"$RETAIN_DAYS" -delete 2>/dev/null || true

# 按份数上限清理（保留最新 MAX_BACKUPS 份）
mapfile -t OLD_FILES < <(ls -1t "$BACKUP_DIR"/${DB_NAME}-[0-9]*.sql.gz 2>/dev/null | tail -n +$((MAX_BACKUPS + 1)) || true)
if ((${#OLD_FILES[@]})); then
  rm -f "${OLD_FILES[@]}"
  echo "[backup] 已按上限清理旧备份 ${#OLD_FILES[@]} 份（最多保留 ${MAX_BACKUPS}）"
fi

COUNT="$(ls -1 "$BACKUP_DIR"/${DB_NAME}-[0-9]*.sql.gz 2>/dev/null | wc -l | tr -d ' ')"
DISK="$(du -sh "$BACKUP_DIR" | awk '{print $1}')"
echo "[backup] 当前 ${COUNT} 份 / ${DISK}；保留 ${RETAIN_DAYS} 天且最多 ${MAX_BACKUPS} 份；目录: $BACKUP_DIR"
