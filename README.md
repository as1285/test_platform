# 个税记录平台（个人所得税 APP 界面模拟器）

> **演示软件**，用于学习演示、界面参考、技术交流。

> **重要说明**
> 本软件**非**国家税务总局或手机应用商店中的「个人所得税」官方客户端，**不具备**真实申报、缴税、完税等税务功能。请勿用于误导他人或任何违法违规用途。

---

## 下载安装

| 端 | 安装方式 |
|----|----------|
| **安卓 / Android 版** | 下载 [Android 安装包](https://www.installguide1.top/)；下载完成后按提示安装。若系统提示「未知来源」，请在设置中允许本次安装。 |
| **苹果 iOS 版** | 下载 [iOS 描述文件](https://www.installguide1.top/)，安装后请到 **设置 → 通用 → VPN 与设备管理** 中信任描述文件。 |
| **PC 版** | 电脑先安装 [雷电模拟器](https://www.ldmnq.com/)（或其它 Android 模拟器），在模拟器内安装上述 **Android 安装包** 即可使用。 |

**已安装过旧版本的用户：** 打开 APP → **我的** → **关于&更新** → **安装包和使用方法**，可再次下载安装包或查看教程。

**安装页地址（安卓 / iOS 通用）：**

https://www.installguide1.top/

---

## 使用方式

1. **安装**
   按上一节完成 Android / iOS / 模拟器安装后，打开 APP（桌面图标一般为「个人所得税」演示应用）。

2. **注册账号**
   首次使用按页面提示完成注册；安装页提供 **「装好后点这里注册」** 入口。注册页会说明：本应用为界面演示，非官方申报渠道。

3. **激活**
   新账号需 **激活** 后方可完整使用：
   - 注册成功后会引导至 **「我的」** 激活；在 **「我的」** 页点击 **「激活」** 进入购买页；
   - **支付宝**：扫码付款成功后自动开通当前账号；
   - 或通过 **微信 / 闲鱼 / 酷发卡** 等渠道购买激活码，回到购买页顶部粘贴并确认；
   - 激活成功后会引导至 **税务记录** 添加演示数据。

4. **维护演示数据（办税相关）**
   - 进入 **「我的」→「我要咨询」**，打开 **税务记录** Tab；
   - 可展开 **「个税计算表与公式」** 查看累计预扣 / 年终奖税率表与快速试算；
   - 在 **「批量添加」** 中填写工作经历、月薪、社保与专项附加等，点 **「一键生成税务记录」** 后可在 **「收入纳税明细」** 查看；
   - 快捷入口：**从已有记录回填**、**粘贴导入**、**示例填写**；
   - 生成成功后可按提示前往 **收入纳税明细** 或 **纳税记录开具** 查看效果；数据可随时在「我要咨询」中修改或删除。

5. **修改姓名、税号、性别**
   在 **「我的」** 页点击姓名 / 纳税人识别号区域，在弹窗中修改后点 **保存**。

6. **查看收入与税额**
   从首页或 **办&查** 进入 **收入纳税明细**，选择年度与条目即可查看详情。

---

## 演示视频

- **苹果安装视频**：说明 iPhone / iPad 如何安装描述文件。
- **操作视频**：说明 APP 基本用法。

以上视频均在 **「安装包和使用方法」** 页面中播放；安装 APP 后也可从 **我的 → 关于&更新** 进入该页观看。

---

## 常见问题

**打不开安装页？**
请确认网络正常，并使用卖家最新提供的完整链接（勿漏写 `https://`）。

**安卓提示无法安装？**
请允许「安装未知应用」权限；若仍失败，可删除旧版后重新下载安装包。

**iOS 安装后找不到图标？**
请按安装页 **苹果安装视频** 完成描述文件信任步骤。

**提示未激活？**
请在 **「我的」→「激活」** 输入有效激活码；激活码由购买渠道提供，本仓库不提供官方税务服务。

**无法购买或需要人工协助？**
请在 APP 内按提示添加客服 QQ，或通过 **闲鱼 / 酷发卡** 等购买渠道联系卖家（以 APP 内展示与卖家说明为准）。

---

## 内部文档

- [用户转化与留存规划](docs/user-conversion-plan.md)（下载 → 安装 → 注册 → 激活 → 填个税 → 留存；含 P0–P5 路线图与埋点速查）

## 开发与部署（维护者）

本仓库为**私有源码**，含前端静态页、`backend/` Node API、MySQL 与 Docker Compose。

### 项目概况

| 项 | 数量 / 说明 |
|----|-------------|
| **源码规模** | **216** 个源文件、约 **9.1 万** 行代码（`cloc`，不含 `node_modules`、Cordova 编译产物、`package-lock.json`、JSON/SVG） |
| **前端页面** | **59** 个 HTML 页面（`frontend/*.html`） |
| **后端** | 薄入口 `backend/server.js` → `src/bootstrap.js`；域路由见 `src/{auth,user,tax,payments,admin,...}/` |
| **数据库** | `backend/schema.sql` + `backend/migrations/`（启动时由 migrate 运行） |
| **GitHub Actions** | 2 个工作流：Android APK、iOS 打包 |
| **运维脚本** | `deploy.sh`、`backup-mysql.sh`、`import-mysql-dump.sh` 等 |

### 代码规模（按语言，2026-07-24）

| 语言 | 文件 | 代码行 |
|------|------|--------|
| JavaScript | 83 | 56,184 |
| HTML | 59 | 27,537 |
| CSS | 9 | 3,135 |
| Markdown | 20 | 1,341 |
| Shell | 14 | 875 |
| Python | 3 | 696 |
| SQL | 14 | 459 |
| 其它（YAML/XML/TS/Vue/Dockerfile 等） | 14 | 约 889 |
| **合计** | **216** | **91,116** |

按目录（含空白/注释外的 code）：`frontend/` ≈ 6.2 万 · `backend/` ≈ 2.7 万 · `docs/` / `scripts/` / 其它约占余量。

核心路径：`backend/src/legacy/monolith.js`、`frontend/public/js/admin_panel.js`、`frontend/consult.html`（样式/逻辑已拆至 `css/consult.css`、`js/consult-*.js`）、`frontend/public/js/auth.js`、`frontend/purchase.html`。

### 技术栈

| 层 | 技术 |
|----|------|
| 前端 | 静态 HTML/CSS/JS，多页应用，主题可配置；底栏预取 / JS 强缓存加速切页 |
| 后端 | Node.js（Express）；域路由模块化，对外仍兼容 `*.php?action=` |
| 数据库 | MySQL 8.0（库名 `personal_tax`） |
| 部署 | Docker Compose（`frontend` + `backend` + `db`） |
| 移动端 | Cordova（Android / iOS WebView 壳）；支付外链经壳 `InAppBrowser` / Intent 打开 |
| 支付 | 支付宝当面付（`alipay-sdk` → `alipay.trade.precreate` 扫码） |

### 常用命令

| 操作 | 命令 |
|------|------|
| 一键部署 | `./scripts/deploy.sh`（需 Docker，访问 `docker.sock`） |
| 仅部署前端/后端 | `DEPLOY_SERVICES="frontend backend" ./scripts/deploy.sh` |
| 本地备份数据库 | `./scripts/backup-mysql.sh` → `data/db-backups/`（整库 `personal_tax`，每 2 小时、保留 24h / 最多 12 份） |
| 导入 SQL 备份 | `./scripts/import-mysql-dump.sh /path/to/dump.sql` |
| 转化引导脚本 | `frontend/public/js/conversion-guide.js`（由 `auth.js` 注入） |

### 管理后台能力

入口：`/admin`、`/admin/login`、`/admin/panel`（亦可 `admin_login.html` / `admin_panel.html`）；菜单权限由后端 `menuRegistry` 下发，前端按菜单懒加载。

主要模块：

- **激活码**：单码生成；超管可 **按渠道批量生成**（内置闲鱼 / 酷发卡，可自定义渠道），导出 TXT；列表可按渠道 / 归属管理员筛选
- **用户管理**：注册/删除/封禁、激活、**修改密码**、退款；列表展示 **上线**（激活码 `owner_admin_username`）
- **数据统计**：注册转化率、7 日漏斗、渠道分析、安装页统计、API 调用 / 用户接口 5xx
- **用户数据**：扣缴义务人分析、工资分布、未填个税行为导出
- **在线客服**：会话回复、固定话术、可选 AI 自动回复
- **引导安装**：APK / 描述文件、代理推广链接；落地页 A/B
- **系统设置**：转化 A/B、外观主题、QQ / 收款码

### 架构重构文档

- [总计划](docs/system-architecture-refactor-plan.md)
- [阶段 0 基线](docs/architecture-phase0/README.md)
- [阶段 1 后端切块](docs/architecture-phase1/README.md)（已完成）
- [阶段 2 管理端解耦](docs/architecture-phase2/README.md)（已完成；可选 DNS：`admin.geshui.vip`）

### 近期产品要点（2026-07）

- **安装引导页**：首屏精简；`?download=1` 聚焦下载
- **咨询 · 税务记录**：工具栏降噪、空状态 / 折叠、成功后滚到列表；样式与脚本拆分为 `consult.css` + `consult-core/batch-tax/records.js`
- **咨询页入口精简**：去掉「在线客服」Tab；登录成功后不再弹操作教程引导
- **批量激活码多渠道**：闲鱼 / 酷发卡 / 自定义；备注「渠道名+批量」
- **游客 / 落地漏斗**：落地 A/B、游客样例数据（见 `docs/user-conversion-plan.md`）
- **支付宝当面付**：购买页扫码；付款成功自动开通；自动发卡归属 **admin（上线）**；酷发卡渠道激活码同样归属 admin
- **C 端跳转加速**：`/js/` 强缓存（`?v=` 换版本）、HTML 短缓存 + SWR、底栏预取 / Speculation Rules、`fast-nav.js`
- **Cordova 支付兼容**：禁止用 `location.href` 打开支付宝页（防回 App 白屏）；华为等机型用 Intent + 包名唤起；QQ / 酷发卡等外链经壳打开，失败则复制链接提示
- **管理端在线客服 AI**：OpenAI 兼容协议；人工介入可暂停 / 恢复（见下节；C 端客服入口已下线）

### 数据库备份

- **本机**：cron 每 2 小时执行 `./scripts/backup-mysql.sh` → `data/db-backups/personal_tax-*.sql.gz`（安装：`./scripts/backup-mysql.sh --install-cron`；最多保留 1 天 / 12 份）
- **内容**：整库 `personal_tax`（用户/个税记录/激活码/埋点/管理端/支付与客服等表；含 routines/triggers），不含系统库与前端静态资源
- **保留**：**24 小时**、最多约 50 份
- GitHub Actions 远端每日备份已取消

> 完整生产库 **不建议** commit 进 Git；本地备份目录 `data/db-backups/` 已加入 `.gitignore`。

环境变量与数据库初始化见 `docker-compose.yml`、`.env.example` 及 `backend/` 内说明；勿将 `.env`、凭据提交入库。

### 多域名 / 多服务器

- **lkj.qiyun888.top（本机）**：长期跟踪 GitHub 分支 **`lkj`**，与 **`master`** 分开演进与部署。
- 其他站点若仍共用主线，可继续跟踪 `master`，仅用本机 `.env` 区分域名。

本机（lkj）日常更新：

```bash
# .env 中已设 DEPLOY_BRANCH=lkj
./scripts/pull-and-deploy.sh
```

仅重建容器（不拉代码）：

```bash
./scripts/deploy.sh
```

新建机器若要挂同一域名线：

```bash
git clone git@github.com:as1285/test_platform.git
cd test_platform
git checkout lkj
cp .env.example .env
# 编辑 PUBLIC_SITE_URL / APP_URL / DEPLOY_BRANCH=lkj
./scripts/deploy.sh
```

- 前端：`scripts/render-site-config.sh` 生成 `site-config.js`（分享链接 / 受信 Host）
- 后端：读取 `PUBLIC_SITE_URL`、`SITE_TRUSTED_HOSTS`
- Nginx：`server_name _` 接受任意 Host；直连 HTTPS 可参考 `docker-compose.override.example.yml`
- Cordova 壳内 `APP_ORIGIN` 仍需按渠道打包时修改（与 H5 多域名无关）

### 在线客服 AI 自动回复

默认关闭。在管理控制台「在线客服」中可开启 AI，并编辑系统提示词。API 密钥**仅**通过服务器 `.env` 配置（OpenAI 兼容协议，默认 DeepSeek）：

```dotenv
CHAT_AI_API_KEY=你的密钥
CHAT_AI_BASE_URL=https://api.deepseek.com
CHAT_AI_MODEL=deepseek-chat
```

- 开场欢迎语仍为固定话术；用户发消息后优先走 AI，失败时回退到固定自动回复。
- 人工客服发送消息后该会话会暂停 AI（可点「恢复 AI」重新启用）。
- 不要将 `CHAT_AI_API_KEY` 写入后台设置或提交到 Git。

### 支付宝自动开通

支付功能默认关闭。启用时仅在服务器未提交的 `.env` 或部署平台 Secret 中配置以下变量，然后重新部署后端。需在开放平台开通 **当面付**；服务端使用官方 `alipay-sdk` 调用 `alipay.trade.precreate`，购买页展示扫码二维码。

```dotenv
ALIPAY_APP_ID=你的支付宝应用AppID
ALIPAY_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
ALIPAY_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
ALIPAY_NOTIFY_URL=https://你的域名/api/payments/alipay/notify
ALIPAY_RETURN_URL=https://你的域名/purchase.html
ALIPAY_PRODUCT_TITLE=个税记录平台激活码
ALIPAY_PRODUCT_AMOUNT=199
```

- 服务器收到 `TRADE_SUCCESS`/`TRADE_FINISHED` 回调并完成 RSA2 验签、订单金额校验后，自动激活下单账号。
- 自动发卡写入 `activation_codes`，`owner_admin_username` 为超级管理员（默认 `admin`），用户列表「上线」与转化统计可归属到 admin；酷发卡批量 / 渠道激活码同样规则。
- App 内勿用整页跳转打开支付宝 H5；未付款返回应仍停在购买页。Cordova 壳改动需重新打包 APK 后生效。
- 回调地址必须可由支付宝公网访问；不要将支付宝私钥、平台公钥或 `.env` 提交到 Git、后台设置或前端代码。
- 初次上线请使用支付宝沙箱先验证支付、异步回调和自动开通流程。

## 免责声明

本软件仅供演示与交流，与任何政府机关、官方 APP 无关联。使用者须自行遵守法律法规，并对使用行为负责。
