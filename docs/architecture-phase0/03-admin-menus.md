# 管理台菜单权限表

> 源码：`backend/src/admin/menuRegistry.js`（阶段 2 单一来源；`ADMIN_MENU_KEYS` 由其派生）  
> 前端侧栏：由 `/api/admin/me` 的 `menu_tree` 渲染（`frontend/public/js/admin/nav.js`）  
> 快照日期：2026-07-21

超级管理员（环境变量 `ADMIN_PANEL_USER` 对应用户）拥有全部菜单。  
子账号权限存 `admin_account_menus`，由「后台账号权限」配置；可选菜单列表来自 `menu_defs`。

## 正式菜单键（后端权威列表）

| menu_key | 中文 | 典型 API 门闸 |
|----------|------|----------------|
| `settings` | 系统设置 | `GET/POST /api/admin/settings` |
| `install-guide` | 引导安装 | settings 共用门闸之一 |
| `appearance` | 用户端外观 | settings 共用门闸之一 |
| `codes` | 激活码 | `issue-code`、`codes` |
| `users` | 注册用户 | `users`、激活/删改/封禁等 |
| `guest-users` | 游客用户 | `guest-users`、部分税记录查看（`super_only`） |
| `user-data` | 用户数据 | `/api/admin/user-data*` |
| `user-behavior` | 用户行为 | 行为分析相关 |
| `activated-user-analysis` | 激活用户分析 | `/api/admin/activated-user-analysis/*` |
| `feedback` | 用户反馈 | `/api/admin/feedback*` |
| `chat` | 在线客服 | `/api/admin/chat/*` |
| `login-log` | 管理账号登录流水 | login/operation logs、login-recent |
| `analytics-conversion` | 转化分析 | conversion KPIs / daily-conversion 等 |
| `analytics-activity` | 用户活跃 | DAU 等 |
| `analytics-register` | 注册分析 | register-* |
| `analytics-tracking` | 埋点分析 | events 等 |
| `analytics-devices` | 设备分析 | devices / device-stats |
| `install-guide-stats` | 安装页统计 | install-guide-stats / install-track-stats |
| `channel-analysis` | 渠道分析 | channel funnel 等 |
| `api-analytics` | 接口统计 | `analytics/api-stats` |
| `admin-accounts` | 后台账号权限 | accounts CRUD（另有超级管理员规则） |
| `server-monitor` | 服务器监控 | `monitor/overview`、`test-email` |

## 页面别名（同 menu_key）

| page | 继承 menu_key | 说明 |
|------|---------------|------|
| `users-deleted` | `users` | 已删除账号 |
| `user-login-log` | `login-log` | 普通用户登录流水 |

## 权限变更检查单

1. 更新 `backend/src/admin/menuRegistry.js`
2. 确认 `requireAdminMenu(...)` 绑定
3. 为已有子账号做迁移或默认补权策略
4. 更新本表与 `snapshots/api-surface.json`（如有路由变更）
5. 前端侧栏无需再手改 DOM（跟 `menu_tree`）
