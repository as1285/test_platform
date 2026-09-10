#!/usr/bin/env bash
# 管理后台全量自测：hub 合并 + 图表页 API/静态/Docker
# 用法：./scripts/admin-panel-full-selftest.sh
# 可选：BASE_URL=http://127.0.0.1:3000 ./scripts/admin-panel-full-selftest.sh
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
  echo "[admin-full-selftest] ERROR: ADMIN_PANEL_PASSWORD required" >&2
  exit 1
fi

PASS=0
FAIL=0
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

echo "== unit: menuRegistry =="
if (cd backend && npx vitest run tests/unit/menuRegistry.test.js --no-coverage >/tmp/admin-hub-unit.log 2>&1); then
  ok "vitest menuRegistry"
else
  fail "vitest menuRegistry"
  tail -20 /tmp/admin-hub-unit.log >&2
fi

echo "== static source =="
for pair in \
  'frontend/public/js/admin_panel.js|ADMIN_HUB_DEFS|insights-product|insights-growth|ops-ia-v22-compat-feedback|installGuideVisitRegChart|destroyPlatformCharts|pointRadius: 0' \
  'frontend/public/js/admin/modules/charts.js|applyAdminChartDefaults|scheduleChartResize|registerPlatformDailyChart|lineSeriesStyle|cutout' \
  'frontend/admin_panel.html|registerPlatformDailyChart|registerPlatformMixChart|registerPlatformChartsWrap|20260903-chart-opt' \
  'frontend/css/admin_panel.css|admin-hub-tabs|chart-canvas-wrap|register-platform-charts-grid' \
  'frontend/public/js/admin/loader.js|20260903-chart-opt|insights-product|insights-growth' \
  'backend/src/admin/menuRegistry.js|insights-product|insights-growth|nav_hidden|ADMIN_HUB_DEFS'
do
  file="${pair%%|*}"
  IFS='|' read -r -a needles <<< "${pair#*|}"
  if [[ ! -f "$file" ]]; then
    fail "missing $file"
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

# 侧栏隐藏项不应作为可见 nav 默认出现在 menu tree 构建结果中
HIDDEN_PAGES='install-guide appearance zaizhi-cert gjj-demo user-login-log analytics-activity analytics-devices tax-fill-survey feedback channel-analysis install-guide-stats'
node - <<'NODE' || fail "menu tree visibility"
const m = require('./backend/src/admin/menuRegistry');
const t = m.buildMenuTreeForAdmin({ is_super: true, username: 'admin', menus: [] });
const pages = t.menu_tree.flatMap((g) => g.items.map((i) => i.page));
const hidden = [
  'install-guide','appearance','zaizhi-cert','gjj-demo','user-login-log',
  'analytics-activity','analytics-devices','tax-fill-survey','feedback','channel-analysis','install-guide-stats'
];
const bad = hidden.filter((p) => pages.includes(p));
if (bad.length) {
  console.error('hidden still visible', bad.join(','));
  process.exit(1);
}
const need = ['insights-product','insights-growth','settings','lizhi-cert','sbdy-demo','login-log','ops-board'];
const miss = need.filter((p) => !pages.includes(p));
if (miss.length) {
  console.error('missing hubs', miss.join(','));
  process.exit(1);
}
if (pages.length < 22 || pages.length > 26) {
  console.error('unexpected visible count', pages.length);
  process.exit(1);
}
const routes = [
  ['#install-guide','settings','install'],
  ['#channel-analysis','insights-growth','channel'],
  ['#analytics-activity','insights-product','activity'],
  ['#zaizhi-cert','lizhi-cert','zaizhi'],
  ['#insights-growth/install-stats','insights-growth','install-stats'],
  ['#feedback','insights-product','feedback']
];
for (const [raw, hub, tab] of routes) {
  const r = m.parseAdminRoute(raw);
  if (r.hub !== hub || r.tab !== tab) {
    console.error('route fail', raw, r);
    process.exit(1);
  }
}
console.log('OK nav=' + pages.length);
NODE
if [[ $? -eq 0 ]]; then ok "menu tree hubs+routes (~24 nav)"; fi

echo "== canvas / chart assets =="
for id in \
  channelChartDailyTrend \
  registerTimeChartPeriods registerTimeChartHourly \
  registerPlatformDailyChart registerPlatformMixChart
do
  if grep -q "id=\"$id\"" frontend/admin_panel.html; then
    ok "canvas $id"
  else
    fail "canvas $id missing in html"
  fi
done
if [[ -f frontend/public/js/vendor/chart.umd.min.js ]]; then
  ok "Chart.js vendor present"
else
  fail "Chart.js vendor missing"
fi

echo "== live API ($BASE) =="
health="$(curl -sS --noproxy '*' "$BASE/health" || true)"
if echo "$health" | grep -q '"ok":true'; then ok "health"; else fail "health: $health"; fi

