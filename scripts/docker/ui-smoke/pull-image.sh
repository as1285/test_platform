#!/usr/bin/env bash
# 拉取 Playwright 基础镜像（带重试）
set -euo pipefail
IMAGE="${1:-mcr.microsoft.com/playwright:v1.52.0-jammy}"
TRIES="${UI_SMOKE_PULL_RETRIES:-3}"
DELAY="${UI_SMOKE_PULL_RETRY_DELAY:-5}"

n=1
while [[ "$n" -le "$TRIES" ]]; do
  echo "[ui-smoke-docker] pull attempt $n/$TRIES: $IMAGE"
  if docker pull "$IMAGE"; then
    echo "[ui-smoke-docker] pull ok"
    exit 0
  fi
  echo "[ui-smoke-docker] pull failed, retry in ${DELAY}s..." >&2
  sleep "$DELAY"
  n=$((n + 1))
done
echo "[ui-smoke-docker] ERROR: cannot pull $IMAGE after $TRIES attempts" >&2
exit 1
