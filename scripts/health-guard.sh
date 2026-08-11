#!/usr/bin/env bash
# 主机级健康巡检 + 自愈：容器 / HTTP / 磁盘内存；失败发邮件并尝试拉起。
# cron 建议：*/2 * * * *
#
# 降噪策略：
# 1) 部署窗口（deploy.sh 写入的 host marker / quiet-until）内跳过检查与邮件
# 2) 连续失败达到阈值后才自愈+发信，避免单次 recreate 误报
# 3) 合并「容器未运行」与对应 HTTP 不可用为一条
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
# 连续多少次巡检仍异常才发邮件/自愈（*/2 cron → 默认约 4 分钟）
FAIL_STREAK_NEED="${HEALTH_FAIL_STREAK:-2}"
# 邮件冷却秒数
ALERT_COOLDOWN_SEC="${HEALTH_ALERT_COOLDOWN_SEC:-1200}"

DEPLOY_IN_PROGRESS_FILE="${DR_STATE_DIR}/deploy-in-progress"
DEPLOY_QUIET_UNTIL_FILE="${DR_STATE_DIR}/deploy-quiet-until"
FAIL_STREAK_FILE="${DR_STATE_DIR}/health-fail-streak"

CONTAINERS=(test_platform_db test_platform_redis personal-tax-api frontend-container)

log() {
  echo "[$(date '+%F %T')] $*" | tee -a "$LOG_FILE"
}

problems=()
healed=()

# 部署中或部署结束后的静默窗：不检查、不自愈、不发信
in_deploy_quiet_window() {
  if [[ -f "$DEPLOY_IN_PROGRESS_FILE" ]]; then
    return 0
  fi
  if [[ -f "$DEPLOY_QUIET_UNTIL_FILE" ]]; then
    local until_ts
    until_ts="$(tr -dc '0-9' <"$DEPLOY_QUIET_UNTIL_FILE" 2>/dev/null || echo 0)"
    if [[ -n "$until_ts" ]] && (( $(date +%s) < until_ts )); then
      return 0
    fi
  fi
  return 1
}

read_fail_streak() {
  local n
  n="$(tr -dc '0-9' <"$FAIL_STREAK_FILE" 2>/dev/null || echo 0)"
  echo "${n:-0}"
}

write_fail_streak() {
  echo "$1" >"$FAIL_STREAK_FILE"
}

container_running() {
  docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null | grep -qx true
}

container_health_status() {
  docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$1" 2>/dev/null || echo missing
}

# healthy / none / starting 视为可接受；unhealthy / missing 才告警
container_healthy_or_nohealth() {
  local st
  st="$(container_health_status "$1")"
  [[ "$st" == "healthy" || "$st" == "none" || "$st" == "starting" ]]
}

check_containers() {
  local c
  for c in "${CONTAINERS[@]}"; do
    if ! container_running "$c"; then
      problems+=("容器未运行: $c")
    elif ! container_healthy_or_nohealth "$c"; then
      local hs
      hs="$(container_health_status "$c")"
      problems+=("容器不健康: $c ($hs)")
    fi
  done
}

