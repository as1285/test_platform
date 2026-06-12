#!/usr/bin/env bash
# 从已签名的 个人.mobileconfig 解出 plist，更新 WebClip URL 后写出未签名 XML（供 Nginx 分发）。
# 用法：APP_URL=http://139.199.191.204 ./scripts/regenerate-ios-mobileconfig.sh
# iOS WebClip 须用 HTTP：IP 直连 HTTPS 为自签证书，Safari 会提示「此连接非私人连接」。
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${ROOT}/个人.mobileconfig"
OUT_FRONTEND="${ROOT}/frontend/个人.mobileconfig"
OUT_ROOT="${ROOT}/个人.mobileconfig"
APP_URL="${APP_URL:-${HTTPS_APP_URL:-http://139.199.191.204}}"
TMP_PLIST="$(mktemp)"

cleanup() { rm -f "$TMP_PLIST"; }
trap cleanup EXIT

if [[ ! -f "$SRC" ]]; then
  echo "[mobileconfig] missing: $SRC" >&2
  exit 1
fi

if head -c 5 "$SRC" | grep -q '<?xml'; then
  cp -f "$SRC" "$TMP_PLIST"
else
  openssl smime -verify -noverify -inform DER -in "$SRC" -out "$TMP_PLIST" >/dev/null 2>&1
fi

python3 - "$TMP_PLIST" "$APP_URL" "$OUT_FRONTEND" "$OUT_ROOT" <<'PY'
import plistlib, sys
src, url, out_frontend, out_root = sys.argv[1:5]
pl = plistlib.load(open(src, 'rb'))
wc = pl['PayloadContent'][0]
old = wc.get('URL', '')
wc['URL'] = url.rstrip('/')
for path in (out_frontend, out_root):
    with open(path, 'wb') as f:
        plistlib.dump(pl, f, fmt=plistlib.FMT_XML)
print(f"[mobileconfig] URL {old!r} -> {wc['URL']!r}")
print(f"[mobileconfig] wrote {out_frontend}")
PY
