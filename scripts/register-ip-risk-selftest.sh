#!/usr/bin/env bash
# 同 IP 多账号注册风控自检：
#   1) 写入 2 个测试账号 + 同一 IP 的 register_ok 事件
#   2) 校验管理端 users 接口返回 risk / 同IP注册N个
#   3) 校验「风险账号」筛选可命中
# 结束后自动清理 iprs* 测试账号。
#
# 用法：
#   ./scripts/register-ip-risk-selftest.sh
#   BASE_URL=https://lkj.qiyun888.top ./scripts/register-ip-risk-selftest.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

BASE="${BASE_URL:-${PUBLIC_SITE_URL:-${APP_URL:-}}}"
BASE="${BASE%/}"
if [[ -z "$BASE" ]]; then
  echo "[ip-risk-selftest] ERROR: set BASE_URL or PUBLIC_SITE_URL" >&2
  exit 1
fi

ADMIN_USER="${ADMIN_PANEL_USER:-}"
ADMIN_PASS="${ADMIN_PANEL_PASSWORD:-}"
if [[ -z "$ADMIN_USER" || -z "$ADMIN_PASS" ]]; then
  echo "[ip-risk-selftest] ERROR: ADMIN_PANEL_USER / ADMIN_PANEL_PASSWORD required in .env" >&2
  exit 1
fi

DB_CTR="${DB_CONTAINER:-test_platform_db}"
DB_NAME="${MYSQL_DATABASE:-personal_tax}"
DB_ROOT_PASS="${MYSQL_ROOT_PASSWORD:-password}"

TS="$(date +%s)"
SUFFIX="${TS: -5}"
U1="iprs${SUFFIX}a"
U2="iprs${SUFFIX}b"
U3="iprs${SUFFIX}c"
TEST_IP="10.88.99.$((TS % 200 + 10))"
CLEANED=0

cleanup() {
  if [[ "$CLEANED" -eq 1 ]]; then
    return 0
  fi
  CLEANED=1
  echo "[ip-risk-selftest] cleanup start"
  EXTRA_USERS="$U1 $U2 $U3" bash "${ROOT}/scripts/cleanup-register-ip-risk-selftest.sh" "$U1" "$U2" "$U3" || true
  echo "[ip-risk-selftest] cleanup finished"
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

mysql_try() {
  docker exec "$DB_CTR" mysql -uroot -p"$DB_ROOT_PASS" "$DB_NAME" --default-character-set=utf8mb4 -e "$1" >/dev/null 2>&1 || true
}

gen_user_hash() {
  docker exec personal-tax-api node -e '
const crypto=require("crypto");
const p=process.argv[1];
const salt=crypto.randomBytes(16);
const hash=crypto.scryptSync(p, salt, 64).toString("hex");
process.stdout.write(salt.toString("hex")+" "+hash+"\n");
' "$1"
}

insert_test_user() {
  local u="$1"
  local p="$2"
  read -r salt hash < <(gen_user_hash "$p")
  mysql_try "
INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password)
VALUES ('${u}', '${salt}', '${hash}', '${u}', 0, 0, NULL);
"
}

insert_register_ok() {
  local u="$1"
  local ip="$2"
  mysql_try "
INSERT INTO user_login_events (username, ok, reason, ip, city, user_agent, device_fp)
VALUES ('${u}', 1, 'register_ok', '${ip}', '自检', 'register-ip-risk-selftest', 'iprisk-${TS}');
"
}

check_user_risk() {
  local username="$1"
  local expect_risk="$2"
  local expect_count="$3"
  local resp
  resp="$(
    curl -sS --noproxy '*' \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      "$BASE/api/admin/users?username=${username}&exact=1&limit=1"
  )"
  local code risk reg_cnt msgs
  code="$(echo "$resp" | json_field code)"
  risk="$(echo "$resp" | python3 -c 'import json,sys
d=json.load(sys.stdin)
rows=(d.get("data") or {}).get("users") or []
if not rows:
  print("")
else:
  print("1" if rows[0].get("risk") else "0")
')"
  reg_cnt="$(echo "$resp" | python3 -c 'import json,sys
d=json.load(sys.stdin)
rows=(d.get("data") or {}).get("users") or []
print(rows[0].get("register_ip_account_count", "") if rows else "")
')"
  msgs="$(echo "$resp" | python3 -c 'import json,sys
d=json.load(sys.stdin)
rows=(d.get("data") or {}).get("users") or []
msgs=rows[0].get("risk_messages") or [] if rows else []
print("；".join(msgs))
')"

  if [[ "$code" != "200" ]]; then
    echo "[ip-risk-selftest] FAIL: users API code=$code user=$username resp=$(echo "$resp" | head -c 240)" >&2
    return 1
  fi
  if [[ "$risk" != "$expect_risk" ]]; then
    echo "[ip-risk-selftest] FAIL: user=$username risk=$risk expected=$expect_risk msgs=$msgs" >&2
    return 1
  fi
  if [[ -n "$expect_count" && "$reg_cnt" != "$expect_count" ]]; then
    echo "[ip-risk-selftest] FAIL: user=$username register_ip_account_count=$reg_cnt expected=$expect_count" >&2
    return 1
  fi
  if [[ "$expect_risk" == "1" ]]; then
    if [[ "$msgs" != *"同IP注册${expect_count}个"* ]]; then
      echo "[ip-risk-selftest] FAIL: user=$username missing 同IP注册${expect_count}个 in msgs=$msgs" >&2
      return 1
    fi
  fi
  echo "[ip-risk-selftest] ok user=$username risk=$risk reg_cnt=$reg_cnt msgs=$msgs"
}

echo "[ip-risk-selftest] base=$BASE ip=$TEST_IP users=$U1,$U2,$U3"

ADMIN_TOKEN="$(
  curl -sS --noproxy '*' -H 'Content-Type: application/json' \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
    "$BASE/api/admin/login" | json_field data token
)"
if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "[ip-risk-selftest] FAIL: admin login" >&2
  exit 1
fi
echo "[ip-risk-selftest] admin login ok"

P1="Ip${SUFFIX}a!"
P2="Ip${SUFFIX}b!"
P3="Ip${SUFFIX}c!"
insert_test_user "$U1" "$P1"
insert_test_user "$U2" "$P2"
insert_test_user "$U3" "$P3"
insert_register_ok "$U1" "$TEST_IP"
insert_register_ok "$U2" "$TEST_IP"
insert_register_ok "$U3" "10.88.98.$((TS % 200 + 10))"
echo "[ip-risk-selftest] seeded users + register_ok events"

check_user_risk "$U1" "1" "2"
check_user_risk "$U2" "1" "2"
check_user_risk "$U3" "0" "1"

risk_filter="$(
  curl -sS --noproxy '*' \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$BASE/api/admin/users?risk=1&username=${U1}&exact=1&limit=5"
)"
risk_rows="$(echo "$risk_filter" | python3 -c 'import json,sys
d=json.load(sys.stdin)
rows=(d.get("data") or {}).get("users") or []
print(len(rows))
')"
if [[ "$risk_rows" -lt 1 ]]; then
  echo "[ip-risk-selftest] FAIL: risk=1 filter did not return $U1 resp=$(echo "$risk_filter" | head -c 240)" >&2
  exit 1
fi
echo "[ip-risk-selftest] risk filter ok rows=$risk_rows"

echo "[ip-risk-selftest] PASS"
