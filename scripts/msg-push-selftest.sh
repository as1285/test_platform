#!/usr/bin/env bash
# 站内信自动推送 / 分群群发 / 未读角标 自检
# 用法: ./scripts/msg-push-selftest.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

BASE="${BASE_URL:-http://127.0.0.1:3000}"
BASE="${BASE%/}"
ADMIN_USER="${ADMIN_PANEL_USER:-admin}"
ADMIN_PASS="${ADMIN_PANEL_PASSWORD:-640810}"
DB_CTR="${DB_CONTAINER:-test_platform_db}"
DB_NAME="${MYSQL_DATABASE:-personal_tax}"
DB_ROOT_PASS="${MYSQL_ROOT_PASSWORD:-password}"
API_CTR="${API_CONTAINER:-personal-tax-api}"

TS="$(date +%s)"
SUFFIX="${TS: -6}"
U="msgst${SUFFIX}"
PASS="Msg${SUFFIX}!"
CLEANED=0

cleanup() {
  if [[ "$CLEANED" -eq 1 ]]; then return 0; fi
  CLEANED=1
  echo "[msg-selftest] cleanup $U"
  docker exec "$DB_CTR" mysql -uroot -p"$DB_ROOT_PASS" "$DB_NAME" --default-character-set=utf8mb4 -e \
    "DELETE FROM messages WHERE user_id='${U}';
     DELETE FROM tax_records WHERE user_id='${U}';
     DELETE FROM user_page_events WHERE username='${U}';
     DELETE FROM users WHERE username='${U}';" >/dev/null 2>&1 || true
}
trap cleanup EXIT

json_field() {
  python3 -c 'import json,sys
d=json.load(sys.stdin)
cur=d
for k in sys.argv[1:]:
  if not isinstance(cur, dict):
    print(""); raise SystemExit
  cur=cur.get(k)
print("" if cur is None else cur)
' "$@"
}

mysql_q() {
  docker exec "$DB_CTR" mysql -uroot -p"$DB_ROOT_PASS" "$DB_NAME" --default-character-set=utf8mb4 -N -e "$1"
}

gen_user_hash() {
  docker exec "$API_CTR" node -e '
const crypto=require("crypto");
const p=process.argv[1];
const salt=crypto.randomBytes(16);
const hash=crypto.scryptSync(p, salt, 64).toString("hex");
process.stdout.write(salt.toString("hex")+" "+hash+"\n");
' "$1"
}

insert_test_user() {
  local active="${2:-0}"
  read -r salt hash < <(gen_user_hash "$PASS")
  mysql_q "
INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password)
VALUES ('${U}', '${salt}', '${hash}', '${U}', ${active}, 0, NULL);"
}

user_login() {
  curl -sS --noproxy '*' -H 'Content-Type: application/json' \
    -d "{\"action\":\"login\",\"username\":\"${U}\",\"password\":\"${PASS}\"}" \
    "$BASE/api/auth" | json_field data token
}

count_msgs() {
  local marker="${1:-}"
  if [[ -n "$marker" ]]; then
    mysql_q "SELECT COUNT(*) FROM messages WHERE user_id='${U}' AND content LIKE '%${marker}%';"
  else
    mysql_q "SELECT COUNT(*) FROM messages WHERE user_id='${U}';"
  fi
}

count_unread() {
  mysql_q "SELECT COUNT(*) FROM messages WHERE user_id='${U}' AND is_read=0;"
}

assert_eq() {
  local got="$1" want="$2" label="$3"
  if [[ "$got" != "$want" ]]; then
    echo "[msg-selftest] FAIL: $label got=$got want=$want" >&2
    exit 1
  fi
  echo "[msg-selftest] ok $label ($got)"
}

echo "[msg-selftest] base=$BASE user=$U"

# --- 静态资源 ---
for path in /js/message-badge.js /js/auth.js /css/nav.css; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1${path}" 2>/dev/null || echo 000)"
  if [[ "$code" != "200" ]]; then
    echo "[msg-selftest] FAIL: static $path http=$code" >&2
    exit 1
  fi
done
grep -q 'nav-unread-badge' "${ROOT}/frontend/css/nav.css" || { echo "[msg-selftest] FAIL: nav badge css missing" >&2; exit 1; }
grep -q 'track_purchase_page_leave' "${ROOT}/frontend/purchase.html" || { echo "[msg-selftest] FAIL: purchase leave track missing" >&2; exit 1; }
grep -q 'inactive_has_tax' "${ROOT}/frontend/admin_panel.html" || { echo "[msg-selftest] FAIL: admin audience missing" >&2; exit 1; }
echo "[msg-selftest] ok static assets"

