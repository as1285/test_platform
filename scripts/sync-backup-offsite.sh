#!/usr/bin/env bash
# 备份分层保留 + 可选 COS 异地同步 + uploads 快照
# - 热备：data/db-backups（由 backup-mysql.sh 维护，每 15 分钟一份）
# - 日备：data/db-backups-daily（每天 1 份，默认留 14 天）
# - 周备：data/db-backups-weekly（每周 1 份，默认留 8 周）
# - 异地：配置 COS_* 后上传（整次失败再重试 COS_SYNC_RETRIES 次，默认 3）
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
# hot-only 只传最近 N 份，避免旧文件分片失败拖垮整次同步并反复告警
COS_HOT_SYNC_LIMIT="${COS_HOT_SYNC_LIMIT:-6}"
# 整次 COS 同步失败后的重试次数（不含首次；默认失败后再跑 3 次）
COS_SYNC_RETRIES="${COS_SYNC_RETRIES:-3}"
COS_SYNC_RETRY_SLEEP="${COS_SYNC_RETRY_SLEEP:-20}"
LOG_FILE="${OFFSITE_BACKUP_LOG:-/var/log/test_platform-offsite-backup.log}"
VENV_PY="${ROOT}/.venv-dr/bin/python"
LOCK_FILE="${OFFSITE_LOCK_FILE:-/var/lock/test_platform-offsite-backup.lock}"
MODE="full"
if [[ "${1:-}" == "--hot-only" ]]; then
  MODE="hot"
fi

