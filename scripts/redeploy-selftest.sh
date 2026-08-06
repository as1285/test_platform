#!/usr/bin/env bash
# 发版后冒烟自检：发码 → 注册 → 激活 →（可选）拉支付宝配置。
# 结束后**必定**清理自检账号与激活码，不落生产脏数据。
#
# 用法：
#   ./scripts/redeploy-selftest.sh
#   BASE_URL=https://lkj.qiyun888.top ./scripts/redeploy-selftest.sh
#   SKIP_ALIPAY=1 ./scripts/redeploy-selftest.sh
#
# 标记：激活码 note 含 @@redeploy-selftest；用户名 st + 时间戳后 7 位。
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

MARKER='@@redeploy-selftest'
TS="$(date +%s)"
U="st${TS: -7}"
P="Cc${TS: -6}!"
PH="137$(printf '%08d' $((TS % 100000000)))"
NEWCODE=""
CLEANED=0

cleanup() {
  if [[ "$CLEANED" -eq 1 ]]; then
    return 0
  fi
  CLEANED=1
  echo "[selftest] cleanup start (user=$U code=${NEWCODE:-none})"
  EXTRA_USERS="$U" bash "${ROOT}/scripts/cleanup-redeploy-selftest.sh" "$U" || true
  # 再按标记扫一遍（覆盖发码未绑定用户的情况）
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

echo "[selftest] base=$BASE user=$U"

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
  curl -sS --noproxy '*' -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"count\":1,\"note\":\"${MARKER}\",\"grant_days\":1}" \
    "$BASE/api/admin/issue-code"
)"
NEWCODE="$(echo "$issue" | json_field data code)"
if [[ -z "$NEWCODE" ]]; then
  echo "[selftest] FAIL: issue-code resp=$(echo "$issue" | head -c 300)" >&2
  exit 1
fi
echo "[selftest] issued code ok"

reg="$(
  curl -sS --noproxy '*' -H 'Content-Type: application/json' \
    -H "Referer: $BASE/register.html" -H "Origin: $BASE" \
    -d "{\"action\":\"register\",\"username\":\"$U\",\"password\":\"$P\",\"phone\":\"$PH\"}" \
    "$BASE/api/auth"
)"
TOKEN="$(echo "$reg" | json_field data token)"
if [[ -z "$TOKEN" ]]; then
  echo "[selftest] FAIL: register resp=$(echo "$reg" | head -c 300)" >&2
  exit 1
fi
echo "[selftest] register ok"

act="$(
  curl -sS --noproxy '*' -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -H "Referer: $BASE/purchase.html" \
    -d "{\"action\":\"activate\",\"code\":\"$NEWCODE\"}" \
    "$BASE/api/auth"
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
  cfg="$(curl -sS --noproxy '*' -H "Authorization: Bearer $TOKEN" "$BASE/api/payments/alipay/config" || true)"
  echo "[selftest] alipay_config=$(echo "$cfg" | head -c 180)"
fi

echo "[selftest] PASS"
# trap 会清理
