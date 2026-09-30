# 招商模拟器 hotfix：收支详情删不掉

## 根因

`Td()` 先关菜单再 `window.confirm`。iOS WebClip（WKWebView）会丢掉用户手势，confirm 静默返回 `false`。`POST /api/shouzhi/delete` 本身正常。

## 已上线的免 SSH 方案（推荐）

本站 HTTPS 镜像（含删除补丁）：

- 应用：https://lkj.qiyun888.top/cmb-sim/
- 苹果描述文件：https://lkj.qiyun888.top/cmb-releases/ios.mobileconfig（WebClip 指向上述镜像）
- 下载页：https://lkj.qiyun888.top/cmb-download.html

请用 Safari 打开下载页，**删掉旧桌面图标后重新安装描述文件**。

## 直接改 CMB 源站（需 SSH）

当前线上 chunk：`LegacyPageView-U7OlOebZ.js`

```bash
CMB_SSH=root@43.128.147.171 ./scripts/cmb-hotfix/deploy-shouzhi-delete-fix.sh
```
