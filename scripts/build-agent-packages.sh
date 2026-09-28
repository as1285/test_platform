#!/usr/bin/env bash
# 一键打渠道包：Android APK + iOS mobileconfig
# 用法：./scripts/build-agent-packages.sh <渠道ID> [--no-register] [--ios-only] [--android-only]
# 批量：./scripts/build-agent-packages.sh --batch ch1,ch2,ch3
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_ONLY=false
IOS_ONLY=false
NO_REGISTER=false
BATCH=""
CHANNEL=""

usage() {
  echo "用法: $0 <渠道ID> [--no-register] [--ios-only|--android-only]" >&2
  echo "      $0 --batch ch1,ch2,ch3 [--no-register] [--ios-only|--android-only]" >&2
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --batch)
      BATCH="${2:-}"
      shift 2
      ;;
    --no-register|no-register)
      NO_REGISTER=true
      shift
      ;;
    --ios-only)
      IOS_ONLY=true
      shift
      ;;
    --android-only)
      ANDROID_ONLY=true
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      if [[ -z "$CHANNEL" && -z "$BATCH" ]]; then
        CHANNEL="$1"
        shift
      else
        echo "未知参数: $1" >&2
        usage
      fi
      ;;
  esac
done

if [[ -n "$BATCH" ]]; then
  IFS=',' read -ra CHS <<< "$BATCH"
  for c in "${CHS[@]}"; do
    c="$(echo "$c" | tr -d '[:space:]')"
    [[ -z "$c" ]] && continue
    echo "======== 批量打包: $c ========"
    args=("$c")
    $NO_REGISTER && args+=(--no-register)
    $IOS_ONLY && args+=(--ios-only)
    $ANDROID_ONLY && args+=(--android-only)
    "$0" "${args[@]}"
  done
  exit 0
fi

if [[ -z "$CHANNEL" ]]; then
  usage
fi

EXTRA=()
$NO_REGISTER && EXTRA+=(--no-register)

if ! $IOS_ONLY; then
  echo "==> Android APK: $CHANNEL"
  bash "$ROOT/scripts/build-agent-apk.sh" "$CHANNEL" ${EXTRA[@]+"${EXTRA[@]}"}
fi

if ! $ANDROID_ONLY; then
  echo "==> iOS mobileconfig: $CHANNEL"
  bash "$ROOT/scripts/build-agent-mobileconfig.sh" "$CHANNEL"
fi

CHANNEL_LOWER="$(echo "$CHANNEL" | tr '[:upper:]' '[:lower:]')"
echo ""
echo "渠道包完成: ${CHANNEL_LOWER}"
$IOS_ONLY || echo "  APK:          $ROOT/dist/agent-apk/app-agent-${CHANNEL_LOWER}-debug.apk"
$ANDROID_ONLY || echo "  mobileconfig: $ROOT/dist/agent-ios/app-agent-${CHANNEL_LOWER}.mobileconfig"
