#!/usr/bin/env bash
# 主机侧每日磁盘清理：Docker 未用资源、大容器日志、journal、旧临时文件。
# 不删除 Docker volume、不碰业务 uploads / 数据库数据卷。
#
# 用法：
#   ./scripts/cleanup-system-disk.sh              # 立即清理
#   ./scripts/cleanup-system-disk.sh --install-cron  # 幂等安装每日 04:20 crontab
#
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT_PATH="$ROOT/scripts/cleanup-system-disk.sh"
LOG_FILE="${DISK_CLEANUP_LOG:-/var/log/test_platform-disk-cleanup.log}"
CRON_EXPR="20 4 * * *"
CRON_LINE="${CRON_EXPR} /bin/bash ${SCRIPT_PATH} >> ${LOG_FILE} 2>&1"
DOCKER_LOG_MAX_BYTES="${DOCKER_LOG_MAX_BYTES:-104857600}" # 100MB
TMP_MAX_AGE_DAYS="${TMP_MAX_AGE_DAYS:-7}"
JOURNAL_VACUUM_SIZE="${JOURNAL_VACUUM_SIZE:-200M}"

log() {
  echo "[disk-cleanup $(date '+%Y-%m-%d %H:%M:%S %z')] $*"
}

install_cron() {
  local tmp
  tmp="$(mktemp)"
  # 幂等：去掉旧条目后写入最新行
  crontab -l 2>/dev/null | grep -v 'scripts/cleanup-system-disk.sh' >"$tmp" || true
  printf '%s\n' "$CRON_LINE" >>"$tmp"
  crontab "$tmp"
  rm -f "$tmp"
  log "crontab installed: $CRON_LINE"
  crontab -l 2>/dev/null | grep -F 'cleanup-system-disk' || true
}

if [[ "${1:-}" == "--install-cron" ]]; then
  install_cron
  exit 0
fi
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  echo "Usage: $0 [--install-cron]"
  echo "  DOCKER_LOG_MAX_BYTES=${DOCKER_LOG_MAX_BYTES}"
  echo "  TMP_MAX_AGE_DAYS=${TMP_MAX_AGE_DAYS}"
  echo "  JOURNAL_VACUUM_SIZE=${JOURNAL_VACUUM_SIZE}"
  echo "  DISK_CLEANUP_LOG=${LOG_FILE}"
  exit 0
fi

log "===== start ====="
log "df before:"
df -h / 2>/dev/null || true

# 1) Docker：清理未用镜像/容器/网络（不加 volume prune）
if command -v docker >/dev/null 2>&1; then
  log "docker system prune -af (no volumes)…"
  docker system prune -af 2>&1 | while IFS= read -r line; do log "  docker: $line"; done || log "docker prune skipped/failed"
else
  log "docker not found, skip prune"
fi

# 2) 过大的容器 JSON 日志 truncate（保留 inode，运行中容器可继续写）
if [[ -d /var/lib/docker/containers ]]; then
  log "truncate container json logs > ${DOCKER_LOG_MAX_BYTES} bytes…"
  find /var/lib/docker/containers -type f -name '*-json.log' -size +"${DOCKER_LOG_MAX_BYTES}"c -print 2>/dev/null \
    | while IFS= read -r f; do
        sz="$(wc -c <"$f" 2>/dev/null | tr -d ' ' || echo 0)"
        : >"$f" 2>/dev/null && log "  truncated $f (was ${sz} bytes)" || log "  truncate failed: $f"
      done || true
else
  log "no /var/lib/docker/containers, skip log truncate"
fi

# 3) journal
if command -v journalctl >/dev/null 2>&1; then
  log "journalctl --vacuum-size=${JOURNAL_VACUUM_SIZE}…"
  journalctl --vacuum-size="$JOURNAL_VACUUM_SIZE" 2>&1 | while IFS= read -r line; do log "  journal: $line"; done || true
else
  log "journalctl not found, skip"
fi

# 4) 临时目录：超过 N 天的普通文件
log "clean /tmp and /var/tmp files older than ${TMP_MAX_AGE_DAYS} days…"
find /tmp -xdev -type f -mtime +"${TMP_MAX_AGE_DAYS}" -print -delete 2>/dev/null \
  | while IFS= read -r f; do log "  rm $f"; done || true
find /var/tmp -xdev -type f -mtime +"${TMP_MAX_AGE_DAYS}" -print -delete 2>/dev/null \
  | while IFS= read -r f; do log "  rm $f"; done || true

# 5) APT 缓存
if command -v apt-get >/dev/null 2>&1; then
  log "apt-get clean…"
  apt-get clean 2>&1 | while IFS= read -r line; do log "  apt: $line"; done || true
else
  log "apt-get not found, skip"
fi

log "df after:"
df -h / 2>/dev/null || true
log "===== done ====="
