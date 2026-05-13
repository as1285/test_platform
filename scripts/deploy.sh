#!/usr/bin/env bash
# 本地 / 服务器一键部署：重建镜像并启动 compose 服务
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

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

# 本机探活：若此处失败，外网同样无法访问（应先修容器/端口）；若此处成功而外网失败，多为云安全组/本机防火墙未放行 TCP 80
if command -v curl >/dev/null 2>&1; then
  if curl -sfS --max-time 5 -o /dev/null "http://127.0.0.1/"; then
    echo "[deploy] probe OK: http://127.0.0.1/ responded"
  else
    echo "[deploy] WARN: http://127.0.0.1/ did not return HTTP 2xx — check: docker compose logs frontend"
  fi
else
  echo "[deploy] (skip curl probe: curl not installed)"
fi
echo "[deploy] If browsers show ERR_CONNECTION_REFUSED to the public IP: open inbound TCP 80 (and 443 if using HTTPS) on the cloud security group / ufw, and ensure no other process bound port 80."
