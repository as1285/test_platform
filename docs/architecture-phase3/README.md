# 架构重构 · 阶段 3：用户端前端现代化

> 状态：**已完成（设计系统壳 + 核心页接入 + content-hash 组装 + Dockerfile 收拢）**  
> 完成日期：2026-07-21  
> 主计划：[`../system-architecture-refactor-plan.md`](../system-architecture-refactor-plan.md)

## 目标

不整站 Vue SPA 重写；先建共享壳，核心页进统一构建管线，发版靠内容 hash。

## 本阶段产出

| 项 | 说明 |
|----|------|
| TaxApp 壳 | [`frontend/public/js/app/`](../../frontend/public/js/app/)：`ui` / `nav` / `core` |
| 壳样式 | [`frontend/css/app-shell.css`](../../frontend/css/app-shell.css) |
| 核心页接入 | `mine` / `shouye` / `consult` / `install_guide`（`TAX_APP_SHELL` 标记） |
| 构建管线 | `npm run build` → Vite + [`scripts/assemble-site.mjs`](../../frontend/scripts/assemble-site.mjs) → `site/` |
| content-hash | `js/app/core.<hash>.js` 等写入 `site/js/app/manifest.json`，核心页引用 hash 路径 |
| Dockerfile | 百余条 `COPY` 收拢为整站 `COPY site/` |
| Cordova | 仍为薄壳；白名单仅 `geshui.vip`；契约见下 |

## Cordova ↔ H5 契约（冻结）

| 项 | 约定 |
|----|------|
| 内容源 | `https://geshui.vip/`（iframe） |
| allow-navigation | 仅 `http(s)://geshui.vip/*` |
| UA 标记 | `TaxPlatformCordovaApp/1` |
| 外链 | H5 `TaxApp.shell.openExternal(url)` → Cordova `postMessage({type:'open-external'})` |
| 业务逻辑 | 不进 Cordova 原生层 |

## 退出标准核对

- [x] 设计系统壳（请求门面 / Toast / 底栏 hydrate）
- [x] 核心 4 页接入统一组装管线
- [x] 发版靠 content-hash（核心壳）；其余页仍可 `?v=` 渐进迁移
- [x] Dockerfile 不再手写上百 COPY
- [x] Cordova 白名单与薄壳契约文档化

## 本地构建

```bash
cd frontend && npm ci && npm run build
# 产物：frontend/site/
```

## 下一阶段

阶段 4：数据与增长治理（事件模型、热表归档、配置分层）。
