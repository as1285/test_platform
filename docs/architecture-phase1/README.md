# 架构重构 · 阶段 1：后端切块

> 状态：**已完成（同仓模块化 + migrations 骨架）**  
> 完成日期：2026-07-21  
> 主计划：[`../system-architecture-refactor-plan.md`](../system-architecture-refactor-plan.md)

## 目标

把 `backend/server.js` 巨石拆成同仓域模块（仍单进程），对外保留 `*.php?action=` 兼容；引入 `migrations/`，冻结 `initDatabase` 内新增 ALTER。

## 本阶段产出

| 项 | 说明 |
|----|------|
| 薄入口 | [`backend/server.js`](../../backend/server.js) → [`src/bootstrap.js`](../../backend/src/bootstrap.js) |
| 域路由 | `src/{auth,user,tax,payments,growth,admin,chat,platform}/routes.js` |
| Shared | `src/shared/config.js`、`db.js`、`migrate.js` |
| Legacy | `src/legacy/monolith.js`（handler / 中间件 / 历史建表暂存） |
| Migrations | [`backend/migrations/`](../../backend/migrations/README.md) |
| Docker | `Dockerfile` 已 `COPY src` + `migrations` |

## 目录形态

```text
backend/
  server.js                 # 仅启动
  src/
    bootstrap.js            # 装配域路由
    auth|user|tax|payments|growth|admin|chat|platform/
      routes.js
    shared/
      config.js | db.js | migrate.js
    legacy/
      monolith.js           # 业务实现暂存；后续按域继续下沉
  migrations/
    001_*.sql
```

## 退出标准核对

- [x] `server.js` 只做装配与启动
- [x] 路由按域注册，兼容路径未改
- [x] `migrations/` 运行器接入启动流程；冻结约定文档化
- [x] Dockerfile 包含 `src/` 与 `migrations/`
- [ ] 仓储层 `repos/*.js`（后续迭代：从 monolith 继续下沉 SQL）
- [ ] 核心税/登录单测可单跑（后续）

## 风险与回滚

- 行为应与切块前一致；若异常，回滚到切块前 commit，见阶段 0 [`07-rollback-drill.md`](../architecture-phase0/07-rollback-drill.md)。
- 金丝雀：优先验证登录、激活、税记录读写、支付宝回调、管理台登录。

## 下一阶段

阶段 2：管理端解耦（独立入口 / 拆分 `admin_panel.js` / 权限单一来源）。
