#!/usr/bin/env bash
# 应急网络防护：Top IP、封禁/解封、临时关闭下载、指定 IP 白名单。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPLOAD_VOLUME="${UPLOAD_VOLUME:-test_platform_uploads_static}"
FRONTEND_CONTAINER="${FRONTEND_CONTAINER:-frontend-container}"
DISABLED_DIR_NAME=".disabled-downloads"

usage() {
  cat <<'EOF'
用法:
  scripts/emergency-network-guard.sh top-ips [since]
  scripts/emergency-network-guard.sh ban-ip <ip>
  scripts/emergency-network-guard.sh unban-ip <ip>
  scripts/emergency-network-guard.sh disable-downloads
  scripts/emergency-network-guard.sh enable-downloads
  scripts/emergency-network-guard.sh allow-only <ip>
  scripts/emergency-network-guard.sh clear-allow-only <ip>

示例:
  scripts/emergency-network-guard.sh top-ips 30m
  scripts/emergency-network-guard.sh ban-ip 1.2.3.4
  scripts/emergency-network-guard.sh disable-downloads
EOF
}

need_arg() {
  if [[ -z "${1:-}" ]]; then
    usage >&2
    exit 2
  fi
}

upload_dir() {
  docker volume inspect "$UPLOAD_VOLUME" --format '{{.Mountpoint}}'
}

top_ips() {
  local since="${1:-30m}"
  docker logs --since "$since" "$FRONTEND_CONTAINER" 2>/dev/null \
    | awk '$1 ~ /^[0-9a-fA-F:.]+$/ {print $1}' \
    | sort | uniq -c | sort -nr | awk 'NR<=30 {print $0}'
}

ensure_chain_rule() {
  local chain="$1"
  shift
  iptables -C "$chain" "$@" 2>/dev/null || iptables -I "$chain" "$@"
}

delete_chain_rule() {
  local chain="$1"
  shift
  while iptables -C "$chain" "$@" 2>/dev/null; do
    iptables -D "$chain" "$@"
  done
}

ban_ip() {
  local ip="$1"
  need_arg "$ip"
  ensure_chain_rule INPUT -s "$ip" -j DROP
  ensure_chain_rule DOCKER-USER -s "$ip" -j DROP
  echo "[guard] banned $ip"
}

unban_ip() {
  local ip="$1"
  need_arg "$ip"
  delete_chain_rule INPUT -s "$ip" -j DROP
  delete_chain_rule DOCKER-USER -s "$ip" -j DROP
  echo "[guard] unbanned $ip"
}

disable_downloads() {
  local dir
  dir="$(upload_dir)"
  mkdir -p "$dir/$DISABLED_DIR_NAME"
  shopt -s nullglob
  mv "$dir"/*.apk "$dir"/*.mobileconfig "$dir/$DISABLED_DIR_NAME"/ 2>/dev/null || true
  shopt -u nullglob
  echo "[guard] downloads disabled: $dir/$DISABLED_DIR_NAME"
}

enable_downloads() {
  local dir
  dir="$(upload_dir)"
  mkdir -p "$dir"
  shopt -s nullglob
  mv "$dir/$DISABLED_DIR_NAME"/* "$dir"/ 2>/dev/null || true
  shopt -u nullglob
  echo "[guard] downloads restored: $dir"
}

allow_only() {
  local ip="$1"
  need_arg "$ip"
  ensure_chain_rule DOCKER-USER ! -s "$ip" -p tcp -m multiport --dports 80,443 -j DROP
  echo "[guard] only $ip can access published 80/443 through Docker"
}

clear_allow_only() {
  local ip="$1"
  need_arg "$ip"
  delete_chain_rule DOCKER-USER ! -s "$ip" -p tcp -m multiport --dports 80,443 -j DROP
  echo "[guard] removed allow-only rule for $ip"
}

cmd="${1:-}"
case "$cmd" in
  top-ips)
    top_ips "${2:-30m}"
    ;;
  ban-ip)
    ban_ip "${2:-}"
    ;;
  unban-ip)
    unban_ip "${2:-}"
    ;;
  disable-downloads)
    disable_downloads
    ;;
  enable-downloads)
    enable_downloads
    ;;
  allow-only)
    allow_only "${2:-}"
    ;;
  clear-allow-only)
    clear_allow_only "${2:-}"
    ;;
  -h|--help|help|"")
    usage
    ;;
  *)
    echo "未知命令: $cmd" >&2
    usage >&2
    exit 2
    ;;
esac
