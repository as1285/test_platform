#!/usr/bin/env bash
# 发版后冒烟自检：发码 → 注册/建号 → 激活 → 支付宝配置/下单探测。
# 结束后**必定**清理自检账号与激活码，不落生产脏数据。
#
# 用法：
#   ./scripts/redeploy-selftest.sh
#   BASE_URL=https://lkj.qiyun888.top ./scripts/redeploy-selftest.sh
#   SKIP_ALIPAY=1 ./scripts/redeploy-selftest.sh
#
# 标记：激活码 note 含 @@redeploy-selftest；用户名 st + 时间戳后 7 位。
# 若注册命中 IP/设备日限，自动改为 DB 建号 + 登录（仍走激活/支付接口）。
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
  echo "[selftest] ERROR: set BASE_URL or PUBLIC_SITE_URL" >&2
  exit 1
fi

ADMIN_USER="${ADMIN_PANEL_USER:-}"
ADMIN_PASS="${ADMIN_PANEL_PASSWORD:-}"
if [[ -z "$ADMIN_USER" || -z "$ADMIN_PASS" ]]; then
  echo "[selftest] ERROR: ADMIN_PANEL_USER / ADMIN_PANEL_PASSWORD required in .env" >&2
  exit 1
fi

DB_CTR="${DB_CONTAINER:-test_platform_db}"
DB_NAME="${MYSQL_DATABASE:-personal_tax}"
DB_ROOT_PASS="${MYSQL_ROOT_PASSWORD:-password}"

MARKER='@@redeploy-selftest'
TS="$(date +%s)"
U="st${TS: -7}"
P="Cc${TS: -6}!"
PH="137$(printf '%08d' $((TS % 100000000)))"
CLIENT_ID="selftest-${TS}-$((RANDOM))"
DEVICE_HDR="$(python3 - <<PY
import json
print(json.dumps({
  "client_id": "${CLIENT_ID}",
  "platform": "selftest",
  "ua": "redeploy-selftest",
}))
PY
)"
NEWCODE=""
TOKEN=""
CLEANED=0
PASS=0

cleanup() {
  if [[ "$CLEANED" -eq 1 ]]; then
    return 0
  fi
  CLEANED=1
  echo "[selftest] cleanup start (user=$U code=${NEWCODE:-none})"
  EXTRA_USERS="$U" bash "${ROOT}/scripts/cleanup-redeploy-selftest.sh" "$U" || true
  bash "${ROOT}/scripts/cleanup-redeploy-selftest.sh" || true
  echo "[selftest] cleanup finished"
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

curl_json() {
  # usage: curl_json METHOD URL [extra curl args...]
  local method="$1" url="$2"
  shift 2
  curl -sS --noproxy '*' -X "$method" \
    -H 'Content-Type: application/json' \
    -H "X-Client-Device: ${DEVICE_HDR}" \
    -H "Referer: $BASE/purchase.html" \
    -H "Origin: $BASE" \
    "$@" \
    "$url"
}

provision_user_via_db() {
  echo "[selftest] register rate-limited → provision via DB"
  # hash with same scrypt params as backend
  local salt hash
  read -r salt hash < <(
    docker exec personal-tax-api node -e '
const crypto=require("crypto");
const p=process.argv[1];
const salt=crypto.randomBytes(16);
const hash=crypto.scryptSync(p, salt, 64).toString("hex");
process.stdout.write(salt.toString("hex")+" "+hash);
' "$P"
  )
  docker exec "$DB_CTR" mysql -uroot -p"$DB_ROOT_PASS" "$DB_NAME" --default-character-set=utf8mb4 -e "
INSERT INTO users (username, salt, hash, real_name, account_active, user_type, plain_password)
VALUES ('${U}', '${salt}', '${hash}', '${U}', 0, 0, NULL);
" 2>/dev/null
  local login
  login="$(
    curl_json POST "$BASE/api/auth" \
      -d "{\"action\":\"login\",\"username\":\"$U\",\"password\":\"$P\"}"
  )"
  TOKEN="$(echo "$login" | json_field data token)"
  if [[ -z "$TOKEN" ]]; then
    echo "[selftest] FAIL: login after DB provision resp=$(echo "$login" | head -c 300)" >&2
    return 1
  fi
  echo "[selftest] provision+login ok"
}

echo "[selftest] base=$BASE user=$U"

# 0) 页面结构冒烟
page_code="$(curl -sS --noproxy '*' -o /tmp/selftest-purchase.html -w '%{http_code}' "$BASE/purchase.html")"
if [[ "$page_code" != "200" ]]; then
  echo "[selftest] FAIL: purchase.html HTTP $page_code" >&2
  exit 1
fi
for needle in purchase-faq purchaseStickyCta foldActivateCode btnPurchaseAlipaySticky; do
  if ! grep -q "$needle" /tmp/selftest-purchase.html; then
    echo "[selftest] FAIL: purchase.html missing $needle" >&2
    exit 1
  fi
done
echo "[selftest] purchase.html structure ok"

ADMIN_TOKEN="$(
  curl -sS --noproxy '*' -H 'Content-Type: application/json' \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
    "$BASE/api/admin/login" | json_field data token
)"
if [[ -z "$ADMIN_TOKEN" ]]; then
  echo "[selftest] FAIL: admin login" >&2
  exit 1
