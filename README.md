# 仿个税 APP 界面模拟器（私有源码仓库）

> 面向用户的**下载与使用说明**（不含源码）请见公开仓库：  
> https://github.com/as1285/personal-income-tax-simulator

个人所得税相关界面与流程的**演示软件**，用于学习演示、界面参考、技术交流。

> **重要说明**  
> 本软件**非**国家税务总局或手机应用商店中的官方「个人所得税」客户端，**不具备**真实申报、缴税、完税等税务功能。请勿用于误导他人或任何违法违规用途。

---

## 软件截图

### 首页

![首页](docs/images/shot-home.png)

### 我的

![我的](docs/images/shot-mine.png)

### 收入纳税明细

![收入纳税明细](docs/images/shot-income.png)

### 个人中心 · 税务记录

![税务记录](docs/images/shot-tax.png)

更新截图：先安装中文字体（Linux：`sudo apt-get install -y fonts-noto-cjk`），再执行  
`SCREENSHOT_USERNAME=… SCREENSHOT_PASSWORD=… node scripts/capture-readme-screenshots.mjs`（需已安装 Playwright 浏览器）。未装字体时截图中文会显示为方框。

---

## 下载安装

请使用**卖家 / 客服提供的最新安装页地址**打开下方页面；页面内可下载 **Android 安装包** 与 **iOS 描述文件**，并观看安装教程视频。

