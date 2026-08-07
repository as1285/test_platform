#!/usr/bin/env bash
# 清理同 IP 注册风控自检账号（用户名前缀 iprs）。
#
# 用法：
#   ./scripts/cleanup-register-ip-risk-selftest.sh
#   ./scripts/cleanup-register-ip-risk-selftest.sh iprs12345a iprs12345b
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_CTR="${DB_CONTAINER:-test_platform_db}"
DB_NAME="${MYSQL_DATABASE:-personal_tax}"
DB_ROOT_PASS="${MYSQL_ROOT_PASSWORD:-password}"

mysql_q() {
  docker exec "$DB_CTR" mysql -uroot -p"$DB_ROOT_PASS" "$DB_NAME" --default-character-set=utf8mb4 -N -e "$1" 2>/dev/null \
    | grep -v 'Using a password' || true
}

mysql_try() {
  docker exec "$DB_CTR" mysql -uroot -p"$DB_ROOT_PASS" "$DB_NAME" --default-character-set=utf8mb4 -e "$1" >/dev/null 2>&1 || true
}

mapfile -t USERS < <(
  {
    mysql_q "SELECT username FROM users WHERE username REGEXP '^iprs[0-9a-z]{5,}$'"
    for u in "$@"; do printf '%s\n' "$u"; done
    if [[ -n "${EXTRA_USERS:-}" ]]; then
      # shellcheck disable=SC2086
      for u in ${EXTRA_USERS}; do printf '%s\n' "$u"; done
    fi
  } | sed '/^$/d' | sort -u
)

if [[ ${#USERS[@]} -eq 0 ]]; then
  echo "[cleanup-ip-risk-selftest] nothing to purge"
  exit 0
fi

echo "[cleanup-ip-risk-selftest] users: ${USERS[*]}"

purge_user() {
  local u="$1"
  [[ -z "$u" ]] && return 0
  if [[ ! "$u" =~ ^iprs[0-9a-z]{5,}$ ]]; then
    echo "[cleanup-ip-risk-selftest] skip unsafe username: $u"
    return 0
  fi
  echo "[cleanup-ip-risk-selftest] purge user $u"
  local tbls=(
    "DELETE FROM chat_messages WHERE conversation_id IN (SELECT id FROM (SELECT id FROM chat_conversations WHERE user_id='${u}') t)"
    "DELETE FROM chat_conversations WHERE user_id='${u}'"
    "DELETE FROM tax_records WHERE user_id='${u}'"
    "DELETE FROM tax_record_change_logs WHERE user_id='${u}'"
    "DELETE FROM user_profile_change_logs WHERE username='${u}'"
    "DELETE FROM tax_issue_applications WHERE user_id='${u}'"
    "DELETE FROM special_deduction_records WHERE user_id='${u}'"
    "DELETE FROM shenbao_jilu_records WHERE user_id='${u}'"
    "DELETE FROM employers WHERE user_id='${u}'"
    "DELETE FROM family_members WHERE user_id='${u}'"
    "DELETE FROM bank_cards WHERE user_id='${u}'"
    "DELETE FROM messages WHERE user_id='${u}'"
    "DELETE FROM user_feedback WHERE user_id='${u}'"
    "DELETE FROM user_rename_credits WHERE username='${u}'"
    "DELETE FROM user_invites WHERE invitee_username='${u}' OR inviter_username='${u}'"
    "DELETE FROM payment_orders WHERE username='${u}'"
    "DELETE FROM pricing_ab_assignments WHERE username='${u}'"
    "DELETE FROM activation_grants WHERE username='${u}'"
    "DELETE FROM invite_link_clicks WHERE inviter_username='${u}'"
    "DELETE FROM user_daily_activity WHERE username='${u}'"
    "DELETE FROM user_login_events WHERE username='${u}'"
    "DELETE FROM user_devices WHERE username='${u}'"
    "DELETE FROM user_page_events WHERE username='${u}'"
    "DELETE FROM user_shebao_photos WHERE username='${u}'"
    "DELETE FROM users WHERE username='${u}'"
  )
  local sql
  for sql in "${tbls[@]}"; do
    mysql_try "$sql"
  done
}

for u in "${USERS[@]}"; do
  purge_user "$(echo "$u" | tr -d '[:space:]')"
done

echo "[cleanup-ip-risk-selftest] done"
