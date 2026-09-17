# 配置治理：app_settings vs 环境密钥

> 阶段 4 · 2026-07-21  
> 代码：`backend/src/shared/settingsPolicy.js`

## 分层

| 层 | 存放 | 示例 |
|----|------|------|
| 运营 / 内容 | `app_settings` | `mine_ui_json`、安装包 URL、A/B JSON |
| 密钥 / 凭据 | 环境变量 / 部署 Secret | `JWT_SECRET`、`ALIPAY_*`、`SMTP_PASS` |

## 允许写入 app_settings 的键（运营）

见 `OPS_SETTING_KEYS`：含 UI、安装包、闲鱼/QQ、转化/落地 AB 等运营配置。

## 禁止写入（env-only）

`JWT_SECRET`、`ADMIN_PANEL_PASSWORD`、`ADMIN_ACTIVATION_KEY`、`DB_PASSWORD`、`SMTP_PASS`、`ALIPAY_*`、`REGISTER_APP_SIGN_SECRET` 等。

`upsertAppSetting` / `classifySettingKey` 会拒绝密钥类键名（含 `password`/`token`/`private_key`/`api_key` 等模式）。

## 封机后密钥不可取回

生产 `.env` 禁止进 git。源站被封时本机文件一起没。用 `scripts/backup-env.sh` 把 **AES-256 密文**寄到告警邮箱（可选再上 COS `…/env/`）；解密口令只放在 `/root/.env-backup-passphrase` 和你自己的密码管理器。恢复步骤见 [`docs/env-recovery.md`](../env-recovery.md)。

## 明文密码（用户表）

与 `app_settings` 无关：`users.plain_password` 由 `REGISTER_STORE_PLAIN_PASSWORD` 控制。  
生产建议 `REGISTER_STORE_PLAIN_PASSWORD=0`，见阶段 0 [`05-security-baseline.md`](../architecture-phase0/05-security-baseline.md)。
