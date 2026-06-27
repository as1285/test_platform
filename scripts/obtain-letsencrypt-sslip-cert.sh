#!/usr/bin/env bash
# 为 sslip.io 主机名申请 Let's Encrypt 证书（无需自购域名）
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${HTTPS_SSLIP_HOST:-85-137-247-81.sslip.io}"
WEBROOT="${ROOT}/certbot-webroot"
CERT_DIR="${ROOT}/certs"
EMAIL="${LETSENCRYPT_EMAIL:-}"

mkdir -p "$WEBROOT" "$CERT_DIR"

use_selfsigned() {
  bash "$ROOT/scripts/generate-selfsigned-https-cert.sh"
  cp -f "$CERT_DIR/selfsigned-ip.crt" "$CERT_DIR/active-fullchain.crt"
  cp -f "$CERT_DIR/selfsigned-ip.key" "$CERT_DIR/active-privkey.key"
  chmod 644 "$CERT_DIR/active-fullchain.crt"
  chmod 600 "$CERT_DIR/active-privkey.key"
}

use_selfsigned

if ! command -v certbot >/dev/null 2>&1; then
  echo "[le] certbot 未安装，跳过 LE（仍使用自签证书）"
  exit 0
fi

EMAIL_ARGS=(--register-unsafely-without-email --agree-tos)
if [[ -n "$EMAIL" ]]; then
  EMAIL_ARGS=(--email "$EMAIL" --agree-tos --no-eff-email)
fi

echo "[le] requesting certificate for ${HOST} ..."
if certbot certonly --webroot -w "$WEBROOT" -d "$HOST" \
  "${EMAIL_ARGS[@]}" \
  --non-interactive --keep-until-expiring; then
  LE_LIVE="/etc/letsencrypt/live/${HOST}"
  cp -L "$LE_LIVE/fullchain.pem" "$CERT_DIR/active-fullchain.crt"
  cp -L "$LE_LIVE/privkey.pem" "$CERT_DIR/active-privkey.key"
  chmod 644 "$CERT_DIR/active-fullchain.crt"
  chmod 600 "$CERT_DIR/active-privkey.key"
  echo "[le] OK: https://${HOST}/"
else
  echo "[le] WARN: 申请失败，继续使用自签证书"
fi
