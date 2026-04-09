#!/usr/bin/env bash
# 启用仓库自带 hooks：每次 git commit 成功后自动执行 scripts/deploy.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
git config core.hooksPath .githooks
echo "已设置 core.hooksPath=.githooks，之后每次 commit 成功会运行部署脚本。"
echo "若要关闭：git config --unset core.hooksPath"
