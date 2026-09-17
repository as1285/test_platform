# 部署配置（lkj / 国内机）

## 一键部署

```bash
git clone -b lkj git@github.com:as1285/test_platform.git
cd test_platform
# 新机优先从邮箱密文恢复，不要只靠手抄：
#   ./scripts/restore-env.sh ~/env-YYYYMMDD-HHMMSS.enc .env
# 没有密文时才：
cp .env.example .env
# 编辑 PUBLIC_SITE_URL / APP_URL，例如 https://lkj.qiyun888.top
./scripts/deploy.sh
```

封机后密钥恢复见 [`docs/env-recovery.md`](../docs/env-recovery.md)。

## Docker 国内加速（推荐）

宿主机：

```bash
sudo mkdir -p /etc/docker
sudo cp deploy/docker-daemon.json.example /etc/docker/daemon.json
sudo systemctl restart docker
```

`docker-compose.yml` 与前后端 `Dockerfile` 已默认使用 DaoCloud 基础镜像 + 阿里云 apt/PyPI + npmmirror。

内存较小（≤4G）打包/构建后端时建议加 swap，或临时 `docker compose stop` 再 `build`。

## 安装包恢复

见仓库根目录 `install-packages/README.md`。

## HTTPS

```bash
certbot certonly --webroot -w ./certbot-webroot -d your.domain \
  --agree-tos --register-unsafely-without-email
cp -L /etc/letsencrypt/live/your.domain/fullchain.pem certs/active-fullchain.crt
cp -L /etc/letsencrypt/live/your.domain/privkey.pem certs/active-privkey.key
docker compose exec frontend nginx -s reload
```

勿提交 `.env`、支付宝私钥、JWT 等密钥。
