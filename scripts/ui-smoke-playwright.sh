#!/usr/bin/env bash
# Playwright 前端冒烟（默认 Docker，无需本机 Chromium）
#
# 用法:
#   ./scripts/ui-smoke-playwright.sh                    # Docker（优先官方 Playwright 镜像，失败则 node 回退）
#   UI_SMOKE_LOCAL=1 ./scripts/ui-smoke-playwright.sh   # 本机 Chromium
#   UI_SMOKE_BUILD_IMAGE=1 ./scripts/ui-smoke-playwright.sh  # 使用自建 test_platform-ui-smoke 镜像
#   UI_SMOKE_NODE_FALLBACK=1 ./scripts/ui-smoke-playwright.sh  # 直接用 node 镜像装 Chromium（不拉 Playwright 镜像）
#   UI_SMOKE_USE_MIRROR=0 ...                                  # 禁用 npmmirror 下载 Chromium
#   UI_SMOKE_DEVICES=mainstream ./scripts/ui-smoke-playwright.sh  # 近一个月日活主力 ∪ 近期兼容（默认）
#   UI_SMOKE_DEVICES=all ./scripts/ui-smoke-playwright.sh         # 目录全量
#   UI_SMOKE_DEVICES=android ./scripts/ui-smoke-playwright.sh     # 仅安卓：纳税明细标题/返回 + 白顶距
#   UI_SMOKE_DEVICES=full ./scripts/ui-smoke-playwright.sh        # 仅 iPhone 12 完整业务冒烟
#   UI_SMOKE_DEVICES=recent ./scripts/ui-smoke-playwright.sh      # 近期频繁改兼容的机型
#   UI_SMOKE_DEVICES=popular ./scripts/ui-smoke-playwright.sh     # 近一个月日活高频型号
#   UI_SMOKE_DEVICES=oneplus-12,mate60,xiaomi-15 ...              # 指定机型
#
# 机型目录：frontend/tests/e2e/ui-smoke-devices.mjs
#   iOS：12 / 13–17 Pro Max / 16 Pro / Air + 线上 iOS 18.7 / 18.5 / 17.6.1 / 14.4 队列
#   Android：Pixel、Galaxy S24、一加 12/Ace 系、Reno10/K9x/A58/A57/Find X8/X9、
#            小米 13–15 / 红米 K80Pro·K80 Ultra·K70·K70至尊·Note11、Mate30/60/70、nova13、
#            Hi nova 9 SE、Pura70、荣耀折叠、vivo/iQOO 系（含 X100）、魅族 20 Pro
#
# 环境变量:
#   SITE_URL / API_URL       站点与 API 地址（Docker 用 --network host，默认 127.0.0.1）
#   UI_SMOKE_DEVICES         mainstream | all | full | recent | popular | 逗号分隔机型 id（见上）
#   UI_SMOKE_CHROME_ONLY=1   跳过 API 业务冒烟，只验壳 / 白顶栏（无 DB 时可用）
#   PLAYWRIGHT_RUN_IMAGE     运行镜像（默认 mcr.microsoft.com/playwright:v1.52.0-jammy）
#   UI_SMOKE_NODE_IMAGE      node 回退镜像（默认 node:20-bookworm-slim，本机常已通过 daocloud 缓存）
#   UI_SMOKE_IMAGE           自建镜像名（UI_SMOKE_BUILD_IMAGE=1 时）
#   UI_SMOKE_PULL_TIMEOUT    拉取 Playwright 镜像超时秒数（默认 120，超时后自动 node 回退）
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

export SITE_URL="${SITE_URL:-${BASE_URL:-http://127.0.0.1}}"
export SITE_URL="${SITE_URL%/}"
export API_URL="${API_URL:-http://127.0.0.1:3000}"
export API_URL="${API_URL%/}"
export DB_CONTAINER="${DB_CONTAINER:-test_platform_db}"
export API_CONTAINER="${API_CONTAINER:-personal-tax-api}"
RUN_IMAGE="${PLAYWRIGHT_RUN_IMAGE:-mcr.microsoft.com/playwright:v1.52.0-jammy}"
BUILT_IMAGE="${UI_SMOKE_IMAGE:-test_platform-ui-smoke:latest}"
NODE_IMAGE="${UI_SMOKE_NODE_IMAGE:-node:20-bookworm-slim}"
BUILT_NODE_IMAGE="${UI_SMOKE_NODE_BUILT_IMAGE:-test_platform-ui-smoke-node:latest}"
PULL_TIMEOUT="${UI_SMOKE_PULL_TIMEOUT:-120}"