# 本机探测公网域名时绕过 systemd-resolved stub 抖动（偶发 Resolving timed out）
# 仍校验本机 :80/:443 上的 TLS/vhost；真外网 DNS 不在本机巡检职责内
http_ok() {
  local url="$1"
  local code
  local -a curl_args=(-sS -o /dev/null -w '%{http_code}' --connect-timeout 5 --max-time 15 -k -4)
  local host=""
  if [[ "$url" =~ ^https?://\[([^\]]+)\] ]]; then
    host="${BASH_REMATCH[1]}"
  elif [[ "$url" =~ ^https?://([^/:]+) ]]; then
    host="${BASH_REMATCH[1]}"
  fi
  if [[ -n "$host" && "$host" != "127.0.0.1" && "$host" != "localhost" && "$host" != "::1" ]]; then
    curl_args+=(--resolve "${host}:443:127.0.0.1" --resolve "${host}:80:127.0.0.1")
  fi
  code="$(curl "${curl_args[@]}" "$url" 2>/dev/null || echo 000)"
  # API ping 未登录返回 401 也算活着；页面 200/301/302/304
  [[ "$code" =~ ^(200|301|302|304|401)$ ]]
}

check_http() {
  local api_down=0
  local fe_local_down=0
  local c
  for c in "${problems[@]+"${problems[@]}"}"; do
    [[ "$c" == "容器未运行: personal-tax-api" ]] && api_down=1
    [[ "$c" == "容器未运行: frontend-container" ]] && fe_local_down=1
  done

  # 前端：容器已 down 时不再重复报 HTTP
  if ((fe_local_down == 0)); then
    if ! http_ok "$FRONTEND_URL/"; then
      if ! http_ok "http://127.0.0.1/mine.html"; then
        problems+=("前端不可用: $FRONTEND_URL 且本机 :80 失败")
      else
        problems+=("前端公网 URL 探测失败: $FRONTEND_URL （本机 :80 正常；已绕过 DNS，可能是证书/443/防火墙）")
      fi
    fi
  fi

  # API：容器已 down 时合并进容器原因，避免双条噪声
  if ((api_down == 0)); then
    if ! http_ok "$API_URL"; then
      problems+=("API 不可用: $API_URL")
    fi
  fi
}

check_resources() {
  local disk_pct mem_pct
  disk_pct="$(df -P / | awk 'NR==2{gsub(/%/,"",$5); print $5}')"
  if [[ -n "$disk_pct" ]] && (( disk_pct >= DISK_ALERT_PCT )); then
    problems+=("磁盘使用 ${disk_pct}% >= ${DISK_ALERT_PCT}%")
  fi
  # available 口径：不可用占比 = (total-available)/total，更贴近 OOM 风险
  mem_pct="$(free | awk '/Mem:/{ if ($2>0 && NF>=7) printf "%d", (100*($2-$7)/$2); else if ($2>0) printf "%d", (100*$3/$2); else print 0 }')"
  if [[ -n "$mem_pct" ]] && (( mem_pct >= MEM_ALERT_PCT )); then
    problems+=("内存压力 ${mem_pct}% >= ${MEM_ALERT_PCT}%（available 口径）")
  fi
}

# 将同因问题折叠成更短列表（邮件/日志）
compact_problems() {
  local -a out=()
  local p has_api_ctn=0 has_fe_ctn=0
  for p in "${problems[@]+"${problems[@]}"}"; do
    [[ "$p" == "容器未运行: personal-tax-api" ]] && has_api_ctn=1
    [[ "$p" == "容器未运行: frontend-container" ]] && has_fe_ctn=1
  done
  for p in "${problems[@]+"${problems[@]}"}"; do
    if ((has_api_ctn)) && [[ "$p" == API\ 不可用* ]]; then
      continue
    fi
    if ((has_fe_ctn)) && [[ "$p" == 前端不可用* ]]; then
      continue
    fi
    out+=("$p")
  done
  if ((has_api_ctn)); then
    local -a tmp=()
    for p in "${out[@]+"${out[@]}"}"; do
      if [[ "$p" == "容器未运行: personal-tax-api" ]]; then
        tmp+=("后端不可用（容器 personal-tax-api 未运行，API 同步不可达）")
      else
        tmp+=("$p")
      fi
    done
    out=("${tmp[@]+"${tmp[@]}"}")
  fi
  if ((has_fe_ctn)); then
    local -a tmp=()
    for p in "${out[@]+"${out[@]}"}"; do
      if [[ "$p" == "容器未运行: frontend-container" ]]; then
        tmp+=("前端不可用（容器 frontend-container 未运行）")
      else
        tmp+=("$p")
      fi
    done
    out=("${tmp[@]+"${tmp[@]}"}")
  fi
  problems=("${out[@]+"${out[@]}"}")
}

try_heal() {
  [[ "$AUTO_HEAL" == "1" ]] || return 0
  if in_deploy_quiet_window; then
    log "部署窗口内跳过自愈"
    return 0
  fi
  log "开始自愈…"
  docker start test_platform_db >/dev/null 2>&1 || true
  sleep 3
  if [[ -f "$COMPOSE_FILE" ]]; then
    (cd "$ROOT" && docker compose -f "$COMPOSE_FILE" up -d) >>"$LOG_FILE" 2>&1 || true
  else
    docker start test_platform_redis personal-tax-api frontend-container >/dev/null 2>&1 || true
  fi
  local i
  for i in $(seq 1 20); do
    local hs
    hs="$(container_health_status test_platform_db)"
    if [[ "$hs" == "healthy" || "$hs" == "none" ]]; then
      break
    fi
    sleep 3
  done
  docker restart personal-tax-api >/dev/null 2>&1 || true
  sleep 4
  healed+=("已执行: start db + compose up -d + restart api")
}

problems_need_heal() {
  local p
  for p in "${problems[@]+"${problems[@]}"}"; do
    if [[ "$p" == 容器* || "$p" == API* || "$p" == 前端不可用* || "$p" == 后端不可用* ]]; then
      return 0
    fi
  done
  return 1
}

main() {
  mkdir -p "$(dirname "$LOG_FILE")" "$DR_STATE_DIR"

  if in_deploy_quiet_window; then
    # 部署期间不把 recreate 当成故障；也不清零 streak（结束后若仍挂会累计）
    echo "[$(date '+%F %T')] deploy-quiet skip" >>"$LOG_FILE"
    exit 0
  fi

  check_containers
  check_http
  check_resources
  compact_problems

  if ((${#problems[@]} == 0)); then
    write_fail_streak 0
    date +%s >"$DR_STATE_DIR/health-ok.ts"
    echo "[$(date '+%F %T')] ok" >>"$LOG_FILE"
    exit 0
  fi

  local streak
  streak="$(read_fail_streak)"
  streak=$((streak + 1))
  write_fail_streak "$streak"

  log "发现问题 (连续第 ${streak}/${FAIL_STREAK_NEED} 次):"
  local p
  for p in "${problems[@]}"; do
    log "  - $p"
  done

  if (( streak < FAIL_STREAK_NEED )); then
    log "未达连续失败阈值，本轮仅记录、不自愈、不发信"
    exit 2
  fi

  local need_heal=0
  if problems_need_heal; then
    need_heal=1
  fi

  if ((need_heal)); then
    try_heal
    problems=()
    check_containers
    check_http
    compact_problems
  fi

  local status_line="仍异常"
  if ((${#problems[@]} == 0)); then
    status_line="已自愈恢复"
    write_fail_streak 0
  fi

  local body site_label
  site_label="$(dr_site_label)"
  body="$(
    cat <<EOF
站点: $(dr_site_origin)
域名: ${site_label:-—}
主机: $(hostname)
时间: $(date '+%F %T %z')
状态: $status_line
连续失败: ${streak} 次（阈值 ${FAIL_STREAK_NEED}）

问题:
$(printf ' - %s\n' "${problems[@]:-（无）}")

自愈动作:
$(printf ' - %s\n' "${healed[@]:-（无）}")

容器:
$(docker ps -a --format 'table {{.Names}}\t{{.Status}}' | head -20)

内存:
$(free -h | head -3)

请登录服务器查看: /var/log/test_platform-health-guard.log
EOF
  )"

  if dr_alert_cooldown_ok "health" "$ALERT_COOLDOWN_SEC"; then
    dr_send_mail "$(dr_mail_prefix) $(hostname) $status_line" "$body" || true
  else
    log "告警冷却中，跳过邮件"
  fi

  if ((${#problems[@]} > 0)); then
    exit 2
  fi
  exit 0
}

main "$@"
