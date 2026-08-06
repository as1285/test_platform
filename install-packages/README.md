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

当前站点：`https://lkj.qiyun888.top`
APK 壳内 APP_ORIGIN：`https://lkj.qiyun888.top/`