run_docker_smoke() {
  local env_file="$1"
  local image="$2"
  docker run --rm \
    --network host \
    --init \
    --cap-add=SYS_ADMIN \
    -e SITE_URL \
    -e API_URL \
    -e UI_SMOKE_DEVICES \
    -e UI_SMOKE_CHROME_ONLY \
    --env-file "$env_file" \
    -v "${ROOT}:/work" \
    -w /work/frontend \
    "$image" \
    bash -lc 'if [[ ! -d node_modules/playwright ]]; then npm install --prefer-offline playwright@1.52.0; fi; node tests/e2e/ui-smoke-browser.mjs'
}

run_node_fallback_smoke() {
  local env_file="$1"
  if [[ "${UI_SMOKE_USE_BUILT_NODE:-1}" == "1" ]] && docker image inspect "$BUILT_NODE_IMAGE" >/dev/null 2>&1; then
    echo "[ui-smoke] node image (${BUILT_NODE_IMAGE}) — 预装 Chromium"
    docker run --rm \
      --network host \
      --init \
      --cap-add=SYS_ADMIN \
      -e SITE_URL \
      -e API_URL \
      -e UI_SMOKE_DEVICES \
    -e UI_SMOKE_CHROME_ONLY \
      -e UI_SMOKE_PLAYWRIGHT_VERSION \
      --env-file "$env_file" \
      -v "${ROOT}:/work" \
      "$BUILT_NODE_IMAGE"
    return
  fi

  mkdir -p "${ROOT}/.cache/ms-playwright"
  echo "[ui-smoke] node fallback (${NODE_IMAGE}) — 容器内安装 Chromium，无需本机浏览器"
  docker run --rm \
    --network host \
    --init \
    --cap-add=SYS_ADMIN \
    -e SITE_URL \
    -e API_URL \
    -e UI_SMOKE_DEVICES \
    -e UI_SMOKE_CHROME_ONLY \
    -e UI_SMOKE_NODE_IMAGE \
    -e UI_SMOKE_PLAYWRIGHT_VERSION \
    -e UI_SMOKE_FORCE_BROWSER_INSTALL \
    -e UI_SMOKE_USE_MIRROR \
    -e PLAYWRIGHT_DOWNLOAD_HOST \
    -e PLAYWRIGHT_BROWSERS_PATH=/work/.cache/ms-playwright \
    --env-file "$env_file" \
    -v "${ROOT}:/work" \
    -w /work/frontend \
    "$NODE_IMAGE" \
    bash /work/scripts/docker/ui-smoke/run-in-node.sh
}

ensure_playwright_image() {
  if docker image inspect "$RUN_IMAGE" >/dev/null 2>&1; then
    return 0
  fi
  echo "[ui-smoke] pulling ${RUN_IMAGE} (timeout ${PULL_TIMEOUT}s) ..."
  if timeout "$PULL_TIMEOUT" "${ROOT}/scripts/docker/ui-smoke/pull-image.sh" "$RUN_IMAGE"; then
    return 0
  fi
  echo "[ui-smoke] WARN: cannot pull ${RUN_IMAGE}, will use node fallback" >&2
  return 1
}

