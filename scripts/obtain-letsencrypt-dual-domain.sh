#!/usr/bin/env bash
# 同机双域名 Let's Encrypt：主站 getjob68.club + 代理站 lkj.qiyun888.top
# 需公网 DNS 已指向本机，且 nginx 已挂载 certbot-webroot（compose 默认已挂）。
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEBROOT="${ROOT}/certbot-webroot"
CERT_DIR="${ROOT}/certs"
EMAIL="${LETSENCRYPT_EMAIL:-}"
# 主证书名用新主站；SAN 含旧站，一份证书两边 HTTPS 都可用
PRIMARY_HOST="${DUAL_DOMAIN_PRIMARY:-getjob68.club}"
# www.lkj 若解析到其它机器，不要放进同一张证（会 HTTP-01 失败）
DOMAINS=(
  getjob68.club
  www.getjob68.club
  lkj.qiyun888.top
)

mkdir -p "$WEBROOT" "$CERT_DIR"

if ! command -v certbot >/dev/null 2>&1; then
  echo "[dual-le] ERROR: 未安装 certbot（apt install certbot）" >&2
  exit 1
fi

for h in "${DOMAINS[@]}"; do
  ip="$(dig +short "$h" A | head -1 || true)"
  if [[ -z "$ip" ]]; then
    echo "[dual-le] ERROR: 公网尚未解析到 $h（dig 为空 / NXDOMAIN）。请先在注册商确认 NS 与 A 记录生效。" >&2
    exit 1
  fi
  echo "[dual-le] $h -> $ip"
done

EMAIL_ARGS=(--register-unsafely-without-email --agree-tos)
if [[ -n "$EMAIL" ]]; then
  EMAIL_ARGS=(--email "$EMAIL" --agree-tos --no-eff-email)
fi

DOMAIN_ARGS=()
for h in "${DOMAINS[@]}"; do
  DOMAIN_ARGS+=(-d "$h")
done

echo "[dual-le] requesting certificate (primary=${PRIMARY_HOST}) ..."
certbot certonly --webroot -w "$WEBROOT" \
  "${DOMAIN_ARGS[@]}" \
  "${EMAIL_ARGS[@]}" \
  --non-interactive --expand --cert-name "$PRIMARY_HOST"

LE_LIVE="/etc/letsencrypt/live/${PRIMARY_HOST}"
if [[ ! -f "$LE_LIVE/fullchain.pem" || ! -f "$LE_LIVE/privkey.pem" ]]; then
  echo "[dual-le] ERROR: 证书文件不存在: $LE_LIVE" >&2
  exit 1
fi

# 备份旧证书
if [[ -f "$CERT_DIR/active-fullchain.crt" ]]; then
  cp -f "$CERT_DIR/active-fullchain.crt" "$CERT_DIR/active-fullchain.crt.bak.$(date +%Y%m%d%H%M%S)" || true
  cp -f "$CERT_DIR/active-privkey.key" "$CERT_DIR/active-privkey.key.bak.$(date +%Y%m%d%H%M%S)" || true
fi

cp -L "$LE_LIVE/fullchain.pem" "$CERT_DIR/active-fullchain.crt"
cp -L "$LE_LIVE/privkey.pem" "$CERT_DIR/active-privkey.key"
chmod 644 "$CERT_DIR/active-fullchain.crt"
chmod 600 "$CERT_DIR/active-privkey.key"

echo "[dual-le] OK -> $CERT_DIR/active-fullchain.crt"
echo "[dual-le] 下一步：docker compose exec frontend nginx -s reload"
echo "[dual-le] DNS 稳定后可将 .env 中 PUBLIC_SITE_URL/APP_URL 改为 https://getjob68.club 并 ./scripts/deploy.sh"
