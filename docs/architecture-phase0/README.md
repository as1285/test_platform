# 架构重构 · 阶段 0：冻结与基线

> 状态：**已完成（文档与启动告警落地）**  
> 完成日期：2026-07-21  
> 主计划：[`../system-architecture-refactor-plan.md`](../system-architecture-refactor-plan.md)

## 目标

在动手拆 `server.js` 之前，先冻结「现状契约」与回归/回滚手段，避免阶段 1 改坏核心链路却无法对照。

## 本阶段产出清单

| # | 文档 | 说明 |
|---|------|------|
| 1 | [`01-core-flows.md`](./01-core-flows.md) | 核心业务链路盘点 |
| 2 | [`02-api-contracts.md`](./02-api-contracts.md) | 关键 API 契约快照 |
| 3 | [`03-admin-menus.md`](./03-admin-menus.md) | 管理台菜单权限表 |
| 4 | [`04-observability-baseline.md`](./04-observability-baseline.md) | 错误率 / 慢接口 / 漏斗基线 |
| 5 | [`05-security-baseline.md`](./05-security-baseline.md) | 密钥、明文密码、管理端凭证计划 |
| 6 | [`06-canary-regression-checklist.md`](./06-canary-regression-checklist.md) | 金丝雀账号回归清单 |
| 7 | [`07-rollback-drill.md`](./07-rollback-drill.md) | 回滚演练步骤 |
| 8 | [`snapshots/api-surface.json`](./snapshots/api-surface.json) | 机读路由/菜单/action 快照 |

## 代码侧轻量落地（不改业务默认行为）

- `backend/server.js` 启动时打印安全基线告警（默认 `JWT_SECRET` / 默认管理口令 / 明文密码开启时）。

## 退出标准核对

- [x] 核心链路文档化
- [x] API + 管理菜单契约快照
- [x] 可观测性基线说明（管理台已有入口 + 表）
- [x] 安全基线计划 + 启动告警
- [x] 金丝雀回归清单
- [x] 回滚演练文档

## 下一阶段入口

阶段 1：拆分 `backend/server.js` 为同仓域模块，并引入 `migrations/`。详见主计划「阶段 1」。
