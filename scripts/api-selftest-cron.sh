#!/usr/bin/env bash
# 定期 API 自测：跑 scripts/api-selftest.mjs，仅失败时写日志并告警。
# cron 建议：*/5 * * * *
# 环境变量：
#   API_SELFTEST_BASE  默认 http://127.0.0.1
#   API_SELFTEST_LOG   默认 /var/log/test_platform-api-selftest.log
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${API_SELFTEST_BASE:-http://127.0.0.1}"
LOG_FILE="${API_SELFTEST_LOG:-/var/log/test_platform-api-selftest.log}"
STATE_DIR="${DR_STATE_DIR:-/var/lib/test_platform}"
FAIL_STREAK_FILE="$STATE_DIR/api-selftest-fail-streak"
ALERT_COOLDOWN_SEC="${API_SELFTEST_ALERT_COOLDOWN_SEC:-1800}"
ALERT_COOLDOWN_FILE="$STATE_DIR/api-selftest-alert-cooldown"

mkdir -p "$STATE_DIR" "$(dirname "$LOG_FILE")"

ts() { date '+%F %T'; }

run_selftest() {
  cd "$ROOT" && BASE="$BASE" node scripts/api-selftest.mjs >/tmp/api-selftest-out.$$ 2>&1
  local rc=$?
  local out
  out="$(cat /tmp/api-selftest-out.$$ 2>/dev/null || true)"
  rm -f /tmp/api-selftest-out.$$
  echo "$out"
  return $rc
}

out="$(run_selftest || true)"
rc=0
if echo "$out" | grep -q 'failed ===' ; then
  failed_line="$(echo "$out" | grep -E '=== .* failed ===' | tail -1)"
  if [[ "$failed_line" == *" 0 failed"* ]]; then
    rc=0
  else
    rc=1
  fi
fi

read_streak() { tr -dc '0-9' <"$FAIL_STREAK_FILE" 2>/dev/null || echo 0; }
write_streak() { echo "$1" >"$FAIL_STREAK_FILE"; }

if [[ $rc -eq 0 ]]; then
  write_streak 0
  exit 0
fi

# 失败：记日志
streak=$(($(read_streak) + 1))
write_streak "$streak"
{
  echo "[$(ts)] FAIL streak=$streak"
  echo "$out" | grep -E 'FAIL|FAILED|===' | tail -20
  echo
} >>"$LOG_FILE"

# 连续 2 次失败才告警（避免单次抖动）
if (( streak < 2 )); then
  exit 0
fi

# 告警冷却
now=$(date +%s)
last_alert=0
if [[ -f "$ALERT_COOLDOWN_FILE" ]]; then
  last_alert=$(tr -dc '0-9' <"$ALERT_COOLDOWN_FILE" 2>/dev/null || echo 0)
fi
if (( now - last_alert < ALERT_COOLDOWN_SEC )); then
  exit 0
fi
echo "$now" >"$ALERT_COOLDOWN_FILE"

# 发告警邮件（复用 dr-common.sh 的邮件函数，若可用）
if type dr_send_alert_mail >/dev/null 2>&1; then
  dr_send_alert_mail "API 自测连续失败" "连续 $streak 次 API 自测失败，最近一次：\n$(echo "$out" | grep -E 'FAIL|FAILED' | tail -10)" 2>/dev/null || true
fi

echo "[$(ts)] ALERT: API selftest failed streak=$streak" >>"$LOG_FILE"
exit 1
