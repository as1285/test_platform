#!/usr/bin/env bash
set -euo pipefail
# 镜像内已安装 playwright；只跑浏览器脚本（工作区只读挂载）
cd /work/frontend
exec node tests/e2e/ui-smoke-browser.mjs "$@"