log() {
  # 写入日志；同时打到 stderr。cron 请用 >/dev/null 2>&1，避免与 >>log 重复写行
  echo "[$(date '+%F %T')] $*" | tee -a "$LOG_FILE" >&2
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
  local retries="${COS_SYNC_RETRIES:-3}"
  local sleep_s="${COS_SYNC_RETRY_SLEEP:-20}"
  local max_attempts=$((retries + 1))
  local attempt=1
  local cos_rc=0

  while ((attempt <= max_attempts)); do
    log "COS 同步开始（第 ${attempt}/${max_attempts} 次）"
    cos_rc=0
    COS_HOT_RETAIN_HOURS="$COS_HOT_RETAIN_HOURS" COS_HOT_MAX="$COS_HOT_MAX" MODE="$mode_py" \
    COS_HOT_SYNC_LIMIT="$COS_HOT_SYNC_LIMIT" \
    HOT_DIR="$HOT_DIR" DAILY_DIR="$DAILY_DIR" WEEKLY_DIR="$WEEKLY_DIR" UPLOADS_DIR="$UPLOADS_DIR" \
    COS_SECRET_ID="${COS_SECRET_ID}" COS_SECRET_KEY="${COS_SECRET_KEY}" \
    COS_BUCKET="${COS_BUCKET}" COS_REGION="${COS_REGION}" COS_PREFIX="$prefix" \
    COS_TOKEN="${COS_TOKEN:-}" \
    "$VENV_PY" - <<'PY' >>"$LOG_FILE" 2>&1 || cos_rc=$?
import os, sys, time
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
hot_sync_limit = int(os.environ.get("COS_HOT_SYNC_LIMIT") or "6")

cfg = CosConfig(Region=region, SecretId=sid, SecretKey=skey, Token=token, Scheme="https", Timeout=300)
client = CosS3Client(cfg)

# full：先日备/周备/uploads，再热备；热备按文件名新→旧，避免旧文件失败阻断今日包
dirs = []
if mode != "hot":
    dirs.extend([
        (os.environ["DAILY_DIR"], "daily", False),
        (os.environ["WEEKLY_DIR"], "weekly", False),
        (os.environ["UPLOADS_DIR"], "uploads", False),
    ])
dirs.append((os.environ["HOT_DIR"], "hot", True))

def list_files(d, newest_first, limit=0):
    if not os.path.isdir(d):
        return []
    names = [n for n in os.listdir(d) if os.path.isfile(os.path.join(d, n))]
    names.sort(reverse=bool(newest_first))
    if limit and newest_first and len(names) > limit:
        names = names[:limit]
    return names

def abort_incomplete(key):
    """分片失败后桶里常留未完成 multipart，再 upload_file 同一 key 会一直 upload_part fail。"""
    try:
        resp = client.list_multipart_uploads(Bucket=bucket, Prefix=key, MaxUploads=50)
        uploads = resp.get("Uploads") or resp.get("Upload") or []
        if isinstance(uploads, dict):
            uploads = [uploads]
        for up in uploads:
            uid = up.get("UploadId")
            ukey = up.get("Key") or ""
            if not uid or ukey != key:
                continue
            client.abort_multipart_upload(Bucket=bucket, Key=ukey, UploadId=uid)
            print(f"[cos] abort leftover multipart {ukey}", flush=True)
    except Exception as e:
        print(f"[cos] abort leftover skip {key}: {e}", flush=True)

def put_whole(path, key, size):
    with open(path, "rb") as f:
        client.put_object(Bucket=bucket, Body=f, Key=key, ContentLength=size)

def upload_with_retry(path, key, attempts=3):
    last_err = None
    try:
        size = os.path.getsize(path)
    except OSError as e:
        return e
    for i in range(attempts):
        try:
            abort_incomplete(key)
            # 19MB 热备用 5MB 分片、单线程；10MB 分片/整文件 PUT 在这台机上会失败或挂死
            client.upload_file(
                Bucket=bucket,
                LocalFilePath=path,
                Key=key,
                PartSize=5,
                MAXThread=1,
                EnableMD5=False,
            )
            return None
        except FileNotFoundError as e:
            return e
        except Exception as e:
            last_err = e
            print(f"[cos] retry {i+1}/{attempts} {key}: {e}", flush=True)
            time.sleep(2 ** i)
    try:
        abort_incomplete(key)
        put_whole(path, key, size)
        return None
    except Exception as e:
        return last_err or e

uploaded = skipped = failed = 0
errors = []
newest_hot_failed = False
saw_hot = False
for d, label, newest_first in dirs:
    limit = hot_sync_limit if (label == "hot" and mode == "hot") else 0
    for name in list_files(d, newest_first, limit):
        path = os.path.join(d, name)
        if name.endswith(".tmp") or "before-import" in name:
            continue
        if not os.path.isfile(path):
            print(f"[cos] skip (gone) {path}", flush=True)
            skipped += 1
            continue
        key = f"{prefix}/{label}/{name}"
        is_newest_hot = label == "hot" and not saw_hot
        if label == "hot":
            saw_hot = True
        try:
            local_size = os.path.getsize(path)
        except OSError as e:
            print(f"[cos] skip (gone) {path}: {e}", flush=True)
            skipped += 1
            continue
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
        err = upload_with_retry(path, key)
        if err is None:
            uploaded += 1
        elif isinstance(err, FileNotFoundError):
            print(f"[cos] skip (gone) {key}", flush=True)
            skipped += 1
        else:
            failed += 1
            msg = f"{key}: {err}"
            errors.append(msg)
            print(f"[cos] FAIL {msg}", flush=True)
            if is_newest_hot:
                newest_hot_failed = True

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
        try:
            client.delete_object(Bucket=bucket, Key=key)
            deleted += 1
        except Exception as e:
            print(f"[cos] delete fail {key}: {e}", flush=True)

print(
    f"[cos] done mode={mode} uploaded={uploaded} skipped={skipped} failed={failed} hot_deleted={deleted}",
    flush=True,
)
if errors:
    print("[cos] errors:", flush=True)
    for e in errors[:20]:
        print(f"  - {e}", flush=True)
    if mode == "hot" and not newest_hot_failed:
        print("[cos] older hot failed but newest is on COS; do not fail hot-only", flush=True)
    else:
        sys.exit(1)
PY
    if ((cos_rc == 0)); then
      if ((attempt > 1)); then
        log "COS 同步重试成功（第 ${attempt} 次）"
      fi
      return 0
    fi
    if ((attempt < max_attempts)); then
      log "ERROR: COS 同步失败（exit=$cos_rc），${sleep_s}s 后重试（${attempt}/${max_attempts}）"
      sleep "$sleep_s"
    fi
    attempt=$((attempt + 1))
  done

  log "ERROR: COS 同步失败（exit=$cos_rc），已重试 ${retries} 次，详见 $LOG_FILE"
  return 1
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
    local err_tail
    err_tail="$(grep -E 'ERROR:|FAIL |Traceback|CosClient|\[cos\] errors' "$LOG_FILE" 2>/dev/null | tail -n 15 || true)"
    if [[ -n "$err_tail" ]]; then
      summary="${summary}
---
最近错误:
${err_tail}"
    fi
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
