#!/usr/bin/env bash
# 本地改完前端后快速同步到运行中的 frontend 容器，无需 docker compose build。
# 用法：
#   ./scripts/sync-frontend.sh
#   ./scripts/sync-frontend.sh --no-build    # 仅同步已生成的 frontend/site（跳过 npm run build）
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="${FRONTEND_CONTAINER:-frontend-container}"
DO_BUILD=1

for arg in "$@"; do
  case "$arg" in
    --no-build) DO_BUILD=0 ;;
    -h|--help)
      echo "Usage: $0 [--no-build]"
      echo "  构建 frontend/site 并同步到容器 $CONTAINER"
      exit 0
      ;;
    *)
      echo "[sync-frontend] unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "[sync-frontend] ERROR: container '$CONTAINER' is not running" >&2
  echo "[sync-frontend] start it first: docker compose up -d frontend" >&2
  exit 1
fi

if [[ "$DO_BUILD" == "1" ]]; then
  echo "[sync-frontend] building frontend/site …"
  (cd "$ROOT/frontend" && npm run build)
fi

SITE="$ROOT/frontend/site"
if [[ ! -d "$SITE" ]]; then
  echo "[sync-frontend] ERROR: $SITE not found — run without --no-build first" >&2
  exit 1
fi

echo "[sync-frontend] syncing -> $CONTAINER:/usr/share/nginx/html/"
# site-config.js 由 deploy/runtime 卷挂载，跳过避免 Resource busy
tar -C "$SITE" --exclude='./js/site-config.js' -cf - . \
  | docker exec -i "$CONTAINER" tar -xf - -C /usr/share/nginx/html

if command -v curl >/dev/null 2>&1; then
  if curl --noproxy '*' -sfS --max-time 5 -o /dev/null "http://127.0.0.1/"; then
    echo "[sync-frontend] OK $(date -Iseconds 2>/dev/null || date) — http://127.0.0.1/ responded"
  else
    echo "[sync-frontend] WARN: sync done but http://127.0.0.1/ probe failed" >&2
  fi
else
  echo "[sync-frontend] OK $(date -Iseconds 2>/dev/null || date)"
fi
