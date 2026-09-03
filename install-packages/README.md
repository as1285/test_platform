# 安装包存档（换机必用）

部署后把文件拷到 Docker uploads 卷，并确认 `app_settings`：

## 安卓
```bash
cp install-packages/android/app-debug.apk \
  /var/lib/docker/volumes/test_platform_uploads_static/_data/648e7f60dcf1e795568a1371025f0d20.apk
# 或后台「引导安装」重新上传 app-debug.apk
```
设置键：`android_apk_download_url` → `uploads/<文件名>.apk`

## 苹果
```bash
cp install-packages/ios/personal.mobileconfig \
  /var/lib/docker/volumes/test_platform_uploads_static/_data/e44df4baea314c3b3392c2e129cd8160.mobileconfig
# 同时可供 /personal.mobileconfig 直链：
cp install-packages/ios/personal.mobileconfig frontend/personal.mobileconfig
cp install-packages/ios/personal.mobileconfig frontend/个人.mobileconfig
```
设置键：`ios_mobileconfig_download_url` → `/uploads/<文件名>.mobileconfig` 或 `/personal.mobileconfig`

## 代理渠道包（每渠道独立）

```bash
# Android + iOS 一键
./scripts/build-agent-packages.sh quan_c

# 仅 iOS 描述文件（WebClip URL 带 ?ch=）
./scripts/build-agent-mobileconfig.sh quan_c

# 批量
./scripts/build-agent-packages.sh --batch quan_c,agent_zhang
```

产物：
- `dist/agent-apk/app-agent-<ch>-debug.apk`
- `dist/agent-ios/app-agent-<ch>.mobileconfig`

后台「安装分发 → 代理专属渠道」为该渠道填写 `android_apk_url` / `ios_mobileconfig_url`。
公开接口 `GET /api/public/install-packages?ch=<渠道>` 优先返回该渠道包。

当前站点：`https://lkj.qiyun888.top`
APK 壳内 APP_ORIGIN：`https://lkj.qiyun888.top/`
