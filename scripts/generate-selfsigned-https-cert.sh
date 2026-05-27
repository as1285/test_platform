#!/usr/bin/env bash
# 无域名时为 IP 生成自签 HTTPS 证书（供 Nginx 443 使用）
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="${ROOT}/certs"
CRT="${CERT_DIR}/selfsigned-ip.crt"
KEY="${CERT_DIR}/selfsigned-ip.key"
IP="${HTTPS_SELF_SIGNED_IP:-139.199.191.204}"
DAYS="${HTTPS_SELF_SIGNED_DAYS:-825}"

mkdir -p "$CERT_DIR"
if [[ -f "$CRT" && -f "$KEY" ]]; then
  echo "[cert] exists: $CRT"
  exit 0
fi

openssl req -x509 -nodes -days "$DAYS" -newkey rsa:2048 \
  -keyout "$KEY" \
  -out "$CRT" \
  -subj "/CN=${IP}" \
  -addext "subjectAltName=IP:${IP},DNS:localhost,IP:127.0.0.1"

chmod 600 "$KEY"
echo "[cert] generated for IP ${IP} -> ${CRT}"
