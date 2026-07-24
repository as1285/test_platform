#!/usr/bin/env bash
# 打包代理专用 Android APK：内置推广渠道、App 内禁用注册、隐藏闲鱼（需后台配置渠道）。
# 用法：./scripts/build-agent-apk.sh <渠道ID>
# 示例：./scripts/build-agent-apk.sh langzi
set -euo pipefail

CHANNEL="${1:-}"
if [[ -z "$CHANNEL" ]]; then
  echo "用法: $0 <agent_channel_id>" >&2
  echo "示例: $0 langzi" >&2
  exit 1
fi

if ! [[ "$CHANNEL" =~ ^[a-zA-Z0-9_-]{1,64}$ ]]; then
  echo "渠道 ID 无效（仅允许字母、数字、下划线、连字符，最长 64 字符）" >&2
  exit 1
fi

CHANNEL_LOWER="$(echo "$CHANNEL" | tr '[:upper:]' '[:lower:]')"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CORDOVA_DIR="$ROOT/cordova-app"
DIST_FILE="$CORDOVA_DIR/www/distribution-config.js"
INDEX_FILE="$CORDOVA_DIR/www/index.html"
CONFIG_FILE="$CORDOVA_DIR/config.xml"
OUT_DIR="$ROOT/dist/agent-apk"
OUT_APK="$OUT_DIR/app-agent-${CHANNEL_LOWER}-debug.apk"

# 从仓库 .env 同步壳内 APP_ORIGIN（仅 https 线上域名）
APP_ORIGIN_URL=""
if [[ -f "$ROOT/.env" ]]; then
  # shellcheck disable=SC1091
  set -a
  # 只读需要的键，避免 source 整份 .env 的副作用
  APP_ORIGIN_URL="$(grep -E '^(PUBLIC_SITE_URL|APP_URL)=' "$ROOT/.env" | head -n1 | cut -d= -f2- | tr -d '\r' | sed 's/^["'\'']//;s/["'\'']$//')"
  set +a
fi
if [[ -z "$APP_ORIGIN_URL" ]]; then
  APP_ORIGIN_URL="https://lkj.qiyun888.top"
fi
APP_ORIGIN_URL="${APP_ORIGIN_URL%/}/"
if ! [[ "$APP_ORIGIN_URL" =~ ^https://lkj\.qiyun888\.top/ ]]; then
  echo "警告: PUBLIC_SITE_URL 非本站 lkj 域名，仍写入壳: $APP_ORIGIN_URL" >&2
fi

mkdir -p "$OUT_DIR"

backup_dist="$(mktemp)"
backup_config="$(mktemp)"
backup_index="$(mktemp)"
cp "$DIST_FILE" "$backup_dist"
cp "$CONFIG_FILE" "$backup_config"
cp "$INDEX_FILE" "$backup_index"

restore() {
  cp "$backup_dist" "$DIST_FILE"
  cp "$backup_config" "$CONFIG_FILE"
  cp "$backup_index" "$INDEX_FILE"
  rm -f "$backup_dist" "$backup_config" "$backup_index"
}
trap restore EXIT

# 同步壳内线上源，避免误打包本地/其它域名
python3 - "$INDEX_FILE" "$APP_ORIGIN_URL" <<'PY'
import re, sys
path, origin = sys.argv[1], sys.argv[2]
text = open(path, encoding="utf-8").read()
text2, n = re.subn(
    r"var APP_ORIGIN = '[^']*';",
    f"var APP_ORIGIN = '{origin}';",
    text,
    count=1,
)
if n != 1:
    raise SystemExit("未能替换 APP_ORIGIN")
open(path, "w", encoding="utf-8").write(text2)
print(f"==> APP_ORIGIN = {origin}")
PY

cat > "$DIST_FILE" <<EOF
/**
 * 代理专用包 — 渠道: ${CHANNEL_LOWER}
 * 由 scripts/build-agent-apk.sh 生成，请勿手改后提交。
 */
window.__TAX_DISTRIBUTION__ = Object.freeze({
  agentSalesChannel: '${CHANNEL_LOWER}',
  disableInAppRegister: true
});
EOF

sed -i "s|<preference name=\"AppendUserAgent\" value=\" TaxPlatformCordovaApp/1\" />|<preference name=\"AppendUserAgent\" value=\" TaxPlatformCordovaApp/1 TaxPlatformDistributor/${CHANNEL_LOWER}\" />|" "$CONFIG_FILE"

echo "==> 代理渠道: ${CHANNEL_LOWER}"
echo "==> 写入 distribution-config.js 与 AppendUserAgent"

cd "$CORDOVA_DIR"

if [[ ! -d node_modules ]]; then
  npm ci
fi

npx cordova telemetry off

if [[ ! -d platforms/android ]]; then
  python3 -m pip install --user --quiet Pillow 2>/dev/null || true
  npm run generate-assets
  npx cordova platform add android@13 --no-interactive
fi

npx cordova build android --debug

BUILT_APK="$CORDOVA_DIR/platforms/android/app/build/outputs/apk/debug/app-debug.apk"
if [[ ! -f "$BUILT_APK" ]]; then
  echo "未找到 APK: $BUILT_APK" >&2
  exit 1
fi

cp "$BUILT_APK" "$OUT_APK"
echo ""
echo "代理专用 APK 已生成:"
echo "  $OUT_APK"
echo ""
echo "下一步："
echo "  1. 在管理后台「引导安装」上传此 APK 到「代理专用安卓安装包」"
echo "  2. 确认「代理推广渠道」列表包含: ${CHANNEL_LOWER}"
echo "  3. 将 APK 或推广链接 install_guide.html?ch=${CHANNEL_LOWER} 发给代理/客户"
