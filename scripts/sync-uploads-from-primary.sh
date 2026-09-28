#!/usr/bin/env bash
# 从主服务器同步 uploads 卷（安装包 / 支付二维码等）。
# 备用机切主、或用户反馈安装包下载 404 时执行：
#   PRIMARY_HOST=primary-db ./scripts/sync-uploads-from-primary.sh
set -euo pipefail

PRIMARY_HOST="${PRIMARY_HOST:-primary-db}"
SRC_VOL="${SRC_VOL:-/var/lib/docker/volumes/test_platform_uploads_static/_data}"
DST_VOL="${DST_VOL:-/var/lib/docker/volumes/test_platform_uploads_static/_data}"
LOG_FILE="${LOG_FILE:-/var/log/standby-uploads-sync.log}"
# 可选：额外要求这些相对路径必须存在（空格分隔）；默认校验常见安装包文件名
REQUIRE_FILES="${REQUIRE_FILES:-648e7f60dcf1e795568a1371025f0d20.apk e44df4baea314c3b3392c2e129cd8160.mobileconfig 085b3c9f59a11f7f7eb4aa5ca69e4f1d.apk}"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG_FILE"; }

mkdir -p "$DST_VOL" "$(dirname "$LOG_FILE")"

if ! command -v docker >/dev/null 2>&1; then
  log "ERROR: 未找到 docker"
  exit 1
fi
if ! docker volume inspect test_platform_uploads_static >/dev/null 2>&1; then
  log "ERROR: 本地 uploads 卷不存在（先 docker compose up 一次）"
  exit 1
fi
if ! command -v rsync >/dev/null 2>&1; then
  log "ERROR: 未找到 rsync"
  exit 1
fi

log "rsync uploads from ${PRIMARY_HOST}:${SRC_VOL}/ -> ${DST_VOL}/"
rsync -az --partial --timeout=300 \
  -e "ssh -o BatchMode=yes -o ConnectTimeout=20" \
  "${PRIMARY_HOST}:${SRC_VOL}/" "${DST_VOL}/"

count="$(find "$DST_VOL" -type f | wc -l | tr -d ' ')"
size="$(du -sh "$DST_VOL" | awk '{print $1}')"
log "完成: files=${count} size=${size}"

missing=0
for f in $REQUIRE_FILES; do
  [[ -z "$f" ]] && continue
  if [[ ! -f "${DST_VOL}/${f}" ]]; then
    log "WARNING: 缺少 ${f}"
    missing=$((missing + 1))
  fi
done
apk_n="$(find "$DST_VOL" -maxdepth 1 -type f -name '*.apk' | wc -l | tr -d ' ')"
ios_n="$(find "$DST_VOL" -maxdepth 1 -type f -name '*.mobileconfig' | wc -l | tr -d ' ')"
log "卷内 apk=${apk_n} mobileconfig=${ios_n}"
if [[ "$apk_n" -lt 1 || "$ios_n" -lt 1 ]]; then
  log "ERROR: 卷内缺少 apk 或 mobileconfig，下载仍会失败"
  exit 2
fi
if [[ "$missing" -gt 0 ]]; then
  log "WARNING: ${missing} 个关键文件名缺失（若 app_settings 已改路径可忽略）"
fi
log "uploads 同步成功"
