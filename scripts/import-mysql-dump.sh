#!/usr/bin/env bash
# 将 MySQL 备份导入本项目的 Docker MySQL（personal_tax）。
# 用法：
#   ./scripts/import-mysql-dump.sh /root/mysql_all.sql
#   ./scripts/import-mysql-dump.sh /root/mysql_all.sql --only personal_tax
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DUMP="${1:-/root/mysql_all.sql}"
ONLY_DB="${3:-}"
if [[ "${2:-}" == "--only" && -n "${3:-}" ]]; then
  ONLY_DB="$3"
elif [[ "${2:-}" == "--only" ]]; then
  echo "用法: $0 <dump.sql> [--only personal_tax]" >&2
  exit 1
fi

DB_CONTAINER="${DB_CONTAINER:-test_platform_db}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-password}"
DB_NAME="${DB_NAME:-personal_tax}"

if [[ ! -f "$DUMP" ]]; then
  echo "[import] 找不到备份文件: $DUMP" >&2
  echo "[import] 请先把旧服务器上的 mysql_all.sql 传到本机，例如：" >&2
  echo "  scp root@旧服务器IP:/root/mysql_all.sql /root/mysql_all.sql" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "[import] MySQL 容器未运行: $DB_CONTAINER" >&2
  echo "[import] 请先执行: cd $ROOT && docker compose up -d db" >&2
  exit 1
fi

echo "[import] 备份文件: $DUMP ($(du -h "$DUMP" | awk '{print $1}'))"
echo "[import] 目标容器: $DB_CONTAINER / 数据库: $DB_NAME"

BACKUP_DIR="$ROOT/data/db-backups"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
CURRENT_BACKUP="$BACKUP_DIR/personal_tax-before-import-$STAMP.sql"

echo "[import] 导出当前库备份 -> $CURRENT_BACKUP"
docker exec "$DB_CONTAINER" mysqldump -uroot -p"$DB_ROOT_PASSWORD" \
  --single-transaction --routines --triggers --databases "$DB_NAME" \
  > "$CURRENT_BACKUP" 2>/dev/null || true

TMP_DUMP="$(mktemp)"
cleanup() { rm -f "$TMP_DUMP"; }
trap cleanup EXIT

if [[ -n "$ONLY_DB" ]]; then
  echo "[import] 从全库备份中提取库: $ONLY_DB"
  awk -v db="$ONLY_DB" '
    /^CREATE DATABASE/ { keep = ($0 ~ "`" db "`") }
    /^USE `/ {
      if ($0 ~ "`" db "`") { keep = 1; print; next }
      keep = 0; next
    }
    keep { print }
  ' "$DUMP" > "$TMP_DUMP"
  if [[ ! -s "$TMP_DUMP" ]]; then
    echo "[import] 未在备份中找到库 $ONLY_DB，将尝试直接导入完整文件" >&2
    cp "$DUMP" "$TMP_DUMP"
  fi
else
  cp "$DUMP" "$TMP_DUMP"
fi

echo "[import] 重建数据库 $DB_NAME ..."
docker exec "$DB_CONTAINER" mysql -uroot -p"$DB_ROOT_PASSWORD" -e \
  "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "[import] 导入中（大文件可能需要几分钟）..."
# 单库 mysqldump 常无 CREATE DATABASE / USE，需指定目标库名
# 必须指定 utf8mb4，否则中文会被二次编码成乱码（å·¥èµ„…）
docker exec -i "$DB_CONTAINER" mysql -uroot -p"$DB_ROOT_PASSWORD" --default-character-set=utf8mb4 --force "$DB_NAME" < "$TMP_DUMP"

USER_COUNT="$(docker exec "$DB_CONTAINER" mysql -uroot -p"$DB_ROOT_PASSWORD" -Nse \
  "SELECT COUNT(*) FROM \`$DB_NAME\`.users;" 2>/dev/null || echo '?')"
TABLE_COUNT="$(docker exec "$DB_CONTAINER" mysql -uroot -p"$DB_ROOT_PASSWORD" -Nse \
  "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='$DB_NAME';" 2>/dev/null || echo '?')"

echo "[import] 完成: 表 $TABLE_COUNT 张, users 行数 $USER_COUNT"
echo "[import] 导入前本地备份: $CURRENT_BACKUP"
echo "[import] 建议重启后端: cd $ROOT && docker compose restart backend"
