# 同机双域名

| 角色 | 域名 | 说明 |
|------|------|------|
| 新主站（你） | `https://getjob68.club`（及 `www`） | 日常投放、改版；DNS/证书就绪后把 `PUBLIC_SITE_URL` 切过来 |
| 代理入口 | `https://lkj.qiyun888.top` | 代理专属 `ch=` 链接；少动 |
| 管理后台 | 任一域名下的 `admin_panel.html` | **同一套后台**，用账号区分超管/代理 |
| 支付宝 | 共用一套 | `ALIPAY_NOTIFY_URL` 暂仍指向 lkj；商户后台白名单加上新域名后再切 |

服务器、分支、数据库不变。Nginx `server_name _` 接受多 Host。

## 上线步骤

1. **注册商**：确认域名已实名；**DNS 服务器（NS）** 指向你正在改解析的那套 DNS；`@` / `www` 的 A 记录 → `103.106.188.166`  
2. 本机验证：`dig +short getjob68.club A` 应返回 `103.106.188.166`（不能是空或 NXDOMAIN）  
3. 申请证书：`./scripts/obtain-letsencrypt-dual-domain.sh`  
4. `docker compose exec frontend nginx -s reload`  
5. 浏览器打开 `https://getjob68.club`、`https://lkj.qiyun888.top` 均应正常  
6. 切主站默认链接（可选）：`.env` 里  
   `PUBLIC_SITE_URL=https://getjob68.club`  
   `APP_URL=https://getjob68.club`  
   然后 `./scripts/deploy.sh`  
7. 支付宝开放平台：回跳/授权域名加上 `getjob68.club`；稳定后把 `ALIPAY_NOTIFY_URL` 改到新主站  

## 当前仓库已就绪

- `.env` → `SITE_TRUSTED_HOSTS` 已含新旧域名  
- `scripts/obtain-letsencrypt-dual-domain.sh` → 一份证书覆盖四个 Host  

新功能若要对代理隐藏：按 Host / `ch=` 做开关（见逻辑隔离文档），不必拆服务器。
