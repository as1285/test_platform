#!/usr/bin/env bash
# 构建 ui-smoke 镜像（需先能拉取 Playwright 基础镜像）
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
IMAGE="${UI_SMOKE_IMAGE:-test_platform-ui-smoke:latest}"
BASE="${PLAYWRIGHT_BASE_IMAGE:-mcr.microsoft.com/playwright:v1.52.0-jammy}"

echo "[ui-smoke-docker] base=$BASE"
echo "[ui-smoke-docker] image=$IMAGE"

if ! docker image inspect "$BASE" >/dev/null 2>&1; then
  echo "[ui-smoke-docker] pulling base image (may take a few minutes)..."
  "${ROOT}/scripts/docker/ui-smoke/pull-image.sh" "$BASE"
fi

docker build \
  -f "${ROOT}/scripts/docker/ui-smoke/Dockerfile" \
  --build-arg "PLAYWRIGHT_BASE=${BASE}" \
  -t "$IMAGE" \
  "$ROOT"

echo "[ui-smoke-docker] built $IMAGE"
