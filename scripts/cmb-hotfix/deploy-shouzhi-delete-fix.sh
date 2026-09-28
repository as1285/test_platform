#!/usr/bin/env bash
# Hotfix 招商模拟器「收支详情 → 删除」在 iOS WebClip 上无效。
# 根因：Td() 先关菜单再 window.confirm，WKWebView 丢失用户手势后 confirm 直接返回 false。
# 另：菜单 mask/z-index 按 cmb-more 模式加固。
#
# 用法：
#   CMB_SSH=root@43.128.147.171 ./scripts/cmb-hotfix/deploy-shouzhi-delete-fix.sh
set -euo pipefail
HOST="${CMB_SSH:-root@43.128.147.171}"
DIR="$(cd "$(dirname "$0")" && pwd)"
echo "==> Finding assets on $HOST"
FOUND=$(ssh -o BatchMode=yes -o ConnectTimeout=15 "$HOST" \
  'find /var/www /opt /root /home /app /srv /data -type f \( -name "LegacyPageView-Tu5H6vwk.js" -o -name "index-BqyJ-Wdf.css" \) 2>/dev/null | head -20' || true)
if [[ -z "${FOUND}" ]]; then
  echo "No matching assets found (SSH failed or paths unknown)."
  echo "Add this agent pubkey to CMB root authorized_keys, then retry:"
  if [[ -f "${HOME}/.ssh/id_ed25519.pub" ]]; then
    cat "${HOME}/.ssh/id_ed25519.pub"
  else
    echo "  ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIL6UneYT42sXVQQD1cu8Oq6HnSbmiqT4QLVaKdy4K7ap cursor-agent-lkj"
  fi
  exit 1
fi
echo "$FOUND"
JS_REMOTE=$(echo "$FOUND" | grep 'LegacyPageView-Tu5H6vwk.js' | head -1 || true)
CSS_REMOTE=$(echo "$FOUND" | grep 'index-BqyJ-Wdf.css' | head -1 || true)
[[ -n "$JS_REMOTE" ]] && scp -o BatchMode=yes "$DIR/LegacyPageView-Tu5H6vwk.js" "$HOST:$JS_REMOTE" && echo "OK JS -> $JS_REMOTE"
[[ -n "$CSS_REMOTE" ]] && scp -o BatchMode=yes "$DIR/index-BqyJ-Wdf.css" "$HOST:$CSS_REMOTE" && echo "OK CSS -> $CSS_REMOTE"
ssh -o BatchMode=yes "$HOST" 'command -v nginx >/dev/null && nginx -s reload || true'
echo "Done. Hard-refresh the WebClip (or clear site data) and retry 删除."