if [[ "${UI_SMOKE_LOCAL:-0}" == "1" ]]; then
  echo "[ui-smoke] local mode (host Chromium)"
  cd "${ROOT}/frontend"
  npm install
  if [[ "${UI_SMOKE_SKIP_BROWSER_INSTALL:-0}" != "1" ]]; then
    if ! compgen -G "$HOME/.cache/ms-playwright/chromium-*" >/dev/null 2>&1; then
      echo "[ui-smoke] installing chromium..."
      npx playwright install chromium
      npx playwright install-deps chromium 2>/dev/null || true
    fi
  fi
  ENV_LINE="$("${ROOT}/scripts/ui-smoke-host-setup.sh" | tail -1)"
  ENV_FILE="${ENV_LINE#UI_SMOKE_ENV_FILE=}"
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  export UI_SMOKE_USER UI_SMOKE_PASS UI_SMOKE_TOKEN API_URL
  node "${ROOT}/frontend/tests/e2e/ui-smoke-browser.mjs"
  docker exec "$DB_CONTAINER" mysql -uroot -p"${MYSQL_ROOT_PASSWORD:-password}" "${MYSQL_DATABASE:-personal_tax}" \
    --default-character-set=utf8mb4 -e \
    "DELETE FROM messages WHERE user_id='${UI_SMOKE_USER}';
     DELETE FROM tax_records WHERE user_id='${UI_SMOKE_USER}';
     DELETE FROM user_page_events WHERE username='${UI_SMOKE_USER}';
     DELETE FROM users WHERE username='${UI_SMOKE_USER}';" >/dev/null 2>&1 || true
  rm -f "$ENV_FILE" 2>/dev/null || true
  exit 0
fi

echo "[ui-smoke] docker mode"

if ! docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
  echo "[ui-smoke] ERROR: 数据库容器 ${DB_CONTAINER} 未运行，请先 docker compose up -d" >&2
  exit 1
fi
if ! docker ps --format '{{.Names}}' | grep -q "^${API_CONTAINER}$"; then
  echo "[ui-smoke] ERROR: 后端容器 ${API_CONTAINER} 未运行" >&2
  exit 1
fi

USE_NODE_FALLBACK=0
USE_IMAGE="$RUN_IMAGE"
if [[ "${UI_SMOKE_BUILD_IMAGE:-0}" == "1" ]]; then
  if [[ "${UI_SMOKE_SKIP_BUILD:-0}" != "1" ]] && ! docker image inspect "$BUILT_IMAGE" >/dev/null 2>&1; then
    "${ROOT}/scripts/docker/ui-smoke/build-image.sh"
  fi
  USE_IMAGE="$BUILT_IMAGE"
elif [[ "${UI_SMOKE_NODE_FALLBACK:-0}" == "1" ]]; then
  USE_NODE_FALLBACK=1
elif ! ensure_playwright_image; then
  USE_NODE_FALLBACK=1
fi

ENV_LINE="$("${ROOT}/scripts/ui-smoke-host-setup.sh" | tail -1)"
ENV_FILE="${ENV_LINE#UI_SMOKE_ENV_FILE=}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "[ui-smoke] ERROR: host setup env file missing" >&2
  exit 1
fi
# shellcheck disable=SC1090
source "$ENV_FILE"
export UI_SMOKE_USER UI_SMOKE_PASS UI_SMOKE_TOKEN API_URL

set +e
if [[ "$USE_NODE_FALLBACK" == "1" ]]; then
  run_node_fallback_smoke "$ENV_FILE"
  RUN_EXIT=$?
elif [[ "${UI_SMOKE_BUILD_IMAGE:-0}" == "1" ]]; then
  docker run --rm \
    --network host \
    --init \
    --cap-add=SYS_ADMIN \
    -e SITE_URL \
    -e API_URL \
    -e UI_SMOKE_DEVICES \
    -e UI_SMOKE_CHROME_ONLY \
    --env-file "$ENV_FILE" \
    -v "${ROOT}:/work:ro" \
    "$USE_IMAGE"
  RUN_EXIT=$?
else
  run_docker_smoke "$ENV_FILE" "$USE_IMAGE"
  RUN_EXIT=$?
fi
set -e

docker exec "$DB_CONTAINER" mysql -uroot -p"${MYSQL_ROOT_PASSWORD:-password}" "${MYSQL_DATABASE:-personal_tax}" \
  --default-character-set=utf8mb4 -e \
  "DELETE FROM messages WHERE user_id='${UI_SMOKE_USER}';
   DELETE FROM tax_records WHERE user_id='${UI_SMOKE_USER}';
   DELETE FROM user_page_events WHERE username='${UI_SMOKE_USER}';
   DELETE FROM users WHERE username='${UI_SMOKE_USER}';" >/dev/null 2>&1 || true
rm -f "$ENV_FILE" 2>/dev/null || true

if [[ "$RUN_EXIT" -ne 0 ]]; then
  echo "[ui-smoke] FAILED (exit $RUN_EXIT)" >&2
  exit "$RUN_EXIT"
fi
echo "[ui-smoke] ALL PASSED"
