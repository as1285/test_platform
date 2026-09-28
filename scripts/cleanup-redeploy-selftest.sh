#!/usr/bin/env bash
# 清理发版自检留下的账号 / 激活码 / 关联数据。
# 识别规则（任一命中即清理）：
#   1) activation_codes.note 含 redeploy-selftest
#   2) 用户名匹配 ^st[0-9]{5,}$（redeploy-selftest.sh 前缀）
#   3) 命令行 / EXTRA_USERS 传入的额外用户名（历史遗留如 act5991647）
#
# 用法：
#   ./scripts/cleanup-redeploy-selftest.sh
#   ./scripts/cleanup-redeploy-selftest.sh act5991647
#   EXTRA_USERS='act5991647' ./scripts/cleanup-redeploy-selftest.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

DB_CTR="${DB_CONTAINER:-test_platform_db}"
DB_NAME="${MYSQL_DATABASE:-personal_tax}"
DB_ROOT_PASS="${MYSQL_ROOT_PASSWORD:-password}"
MARKER='%redeploy-selftest%'

mysql_q() {
  docker exec "$DB_CTR" mysql -uroot -p"$DB_ROOT_PASS" "$DB_NAME" --default-character-set=utf8mb4 -N -e "$1" 2>/dev/null \
    | grep -v 'Using a password' || true
}

mysql_try() {
  docker exec "$DB_CTR" mysql -uroot -p"$DB_ROOT_PASS" "$DB_NAME" --default-character-set=utf8mb4 -e "$1" >/dev/null 2>&1 || true
}

mapfile -t USERS < <(
  {
    mysql_q "SELECT DISTINCT used_by_username FROM activation_codes
             WHERE note LIKE '${MARKER}' AND used_by_username IS NOT NULL AND used_by_username <> ''"
    mysql_q "SELECT username FROM users WHERE username REGEXP '^st[0-9]{5,}$'"
    for u in "$@"; do printf '%s\n' "$u"; done
    if [[ -n "${EXTRA_USERS:-}" ]]; then
      # shellcheck disable=SC2086
      for u in ${EXTRA_USERS}; do printf '%s\n' "$u"; done
    fi
  } | sed '/^$/d' | sort -u
)

mapfile -t CODE_IDS < <(
  mysql_q "SELECT id FROM activation_codes WHERE note LIKE '${MARKER}'" | sed '/^$/d' | sort -u
)

if [[ ${#USERS[@]} -eq 0 && ${#CODE_IDS[@]} -eq 0 ]]; then
  echo "[cleanup-selftest] nothing to purge"
  exit 0
fi

echo "[cleanup-selftest] users: ${USERS[*]:-(none)}"
echo "[cleanup-selftest] code_ids: ${CODE_IDS[*]:-(none)}"

purge_user() {
  local u="$1"
  [[ -z "$u" ]] && return 0
  # 仅允许自检前缀或显式传入；避免误删
  if [[ ! "$u" =~ ^(st|act)[0-9]{5,}$ ]]; then
    echo "[cleanup-selftest] skip unsafe username: $u"
    return 0
  fi
  echo "[cleanup-selftest] purge user $u"
  # 自检用户用过的激活码直接物理删除（先于 unlink）
  mysql_try "DELETE FROM activation_codes WHERE used_by_username='${u}'"
  # 先删 notify（依赖订单号），再删订单
  mysql_try "DELETE pn FROM payment_notify_logs pn
             INNER JOIN payment_orders po ON po.out_trade_no = pn.out_trade_no
             WHERE po.username='${u}'"
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

if [[ ${#CODE_IDS[@]} -gt 0 ]]; then
  IDS_CSV=$(IFS=,; echo "${CODE_IDS[*]}")
  echo "[cleanup-selftest] delete activation_codes id IN ($IDS_CSV)"
  mysql_try "DELETE FROM activation_codes WHERE id IN ($IDS_CSV)"
fi

echo "[cleanup-selftest] done"
