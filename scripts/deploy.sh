#!/usr/bin/env bash
# 本地 / 服务器一键部署：重建镜像并启动 compose 服务
# Cloudflare Flexible：源站仅 HTTP:80，跳过本机 SSL / Let's Encrypt
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# iOS 描述文件 WebClip 指向对外域名（浏览器侧 HTTPS 由 Cloudflare 提供）
export APP_URL="${APP_URL:-https://geshui.vip}"
export HTTPS_APP_URL="${HTTPS_APP_URL:-$APP_URL}"
bash "$ROOT/scripts/regenerate-ios-mobileconfig.sh"

# 通知后端监控当前正在部署，避免容器重建的短暂不可用触发告警邮件。
# 标记位于共享 uploads 卷；异常退出时 trap 也会尽量清理，后端另有过期保护。
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

# 仅部署部分服务时：DEPLOY_SERVICES="frontend api" ./scripts/deploy.sh
if [[ -n "${DEPLOY_SERVICES:-}" ]]; then
  # shellcheck disable=SC2086
  docker compose up -d --build ${DEPLOY_SERVICES}
else
  docker compose up -d --build
fi

echo "[deploy] OK $(date -Iseconds 2>/dev/null || date)"
echo "[deploy] compose ps:"
docker compose ps

# 本机探活：Flexible 模式只验 HTTP:80
if command -v curl >/dev/null 2>&1; then
  if curl -sfS --max-time 5 -o /dev/null "http://127.0.0.1/"; then
    echo "[deploy] probe OK: http://127.0.0.1/ responded"
  else
    echo "[deploy] WARN: http://127.0.0.1/ did not return HTTP 2xx — check: docker compose logs frontend"
  fi
else
  echo "[deploy] (skip curl probe: curl not installed)"
fi
echo "[deploy] Cloudflare Flexible: origin is HTTP:80 only; public HTTPS is terminated at CF (geshui.vip)."
echo "[deploy] If CF shows 521/522: open inbound TCP 80 on cloud security group / ufw."
