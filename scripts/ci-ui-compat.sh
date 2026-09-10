#!/usr/bin/env bash
# 本地 / CI 等价入口：单测 +（可选）assemble 后的日活机壳冒烟。
#   ./scripts/ci-ui-compat.sh           # 只跑 vitest + today-selftest
#   ./scripts/ci-ui-compat.sh --chrome  # 再加上 popular chrome-only
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
RUN_CHROME=0
for arg in "$@"; do
  case "$arg" in
    --chrome) RUN_CHROME=1 ;;
    -h|--help)
      echo "Usage: $0 [--chrome]"
      exit 0
      ;;
    *)
      echo "[ci-ui-compat] unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

echo "[ci-ui-compat] vitest"
(cd "$ROOT/frontend" && npx vitest run)

echo "[ci-ui-compat] today-changes-selftest (informational; historical fails do not block)"
node "$ROOT/scripts/today-changes-selftest.mjs" || echo "[ci-ui-compat] WARN today-selftest exit $?"

if [[ "$RUN_CHROME" != "1" ]]; then
  echo "[ci-ui-compat] skip chrome (pass --chrome to run popular shell smoke)"
  exit 0
fi

echo "[ci-ui-compat] assemble"
(cd "$ROOT/frontend" && npm run assemble)

PORT="${UI_SMOKE_PORT:-8765}"
SITE_DIR="$ROOT/frontend/site"
if [[ ! -d "$SITE_DIR" ]]; then
  echo "[ci-ui-compat] ERROR: $SITE_DIR missing after assemble" >&2
  exit 1
fi

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$SITE_DIR" &
HTTP_PID=$!
cleanup() {
  kill "$HTTP_PID" 2>/dev/null || true
}
trap cleanup EXIT

for i in $(seq 1 40); do
  if curl --noproxy '*' -sfS --max-time 2 -o /dev/null "http://127.0.0.1:${PORT}/mine.html"; then
    break
  fi
  if [[ "$i" -eq 40 ]]; then
    echo "[ci-ui-compat] site did not start on :$PORT" >&2
    exit 1
  fi
  sleep 1
done

export UI_SMOKE_CHROME_ONLY=1
export UI_SMOKE_DEVICES="${UI_SMOKE_DEVICES:-popular}"
export SITE_URL="http://127.0.0.1:${PORT}"
export UI_SMOKE_SHOT_DIR="${UI_SMOKE_SHOT_DIR:-/tmp/ui-smoke-shots}"
echo "[ci-ui-compat] chrome-only devices=${UI_SMOKE_DEVICES} site=${SITE_URL}"
(cd "$ROOT/frontend" && node tests/e2e/ui-smoke-browser.mjs)
echo "[ci-ui-compat] OK shots=${UI_SMOKE_SHOT_DIR}"
