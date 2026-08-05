#!/usr/bin/env bash
# 备份分层保留 + 可选 COS 异地同步 + uploads 快照
# - 热备：data/db-backups（由 backup-mysql.sh 维护，每 15 分钟一份）
# - 日备：data/db-backups-daily（每天 1 份，默认留 14 天）
# - 周备：data/db-backups-weekly（每周 1 份，默认留 8 周）
# - 异地：配置 COS_* 后上传日备/周备与 uploads（同名且同大小则跳过）
# cron 建议：15 3 * * * （在凌晨备份之后）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/dr-common.sh"
dr_load_env

HOT_DIR="${BACKUP_DIR:-$ROOT/data/db-backups}"
DAILY_DIR="${BACKUP_DAILY_DIR:-$ROOT/data/db-backups-daily}"
WEEKLY_DIR="${BACKUP_WEEKLY_DIR:-$ROOT/data/db-backups-weekly}"
UPLOADS_DIR="${BACKUP_UPLOADS_DIR:-$ROOT/data/uploads-backups}"
DB_NAME="${DB_NAME:-personal_tax}"
DAILY_KEEP="${BACKUP_DAILY_KEEP:-14}"
WEEKLY_KEEP="${BACKUP_WEEKLY_KEEP:-8}"
UPLOADS_KEEP="${BACKUP_UPLOADS_KEEP:-7}"
LOG_FILE="${OFFSITE_BACKUP_LOG:-/var/log/test_platform-offsite-backup.log}"
VENV_PY="${ROOT}/.venv-dr/bin/python"
LOCK_FILE="${OFFSITE_LOCK_FILE:-/var/lock/test_platform-offsite-backup.lock}"

log() {
  echo "[$(date '+%F %T')] $*" | tee -a "$LOG_FILE"
}

mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" "$UPLOADS_DIR" "$(dirname "$LOG_FILE")" "$(dirname "$LOCK_FILE")"

# 单实例锁，避免 cron 重叠
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "已有异地同步在运行，退出"
  exit 0
fi

assert_gzip_ok() {
  local f="$1"
  if [[ ! -f "$f" ]]; then
    log "ERROR: 文件不存在: $f"
    return 1
  fi
  if ! gzip -t "$f" 2>/dev/null; then
    log "ERROR: gzip 损坏: $f"
    return 1
  fi
  return 0
}

latest_hot() {
  ls -1t "$HOT_DIR"/${DB_NAME}-[0-9]*.sql.gz 2>/dev/null | head -1 || true
}