fi

issue="$(
  curl_json POST "$BASE/api/admin/issue-code" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -d "{\"count\":1,\"note\":\"${MARKER}\",\"grant_days\":1}"
)"
NEWCODE="$(echo "$issue" | json_field data code)"
if [[ -z "$NEWCODE" ]]; then
  echo "[selftest] FAIL: issue-code resp=$(echo "$issue" | head -c 300)" >&2
  exit 1
fi
echo "[selftest] issued code ok"

reg="$(
  curl_json POST "$BASE/api/auth" \
    -H "Referer: $BASE/register.html" \
    -d "{\"action\":\"register\",\"username\":\"$U\",\"password\":\"$P\",\"phone\":\"$PH\"}"
)"
TOKEN="$(echo "$reg" | json_field data token)"
if [[ -z "$TOKEN" ]]; then
  reg_code="$(echo "$reg" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("code",""))')"
  if [[ "$reg_code" == "429" ]]; then
    provision_user_via_db
  else
    echo "[selftest] FAIL: register resp=$(echo "$reg" | head -c 300)" >&2
    exit 1
  fi
else
  echo "[selftest] register ok"
fi

act="$(
  curl_json POST "$BASE/api/auth" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"action\":\"activate\",\"code\":\"$NEWCODE\"}"
)"
ACT_OK="$(echo "$act" | python3 -c 'import json,sys
d=json.load(sys.stdin)
print("1" if int(d.get("code") or 0)==200 else "0")
')"
if [[ "$ACT_OK" != "1" ]]; then
  echo "[selftest] FAIL: activate resp=$(echo "$act" | head -c 300)" >&2
  exit 1
fi
echo "[selftest] activate ok"

if [[ "${SKIP_ALIPAY:-0}" != "1" ]]; then
  cfg="$(curl_json GET "$BASE/api/payments/alipay/config" -H "Authorization: Bearer $TOKEN" || true)"
  cfg_ok="$(echo "$cfg" | python3 -c 'import json,sys
d=json.load(sys.stdin)
print("1" if int(d.get("code") or 0)==200 and (d.get("data") or {}).get("enabled") else "0")
' 2>/dev/null || echo 0)"
  echo "[selftest] alipay_config=$(echo "$cfg" | head -c 180)"
  if [[ "$cfg_ok" != "1" ]]; then
    echo "[selftest] FAIL: alipay config not enabled" >&2
    exit 1
  fi
  # 已用 grant_days=1 激活：须选更长时效/永久 sku，否则 coverLonger 会 409
  sku="$(echo "$cfg" | python3 -c 'import json,sys
d=json.load(sys.stdin)
skus=(d.get("data") or {}).get("skus") or []
if not skus:
  print(""); raise SystemExit
def rank(s):
  kind=str(s.get("grant_kind") or "")
  if kind=="permanent":
    return (3, 0, 0)
  return (1, int(s.get("grant_days") or 0), int(s.get("grant_hours") or 0))
skus=sorted(skus, key=rank, reverse=True)
print(skus[0].get("id") or "")
')"
  if [[ -n "$sku" ]]; then
    pay="$(
      curl_json POST "$BASE/api/payments/alipay/create" \
        -H "Authorization: Bearer $TOKEN" \
        -d "{\"sku_id\":\"$sku\"}"
    )"
    pay_ok="$(echo "$pay" | python3 -c 'import json,sys
d=json.load(sys.stdin)
data=d.get("data") or {}
ok=int(d.get("code") or 0)==200 and bool(data.get("qr_code") or data.get("payment_url") or (data.get("order") or {}).get("out_trade_no"))
print("1" if ok else "0")
' 2>/dev/null || echo 0)"
    echo "[selftest] alipay_create=$(echo "$pay" | head -c 220)"
    if [[ "$pay_ok" != "1" ]]; then
      echo "[selftest] FAIL: alipay create order" >&2
      exit 1
    fi
    echo "[selftest] alipay create ok (sku=$sku)"
  else
    echo "[selftest] WARN: no sku in config, skip create"
  fi
fi

# 管理台支付漏斗接口可访问
funnel="$(
  curl -sS --noproxy '*' -H "Authorization: Bearer $ADMIN_TOKEN" \
    "$BASE/api/admin/analytics/purchase-events?days=7"
)"
funnel_ok="$(echo "$funnel" | python3 -c 'import json,sys
d=json.load(sys.stdin)
print("1" if int(d.get("code") or 0)==200 and "funnel" in (d.get("data") or {}) else "0")
' 2>/dev/null || echo 0)"
if [[ "$funnel_ok" != "1" ]]; then
  echo "[selftest] FAIL: purchase-events analytics resp=$(echo "$funnel" | head -c 200)" >&2
  exit 1
fi
has_survey="$(echo "$funnel" | python3 -c 'import json,sys
d=json.load(sys.stdin)
print("1" if "price_survey" in (d.get("data") or {}) else "0")
')"
if [[ "$has_survey" != "1" ]]; then
  echo "[selftest] FAIL: purchase-events missing price_survey" >&2
  exit 1
fi
echo "[selftest] analytics purchase-events ok"

PASS=1
echo "[selftest] PASS"
# trap 会清理
