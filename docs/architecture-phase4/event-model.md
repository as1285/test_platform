# 统一事件模型

> 阶段 4 · 2026-07-21  
> 运行时建表以 `backend/src/legacy/monolith.js` `createTables()` 为准。

## 命名约定（前端 → 后端）

| 前缀 / action | 含义 | 落表 |
|---------------|------|------|
| `track_install_*` | 安装/下载漏斗 | `install_guide_track_events` + 日聚合 |
| `track_landing_*` | 落地页 / AB | 同上 |
| `track_guest_*` | 游客沙箱 | 同上 |
| `track_app_*` / `track_wechat_*` / `track_browser_*` | App/微信/浏览器引导 | 同上 |
| `track_jump_*` | 自动跳转（折叠） | 多为 `user_page_events` / 日聚合 |
| `track_api_perf` / `track_api_slow` | 客户端性能 | `api_slow_events` |
| 其他 `track_*`（已登录） | 用户行为 | `user_page_events`（经 analytics 中间件） |

前端：

- `window.trackUserAction` → `POST /api/user.php`
- `window.trackPublicAction` → `POST /api/auth.php`
- `TaxApp.analytics.*`（阶段 3 门面）

## 逻辑类型 ↔ 物理表

| logical_type | table | 主写入 | 关键字段 |
|--------------|-------|--------|----------|
| `api_daily` | `analytics_api_daily` | `analyticsFinishMiddleware` → `incrementApiDailyCounter` | `stat_date`, `route_key`, `biz_category`, `cnt`, `sum_ms`, `max_ms` |
| `api_slow` | `api_slow_events` | `recordApiSlowEvent`（服务端阈值 / 客户端上报） | `source`, `route_key`, `total_ms`, `username`, `client_id`, `page_path` |
| `api_error` | `api_error_events` | `recordApiErrorEvent` | `http_status`, `biz_code`, `latency_ms` |
| `page_view` / `user_action` | `user_page_events` | `recordUserPageEvent` | `username`, `page_path`, `route_key`, `client_id` |
| `install_funnel` | `install_guide_track_events` | `recordInstallGuideTrackEvent` | `event_key`, `client_id`, `device_fp`, `dwell_seconds`, `meta_json` |
| `login_attempt` | `user_login_events` | `recordUserLoginAttempt` / 注册 | `ok`, `reason`, `ip`, `device_fp` |
| `admin_login_attempt` | `admin_login_events` | `recordAdminLoginAttempt` | `admin_username`, `ok`, `reason` |
| `admin_audit` | `admin_operation_logs` | `recordAdminOperationLog` | `path`, `action`, `request_brief`, `status_code` |
| `tax_audit` | `tax_record_change_logs` | `insertTaxChangeLog` | `action`, `before_json`, `after_json` |
| `dau` | `user_daily_activity` | `touchUserDailyActivity` | `activity_date`, `username` |
| `channel_attribution` | `sales_channel_attributions` | `recordSalesChannelAttribution` | `sales_ch`, `expires_at` |

## 与管理台对照

详见阶段 0 [`04-observability-baseline.md`](../architecture-phase0/04-observability-baseline.md)。  
新增错误表明细同样可进「接口统计」类分析（保留策略已覆盖 `api_error_events`）。

## 变更原则

1. **只前进**：新事件优先复用现有表 + `event_key` / `route_key` 约定，避免平行影子表。
2. **脱敏**：管理审计已对 password/token 等字段脱敏；埋点 `meta_json` 禁止写密码/证件号。
3. **保留**：见 `dbLogRetention.js` 与本目录 README 运维节。
