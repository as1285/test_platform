# 招商模拟器 hotfix：收支详情删不掉

## 根因

线上 `LegacyPageView-Tu5H6vwk.js` 删除处理为先关菜单再 `window.confirm`。iOS WebClip（WKWebView）会丢掉用户手势，confirm 静默返回 `false`，点「删除」无反应。`POST /api/shouzhi/delete` 本身正常。

## 修复内容

- 先 confirm，通过后再关菜单并调用删除（与银行卡删除同一写法）
- 菜单 mask 先于菜单渲染；z-index 对齐 `cmb-more`（mask 40 / menu 41）

## 部署

需要 SSH 到 `43.128.147.171`：

```bash
CMB_SSH=root@43.128.147.171 ./scripts/cmb-hotfix/deploy-shouzhi-delete-fix.sh
```
