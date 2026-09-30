#!/usr/bin/env bash
# Hotfix 招商模拟器「收支详情 → 删除」在 iOS WebClip 上无效。
# 根因：Td() 先关菜单再 window.confirm，WKWebView 丢失用户手势后 confirm 直接返回 false。
#
# 优先推荐：本仓库已提供 HTTPS 补丁镜像 /cmb-sim/（无需 CMB SSH）。
# 若仍要直接改 CMB 源站静态文件（需 SSH）：
#   CMB_SSH=root@43.128.147.171 ./scripts/cmb-hotfix/deploy-shouzhi-delete-fix.sh
set -euo pipefail
HOST="${CMB_SSH:-root@43.128.147.171}"
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "==> Finding assets on $HOST"
FOUND=$(ssh -o BatchMode=yes -o ConnectTimeout=15 "$HOST" \
  'find /var/www /opt /root /home /app /srv /data -type f \( -name "LegacyPageView-*.js" -o -name "index-BqyJ-Wdf.css" \) 2>/dev/null | head -30' || true)
if [[ -z "${FOUND}" ]]; then
  echo "No matching assets found (SSH failed or paths unknown)."
  echo "Use HTTPS mirror instead: https://lkj.qiyun888.top/cmb-sim/"
  exit 1
fi
echo "$FOUND"
# Prefer newest hashed LegacyPageView if multiple
JS_REMOTE=$(echo "$FOUND" | grep 'LegacyPageView-U7OlOebZ.js' | head -1 || true)
[[ -z "$JS_REMOTE" ]] && JS_REMOTE=$(echo "$FOUND" | grep 'LegacyPageView-' | head -1 || true)
CSS_REMOTE=$(echo "$FOUND" | grep 'index-BqyJ-Wdf.css' | head -1 || true)
if [[ -n "$JS_REMOTE" && -f "$DIR/LegacyPageView-U7OlOebZ.js" ]]; then
  scp -o BatchMode=yes "$DIR/LegacyPageView-U7OlOebZ.js" "$HOST:$JS_REMOTE" && echo "OK JS -> $JS_REMOTE"
fi
[[ -n "$CSS_REMOTE" && -f "$DIR/index-BqyJ-Wdf.css" ]] && scp -o BatchMode=yes "$DIR/index-BqyJ-Wdf.css" "$HOST:$CSS_REMOTE" && echo "OK CSS -> $CSS_REMOTE"
ssh -o BatchMode=yes "$HOST" 'command -v nginx >/dev/null && nginx -s reload || true'
echo "Done."
