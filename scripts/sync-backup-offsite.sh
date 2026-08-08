#!/usr/bin/env bash
# 备份分层保留 + 可选 COS 异地同步 + uploads 快照
# - 热备：data/db-backups（由 backup-mysql.sh 维护，每 15 分钟一份）
# - 日备：data/db-backups-daily（每天 1 份，默认留 14 天）
# - 周备：data/db-backups-weekly（每周 1 份，默认留 8 周）
# - 异地：配置 COS_* 后上传
#   - --hot-only：仅上传热备（建议每 15 分钟，抗打挂）
#   - 默认 full：日备/周备/uploads + 热备（建议每天 03:15）
# cron 见 scripts/dr-install.sh
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
# COS 热备保留：与本机热备默认对齐（48h / 最多 200 份）
COS_HOT_RETAIN_HOURS="${COS_HOT_RETAIN_HOURS:-${RETAIN_HOURS:-48}}"
COS_HOT_MAX="${COS_HOT_MAX:-${MAX_BACKUPS:-200}}"
LOG_FILE="${OFFSITE_BACKUP_LOG:-/var/log/test_platform-offsite-backup.log}"
VENV_PY="${ROOT}/.venv-dr/bin/python"
LOCK_FILE="${OFFSITE_LOCK_FILE:-/var/lock/test_platform-offsite-backup.lock}"
MODE="full"
if [[ "${1:-}" == "--hot-only" ]]; then
  MODE="hot"
fi

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
  local mode_py="$MODE"
  COS_HOT_RETAIN_HOURS="$COS_HOT_RETAIN_HOURS" COS_HOT_MAX="$COS_HOT_MAX" MODE="$mode_py" \
  HOT_DIR="$HOT_DIR" DAILY_DIR="$DAILY_DIR" WEEKLY_DIR="$WEEKLY_DIR" UPLOADS_DIR="$UPLOADS_DIR" \
  "$VENV_PY" - <<'PY'
import os, time
from qcloud_cos import CosConfig, CosS3Client

sid = os.environ["COS_SECRET_ID"]
skey = os.environ["COS_SECRET_KEY"]
region = os.environ["COS_REGION"]
bucket = os.environ["COS_BUCKET"]
prefix = os.environ.get("COS_PREFIX", "test_platform/dr").rstrip("/")
token = os.environ.get("COS_TOKEN") or None
mode = os.environ.get("MODE", "full")
hot_retain_h = int(os.environ.get("COS_HOT_RETAIN_HOURS") or "48")
hot_max = int(os.environ.get("COS_HOT_MAX") or "200")

cfg = CosConfig(Region=region, SecretId=sid, SecretKey=skey, Token=token, Scheme="https")
client = CosS3Client(cfg)

dirs = [(os.environ["HOT_DIR"], "hot")]
if mode != "hot":
    dirs.extend([
        (os.environ["DAILY_DIR"], "daily"),
        (os.environ["WEEKLY_DIR"], "weekly"),
        (os.environ["UPLOADS_DIR"], "uploads"),
    ])

uploaded = skipped = 0
for d, label in dirs:
    if not os.path.isdir(d):
        continue
    for name in sorted(os.listdir(d)):
        path = os.path.join(d, name)
        if not os.path.isfile(path):
            continue
        # 跳过导入前临时备份与临时文件
        if name.endswith(".tmp") or "before-import" in name:
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

# 清理 COS 过期热备，避免桶无限涨
hot_prefix = f"{prefix}/hot/"
marker = ""
objs = []
while True:
    kwargs = {"Bucket": bucket, "Prefix": hot_prefix, "MaxKeys": 1000}
    if marker:
        kwargs["Marker"] = marker
    resp = client.list_objects(**kwargs)
    contents = resp.get("Contents") or []
    for it in contents:
        objs.append(it)
    if resp.get("IsTruncated") == "true":
        marker = resp.get("NextMarker") or (contents[-1]["Key"] if contents else "")
        if not marker:
            break
    else:
        break

now = time.time()
cutoff = now - hot_retain_h * 3600
# 按 LastModified 新→旧
def _mtime(it):
    lm = it.get("LastModified")
    if hasattr(lm, "timestamp"):
        return lm.timestamp()
    try:
        from datetime import datetime
        return datetime.strptime(str(lm), "%Y-%m-%dT%H:%M:%S.%fZ").timestamp()
    except Exception:
        return 0

objs.sort(key=_mtime, reverse=True)
deleted = 0
for idx, it in enumerate(objs):
    key = it["Key"]
    mt = _mtime(it)
    too_old = mt and mt < cutoff
    over_max = idx >= hot_max
    if too_old or over_max:
        print(f"[cos] delete old hot {key}", flush=True)
        client.delete_object(Bucket=bucket, Key=key)
        deleted += 1

print(f"[cos] done mode={mode} uploaded={uploaded} skipped={skipped} hot_deleted={deleted}", flush=True)
PY
}

main() {
  local rc=0
  if [[ "$MODE" == "hot" ]]; then
    log "模式: hot-only（15 分钟热备上云）"
    if ! sync_cos; then
      rc=1
    fi
  else
    log "模式: full（日备/周备/uploads/热备）"
    promote_daily || rc=1
    promote_weekly || true
    snapshot_uploads || true
    if ! sync_cos; then
      rc=1
    fi
  fi

  local summary
  summary="$(
    cat <<EOF
站点: $(dr_site_origin)
域名: $(dr_site_label)
模式: $MODE
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
      dr_send_mail "$(dr_mail_prefix) 备份/异地同步异常 $(hostname)" "$summary" || true
    fi
    exit 1
  fi
  if [[ "$MODE" == "full" && "${BACKUP_SUCCESS_MAIL:-0}" == "1" && "$(date +%u)" == "1" ]]; then
    if dr_alert_cooldown_ok "offsite-ok" 86400; then
      dr_send_mail "$(dr_mail_prefix) 周备份完成 $(hostname)" "$summary" || true
    fi
  fi
}

main "$@"
