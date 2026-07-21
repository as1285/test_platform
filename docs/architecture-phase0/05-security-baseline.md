# 安全基线与下线计划

> 阶段 0：固化现状风险 + 启动告警；**不在本阶段强制关闭运营明文密码**（避免打断现网）。  
> 快照日期：2026-07-21

---

## 1. 当前风险清单

| ID | 风险 | 现状代码/配置 | 严重度 |
|----|------|----------------|--------|
| S1 | JWT 默认密钥 | `JWT_SECRET` 缺省 `dev-jwt-secret-change-in-production` | 高 |
| S2 | 管理端默认口令 | `ADMIN_PANEL_USER=admin` / `ADMIN_PANEL_PASSWORD=640810` | 高 |
| S3 | 注册存明文密码 | `REGISTER_STORE_PLAIN_PASSWORD` 默认开启（`!=0` 即开） | 高 |
| S4 | 用户与管理同域同站 | `geshui.vip` 上同时挂 C 端与 `admin_*.html` | 中 |
| S5 | Cordova 曾允许任意导航 | 已收紧为仅 `geshui.vip`（需重打包 APK 全量生效） | 中 |
| S6 | DB 默认密码出现在 compose 示例 | 依赖部署环境 `.env` | 中 |

---

## 2. 阶段 0 已落地

### 2.1 启动告警（`backend/server.js`）

进程启动时检测并 `console.warn`：

- 仍使用默认 `JWT_SECRET`
- 仍使用默认管理口令
- 明文密码存储开启

**不阻断启动**（避免误伤未改 env 的环境），但日志可被监控采集。

### 2.2 运维立即动作（人工，本周内）

1. 生产 `.env` 设置高强度 `JWT_SECRET`（设置后**所有用户需重新登录**）。  
2. 修改 `ADMIN_PANEL_PASSWORD`，并确认库内超级管理员哈希已同步（启动逻辑会按 env 对齐 root 管理员）。  
3. Cloudflare / 防火墙限制 `/admin_*.html` 与 `/api/admin/*` 来源 IP（若可行）。  
4. 确认生产未把 `.env` 提交进 git。

---

## 3. 明文密码下线计划（阶段 1–2）

| 步骤 | 内容 | 建议窗口 |
|------|------|----------|
| P1 | 管理台「查看密码」增加审计日志 + 二次确认 | 阶段 1 |
| P2 | 新注册默认 `REGISTER_STORE_PLAIN_PASSWORD=0`（生产 env 先切） | 阶段 1 |
| P3 | 管理台改为「重置密码」替代展示明文；保留临时一次性展示 | 阶段 2 |
| P4 | 数据迁移：清空历史 `plain_password` 列或整列 DROP | 阶段 2 末（需产品签字） |

**回滚**：env 改回 `REGISTER_STORE_PLAIN_PASSWORD=1` 仅影响**新写入**；已清空列不可自动恢复。

---

## 4. 管理端凭证策略

| 项 | 要求 |
|----|------|
| 超级管理员 | 仅 env + 库内一条；口令 ≥ 16 位随机 |
| 子账号 | 必须走 `admin-accounts` 菜单授权，禁止共用超管密码 |
| JWT | 管理 JWT 与用户 JWT 共用 `JWT_SECRET`（现状）；阶段 2 评估拆 `ADMIN_JWT_SECRET` |
| 登录限流 | 保持 `ADMIN_LOGIN_RATE_PER_IP_MIN` |

---

## 5. 阶段 1 安全门禁（PR 检查）

- [ ] 未在代码中新增默认密钥/口令字面量  
- [ ] 未扩大未激活用户可写范围  
- [ ] 支付回调仍校验签名  
- [ ] 管理接口均带 `requireAdminAuth` + 菜单门闸  

---

## 附录：相关环境变量

```bash
JWT_SECRET=
JWT_EXPIRES=7d
ADMIN_PANEL_USER=admin
ADMIN_PANEL_PASSWORD=
ADMIN_ACTIVATION_KEY=
REGISTER_STORE_PLAIN_PASSWORD=0   # 生产建议 0
```