promote_daily() {
  local src day dest
  src="$(latest_hot)"
  if [[ -z "$src" ]]; then
    log "ERROR: 无热备可晋升日备"
    return 1
  fi
  assert_gzip_ok "$src" || return 1
  day="$(date +%Y%m%d)"
  dest="$DAILY_DIR/${DB_NAME}-daily-${day}.sql.gz"
  if [[ -f "$dest" ]]; then
    log "日备已存在: $dest"
  else
    local tmp="${dest}.tmp.$$"
    cp -f "$src" "$tmp"
    mv -f "$tmp" "$dest"
    log "日备已写入: $dest (from $(basename "$src"))"
  fi
  mapfile -t old < <(ls -1t "$DAILY_DIR"/${DB_NAME}-daily-*.sql.gz 2>/dev/null | tail -n +"$((DAILY_KEEP + 1))" || true)
  if ((${#old[@]})); then
    rm -f "${old[@]}"
    log "清理旧日备 ${#old[@]} 份"
  fi
}

promote_weekly() {
  local dow
  dow="$(date +%u)"
  if [[ "${FORCE_WEEKLY:-0}" != "1" && "$dow" != "1" ]]; then
    return 0
  fi
  local src week dest
  src="$(ls -1t "$DAILY_DIR"/${DB_NAME}-daily-*.sql.gz 2>/dev/null | head -1 || latest_hot)"
  if [[ -z "$src" ]]; then
    log "ERROR: 无文件可晋升周备"
    return 1
  fi
  assert_gzip_ok "$src" || return 1
  week="$(date +%Y%W)"
  dest="$WEEKLY_DIR/${DB_NAME}-weekly-${week}.sql.gz"
  if [[ -f "$dest" ]]; then
    log "周备已存在: $dest"
  else
    local tmp="${dest}.tmp.$$"
    cp -f "$src" "$tmp"
    mv -f "$tmp" "$dest"
    log "周备已写入: $dest"
  fi
  mapfile -t old < <(ls -1t "$WEEKLY_DIR"/${DB_NAME}-weekly-*.sql.gz 2>/dev/null | tail -n +"$((WEEKLY_KEEP + 1))" || true)
  if ((${#old[@]})); then
    rm -f "${old[@]}"
    log "清理旧周备 ${#old[@]} 份"
  fi
}

snapshot_uploads() {
  local vol_path day dest
  vol_path="$(docker volume inspect test_platform_uploads_static --format '{{.Mountpoint}}' 2>/dev/null || true)"
  if [[ -z "$vol_path" || ! -d "$vol_path" ]]; then
    log "跳过 uploads：卷不存在"
    return 0
  fi
  day="$(date +%Y%m%d)"
  dest="$UPLOADS_DIR/uploads-${day}.tar.gz"
  if [[ -f "$dest" ]]; then
    log "uploads 日包已存在: $dest"
  else
    local tmp="${dest}.tmp.$$"
    tar -C "$vol_path" -czf "$tmp" .
    if ! gzip -t "$tmp" 2>/dev/null; then
      log "ERROR: uploads 包 gzip 校验失败"
      rm -f "$tmp"
      return 1
    fi
    mv -f "$tmp" "$dest"
    log "uploads 日包: $dest ($(du -h "$dest" | awk '{print $1}'))"
  fi
  mapfile -t old < <(ls -1t "$UPLOADS_DIR"/uploads-*.tar.gz 2>/dev/null | tail -n +"$((UPLOADS_KEEP + 1))" || true)
  if ((${#old[@]})); then
    rm -f "${old[@]}"
    log "清理旧 uploads ${#old[@]} 份"
  fi
}

cos_configured() {
  [[ -n "${COS_SECRET_ID:-}" && -n "${COS_SECRET_KEY:-}" && -n "${COS_BUCKET:-}" && -n "${COS_REGION:-}" ]]
}

sync_cos() {
  if ! cos_configured; then
    log "未配置 COS_*，跳过异地上传（请在 .env 填写 COS_SECRET_ID/KEY/BUCKET/REGION）"
    return 0
  fi
  if [[ ! -x "$VENV_PY" ]]; then
    log "ERROR: 缺少 $VENV_PY，无法上传 COS（请先执行 ./scripts/dr-install.sh）"
    return 1
  fi
  local prefix="${COS_PREFIX:-test_platform/dr}"
  "$VENV_PY" - <<PY
import os, sys
from qcloud_cos import CosConfig, CosS3Client

sid = os.environ["COS_SECRET_ID"]
skey = os.environ["COS_SECRET_KEY"]
region = os.environ["COS_REGION"]
bucket = os.environ["COS_BUCKET"]
prefix = os.environ.get("COS_PREFIX", "test_platform/dr").rstrip("/")
token = os.environ.get("COS_TOKEN") or None

cfg = CosConfig(Region=region, SecretId=sid, SecretKey=skey, Token=token, Scheme="https")
client = CosS3Client(cfg)

uploaded = skipped = 0
for d, label in [
    (r"${DAILY_DIR}", "daily"),
    (r"${WEEKLY_DIR}", "weekly"),
    (r"${UPLOADS_DIR}", "uploads"),
]:
    if not os.path.isdir(d):
        continue
    for name in sorted(os.listdir(d)):
        path = os.path.join(d, name)
        if not os.path.isfile(path):
            continue
        key = f"{prefix}/{label}/{name}"
        local_size = os.path.getsize(path)
        try:
            meta = client.head_object(Bucket=bucket, Key=key)
            remote_size = int(meta.get("Content-Length") or 0)
            if remote_size == local_size and local_size > 0:
                print(f"[cos] skip (same size) {key}", flush=True)
                skipped += 1
                continue
        except Exception:
            pass
        print(f"[cos] upload {path} -> cos://{bucket}/{key}", flush=True)
        client.upload_file(Bucket=bucket, LocalFilePath=path, Key=key)
        uploaded += 1

print(f"[cos] done uploaded={uploaded} skipped={skipped}", flush=True)
PY
}

main() {
  local rc=0
  promote_daily || rc=1
  promote_weekly || true
  snapshot_uploads || true
  if ! sync_cos; then
    rc=1
  fi

  local summary
  summary="$(
    cat <<EOF
热备目录: $HOT_DIR ($(du -sh "$HOT_DIR" 2>/dev/null | awk '{print $1}' || echo 0))
日备: $DAILY_DIR ($(ls -1 "$DAILY_DIR"/${DB_NAME}-daily-*.sql.gz 2>/dev/null | wc -l | tr -d ' ') 份)
周备: $WEEKLY_DIR ($(ls -1 "$WEEKLY_DIR"/${DB_NAME}-weekly-*.sql.gz 2>/dev/null | wc -l | tr -d ' ') 份)
uploads: $UPLOADS_DIR
COS: $(cos_configured && echo configured || echo not-configured)
主机: $(hostname)
时间: $(date '+%F %T')
EOF
  )"
  log "$summary"

  if ((rc != 0)); then
    if dr_alert_cooldown_ok "offsite-backup" 3600; then
      dr_send_mail "[灾容] 备份/异地同步异常 $(hostname)" "$summary" || true
    fi
    exit 1
  fi
  if [[ "${BACKUP_SUCCESS_MAIL:-0}" == "1" ]] && [[ "$(date +%u)" == "1" ]]; then
    if dr_alert_cooldown_ok "offsite-ok" 86400; then
      dr_send_mail "[灾容] 周备份完成 $(hostname)" "$summary" || true
    fi
  fi
}

main "$@"
