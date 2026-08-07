#!/usr/bin/env bash
set -euo pipefail
# 预构建 node 镜像入口：Chromium 与系统依赖已装好，直接跑冒烟
cd /work/frontend
if [[ ! -d node_modules/playwright ]]; then
  npm install --prefer-offline "playwright@${UI_SMOKE_PLAYWRIGHT_VERSION:-1.52.0}"
fi
exec node tests/e2e/ui-smoke-browser.mjs
