#!/usr/bin/env bash
# 备份 Docker MySQL 中的 personal_tax 库为 gzip sql。
# 用法：
#   ./scripts/backup-mysql.sh              # 写入 data/db-backups/
#   ./scripts/backup-mysql.sh --stdout     # 输出到 stdout（供 GitHub Actions / 管道使用）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_CONTAINER="${DB_CONTAINER:-test_platform_db}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-password}"
DB_NAME="${DB_NAME:-personal_tax}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/data/db-backups}"
RETAIN_DAYS="${RETAIN_DAYS:-14}"
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

if [[ "$STDOUT" -eq 1 ]]; then
  docker exec "$DB_CONTAINER" mysqldump -uroot -p"$DB_ROOT_PASSWORD" \
    --single-transaction --routines --triggers "$DB_NAME" | gzip -c
  exit 0
fi

mkdir -p "$BACKUP_DIR"
docker exec "$DB_CONTAINER" mysqldump -uroot -p"$DB_ROOT_PASSWORD" \
  --single-transaction --routines --triggers "$DB_NAME" | gzip -c > "$OUT"

echo "[backup] 已写入 $OUT ($(du -h "$OUT" | awk '{print $1}'))"
find "$BACKUP_DIR" -name "${DB_NAME}-*.sql.gz" -mtime +"$RETAIN_DAYS" -delete 2>/dev/null || true
