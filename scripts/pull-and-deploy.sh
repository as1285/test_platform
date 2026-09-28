#!/usr/bin/env bash
# 从 GitHub 拉取本机绑定分支后执行 deploy.sh（与 master 隔离）
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

BRANCH="${DEPLOY_BRANCH:-lkj}"
REMOTE="${DEPLOY_REMOTE:-origin}"

if [[ ! -d "${ROOT}/.git" ]]; then
  echo "[pull-deploy] ERROR: 不是 git 仓库：${ROOT}" >&2
  exit 1
fi

echo "[pull-deploy] remote=${REMOTE} branch=${BRANCH}"
git fetch "$REMOTE" "$BRANCH"
# 若本地有未提交改动，先提示；默认要求干净工作区以免覆盖本机未入库修改
if [[ -n "$(git status --porcelain)" ]]; then
  echo "[pull-deploy] ERROR: 工作区有未提交改动，请先 commit / stash，再拉取部署。" >&2
  git status -sb >&2
  exit 1
fi

current="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$current" != "$BRANCH" ]]; then
  echo "[pull-deploy] checkout ${BRANCH} (was ${current})"
  git checkout "$BRANCH"
fi
git pull --ff-only "$REMOTE" "$BRANCH"

echo "[pull-deploy] HEAD=$(git rev-parse --short HEAD) — running deploy.sh"
exec bash "${ROOT}/scripts/deploy.sh"
