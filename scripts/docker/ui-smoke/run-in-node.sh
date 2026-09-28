#!/usr/bin/env bash
# 在 node:bookworm-slim 容器内安装 Playwright Chromium 并跑冒烟（无需官方 Playwright 镜像）
set -euo pipefail

NODE_IMAGE="${UI_SMOKE_NODE_IMAGE:-node:20-bookworm-slim}"
PLAYWRIGHT_VERSION="${UI_SMOKE_PLAYWRIGHT_VERSION:-1.52.0}"
BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/work/.cache/ms-playwright}"
MARKER="${BROWSERS_PATH}/.ui-smoke-node-ready"

export PLAYWRIGHT_BROWSERS_PATH="$BROWSERS_PATH"
mkdir -p "$BROWSERS_PATH"

# 国内网络可设 UI_SMOKE_USE_MIRROR=1 或自行 export PLAYWRIGHT_DOWNLOAD_HOST
if [[ "${UI_SMOKE_USE_MIRROR:-1}" == "1" ]]; then
  if [[ -z "${PLAYWRIGHT_DOWNLOAD_HOST:-}" ]]; then
    export PLAYWRIGHT_DOWNLOAD_HOST="https://npmmirror.com/mirrors/playwright"
  fi
  if [[ -f /etc/apt/sources.list ]]; then
    sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list || true
  fi
  if [[ -f /etc/apt/sources.list.d/debian.sources ]]; then
    sed -i 's|deb.debian.org|mirrors.aliyun.com|g; s|security.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources || true
  fi
fi

echo "[ui-smoke-node] image=${NODE_IMAGE} playwright=${PLAYWRIGHT_VERSION}"
if [[ -n "${PLAYWRIGHT_DOWNLOAD_HOST:-}" ]]; then
  echo "[ui-smoke-node] download host=${PLAYWRIGHT_DOWNLOAD_HOST}"
fi

if [[ ! -d node_modules/playwright ]]; then
  echo "[ui-smoke-node] npm install playwright@${PLAYWRIGHT_VERSION}..."
  npm install --prefer-offline "playwright@${PLAYWRIGHT_VERSION}"
fi

if [[ ! -f "$MARKER" ]] || [[ "${UI_SMOKE_FORCE_BROWSER_INSTALL:-0}" == "1" ]]; then
  echo "[ui-smoke-node] installing chromium (first run may take a few minutes)..."
  npx playwright install chromium
  touch "$MARKER"
fi

echo "[ui-smoke-node] ensuring chromium system deps..."
npx playwright install-deps chromium

exec node tests/e2e/ui-smoke-browser.mjs