| 端 | 安装方式 |
|----|----------|
| **安卓 / Android 版** | 打开 [安装页](https://www.installguide1.top/)，点击 **「下载 Android 安装包」**；下载完成后按提示安装。若系统提示「未知来源」，请在设置中允许本次安装。 |
| **苹果 iOS 版** | 打开 [安装页](https://www.installguide1.top/)，点击 **「下载 iOS 描述文件」**，按页内 **苹果安装视频** 操作；安装后请到 **设置 → 通用 → VPN 与设备管理** 中信任描述文件。 |
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
   新账号需输入 **激活码** 后方可完整使用：  
   - 注册成功后会引导至 **「我的」** 激活；在 **「我的」** 页点击 **「激活」**，粘贴激活码并确认；  
   - 激活成功后会引导至 **税务记录** 添加演示数据；  
   - 或通过 **闲鱼 / 酷发卡** 等渠道购买，按卖家说明获取激活码（APP 内 **「闲鱼购买」** 可复制购买文案）。

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
| **源码规模** | 约 **120** 个源文件、**7 万+** 行（不含 `node_modules`、Cordova 编译产物、`package-lock.json`） |
| **前端页面** | **58** 个 HTML 页面（`frontend/*.html`） |
| **后端 API** | 单文件 `backend/server.js`（约 **1.7 万** 行） |
| **数据库表** | 以 `backend/schema.sql` / 启动迁移为准 |
| **GitHub Actions** | 3 个工作流：Android APK、iOS 打包、MySQL 定时备份 |
| **运维脚本** | `deploy.sh`、`backup-mysql.sh`、`import-mysql-dump.sh` 等 |

### 代码规模（按语言，2026-07）

| 语言 | 文件数 | 行数 |
|------|--------|------|
| JavaScript | ~35 | ~35,000+ |
| HTML | 58 | ~30,000+ |
| CSS | 5 | ~1,800 |
| Shell / YAML / SQL / 其他 | ~15 | ~1,100 |
| **合计** | **~120** | **~71,000** |

按模块：`frontend/` 约 5 万行 · `backend/` 约 1.7 万行 · `scripts/` + CI 约 0.1 万行。

核心大文件：`backend/server.js`、`frontend/public/js/admin_panel.js`、`frontend/consult.html`、`frontend/public/js/auth.js`、`frontend/install_guide.html`。

### 技术栈

| 层 | 技术 |
|----|------|
| 前端 | 静态 HTML/CSS/JS，多页应用，主题可配置 |
| 后端 | Node.js + Express 风格 API（`server.js`） |
| 数据库 | MySQL 8.0（库名 `personal_tax`） |
| 部署 | Docker Compose（`frontend` + `backend` + `db`） |
| 移动端 | Cordova（Android / iOS WebView 壳） |

### 常用命令

| 操作 | 命令 |
|------|------|
| 一键部署 | `./scripts/deploy.sh`（需 Docker，访问 `docker.sock`） |
| 仅部署前端/后端 | `DEPLOY_SERVICES=frontend ./scripts/deploy.sh` |
| 本地备份数据库 | `./scripts/backup-mysql.sh` → `data/db-backups/` |
| 导入 SQL 备份 | `./scripts/import-mysql-dump.sh /path/to/dump.sql` |
| 转化引导脚本 | `frontend/public/js/conversion-guide.js`（由 `auth.js` 注入） |

### 管理后台能力

`admin_panel.html` 主要模块：

- **激活码**：单码生成；超管可 **按渠道批量生成**（内置闲鱼 / 酷发卡，可手动添加或删除自定义渠道），备注为「渠道名+批量」，并导出 TXT；渠道批量码列表可按渠道筛选
- **数据统计**：注册转化率、7 日漏斗、渠道分析、安装页统计（最近访客默认展示 3 位）、API 调用分析
- **用户管理**：注册/删除/封禁、激活、**修改密码**、退款
- **用户数据**：扣缴义务人分析、工资分布、未填个税行为导出
- **引导安装**：APK / 描述文件、代理推广链接生成；落地页 A/B（体验向游客沙盒 / 下载向安装页）
- **系统设置**：转化 A/B、外观主题、QQ / 收款码

### 近期产品要点（2026-07）

- **安装引导页**：首屏精简为品牌 + 一句说明 + 下载主按钮；`?download=1` 更聚焦下载区
- **咨询 · 税务记录**：布局收紧；可折叠「个税计算表与公式」（七级预扣 + 年终奖单独计税 + 试算）
- **批量激活码多渠道**：生成时选择渠道；自定义渠道入库共享；内置渠道不可删
- **游客 / 落地漏斗**：落地 A/B 分流、游客样例数据与下载引导（详见 `docs/user-conversion-plan.md`）

### 数据库备份（GitHub Actions）

工作流：`.github/workflows/mysql-backup.yml`

- **调度**：每天 UTC 19:00（约北京时间 03:00）
- **方式**：SSH 连服务器 → `docker exec` mysqldump → 上传 **Artifact**（保留 90 天）
- **手动触发**：Actions → **MySQL Database Backup** → Run workflow

首次使用需在仓库 **Settings → Secrets** 配置：`BACKUP_SSH_HOST`、`BACKUP_SSH_USER`、`BACKUP_SSH_KEY`（可选 `BACKUP_DB_ROOT_PASSWORD`）。详见 workflow 文件头注释。

> 完整生产库 **不建议** commit 进 Git；本地备份目录 `data/db-backups/` 已加入 `.gitignore`。

环境变量与数据库初始化见 `docker-compose.yml` 及 `backend/` 内说明；勿将 `.env`、凭据提交入库。

### 支付宝自动开通

支付功能默认关闭。启用时仅在服务器未提交的 `.env` 或部署平台 Secret 中配置以下变量，然后重新部署后端：

```dotenv
ALIPAY_APP_ID=你的支付宝应用AppID
ALIPAY_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
ALIPAY_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
ALIPAY_NOTIFY_URL=https://www.geshui.vip/api/payments/alipay/notify
ALIPAY_RETURN_URL=https://www.geshui.vip/purchase.html
ALIPAY_PRODUCT_TITLE=个税记录平台激活码
ALIPAY_PRODUCT_AMOUNT=9.90
```

- 服务器收到 `TRADE_SUCCESS`/`TRADE_FINISHED` 回调并完成 RSA2 验签、订单金额校验后，自动激活下单账号。
- 回调地址必须可由支付宝公网访问；不要将支付宝私钥、平台公钥或 `.env` 提交到 Git、后台设置或前端代码。
- 初次上线请使用支付宝沙箱先验证支付、异步回调和自动开通流程。

## 免责声明

本软件仅供演示与交流，与任何政府机关、官方 APP 无关联。使用者须自行遵守法律法规，并对使用行为负责。
