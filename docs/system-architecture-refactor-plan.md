# 系统架构重构计划

> 文档位置：`docs/system-architecture-refactor-plan.md`  
> 适用仓库：`test_platform`（个税 H5 模拟平台）  
> 状态：规划稿（未开始大规模实施）  
> 更新日期：2026-07-21

---

## 1. 目标与原则

### 1.1 目标

在**不中断现网业务**的前提下，降低单体耦合、提升可维护性与发版安全，使税核心、激活/支付、增长归因、管理后台可独立演进。

### 1.2 原则

- **先模块化同仓，再按需拆进程**（避免一上来微服务运维爆炸）。
- **用户端与管理端分离部署/域名**（降低 Cookie/JWT 面、独立发版）。
- **契约优先**：统一 REST（或保留兼容层），淘汰对内强依赖 `*.php?action=`。
- **Schema 单一来源**：迁移工具替代启动时一长串 `ALTER`。
- **分阶段、可回滚**：兼容层 + feature flag + 金丝雀回归清单。

### 1.3 明确不做 / 慎做

| 慎做 | 原因 |
|------|------|
| 一次性重写全部 H5 为 Vue SPA | 业务页多、Cordova/机型适配多，回归成本爆炸 |
| 一上来上 K8s/微服务全家桶 | 当前单机 Docker Compose 已够用，先模块化 |
| 把计税口径改动当成「重构」 | 计税是产品正确性，应有金样例测试单独保护 |
| 同时改激活漏斗 + 税核心 | 两条高风险链路不要同迭代 |

---

## 2. 现状摘要

业务主要挤在：

- 后端：`backend/server.js`（约 1.9 万行单体）
- 前端：数十个静态 HTML + `public/js/auth.js` / `admin_panel.js`
- 部署：Docker Compose（`db` + `backend` + `frontend`）+ Cloudflare Flexible（源站 HTTP:80）
- 壳：`cordova-app` WebView 加载 `https://geshui.vip`

税、激活、支付、增长归因、管理后台同一进程、同库、同域名部署。

### 2.1 现状架构示意

```text
[ H5 / Cordova / admin_panel ]
            |
      Cloudflare Flexible
            |
        nginx :80
            |
     Express server.js  ----->  MySQL 8
```

### 2.2 主要技术债

1. **`server.js` 巨石**：税、鉴权、管理分析、支付、客服、迁移同文件。
2. **双轨 API 风格**：`*.php?action=` RPC 与 `/api/admin/*` REST 并存。
3. **Schema 漂移**：`schema.sql` 与启动时 `ALTER` 不一致。
4. **MPA + 手写 `?v=`**：无统一构建管线；Vue/Vite 脚手架基本未用于真页面。
5. **管理台巨型 JS/HTML**：与 C 端同域同发版，菜单权限前后端双份。
6. **安全债**：明文密码能力、默认弱密钥风险、管理端与用户端同域。
7. **增长归因散落**：guest / AB / 渠道 / 安装埋点贯穿 `auth.js` 与后端。
8. **单进程限流与缓存**：多副本不友好。

---

## 3. 目标架构

```text
[ 用户 H5 / Cordova ]          [ 管理端独立应用 ]
            \                    /
             Cloudflare + nginx
                      |
     +----------------+----------------+
     |     |     |         |     |     |
   auth  user  tax   payments growth admin-bff chat
                      |
                 MySQL（逻辑分区/只读副本可选）
                 + uploads / 对象存储
```

### 3.1 域边界（同仓模块，可先同进程）

| 模块 | 边界 |
|------|------|
| `auth` | 注册/登录/JWT/激活码/会话吊销 |
| `user` | 资料、任职、家人、银行卡、专项附加 |
| `tax` | 税务记录 CRUD、批量生成、计税、软删回收站 |
| `payments` | 支付宝下单/回调/订单 |
| `growth` | 安装页、AB、渠道归因、埋点写入 |
| `admin` | `/api/admin/*` BFF，只编排不塞业务细节 |
| `chat` | 客服/反馈/可选 AI |
| `platform` | 健康检查、限流、监控、日志清理、设置读取 |

---

## 4. 分阶段实施计划

### 阶段 0：冻结与基线（约 1 周）

| 事项 | 产出 |
|------|------|
| 盘点核心链路 | 登录/激活 → 税记录生成 → 明细展示 → 支付/激活码 → 安装漏斗 |
| 契约快照 | 关键 API 请求/响应样例 + 管理台菜单权限表 |
| 可观测性 | 错误率、慢接口、核心转化漏斗仪表盘固定 |
| 安全基线 | 去掉默认弱密钥依赖；`plain_password` 下线计划；管理端强制独立凭证 |

**退出标准**：有回滚演练；生产有「金丝雀」账号回归清单。

---

### 阶段 1：后端切块（约 2–4 周）——收益最大

把 `server.js` 按域拆成同仓模块（仍一个进程）：

- 路由层：对外保留 `/api/auth.php` 等兼容别名 → 内部转新 handler。
- 迁移：引入 `migrations/`（knex / prisma / flyway 等任选其一），冻结 `initDatabase` 里新增 ALTER。
- 仓储层：禁止 handler 里散落 SQL；按域 `repos/*.js`。

