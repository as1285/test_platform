#!/usr/bin/env bash
# 主机级健康巡检 + 自愈：容器 / HTTP / 磁盘内存；失败发邮件并尝试拉起。
# cron 建议：*/2 * * * *
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/scripts/lib/dr-common.sh"
dr_load_env

COMPOSE_FILE="${COMPOSE_FILE:-$ROOT/docker-compose.yml}"
FRONTEND_URL="${HEALTH_FRONTEND_URL:-${PUBLIC_SITE_URL:-https://lkj.qiyun888.top}}"
API_URL="${HEALTH_API_URL:-http://127.0.0.1:3000/api/user?action=ping}"
AUTO_HEAL="${HEALTH_AUTO_HEAL:-1}"
DISK_ALERT_PCT="${HEALTH_DISK_ALERT_PCT:-90}"
MEM_ALERT_PCT="${HEALTH_MEM_ALERT_PCT:-92}"
LOG_FILE="${HEALTH_GUARD_LOG:-/var/log/test_platform-health-guard.log}"

CONTAINERS=(test_platform_db test_platform_redis personal-tax-api frontend-container)

log() {
  echo "[$(date '+%F %T')] $*" | tee -a "$LOG_FILE"
}

problems=()
healed=()

container_running() {
  docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null | grep -qx true
}

container_healthy_or_nohealth() {
  local st
  st="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$1" 2>/dev/null || echo missing)"
  [[ "$st" == "healthy" || "$st" == "none" || "$st" == "starting" ]]
}

check_containers() {
  local c
  for c in "${CONTAINERS[@]}"; do
    if ! container_running "$c"; then
      problems+=("容器未运行: $c")
    elif ! container_healthy_or_nohealth "$c"; then
      local hs
      hs="$(docker inspect -f '{{.State.Health.Status}}' "$c" 2>/dev/null || echo unknown)"
      problems+=("容器不健康: $c ($hs)")
    fi
  done
}

http_ok() {
  local url="$1"
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 15 -k "$url" 2>/dev/null || echo 000)"
  # API ping 未登录返回 401 也算活着；页面 200/301/302/304
  [[ "$code" =~ ^(200|301|302|304|401)$ ]]
}

check_http() {
  if ! http_ok "$FRONTEND_URL/"; then
    # 本机回环兜底（域名 DNS/证书问题时仍能判活）
    if ! http_ok "http://127.0.0.1/mine.html"; then
      problems+=("前端不可用: $FRONTEND_URL 且本机 :80 失败")
    else
      problems+=("前端外网探测失败: $FRONTEND_URL （本机 :80 正常，可能是 DNS/证书/防火墙）")
    fi
  fi
  if ! http_ok "$API_URL"; then
    problems+=("API 不可用: $API_URL")
  fi
}

check_resources() {
  local disk_pct mem_pct
  disk_pct="$(df -P / | awk 'NR==2{gsub(/%/,"",$5); print $5}')"
  if [[ -n "$disk_pct" ]] && (( disk_pct >= DISK_ALERT_PCT )); then
    problems+=("磁盘使用 ${disk_pct}% >= ${DISK_ALERT_PCT}%")
  fi
  mem_pct="$(free | awk '/Mem:/{printf "%d", ($3/$2)*100}')"
  if [[ -n "$mem_pct" ]] && (( mem_pct >= MEM_ALERT_PCT )); then
    problems+=("内存使用 ${mem_pct}% >= ${MEM_ALERT_PCT}%")
  fi
}

try_heal() {
  [[ "$AUTO_HEAL" == "1" ]] || return 0
  log "开始自愈…"
  # 先库，再整栈，再 API
  docker start test_platform_db >/dev/null 2>&1 || true
  sleep 3
  if [[ -f "$COMPOSE_FILE" ]]; then
    (cd "$ROOT" && docker compose -f "$COMPOSE_FILE" up -d) >>"$LOG_FILE" 2>&1 || true
  else
    docker start test_platform_redis personal-tax-api frontend-container >/dev/null 2>&1 || true
  fi
  # 等 MySQL healthy 最多 60s
  local i
  for i in $(seq 1 20); do
    local hs
    hs="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' test_platform_db 2>/dev/null || echo missing)"
    if [[ "$hs" == "healthy" || "$hs" == "none" ]]; then
      break
    fi
    sleep 3
  done
  docker restart personal-tax-api >/dev/null 2>&1 || true
  sleep 4
  healed+=("已执行: start db + compose up -d + restart api")
}

main() {
  mkdir -p "$(dirname "$LOG_FILE")"
  check_containers
  check_http
  check_resources

  if ((${#problems[@]} == 0)); then
    # 成功时写心跳，方便排查
    date +%s >"$DR_STATE_DIR/health-ok.ts"
    echo "[$(date '+%F %T')] ok" >>"$LOG_FILE"
    exit 0
  fi

  log "发现问题:"
  local p
  for p in "${problems[@]}"; do
    log "  - $p"
  done

  local need_heal=0
  for p in "${problems[@]}"; do
    if [[ "$p" == 容器* || "$p" == API* || "$p" == 前端不可用* ]]; then
      need_heal=1
    fi
  done

  if ((need_heal)); then
    try_heal
    # 复检
    problems=()
    check_containers
    check_http
  fi

  local status_line="仍异常"
  if ((${#problems[@]} == 0)); then
    status_line="已自愈恢复"
  fi

  local body
  body="$(
    cat <<EOF
主机: $(hostname)
时间: $(date '+%F %T %z')
状态: $status_line

问题:
$(printf ' - %s\n' "${problems[@]:-（无）}")

自愈动作:
$(printf ' - %s\n' "${healed[@]:-（无）}")

容器:
$(docker ps -a --format 'table {{.Names}}\t{{.Status}}' | head -20)

请登录服务器查看: /var/log/test_platform-health-guard.log
EOF
  )"

  if dr_alert_cooldown_ok "health" 1200; then
    dr_send_mail "[灾容] $(hostname) $status_line" "$body" || true
  else
    log "告警冷却中，跳过邮件"
  fi

  if ((${#problems[@]} > 0)); then
    exit 2
  fi
  exit 0
}

main "$@"
