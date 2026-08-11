# 关键 API 契约快照

> 快照日期：2026-07-21  
> 机读清单：[`snapshots/api-surface.json`](./snapshots/api-surface.json)  
> 说明：以下为**行为契约摘要**，非 OpenAPI 全文。阶段 1 重构须保持兼容或显式版本化。

通用约定：

- 多数业务接口返回：`{ code: number, msg?: string, data?: any }`，成功 `code === 200`。
- 用户 JWT：`Authorization: Bearer <token>`；管理端：`admin_token`（见 `admin_auth.js`）。
- **规范路径**：`/api/auth`、`/api/user`、`/api/tax`、`/api/message`、`/api/feedback`、`/api/chat`、`/api/shenbao-jilu`（仓库前端已改用）。
- **兼容别名**：`/api/xxx.php` 与 `/xxx.php` 仍双挂，旧客户端可继续调用。

---

## 1. 健康检查

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/health`、`/api/health` | 无 | 探活 |

---

## 2. 鉴权 `/api/auth`

| action | 方法 | 鉴权 | 要点 |
|--------|------|------|------|
| `register_captcha` | GET | 无 | 验证码 |
| `register` | POST | 无 | 注册；可能写 `plain_password` |
| `login` | POST | 无 | 返回 JWT |
| `activate` | POST | 通常需登录 | 激活码 |
| `recover_by_activation_code` | POST | 无/弱 | 按激活码找回 |
| `admin_issue_code` | POST | 特殊密钥 | 兼容发码 |
| （status 类） | GET | 可选 Bearer | 会话状态 |

**登录请求示例：**

```json
{ "action": "login", "username": "demo_user", "password": "******" }
```

**登录成功 data（字段名以现网为准，阶段 1 勿删）：**  
`token`、用户摘要字段（`real_name`、`account_active`、`user_type` 等）。

---

## 3. 用户 `/api/user`

| action | 读写 | 说明 |
|--------|------|------|
| `summary` | 读 | 首页/我的摘要 |
| `save_profile` | 写 | 姓名/证件/地址/性别等 |
| `employers` / `add_employer` / `update_employer` / `delete_employer` | 读写 | 任职受雇 |
| `family_members` / `family_member` / 增删改 | 读写 | 家庭成员 |
| `bank_cards` / `add_bank_card` / `delete_bank_card` / `set_default_bank_card` | 读写 | 银行卡 |
| `special_deduction_records` 及增删改 | 读写 | 专项附加 |
| `change_password` | 写 | 改密（可同步 plain） |
| `track_*` | 写 | 埋点（未激活也可） |

未激活白名单：见 `requireAuthAndActivatedUnlessAllowed`（税演示、资料、埋点、反馈、客服、消息）。

---

## 4. 税务 `/api/tax`

| action | 说明 |
|--------|------|
| （GET 默认列表） | 当前用户税务记录 |
| `detail` / `calculation` | 明细与计算视图 |
| `save_record` / `add_record` | 单条保存 |
| `batch_save` / `batch_save_records` | 批量新增 |
| `batch_replace_records` | 删除指定 id + 写入新记录（咨询页一键生成） |
| `delete_record` / `delete_all_records` / `delete_records_by_year` / `delete_records_by_company` | 删除 |
| `deleted_records` | 回收站列表 |
| `restore_record` / `restore_all_deleted_records` / `restore_records_by_company` | 恢复 |
| `dedupe_records` | 去重 |
| `log_issue_application` | 开具类申请日志 |
| `delete_issue_application` | 删除开具申请记录 |

**批量覆盖请求骨架：**

```json
{
  "action": "batch_replace_records",
  "ids_to_delete": ["..."],
  "records": [{ "year": 2025, "month": 1, "income": 20000, "tax": 0, "company_name": "..." }]
}
```

---

## 5. 支付

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| GET | `/api/payments/alipay/config` | 用户 | 前端配置 |
| POST | `/api/payments/alipay/create` | 用户 | 创建订单 |
| GET | `/api/payments/alipay/latest` | 用户 | 最近订单 |
| POST | `/api/payments/alipay/notify` | 无（签名校验） | 支付宝回调 |

---

## 6. 公开增长 / 配置

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/public/mine-ui` | 我的页外观 |
| GET | `/api/public/install-packages` | 安装包链接 |
| GET | `/api/public/conversion-config` | 转化配置 |
| GET | `/api/public/landing-ab-config` | 落地 AB |
| GET | `/api/public/resolve-sales-channel` | 渠道解析 |
| POST | `/api/public/sales-channel-attribution` | 渠道归因 |
| POST | `/api/public/guest-session` | 游客沙盒会话 |

---

## 7. 其他用户 RPC

| 端点（规范） | 兼容别名 | 典型 action |
|--------------|----------|-------------|
| `/api/message` | `message.php` | `list`、`add_message`、`delete_message`、`mark_all_read` |
| `/api/feedback` | `feedback.php` | `list`、`config`、提交类 |
| `/api/chat` | `chat.php` | `thread`、`poll`、`send`、`mark_read`；上传 `POST /api/chat/upload-image` |
| `/api/shenbao-jilu` | `shenbao_jilu.php` | `list` / `get` / `save_record` 等申报记录 |

---

## 8. 管理端 REST（摘要）

完整列表见 `snapshots/api-surface.json` → `routes`。  
鉴权：`POST /api/admin/login` → Bearer admin JWT；菜单门闸 `requireAdminMenu` / `requireAdminAnyMenu`。

规范路径优先；`.php` 别名可继续调用。删除别名前须更新本快照与客户端。