**建议目录形态（示意）：**

```text
backend/
  server.js                 # 仅装配与启动
  src/
    auth/
    user/
    tax/
    payments/
    growth/
    admin/
    chat/
    platform/
    shared/                 # db pool、jwt、errors、logger
  migrations/
```

**退出标准**：`server.js` 只做装配；核心税/登录测试可单跑；行为与线上一致。

---

### 阶段 2：管理端解耦（约 2–3 周）

| 事项 | 说明 |
|------|------|
| 管理端独立入口 | `admin.geshui.vip` 或路径隔离 + 更严 CSP |
| 拆分 `admin_panel.js` | 按菜单懒加载（用户、激活码、转化、税务、客服、系统） |
| 菜单权限单一来源 | 后端下发权限树，前端不再硬编码双份 |
| 只读分析库（可选） | 重报表走只读副本，避免拖垮业务库 |

**退出标准**：改用户端税页不强制重发管理台大包；管理台发版可独立。

---

### 阶段 3：用户端前端现代化（约 3–6 周，可并行）

不要一次把全部页面 Vue 化。建议：

1. **建设计系统壳**：布局、导航、请求层、鉴权、Toast（可从现有 `auth.js` 抽出 SDK）。
2. **按流量迁移**：`mine` / `shouye` / `consult`（税）/ `install_guide` 优先。
3. **其余页**：先壳内兼容或逐步替换；Dockerfile 不再手写上百个 COPY。
4. **Cordova**：继续薄壳；导航白名单保持仅 `geshui.vip`；壳版本与 H5 契约测试固定。

**退出标准**：核心 4–5 页进统一构建管线；缓存/发版靠内容 hash，不再靠手写 `?v=`。

---

### 阶段 4：数据与增长治理（约 2–3 周）

| 事项 | 说明 |
|------|------|
| 事件模型统一 | 页面浏览 / 转化 / API 慢日志 schema 文档化 |
| 热表归档 | 埋点、API 日统计按保留策略分区或冷热分离 |
| 配置中心 | `app_settings` 分层：运营配置 vs 密钥（密钥进环境/密钥管理） |
| 上传资产 | `uploads` 明确走对象存储或独立卷策略 |

---

### 阶段 5：可选「真拆服务」（按需，约 4+ 周）

仅在出现以下情况再拆进程：

- 税批量计算拖垮登录/支付；
- 管理报表与 C 端争抢连接池；
- 需要独立扩缩容。

**优先拆：** `payments`（合规/回调）、`growth` 写入（高峰）、`admin` 报表只读。

---

## 5. 风险与回滚

- **兼容层**：旧 `*.php?action=` 至少保留 1–2 个大版本周期。
- **双跑**：新模块 handler 与旧逻辑可用 feature flag 切换。
- **DB**：只前进迁移；禁止「重构顺手改字段语义」。
- **发版**：继续 `./scripts/deploy.sh`；模块化后可 `DEPLOY_SERVICES=backend` 灰度。
- **计税**：单独建立金样例（工资累计预扣、年终奖单独计税）回归，与架构迁移解耦。

---

## 6. 建议优先级（若资源有限）

1. **拆 `server.js` 域模块 + 迁移规范化**
2. **管理端与用户端发版/域名分离**
3. **税链路抽 SDK + 契约测试（金样例）**

---

## 7. 待决策项

实施前需产品/运维拍板：

1. **管理端**：同域加深隔离，还是独立子域（如 `admin.geshui.vip`）？
2. **前端**：继续 MPA 渐进，还是核心页强制上 Vue/Vite？
3. **目标时限**：偏「3 个月稳态改造」还是「6 个月可拆服务」？
4. **是否保留** `plain_password` / 运营查看明文密码能力（安全与运营冲突）？

决策记录建议追加到本文「附录 A」。

---

## 8. 相关路径速查

| 类别 | 路径 |
|------|------|
| 后端入口 | `backend/server.js` |
| 后端依赖 | `backend/package.json` |
| 前端页面 | `frontend/*.html` |
| 共享 JS | `frontend/public/js/` |
| Nginx | `frontend/nginx.conf` |
| Compose | `docker-compose.yml` |
| 部署脚本 | `scripts/deploy.sh` |
| Cordova | `cordova-app/` |
| 既有文档 | `docs/` |

---

## 附录 A：决策记录

| 日期 | 议题 | 结论 | 记录人 |
|------|------|------|--------|
| （待填） | 管理端域名策略 |  |  |
| （待填） | 前端技术路线 |  |  |
| （待填） | 改造时限 |  |  |
| （待填） | 明文密码策略 |  |  |

---

## 附录 B：阶段 1 建议首批迁移 API（草案）

以下仍走兼容路径，但实现迁入对应模块：

1. **auth**：`register` / `login` / `activate` / `status`
2. **tax**：`records` 列表、单条增删改、批量生成/覆盖、回收站
3. **user**：`summary` / `save_profile` / `employers` / `bank_cards`
4. **payments**：`alipay/create` / `notify` / `latest`
5. **growth**：`install-packages`、安装页与转化相关 public API

具体拆分任务清单在阶段 0 完成后单独成文（可新增 `docs/architecture-phase1-tasks.md`）。
