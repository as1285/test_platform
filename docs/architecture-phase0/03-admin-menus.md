# 管理台菜单权限表

> 源码：`backend/src/admin/menuRegistry.js`（阶段 2 单一来源；`ADMIN_MENU_KEYS` 由其派生）  
> 前端侧栏：由 `/api/admin/me` 的 `menu_tree` 渲染（`frontend/public/js/admin/nav.js`）  
> 快照日期：2026-08-29（对齐当前 registry）

超级管理员（环境变量 `ADMIN_PANEL_USER` 对应用户）拥有全部菜单。  
子账号权限存 `admin_account_menus`，由「后台账号权限」配置；可选菜单列表来自 `menu_defs`。

## 分组

| group | 中文 |
|-------|------|
| `ops-desk` | 转化运营 |
| `ops-config` | 内容配置 |
| `users` | 用户管理 |
| `cert-tools` | 业务工具 |
| `insights` | 数据分析 |
| `system` | 系统与安全 |

## 正式菜单键（后端权威列表）

| menu_key | 中文 | 典型用途 |
|----------|------|----------|
| `ops-inactive` | 未激活用户 | 收集未开通用户明细（也可凭 `analytics-conversion` / `users` 进入） |
| `ops-research` | 转化调研 | 未开通漏斗、价格与填写问卷（也可凭转化概览 / 填写调研进入） |
| `ops-lift` | 提高转化 | 次日回访、高收入跟进、站内信群发 |
| `ops-ad-analytics` | 广告页数据运营 | 退税合格名单 + 广告页停留时间与操作（也可凭转化概览进入） |
| `analytics-conversion` | 转化概览 | 支付转化 + 日转化总览 |
| `codes` | 激活码 | 发码 / 列表 |
| `payment-orders` | 订单检索 | 按账号/商户单号查待付、已支付、关闭、退款 |
| `settings` | 定价与引导 | `/api/admin/settings` |
| `install-guide` | 安装分发 | settings 共用门闸之一 |
| `appearance` | 外观 | settings 共用门闸之一 |
| `users` | 注册用户 | 用户 CRUD / 封禁等 |
| `peer-accounts` | 同行账号 | 超阈值改名/改税账号，可豁免或封禁 |
| `rename-tax-daily` | 高频改名 | 改名/个税修改天数超阈值用户的每日修改次数 |
| `users-deleted` | 已删除 | 已删除账号恢复 / 硬删除 |
| `user-data` | 用户数据 | `/api/admin/user-data*` |
| `tax-records-edit` | 个税维护 | `/api/admin/user-tax-records` |
| `sbdy-demo` | 社保演示 | 工具 |
| `lizhi-cert` | 离职证明 | 工具 |
| `ccb-flow` | 工资流水 | 工具 |
| `najilu-qr` | 完税二维码 | 工具 |
| `analytics-register` | 注册分析 | 注册漏斗 |
| `feature-survey` | 功能调研 | 各功能偏贵% / 不满意% / 优化 Top（产品洞察 tab） |
| `analytics-activity` | 用户活跃 | DAU 等 |
| `analytics-devices` | 机型 | UI 兼容目录与 user_devices 对账 |
| `analytics-purchase` | 支付分析 | 购买漏斗 |
| `channel-analysis` | 渠道分析 | 渠道漏斗 |
| `install-guide-stats` | 安装统计 | install-guide-stats |
| `gjj-demo` | 公积金演示 | 工具 |
| `zaizhi-cert` | 在职证明 | 工具 |
| `admin-accounts` | 账号权限 | 子账号（`super_only`，不出现在勾选列表） |
| `downline-admins` | 下线管理员 | 子账号可再发展下线 |
| `login-log` | 管理登录 | 管理端登录 / 操作流水 |
| `user-login-log` | 用户登录 | 普通用户登录流水 |
| `server-monitor` | 监控 | `monitor/overview` |
| `blocked-ips` | IP 黑名单 | 封禁 IP |

## 页面与 menu_key

侧栏每一项对应独立 `menu_key`（`page` 与 `menu_key` 同名），在「可用菜单」中按分组勾选。`admin-accounts` 仍为超管专属，不出现在子账号勾选列表。

## 已废弃（勿再当作现行菜单）

旧文档中的 `guest-users`、`user`、`chat`、`user-behavior`、`activated-user-analysis`、`api-analytics`、`analytics-tracking`（埋点分析）、`ylbx-ps`（社保图片 PS）等**已不在**当前 `ADMIN_PAGE_DEFS`；以 `menuRegistry.js` 为准。旧 hash `#analytics-tracking` 归一到支付分析。

## 权限变更检查单

1. 更新 `backend/src/admin/menuRegistry.js`
2. 确认 `requireAdminMenu(...)` 绑定
3. 为已有子账号做迁移或默认补权策略
4. 更新本表与 `snapshots/api-surface.json`（如有路由变更）
5. 前端侧栏无需再手改 DOM（跟 `menu_tree`）
