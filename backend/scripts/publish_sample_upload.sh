#!/usr/bin/env bash
# 把本地示例发布到站点 /uploads/，打印可打开的网页链接。
# 用法：publish_sample_upload.sh <本地文件> [目标文件名]
set -euo pipefail

SRC="${1:-}"
if [[ -z "$SRC" || ! -f "$SRC" ]]; then
  echo "usage: $0 <local-file> [dest-name]" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BASE_URL="$(grep -E '^PUBLIC_SITE_URL=' "$ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2-)"
BASE_URL="${BASE_URL:-$(grep -E '^APP_URL=' "$ROOT/.env" 2>/dev/null | head -1 | cut -d= -f2-)}"
BASE_URL="${BASE_URL%/}"
BASE_URL="${BASE_URL:-https://lkj.qiyun888.top}"

DEST_NAME="${2:-$(basename "$SRC")}"
DEST_NAME="${DEST_NAME##*/}"
UPLOAD_DIR="/var/lib/docker/volumes/test_platform_uploads_static/_data"
if [[ ! -d "$UPLOAD_DIR" ]]; then
  echo "uploads volume missing: $UPLOAD_DIR" >&2
  exit 1
fi

cp -f "$SRC" "$UPLOAD_DIR/$DEST_NAME"
URL="$BASE_URL/uploads/$DEST_NAME"
CODE="$(curl -sS -o /dev/null -w '%{http_code}' "$URL" || true)"
echo "$URL"
if [[ "$CODE" != "200" ]]; then
  echo "warn: HTTP $CODE for $URL" >&2
  exit 1
fi
