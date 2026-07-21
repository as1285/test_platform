# 架构重构 · 阶段 2：管理端解耦

> 状态：**已完成（独立入口 + 菜单单一来源 + 按菜单懒加载骨架）**  
> 完成日期：2026-07-21  
> 主计划：[`../system-architecture-refactor-plan.md`](../system-architecture-refactor-plan.md)

## 目标

用户端与管理端分离部署面；菜单权限后端单一来源；`admin_panel.js` 按菜单懒加载，降低首包与耦合。

## 本阶段产出

| 项 | 说明 |
|----|------|
| 菜单 registry | [`backend/src/admin/menuRegistry.js`](../../backend/src/admin/menuRegistry.js) |
| 会话下发 | `GET /api/admin/me`、登录响应含 `menu_tree` / `pages` / `menu_defs` / `first_page` |
| 侧栏渲染 | 前端 `AdminNav` 按 `menu_tree` 生成，不再硬编码整棵导航 |
| 懒加载 | `js/admin/loader.js` + `js/admin/modules/*`（charts/chat 已拆出；其余模块占位） |
| 路径入口 | `/admin`、`/admin/login`、`/admin/panel` |
| 独立 Host | nginx `server_name admin.geshui.vip`（需 DNS/CF 指向后生效） |
| CSP | 管理登录/面板页 Content-Security-Policy；管理域 `X-Frame-Options: DENY` |
| 登录外置 | `css/admin_login.css` + `js/admin/login.js`（去 inline） |

## 退出标准核对

- [x] 管理端独立入口（路径 + Host 配置）
- [x] `admin_panel.js` 按菜单懒加载（Chart/QR/najilu + charts/chat 模块）
- [x] 菜单权限后端单一来源（registry → me/login/accounts）
- [ ] 只读分析库（可选，未做）
- [ ] DNS 上线 `admin.geshui.vip`（运维）

## 运维注意

1. Cloudflare 增加 `admin.geshui.vip` A/AAAA 或 CNAME 到现源站后，管理域 CSP/收敛资源面立即生效。
2. 未配 DNS 时继续用 `https://geshui.vip/admin_login.html` 或 `/admin`。
3. 同 origin 下 `admin_token` 仍可能被用户页 XSS 读取；完整隔离依赖独立 Host 后再考虑 Cookie 化。

## 下一阶段

阶段 3：用户端前端现代化（设计系统壳 + 核心页迁移）。
