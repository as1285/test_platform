#!/usr/bin/env bash
# 本地 / 服务器一键部署：重建镜像并启动 compose 服务
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# 仅部署部分服务时：DEPLOY_SERVICES="frontend api" ./scripts/deploy.sh
if [[ -n "${DEPLOY_SERVICES:-}" ]]; then
  # shellcheck disable=SC2086
  docker compose up -d --build ${DEPLOY_SERVICES}
else
  docker compose up -d --build
fi

echo "[deploy] OK $(date -Iseconds 2>/dev/null || date)"