login="$(curl_json POST "$BASE/api/admin/login" \
  -d "$(python3 -c "import json; print(json.dumps({'username':'''$ADMIN_USER''','password':'''$ADMIN_PASS'''}))")")"
ADMIN_TOKEN="$(echo "$login" | json_field data token)"
if [[ -n "$ADMIN_TOKEN" ]]; then ok "admin login"; else
  fail "admin login: $(echo "$login" | head -c 200)"
  echo "[admin-full-selftest] done passed=$PASS failed=$FAIL"
  exit 1
fi

me="$(curl_json GET "$BASE/api/admin/me" -H "Authorization: Bearer $ADMIN_TOKEN")"
me_vis="$(echo "$me" | python3 -c 'import json,sys
d=json.load(sys.stdin).get("data") or {}
tree=d.get("menu_tree") or []
pages=[i.get("page") for g in tree for i in (g.get("items") or [])]
print(len(pages))
print("1" if "insights-product" in pages and "insights-growth" in pages else "0")
print("1" if "install-guide" not in pages and "channel-analysis" not in pages else "0")
print(",".join((d.get("hubs") or {}).keys()))
')"
vis_n="$(echo "$me_vis" | sed -n '1p')"
has_hub="$(echo "$me_vis" | sed -n '2p')"
no_hidden="$(echo "$me_vis" | sed -n '3p')"
hub_keys="$(echo "$me_vis" | sed -n '4p')"
[[ "$has_hub" == "1" ]] && ok "/me hubs present (nav=$vis_n)" || fail "/me missing insights hubs"
[[ "$no_hidden" == "1" ]] && ok "/me hidden pages not in sidebar" || fail "/me still lists hidden pages"
echo "$hub_keys" | grep -q 'insights-growth' && ok "/me hubs keys: $hub_keys" || fail "/me hubs keys incomplete: $hub_keys"

for path in \
  '/api/admin/analytics/register-channels?days=7' \
  '/api/admin/analytics/install-guide-stats?days=7' \
  '/api/admin/analytics/register-time?days=30' \
  '/api/admin/analytics/devices?days=7' \
  '/api/admin/analytics/overview?days=7' \
  '/api/admin/ops/board'
do
  code="$(curl -sS --noproxy '*' -o /tmp/admin_full_api.json -w '%{http_code}' \
    -H "Authorization: Bearer $ADMIN_TOKEN" "$BASE$path")"
  jcode="$(python3 -c 'import json; print(json.load(open("/tmp/admin_full_api.json")).get("code",""))' 2>/dev/null || echo '')"
  if [[ "$code" == "200" && "$jcode" == "200" ]]; then
    ok "API $path"
  else
    fail "API $path http=$code code=$jcode"
  fi
done

# 图表数据形状
python3 - <<'PY' || fail "chart payload shape"
import json
ch=json.load(open('/tmp/admin_full_api.json'))
# last call was ops/board — reload channels
print('skip-shape-from-last')
PY
curl -sS --noproxy '*' -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE/api/admin/analytics/register-channels?days=7" -o /tmp/ch_shape.json
curl -sS --noproxy '*' -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE/api/admin/analytics/install-guide-stats?days=7" -o /tmp/ig_shape.json
curl -sS --noproxy '*' -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$BASE/api/admin/analytics/register-time?days=30" -o /tmp/rt_shape.json
python3 - <<'PY'
import json,sys
ok=True
ch=json.load(open('/tmp/ch_shape.json'))['data']
for k in ('register_channels','by_day','total'):
  if k not in ch:
    print('channels missing', k); ok=False
ig=json.load(open('/tmp/ig_shape.json'))['data']
for k in ('daily','hourly','summary'):
  if k not in ig:
    print('install missing', k); ok=False
rt=json.load(open('/tmp/rt_shape.json'))['data']
for k in ('periods','by_hour','platform_daily','platform_summary'):
  if k not in rt:
    print('register-time missing', k); ok=False
if not ok:
  sys.exit(1)
print('OK shapes', 'ch_days', len(ch.get('by_day') or []), 'ig_daily', len(ig.get('daily') or []), 'plat', len(rt.get('platform_daily') or []))
PY
if [[ $? -eq 0 ]]; then ok "chart API payload shapes"; else fail "chart API payload shapes"; fi

echo "== docker frontend (if up) =="
if docker exec frontend-container true 2>/dev/null; then
  if docker exec frontend-container sh -c 'grep -q registerPlatformDailyChart /usr/share/nginx/html/admin_panel.html && grep -q applyAdminChartDefaults /usr/share/nginx/html/js/admin/modules/charts.js && grep -q 20260903-chart-opt /usr/share/nginx/html/admin_panel.html'; then
    ok "docker frontend has chart-opt markers"
  else
    fail "docker frontend missing chart-opt markers (need rebuild)"
  fi
else
  fail "frontend-container not running"
fi

echo
echo "[admin-full-selftest] done passed=$PASS failed=$FAIL"
if [[ "$FAIL" -gt 0 ]]; then exit 1; fi
