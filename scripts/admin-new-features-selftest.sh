#!/usr/bin/env bash
# 自测：本次管理后台新增 — 离职/在职证明价格、支付套餐心理价
# 用法：./scripts/admin-new-features-selftest.sh
# 可选：BASE_URL=http://127.0.0.1:3000 ./scripts/admin-new-features-selftest.sh
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
ADMIN_PASS="${ADMIN_PANEL_PASSWORD:-}"
if [[ -z "$ADMIN_PASS" ]]; then
  echo "[admin-feat-selftest] ERROR: ADMIN_PANEL_PASSWORD required" >&2
  exit 1
fi

PASS=0
FAIL=0
RESTORE_LIZHI=""
RESTORE_CATALOG=""

ok() { PASS=$((PASS + 1)); echo "[ok] $*"; }
fail() { FAIL=$((FAIL + 1)); echo "[FAIL] $*" >&2; }

json_field() {
  python3 -c 'import json,sys
d=json.load(sys.stdin)
cur=d
for k in sys.argv[1:]:
  if isinstance(cur, dict):
    cur=cur.get(k)
  elif isinstance(cur, list) and k.isdigit():
    cur=cur[int(k)]
  else:
    print(""); raise SystemExit
print("" if cur is None else cur)
' "$@"
}

curl_json() {
  local method="$1"; shift
  local url="$1"; shift
  curl -sS --noproxy '*' -X "$method" "$url" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json' \
    "$@"
}

cleanup() {
  if [[ -n "${ADMIN_TOKEN:-}" ]]; then
    if [[ -n "$RESTORE_LIZHI" ]]; then
      curl_json POST "$BASE/api/admin/settings" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -d "$RESTORE_LIZHI" >/dev/null 2>&1 || true
      echo "[cleanup] restored lizhi_cert_fee"
    fi
    if [[ -n "$RESTORE_CATALOG" ]]; then
      curl_json POST "$BASE/api/admin/settings" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -d "$RESTORE_CATALOG" >/dev/null 2>&1 || true
      echo "[cleanup] restored sku_catalog"
    fi
  fi
}
trap cleanup EXIT

echo "== unit tests =="
if (cd backend && npx vitest run lizhiCertFeePolicy settingsPolicy pricingAb --no-coverage >/tmp/admin-feat-unit.log 2>&1); then
  ok "vitest lizhiCertFeePolicy + settingsPolicy + pricingAb"
else
  fail "vitest failed"
  tail -30 /tmp/admin-feat-unit.log >&2
fi

echo "== static (source + assembled site) =="
for pair in \
  'frontend/admin_panel.html|lizhiCertFeeAmount|btnSaveLizhiCertFee|sku-catalog-psych|skuPsychWeek|心理价（元）|保存证明价格' \
  'frontend/public/js/admin_panel.js|lizhi_cert_fee|applyLizhiCertFeeToForm|psych_amount|sku-catalog-psych' \
  'frontend/site/admin_panel.html|lizhiCertFeeAmount|sku-catalog-psych|心理价（元）' \
  'frontend/site/js/admin_panel.js|lizhi_cert_fee|psych_amount|btnSaveLizhiCertFee' \
  'backend/src/user/lizhiCertFeePolicy.js|lizhi_cert_fee_json|LIZHI_CERT_FEE_DEFAULT_AMOUNT' \
  'backend/src/shared/settingsPolicy.js|lizhi_cert_fee_json' \
  'backend/src/legacy/pricingAb.js|psych_amount|psych_offer|list_amount'
