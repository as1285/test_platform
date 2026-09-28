#!/usr/bin/env bash
# 构建预装 Chromium 的 node 冒烟镜像（网络好时执行一次即可）
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
IMAGE="${UI_SMOKE_NODE_IMAGE:-test_platform-ui-smoke-node:latest}"

echo "[ui-smoke-docker] building node image: $IMAGE"
docker build \
  -f "${ROOT}/scripts/docker/ui-smoke/Dockerfile.node" \
  -t "$IMAGE" \
  "$ROOT"
echo "[ui-smoke-docker] built $IMAGE"
echo "[ui-smoke-docker] 之后运行: UI_SMOKE_NODE_FALLBACK=1 ./scripts/ui-smoke-playwright.sh"
