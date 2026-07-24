#!/usr/bin/env bash
# 本地 / 服务器一键部署：按 .env 渲染域名配置，重建镜像并启动 compose
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

# 对外域名：优先环境变量 / .env，勿在仓库写死某台机器的域名
export PUBLIC_SITE_URL="${PUBLIC_SITE_URL:-${APP_URL:-}}"
export APP_URL="${APP_URL:-${PUBLIC_SITE_URL:-}}"
export HTTPS_APP_URL="${HTTPS_APP_URL:-$APP_URL}"

if [[ -z "${APP_URL}" ]]; then
  echo "[deploy] ERROR: 请在 .env 中设置 PUBLIC_SITE_URL 或 APP_URL（参见 .env.example）" >&2
  exit 1
fi

bash "$ROOT/scripts/render-site-config.sh"
bash "$ROOT/scripts/regenerate-ios-mobileconfig.sh"

# 直连 HTTPS 机：若尚无证书则生成自签，避免 nginx 因缺证书起不来
if [[ "${ENABLE_ORIGIN_HTTPS:-1}" != "0" ]]; then
  mkdir -p "${ROOT}/certs" "${ROOT}/certbot-webroot"
  if [[ ! -f "${ROOT}/certs/active-fullchain.crt" || ! -f "${ROOT}/certs/active-privkey.key" ]]; then
    if [[ -x "${ROOT}/scripts/generate-selfsigned-https-cert.sh" ]]; then
      bash "${ROOT}/scripts/generate-selfsigned-https-cert.sh" || true
      if [[ -f "${ROOT}/certs/selfsigned-ip.crt" ]]; then
        cp -f "${ROOT}/certs/selfsigned-ip.crt" "${ROOT}/certs/active-fullchain.crt"
        cp -f "${ROOT}/certs/selfsigned-ip.key" "${ROOT}/certs/active-privkey.key"
      fi
    fi
  fi
fi

# 通知后端监控当前正在部署，避免容器重建的短暂不可用触发告警邮件。
DEPLOY_MARKER="/data/uploads/.deployment-in-progress"
mark_deploy_start() {
  docker compose exec -T backend sh -c \
    "date -u +%Y-%m-%dT%H:%M:%SZ > '$DEPLOY_MARKER'" >/dev/null 2>&1 || true
}
mark_deploy_end() {
  docker compose exec -T backend rm -f "$DEPLOY_MARKER" >/dev/null 2>&1 || true
}
mark_deploy_start
trap mark_deploy_end EXIT

# 仅部署部分服务时：DEPLOY_SERVICES="frontend backend" ./scripts/deploy.sh
if [[ -n "${DEPLOY_SERVICES:-}" ]]; then
  # shellcheck disable=SC2086
  docker compose up -d --build ${DEPLOY_SERVICES}
else
  docker compose up -d --build
fi

echo "[deploy] OK $(date -Iseconds 2>/dev/null || date)"
echo "[deploy] compose ps:"
docker compose ps

if command -v curl >/dev/null 2>&1; then
  if curl -sfS --max-time 5 -o /dev/null "http://127.0.0.1/"; then
    echo "[deploy] probe OK: http://127.0.0.1/ responded"
  else
    echo "[deploy] WARN: http://127.0.0.1/ did not return HTTP 2xx — check: docker compose logs frontend"
  fi
  if [[ "${ENABLE_ORIGIN_HTTPS:-1}" != "0" ]]; then
    if curl -kfsS --max-time 5 -o /dev/null "https://127.0.0.1/"; then
      echo "[deploy] probe OK: https://127.0.0.1/ responded"
    else
      echo "[deploy] WARN: https://127.0.0.1/ failed — check certs mount and docker compose logs frontend"
    fi
  fi
else
  echo "[deploy] (skip curl probe: curl not installed)"
fi
echo "[deploy] public site: ${APP_URL}"
echo "[deploy] 本机分支部署：在 .env 设 DEPLOY_BRANCH（lkj 站默认 lkj），然后执行 ./scripts/pull-and-deploy.sh"
