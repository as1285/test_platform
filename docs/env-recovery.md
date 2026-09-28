# ENV 封机恢复

> 目的：源站被封、磁盘拿不回时，仍能在新机器把 `.env` 配回去。  
> 密文可以进邮箱 / COS；**解密口令必须另存**（密码管理器或手机备忘录），不要和密文放在同一封邮件。

## 为什么单独做

- `.env` 已 gitignore，代码仓库里没有密钥。
- 本机 `data/db-backups/` 和未加密的 `.env` 都在同一台机器上，封机后一起没。
- 支付宝**应用私钥**开放平台不回显；旧机没了只能重配密钥，旧验签会断。
- SMTP、管理口令、JWT、COS 也只在 `.env`。

## 日常（这台机器）

```bash
# 改完 .env 立刻跑一次（有变更才会再寄邮件）
./scripts/backup-env.sh

# 看上次是否寄出、哈希、cron
./scripts/backup-env.sh --status

# 装每 6 小时检查（dr-install.sh 也会装）
./scripts/backup-env.sh --install-cron
```

- 密文目录：`data/env-backups/env-*.enc`（已 gitignore）
- 口令文件：`/root/.env-backup-passphrase`（不在仓库里）
- 邮件主题：`[灾容][域名] ENV 加密备份`
- 附件：`.enc` + `.json`（只有键名清单，没有明文）

改口令：覆盖 `/root/.env-backup-passphrase` 后执行 `./scripts/backup-env.sh --force`，并更新你自己的离机副本。

## 新机器恢复

1. 从 QQ 邮箱（或 COS `…/env/`）下载最新 `env-YYYYMMDD-HHMMSS.enc`
2. 把口令写到 `/root/.env-backup-passphrase`（与旧机同一串，含连字符）
3. 拉代码后：

```bash
cd /root/test_platform
chmod 600 /root/.env-backup-passphrase
./scripts/restore-env.sh ~/env-YYYYMMDD-HHMMSS.enc .env
./scripts/deploy.sh
```

也可用环境变量，不落口令文件：

```bash
ENV_BACKUP_PASSPHRASE='你的口令' ./scripts/backup-env.sh --decrypt ~/env-xxx.enc .env
```

4. 核对清单里的关键项：`ALIPAY_*`、`SMTP_*`、回调域名仍用域名不要写新 IP。
5. 支付宝开放平台若开了 IP 白名单，加上新机器出口 IP。

## 不要做的事

- 不要把明文 `.env` 提交进 git
- 不要把口令写进密文那封邮件
- 不要只依赖本机 `data/env-backups/`（封机后同样拿不到）
- COS 未配时，**邮箱是唯一离机副本**；收件箱不要清空灾容邮件
