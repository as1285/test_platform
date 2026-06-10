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
CONFIG_FILE="$CORDOVA_DIR/config.xml"
OUT_DIR="$ROOT/dist/agent-apk"
OUT_APK="$OUT_DIR/app-agent-${CHANNEL_LOWER}-debug.apk"

mkdir -p "$OUT_DIR"

backup_dist="$(mktemp)"
backup_config="$(mktemp)"
cp "$DIST_FILE" "$backup_dist"
cp "$CONFIG_FILE" "$backup_config"

restore() {
  cp "$backup_dist" "$DIST_FILE"
  cp "$backup_config" "$CONFIG_FILE"
  rm -f "$backup_dist" "$backup_config"
}
trap restore EXIT

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
