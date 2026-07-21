# 核心业务链路盘点

冻结对象：以下链路在阶段 1+ 重构中须保持行为兼容（除非产品明确变更）。

---

## F1 · 注册 / 登录 / 会话

| 项 | 说明 |
|----|------|
| 页面 | `index.html`（登录）、`register.html` |
| API | `POST /api/auth`：`register` / `login` / `register_captcha`；`GET /api/auth` 状态类（兼容 `/api/auth.php`） |
| 鉴权 | JWT → `localStorage.token`；`authFetch` 带 `Authorization` |
| 关键表 | `users`（含 `session_rev`、`user_type`、`plain_password` 等） |
| 风险点 | 注册守卫 `register-guard.js`；游客类型 `user_type=2`；同设备归因 |

**成功判据**：注册成功进 `mine.html`；登录后受保护页可拉 `user/summary`。

---

## F2 · 激活码激活（去水印 / 正式能力）

| 项 | 说明 |
|----|------|
| 页面 | `mine.html` / `consult.html` / `purchase.html` 激活弹窗 |
| API | `POST /api/auth` `action=activate`；管理端发码 `POST /api/admin/issue-code` |
| 支付可选 | `POST /api/payments/alipay/create` → 回调 `notify` → 业务侧发码/激活 |
| 关键表 | `activation_codes`、`payment_orders`、`payment_notify_logs` |
| 风险点 | 未激活仍可写税演示（白名单 action）；激活改变 `account_active` 与 JWT `act` |

**成功判据**：有效码激活后水印消失、`account_active=1`，管理台可见激活记录。

---

## F3 · 税务记录生成与展示

| 项 | 说明 |
|----|------|
| 页面 | `consult.html`（批量/粘贴导入）、`shuiming.html` / `shuiming_result.html`、`xiangqing.html` |
| API | `GET/POST /api/tax`：`list` 隐式 records、`save_record`、`batch_save_records`、`batch_replace_records`、软删/恢复等 |
| 计税 | 服务端累计预扣 + 年终奖单独计税（`consult.html` 本地预览与写入） |
| 关键表 | `tax_records`（含软删字段） |
| 风险点 | 大批量写入、按公司去重、粘贴导入摘要模式税额重算 |

**成功判据**：一键生成后收入纳税明细可见；回收站可恢复。

---

## F4 · 个人信息 / 任职 / 银行卡

| 项 | 说明 |
|----|------|
| 页面 | `gerenxinxi.html`、`renzhi.html`、`yhk*.html`、`consult.html` 粘贴个人信息 |
| API | `/api/user`：`summary`、`save_profile`、`employers*`、`bank_cards*`、家人与专项附加 |
| 关键表 | `users` 扩展地址字段、`employers`、`bank_cards`、`family_members` 等 |

**成功判据**：资料保存后刷新仍在；银行卡列表与默认卡正确。

---

## F5 · 安装漏斗与增长归因

| 项 | 说明 |
|----|------|
| 页面 | `install_guide.html`、落地 AB / 游客沙盒 |
| API | `/api/public/install-packages`、`guest-session`、`landing-ab-config`、`conversion-config`、渠道归因；`/api/user` / 公开埋点 `track_*` |
| 关键表 | `install_guide_track_events`、设备/访客相关表、渠道字段 |
| 管理台 | 安装页统计、转化分析、渠道分析 |

**成功判据**：浏览→下载→打开→注册漏斗在管理台有数；`client_id` 可串联。

---

## F6 · 消息 / 反馈 / 在线客服

| 项 | 说明 |
|----|------|
| 页面 | `message.html`、`consult` 反馈、`chat.html` |
| API | `/api/message`、`/api/feedback`、`/api/chat`（兼容原 `*.php`） |
| 管理台 | feedback / chat 菜单 |

**成功判据**：用户发反馈/客服消息后管理端可见并可回复。

---

## F7 · 管理后台运营闭环

| 项 | 说明 |
|----|------|
| 页面 | `admin_login.html`、`admin_panel.html` |
| API | `/api/admin/*`（独立 admin JWT） |
| 能力 | 发码、用户管理、设置（安装包/外观）、分析报表、监控 |

**成功判据**：超级管理员可发码、改安装包链接、查看 API 统计与转化 KPI。

---

## 链路优先级（回归时）

1. F1 → F3（未激活也可演示税）  
2. F2 → F3（激活后完整）  
3. F5（增长）  
4. F4 / F6 / F7
