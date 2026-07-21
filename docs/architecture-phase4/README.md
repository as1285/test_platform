# 架构重构 · 阶段 4：数据与增长治理

> 状态：**已完成（事件模型文档 + 按表保留 + 配置分层 + uploads 约定）**  
> 完成日期：2026-07-21  
> 主计划：[`../system-architecture-refactor-plan.md`](../system-architecture-refactor-plan.md)

## 目标

统一增长/观测事件语义；热表可配置保留；`app_settings` 与密钥分离；uploads 明确本地卷 + 可演进 CDN/对象存储。

## 本阶段产出

| 文档 / 代码 | 说明 |
|-------------|------|
| [`event-model.md`](./event-model.md) | 逻辑事件 → 表 / 写入点 / 字段 |
| [`config-governance.md`](./config-governance.md) | 运营配置 vs env 密钥 |
| [`uploads-strategy.md`](./uploads-strategy.md) | 上传卷、URL 解析、CDN 前缀 |
| `backend/dbLogRetention.js` | 按表 `DB_RETAIN_*_DAYS` + 补齐 `api_error_events` 等 |
| `scripts/purge-old-db-logs.sh` | 优先走后端同一实现 |
| `backend/src/shared/settingsPolicy.js` | 禁止密钥键写入 `app_settings` |
| `PUBLIC_ASSET_BASE_URL` / `UPLOAD_STORAGE_BACKEND` | compose + `resolvePublicAssetUrl` |

## 退出标准核对

- [x] 事件模型文档化
- [x] 热表按保留策略清理（可按表覆盖）
- [x] 配置分层（策略模块 + 文档；密钥仍 env-only）
- [x] uploads 策略文档 + CDN 前缀钩子（写入仍本地）

## 运维提示

```bash
# 预览将删行数
./scripts/purge-old-db-logs.sh --dry-run

# 单表缩短保留（例：页面埋点 60 天）
DB_RETAIN_USER_PAGE_EVENTS_DAYS=60 ./scripts/purge-old-db-logs.sh --dry-run
```

生产建议：`REGISTER_STORE_PLAIN_PASSWORD=0`（见阶段 0 安全基线）。

## 下一阶段

阶段 5：仅在确有负载隔离需求时再拆进程（payments / growth / admin 只读优先）。
