# 架构重构 · 阶段 2：管理端解耦

> 状态：**已完成（独立入口 + 菜单单一来源 + 按菜单懒加载骨架）**  
> 完成日期：2026-07-21（文档纠偏 2026-08-06）  
> 主计划：[`../system-architecture-refactor-plan.md`](../system-architecture-refactor-plan.md)

## 目标

用户端与管理端分离部署面；菜单权限后端单一来源；`admin_panel.js` 按菜单懒加载，降低首包与耦合。

## 本阶段产出

| 项 | 说明 |
|----|------|
| 菜单 registry | [`backend/src/admin/menuRegistry.js`](../../backend/src/admin/menuRegistry.js) |
| 会话下发 | `GET /api/admin/me`、登录响应含 `menu_tree` / `pages` / `menu_defs` / `first_page` |
| 侧栏渲染 | 前端 `AdminNav` 按 `menu_tree` 生成，不再硬编码整棵导航 |
| 懒加载 | `js/admin/loader.js` + `js/admin/modules/*` |
| 路径入口 | `/admin`、`/admin/login`、`/admin/panel` |
| 独立 Host | nginx `server_name admin.geshui.vip`（需 DNS/CF 指向后生效） |
| CSP | 管理登录/面板页 Content-Security-Policy；管理域 `X-Frame-Options: DENY` |
| 登录外置 | `css/admin_login.css` + `js/admin/login.js`（去 inline） |

### 模块拆分现状（纠偏）

| 状态 | 说明 |
|------|------|
| **已拆出真实逻辑** | `charts`、业务工具：`sbdy-demo` / `lizhi-cert` / `ylbx-ps` / `ccb-flow` / `najilu-qr` |
| **仍在 `admin_panel.js`** | 用户、个税维护、数据分析、激活码、设置、账号、日志、监控等 |
| **占位模块** | `users` / `analytics` / `codes` / `settings` / `accounts` / `logs` / `monitor` / `user-data` 多为 `AdminModules[x]={ready:true}`，重逻辑仍在主文件 |
| **已移除/未再拆** | 文档旧述「chat 已拆」不准确：当前菜单与模块中**无**独立 `chat` 页 |

个税维护懒加载共享引擎：`consult-core.js` + `consult-batch-tax.js` + `admin-tax-batch-bridge.js`（管理端无 C 端三入口 DOM，共享 JS 在无 `#taxStartChooser` 时回退为始终显表单）。

## 退出标准核对

- [x] 管理端独立入口（路径 + Host 配置）
- [x] `admin_panel.js` 按菜单懒加载（Chart/QR/najilu + charts/工具模块；核心业务页仍主文件）
- [x] 菜单权限后端单一来源（registry → me/login/accounts）
- [ ] 只读分析库（可选，未做）
- [ ] DNS 上线 `admin.geshui.vip`（运维）

## 运维注意

1. Cloudflare 增加 `admin.geshui.vip` A/AAAA 或 CNAME 到现源站后，管理域 CSP/收敛资源面立即生效。
2. 未配 DNS 时继续用站点 `/admin` 或 `admin_login.html`。
3. 同 origin 下 `admin_token` 仍可能被用户页 XSS 读取；完整隔离依赖独立 Host 后再考虑 Cookie 化。

## 下一阶段

阶段 3：用户端前端现代化（设计系统壳 + 核心页迁移）；管理端可将 users/analytics/tax 等从 `admin_panel.js` 继续抽到真实懒加载模块。
