# 配置治理：app_settings vs 环境密钥

> 阶段 4 · 2026-07-21  
> 代码：`backend/src/shared/settingsPolicy.js`

## 分层

| 层 | 存放 | 示例 |
|----|------|------|
| 运营 / 内容 | `app_settings` | `mine_ui_json`、安装包 URL、A/B JSON、客服话术 |
| 密钥 / 凭据 | 环境变量 / 部署 Secret | `JWT_SECRET`、`ALIPAY_*`、`CHAT_AI_API_KEY`、`SMTP_PASS` |

## 允许写入 app_settings 的键（运营）

见 `OPS_SETTING_KEYS`：含 UI、安装包、闲鱼/QQ、转化/落地 AB、客服自动回复与 AI **开关/提示词**（提示词不是 API Key）。

## 禁止写入（env-only）

`JWT_SECRET`、`ADMIN_PANEL_PASSWORD`、`ADMIN_ACTIVATION_KEY`、`DB_PASSWORD`、`SMTP_PASS`、`ALIPAY_*`、`CHAT_AI_API_KEY`、`REGISTER_APP_SIGN_SECRET` 等。

`upsertAppSetting` / `classifySettingKey` 会拒绝密钥类键名（含 `password`/`token`/`private_key`/`api_key` 等模式）。

客服 `ai_prompt`：若内容疑似 PEM/`sk-`/Bearer，接口返回 `warnings: ['ai_prompt_looks_like_secret']` 并打日志（仍保存文案，避免误伤示例）。

## 明文密码（用户表）

与 `app_settings` 无关：`users.plain_password` 由 `REGISTER_STORE_PLAIN_PASSWORD` 控制。  
生产建议 `REGISTER_STORE_PLAIN_PASSWORD=0`，见阶段 0 [`05-security-baseline.md`](../architecture-phase0/05-security-baseline.md)。