do
  file="${pair%%|*}"
  IFS='|' read -r -a needles <<< "${pair#*|}"
  if [[ ! -f "$file" ]]; then
    fail "missing file $file"
    continue
  fi
  miss=()
  for n in "${needles[@]}"; do
    if ! grep -qF "$n" "$file"; then
      miss+=("$n")
    fi
  done
  if [[ ${#miss[@]} -eq 0 ]]; then
    ok "static $file"
  else
    fail "static $file missing: ${miss[*]}"
  fi
done

# docker frontend image should also have psych column
if docker exec frontend-container grep -q 'sku-catalog-psych' /usr/share/nginx/html/admin_panel.html 2>/dev/null; then
  ok "docker frontend has sku-catalog-psych"
else
  fail "docker frontend missing sku-catalog-psych"
fi
if docker exec personal-tax-api grep -q 'psych_amount' /app/src/legacy/pricingAb.js 2>/dev/null; then
  ok "docker backend has psych_amount"
else
  fail "docker backend missing psych_amount"
fi
if docker exec personal-tax-api grep -q 'lizhi_cert_fee_json' /app/src/shared/settingsPolicy.js 2>/dev/null; then
  ok "docker backend has lizhi_cert_fee_json"
else
  fail "docker backend missing lizhi_cert_fee_json"
fi

echo "== live API ($BASE) =="
health="$(curl -sS --noproxy '*' "$BASE/health" || true)"
if echo "$health" | grep -q '"ok":true'; then
  ok "health"
else
  fail "health: $health"
fi

login="$(curl_json POST "$BASE/api/admin/login" \
  -d "$(python3 -c "import json; print(json.dumps({'username':'''$ADMIN_USER''','password':'''$ADMIN_PASS'''}))")")"
ADMIN_TOKEN="$(echo "$login" | json_field data token)"
if [[ -n "$ADMIN_TOKEN" && "$ADMIN_TOKEN" != "" ]]; then
  ok "admin login"
else
  fail "admin login: $(echo "$login" | head -c 200)"
  echo "[admin-feat-selftest] done passed=$PASS failed=$FAIL"
  exit 1
fi

settings="$(curl_json GET "$BASE/api/admin/settings" -H "Authorization: Bearer $ADMIN_TOKEN")"
code="$(echo "$settings" | json_field code)"
if [[ "$code" == "200" ]]; then
  ok "GET /api/admin/settings"
else
  fail "GET settings code=$code"
fi

# --- 证明价格 ---
orig_lizhi="$(echo "$settings" | python3 -c 'import json,sys
d=json.load(sys.stdin)
fee=(d.get("data") or {}).get("lizhi_cert_fee") or {"amount":"50.00"}
print(json.dumps({"lizhi_cert_fee": fee}))')"
RESTORE_LIZHI="$orig_lizhi"
orig_amt="$(echo "$orig_lizhi" | json_field lizhi_cert_fee amount)"
test_amt="51.00"
if [[ "$orig_amt" == "51.00" ]]; then test_amt="52.00"; fi

save_lizhi="$(curl_json POST "$BASE/api/admin/settings" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "{\"lizhi_cert_fee\":{\"amount\":\"$test_amt\"}}")"
if [[ "$(echo "$save_lizhi" | json_field code)" == "200" ]]; then
  got="$(echo "$save_lizhi" | json_field data lizhi_cert_fee amount)"
  if [[ "$got" == "$test_amt" ]]; then
    ok "POST lizhi_cert_fee -> $test_amt"
  else
    fail "POST lizhi_cert_fee saved=$got want=$test_amt"
  fi
else
  fail "POST lizhi_cert_fee: $(echo "$save_lizhi" | head -c 240)"
fi

# invalid amount rejected
bad_lizhi="$(curl_json POST "$BASE/api/admin/settings" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"lizhi_cert_fee":{"amount":"0"}}')"
bad_code="$(echo "$bad_lizhi" | json_field code)"
if [[ "$bad_code" == "400" ]]; then
  ok "POST lizhi_cert_fee rejects 0"
else
  fail "POST lizhi_cert_fee 0 expected 400 got $bad_code"
fi

# --- 套餐心理价 ---
catalog_json="$(echo "$settings" | python3 -c 'import json,sys
d=json.load(sys.stdin)
cat=(d.get("data") or {}).get("sku_catalog") or (d.get("data") or {}).get("sku_catalog_prices") or {}
print(json.dumps({"sku_catalog": cat}))')"
RESTORE_CATALOG="$catalog_json"

patched="$(echo "$settings" | python3 -c 'import json,sys,copy
d=json.load(sys.stdin)
cat=copy.deepcopy((d.get("data") or {}).get("sku_catalog") or {})
defaults={
  "sku_300_7d": {"amount":"300.00","grant_days":7,"grant_hours":0,"enabled":True},
  "sku_348_14d": {"amount":"348.00","grant_days":14,"grant_hours":0,"enabled":True},
  "sku_398_30d": {"amount":"398.00","grant_days":30,"grant_hours":0,"enabled":True},
}
for sid, dft in defaults.items():
  cur=cat.get(sid)
  if not isinstance(cur, dict):
    cur=dict(dft)
    if cur is not dft and isinstance(cat.get(sid), (str,int,float)):
      cur["amount"]=str(cat[sid])
  else:
    cur=dict(dft, **cur)
  cur.setdefault("psych_amount", cur.get("psych_amount") or "")
  cat[sid]=cur
week=dict(cat["sku_300_7d"])
list_amt=float(week.get("amount") or 300)
psych=120.0
if psych >= list_amt:
  psych=max(1.0, round(list_amt * 0.4, 2))
week["psych_amount"]=f"{psych:.2f}"
cat["sku_300_7d"]=week
print(json.dumps({"sku_catalog": cat}))
')"
psych_want="$(echo "$patched" | python3 -c 'import json,sys; print(json.load(sys.stdin)["sku_catalog"]["sku_300_7d"]["psych_amount"])')"

save_cat="$(curl_json POST "$BASE/api/admin/settings" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "$patched")"
if [[ "$(echo "$save_cat" | json_field code)" == "200" ]]; then
  got_psych="$(echo "$save_cat" | python3 -c 'import json,sys
d=json.load(sys.stdin)
c=(d.get("data") or {}).get("sku_catalog") or {}
w=c.get("sku_300_7d") or {}
print(w.get("psych_amount") or "")')"
  if [[ "$got_psych" == "$psych_want" ]]; then
    ok "POST sku_catalog psych_amount=$got_psych"
  else
    fail "POST sku_catalog psych got=$got_psych want=$psych_want"
  fi
else
  fail "POST sku_catalog: $(echo "$save_cat" | head -c 300)"
fi

# reject psych >= list
bad_psych_body="$(echo "$patched" | python3 -c 'import json,sys
d=json.load(sys.stdin)
c=d["sku_catalog"]
c["sku_300_7d"]=dict(c["sku_300_7d"], psych_amount=c["sku_300_7d"]["amount"])
print(json.dumps(d))
')"
bad_psych="$(curl_json POST "$BASE/api/admin/settings" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d "$bad_psych_body")"
if [[ "$(echo "$bad_psych" | json_field code)" == "400" ]]; then
  ok "POST sku_catalog rejects psych>=price"
else
  fail "psych>=price expected 400 got $(echo "$bad_psych" | json_field code) $(echo "$bad_psych" | head -c 160)"
fi

# --- C 端：alipay config should reflect psych when no custom offer ---
# Lightweight: inspect saved catalog via GET settings again
verify="$(curl_json GET "$BASE/api/admin/settings" -H "Authorization: Bearer $ADMIN_TOKEN")"
vpsych="$(echo "$verify" | python3 -c 'import json,sys
d=json.load(sys.stdin)
c=(d.get("data") or {}).get("sku_catalog") or {}
print((c.get("sku_300_7d") or {}).get("psych_amount") or "")')"
vlizhi="$(echo "$verify" | json_field data lizhi_cert_fee amount)"
if [[ "$vpsych" == "$psych_want" ]]; then ok "GET settings still has psych=$vpsych"; else fail "GET settings psych=$vpsych want=$psych_want"; fi
if [[ "$vlizhi" == "$test_amt" ]]; then ok "GET settings lizhi_cert_fee=$vlizhi"; else fail "GET settings lizhi=$vlizhi want=$test_amt"; fi

# Simulate live catalog apply inside backend container
docker_apply="$(docker exec personal-tax-api node -e '
const { normalizeCatalogConfig, cloneLiveCatalog } = require("./src/legacy/pricingAb");
const cfg = normalizeCatalogConfig({
  sku_300_7d: { amount: "300", psych_amount: "120", grant_days: 7, enabled: true },
  sku_348_14d: { amount: "348", grant_days: 14, enabled: true },
  sku_398_30d: { amount: "398", grant_days: 30, enabled: true }
});
const live = cloneLiveCatalog(cfg);
const w = live.find(s => s.id === "sku_300_7d");
if (!w || w.amount !== "120.00" || w.list_amount !== "300.00" || !w.psych_offer) {
  console.log("FAIL", JSON.stringify(w));
  process.exit(1);
}
console.log("OK", w.label, w.amount, w.list_amount);
')"
if echo "$docker_apply" | grep -q '^OK'; then
  ok "runtime cloneLiveCatalog psych apply: $docker_apply"
else
  fail "runtime cloneLiveCatalog: $docker_apply"
fi

# lizhi fee loader in container
docker_lizhi="$(docker exec personal-tax-api node -e '
const p = require("./src/user/lizhiCertFeePolicy");
const n = p.normalizeLizhiCertFeeConfig({ amount: "51" });
if (n.amount !== "51.00") { console.log("FAIL", n); process.exit(1); }
if (p.parseLizhiCertFeeConfigFromAdmin({ amount: "0" }) !== null) { console.log("FAIL zero"); process.exit(1); }
console.log("OK", n.amount);
')"
if echo "$docker_lizhi" | grep -q '^OK'; then
  ok "runtime lizhiCertFeePolicy: $docker_lizhi"
else
  fail "runtime lizhiCertFeePolicy: $docker_lizhi"
fi

echo
echo "[admin-feat-selftest] done passed=$PASS failed=$FAIL"
if [[ "$FAIL" -gt 0 ]]; then exit 1; fi
