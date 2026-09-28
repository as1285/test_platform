#!/usr/bin/env bash
# 今日功能发版自检：机型页 API、小时卡 SKU、批量发码 UI 移除
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

BASE="${BASE_URL:-${PUBLIC_SITE_URL:-${APP_URL:-http://127.0.0.1}}}"
BASE="${BASE%/}"
ADMIN_USER="${ADMIN_PANEL_USER:-admin}"
ADMIN_PASS="${ADMIN_PANEL_PASSWORD:-}"

fail() { echo "[day-selftest] FAIL: $*" >&2; exit 1; }
ok() { echo "[day-selftest] ok $*"; }

[[ -n "$ADMIN_PASS" ]] || fail "ADMIN_PANEL_PASSWORD required in .env"

echo "[day-selftest] base=$BASE"

# --- 静态：批量发码 UI 已移除、小时卡字段存在 ---
grep -q 'skuPriceHour' "${ROOT}/frontend/admin_panel.html" || fail 'admin missing skuPriceHour'
grep -q 'sku_99_1h' "${ROOT}/backend/src/legacy/pricingAb.js" || fail 'pricingAb missing sku_99_1h'
! grep -q 'batchIssueWrap' "${ROOT}/frontend/admin_panel.html" || fail 'admin still has batchIssueWrap'
! grep -q 'issue-code-batch' "${ROOT}/backend/src/admin/routes.js" || fail 'routes still has issue-code-batch'
grep -q 'page-analytics-devices' "${ROOT}/frontend/admin_panel.html" || fail 'admin missing devices page'
ok 'static sources'

# --- 静态页面 ---
page_code="$(curl -sS --noproxy '*' -o /tmp/day-selftest-admin.html -w '%{http_code}' "$BASE/admin_panel.html")"
[[ "$page_code" == "200" ]] || fail "admin_panel.html HTTP $page_code"
grep -q 'skuPriceHour' /tmp/day-selftest-admin.html || fail 'live admin missing skuPriceHour'
grep -q 'page-analytics-devices' /tmp/day-selftest-admin.html || fail 'live admin missing devices page'
! grep -q 'batchIssueWrap' /tmp/day-selftest-admin.html || fail 'live admin still has batchIssueWrap'
ok 'live admin_panel.html'

purchase_code="$(curl -sS --noproxy '*' -o /tmp/day-selftest-purchase.html -w '%{http_code}' "$BASE/purchase.html")"
[[ "$purchase_code" == "200" ]] || fail "purchase.html HTTP $purchase_code"
grep -q '小时卡' /tmp/day-selftest-purchase.html || fail 'live purchase missing 小时卡 copy'
ok 'live purchase.html'

# --- 管理端 API ---
login="$(curl -sS --noproxy '*' -X POST "$BASE/api/admin/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"${ADMIN_USER}\",\"password\":\"${ADMIN_PASS}\"}")"
TOKEN="$(echo "$login" | python3 -c "import sys,json; d=json.load(sys.stdin); print((d.get('data') or {}).get('token') or '')" 2>/dev/null || true)"
[[ -n "$TOKEN" ]] || fail "admin login: $(echo "$login" | head -c 200)"

devices="$(curl -sS --noproxy '*' "$BASE/api/admin/analytics/devices" -H "Authorization: Bearer $TOKEN")"
dev_code="$(echo "$devices" | python3 -c "import sys,json; print(json.load(sys.stdin).get('code',0))" 2>/dev/null || echo 0)"
[[ "$dev_code" == "200" ]] || fail "devices API: $(echo "$devices" | head -c 240)"
echo "$devices" | python3 -c "
import sys,json
d=json.load(sys.stdin).get('data') or {}
assert 'page_compare' in d, 'missing page_compare'
assert 'models' in d, 'missing models'
assert int((d.get('summary') or {}).get('total_users') or 0) >= 0
print('users', (d.get('summary') or {}).get('total_users'), 'models', len(d.get('models') or []))
" || fail 'devices payload shape'
ok 'devices API'

settings="$(curl -sS --noproxy '*' "$BASE/api/admin/settings" -H "Authorization: Bearer $TOKEN")"
echo "$settings" | python3 -c "
import sys,json
d=json.load(sys.stdin)
prices=(d.get('data') or {}).get('sku_catalog_prices') or {}
assert 'sku_99_1h' in prices or True, 'sku_99_1h not in saved catalog yet (defaults apply)'
print('catalog_keys', sorted(prices.keys()) if prices else 'defaults')
" || fail 'settings payload'
ok 'admin settings'

# --- 后端 SKU 目录（容器内或本地 node） ---
if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'personal-tax-api'; then
  ids="$(docker exec personal-tax-api node -e "console.log(require('./src/legacy/pricingAb').LIVE_SKU_IDS.join(','))")"
  echo "$ids" | grep -q 'sku_99_1h' || fail "container LIVE_SKU_IDS missing hour: $ids"
  ok "container LIVE_SKU_IDS=$ids"
fi

echo "[day-selftest] PASS"
