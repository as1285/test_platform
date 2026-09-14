#!/usr/bin/env bash
# 每日整库备份并上传腾讯云 COS。本机 30 分钟备份仍由 backup-mysql.sh 负责。
# 依赖仓库根目录 .env：COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION / COS_PREFIX
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

DB_CONTAINER="${DB_CONTAINER:-test_platform_db}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-password}"
DB_NAME="${DB_NAME:-personal_tax}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/data/db-backups}"
COS_RETAIN_DAYS="${COS_RETAIN_DAYS:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DAY="$(date +%Y%m%d)"
OUT="$BACKUP_DIR/${DB_NAME}-daily-${STAMP}.sql.gz"
DAY_NAME="${DB_NAME}-daily-${DAY}.sql.gz"
LATEST_NAME="${DB_NAME}-latest.sql.gz"

if [[ -z "${COS_SECRET_ID:-}" || -z "${COS_SECRET_KEY:-}" || -z "${COS_BUCKET:-}" || -z "${COS_REGION:-}" ]]; then
  echo "[backup-cos] ERROR: .env 缺少 COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  echo "[backup-cos] MySQL 容器未运行: $DB_CONTAINER" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
echo "[backup-cos] dump $DB_NAME -> $OUT"
docker exec "$DB_CONTAINER" mysqldump \
  -uroot "-p$DB_ROOT_PASSWORD" \
  --default-character-set=utf8mb4 \
  --single-transaction --routines --triggers --databases "$DB_NAME" | gzip -c > "$OUT"
SZ="$(wc -c < "$OUT" | tr -d ' ')"
if [[ "$SZ" -lt "${BACKUP_MIN_BYTES:-4096}" ]]; then
  echo "[backup-cos] ERROR: 备份过小 (${SZ} bytes)" >&2
  rm -f "$OUT"
  exit 1
fi
echo "[backup-cos] local $(du -h "$OUT" | awk '{print $1}')"

if ! python3 -c 'import qcloud_cos' >/dev/null 2>&1; then
  pip3 install --break-system-packages -q cos-python-sdk-v5
fi
python3 "$ROOT/scripts/cos_put.py" put "$OUT" "$DAY_NAME"
python3 "$ROOT/scripts/cos_put.py" put "$OUT" "$LATEST_NAME"
python3 "$ROOT/scripts/cos_put.py" prune "$COS_RETAIN_DAYS" "$DAY_NAME" "$LATEST_NAME"

mapfile -t OLD_DAILY < <(ls -1t "$BACKUP_DIR"/${DB_NAME}-daily-*.sql.gz 2>/dev/null | tail -n +8 || true)
if ((${#OLD_DAILY[@]})); then
  rm -f "${OLD_DAILY[@]}"
  echo "[backup-cos] 本机 daily 备份已清理 ${#OLD_DAILY[@]} 份（最多留 7 份）"
fi

PREFIX="$(printf '%s' "${COS_PREFIX:-}" | sed 's#^/*##; s#/*$##')"
if [[ -n "$PREFIX" ]]; then
  PREFIX="$PREFIX/"
fi
echo "[backup-cos] OK cos://${COS_BUCKET}/${PREFIX}${DAY_NAME}"