# --- 管理端登录 ---
ADMIN_TOKEN="$(
  curl -sS --noproxy '*' -H 'Content-Type: application/json' \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
    "$BASE/api/admin/login" | json_field data token
)"
[[ -n "$ADMIN_TOKEN" ]] || { echo "[msg-selftest] FAIL: admin login" >&2; exit 1; }
echo "[msg-selftest] ok admin login"

# --- 分群预览 dry_run ---
for aud in pending_activate_24h all_inactive inactive_has_tax inactive_no_tax inactive_visited_purchase inactive_purchase_no_pay; do
  resp="$(curl -sS --noproxy '*' -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"audience\":\"$aud\",\"title\":\"t\",\"content\":\"c\",\"dry_run\":true}" \
    "$BASE/api/admin/messages/bulk")"
  code="$(echo "$resp" | json_field code)"
  matched="$(echo "$resp" | json_field data matched)"
  [[ "$code" == "200" ]] || { echo "[msg-selftest] FAIL: bulk dry_run $aud code=$code resp=$resp" >&2; exit 1; }
  echo "[msg-selftest] ok bulk dry_run audience=$aud matched=$matched"
done

# --- 非法 audience ---
bad="$(curl -sS --noproxy '*' -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"audience":"invalid_xyz","title":"t","content":"c","dry_run":true}' \
  "$BASE/api/admin/messages/bulk")"
bad_code="$(echo "$bad" | json_field code)"
[[ "$bad_code" == "400" ]] || { echo "[msg-selftest] FAIL: invalid audience should 400 got=$bad_code" >&2; exit 1; }
echo "[msg-selftest] ok invalid audience rejected"

# --- 创建未激活测试用户 ---
insert_test_user "$U" 0
USER_TOKEN="$(user_login)"
[[ -n "$USER_TOKEN" ]] || { echo "[msg-selftest] FAIL: user login" >&2; exit 1; }
echo "[msg-selftest] ok user login"

# --- unread_count 初始为 0 ---
unread_resp="$(curl -sS --noproxy '*' -H "Authorization: Bearer $USER_TOKEN" "$BASE/api/message?action=unread_count")"
unread="$(echo "$unread_resp" | json_field data unread)"
assert_eq "$unread" "0" "unread_count initial"

# --- 开通类自动站内信已关闭：填税 / 离开支付页均不应再写入 ---
tax_resp="$(curl -sS --noproxy '*' -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"action":"save_record","record":{"year":2025,"month":1,"income_type":"工资薪金","company_name":"自检公司","income":10000,"tax_reported":300}}' \
  "$BASE/api/tax")"
tax_code="$(echo "$tax_resp" | json_field code)"
[[ "$tax_code" == "200" ]] || { echo "[msg-selftest] FAIL: save_record code=$tax_code resp=$tax_resp" >&2; exit 1; }
sleep 2
tax_msg_cnt="$(count_msgs '@@auto_tax_done')"
assert_eq "$tax_msg_cnt" "0" "auto tax message disabled"

track_resp="$(curl -sS --noproxy '*' -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json' \
  -H 'X-Page-Path: /event/track_purchase_page_leave' \
  -d '{"action":"track_purchase_page_leave","meta":{"page":"purchase"}}' \
  "$BASE/api/user")"
track_code="$(echo "$track_resp" | json_field code)"
[[ "$track_code" == "200" ]] || { echo "[msg-selftest] FAIL: track leave code=$track_code" >&2; exit 1; }
sleep 1
purchase_msg_cnt="$(count_msgs '@@auto_purchase_exit')"
assert_eq "$purchase_msg_cnt" "0" "auto purchase exit message disabled"

unread2="$(curl -sS --noproxy '*' -H "Authorization: Bearer $USER_TOKEN" "$BASE/api/message?action=unread_count" | json_field data unread)"
assert_eq "$unread2" "0" "unread_count stays 0 without auto promo"

# --- mark_all_read 在无未读时也应成功 ---
curl -sS --noproxy '*' -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"action":"mark_all_read"}' "$BASE/api/message" >/dev/null
unread4="$(curl -sS --noproxy '*' -H "Authorization: Bearer $USER_TOKEN" "$BASE/api/message?action=unread_count" | json_field data unread)"
assert_eq "$unread4" "0" "unread_count after mark_all_read"

total_msgs="$(count_msgs)"
assert_eq "$total_msgs" "0" "no activation auto messages created"

echo "[msg-selftest] ALL PASSED"
