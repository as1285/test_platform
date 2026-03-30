# 测试平台 (Test Platform)

一个基于 Flask + Vue.js 的轻量化测试工具平台，专注于提供实用的测试工具集。

## 📊 代码统计

| 语言 | 代码行数 | 说明 |
|------|---------|------|
| Python | 738 行 | 后端核心代码（不含依赖） |
| TypeScript/Vue | 2,895 行 | 前端核心代码 |
| **总计** | **3,633 行** | 纯业务代码 |

## 功能特性

### ✅ 核心功能

#### 测试工具集
- ✅ Cron 表达式生成器
- ✅ 编码转换工具（UTF-8、Base64、Hex、URL 等）
- ✅ 时间转换工具（时区转换、时间差计算、时间叠加）
- ✅ 二维码生成与识别
- ✅ 正则表达式生成与测试
- ✅ 加密解密工具（ASCII、Hex、Base64、MD5、SHA、AES、DES 等）
- ✅ Excel 处理工具（去除 &lt;br&gt; 标签并替换为换行）

### ❌ 已移除模块

以下模块已在最新版本中移除，以简化系统架构：
- ❌ 仪表盘
- ❌ 用例管理
- ❌ 测试执行
- ❌ 性能测试
- ❌ 用户管理（无需登录即可使用）
- ❌ 登录认证（移除 JWT 认证）
- ❌ 鲁棒性测试
- ❌ 报告管理
- ❌ 独立接口文档模块

## 技术栈

### 后端
- **框架**: Flask 2.0.1
- **数据库**: MySQL 8.0
- **ORM**: SQLAlchemy 1.4.39
- **缓存**: Redis
- **并发**: gevent
- **其他**: Pydantic、PyMySQL、Requests、psutil、Markdown、pandas、openpyxl

### 前端
- **框架**: Vue.js 3.5.13
- **构建工具**: Vite 6.0.3
- **UI 组件**: Element Plus 2.8.4
- **状态管理**: Pinia 2.3.0
- **路由**: Vue Router 4.4.5
- **HTTP 客户端**: Axios 1.7.9
- **类型**: TypeScript 5.6.2

## 项目结构

```
test_platform/
├── backend/                 # 后端项目
│   ├── app/
│   │   ├── api/            # API 路由
│   │   │   ├── __init__.py
│   │   │   └── tools.py    # 工具相关接口
│   │   ├── utils/          # 工具类
│   │   │   └── __init__.py
│   │   └── plugins/        # 插件
│   │       └── __init__.py
│   ├── config.py           # 配置文件
│   ├── run.py              # 启动文件
│   └── requirements.txt    # Python 依赖
├── frontend/               # 前端项目
│   ├── src/
│   │   ├── api/           # API 请求
│   │   │   └── index.ts
│   │   ├── router/        # 路由配置
│   │   │   └── index.ts
│   │   ├── views/         # 页面组件
│   │   │   ├── 404/
│   │   │   │   └── 404.vue
│   │   │   └── tools/
│   │   │       └── TestTool.vue
│   │   ├── App.vue        # 根组件
│   │   └── main.ts        # 入口文件
│   ├── nginx.conf         # Nginx 配置
│   ├── package.json       # Node 依赖
│   └── vite.config.ts     # Vite 配置
├── docker-compose.yml     # Docker Compose 配置
└── README.md              # 项目说明
```

## 快速开始

### 环境要求
- Docker & Docker Compose
- Node.js 18+ (前端开发)
- Python 3.9+ (后端开发)

### Docker 部署（推荐）

1. 克隆项目
```bash
git clone https://github.com/as1285/test_platform.git
cd test_platform
```

2. 启动所有服务
```bash
docker-compose up -d
```

3. 访问系统
- 前端页面：http://localhost:8081
- 后端 API: http://localhost:8081/api/v1

### 本地开发

#### 后端
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python run.py
```

#### 前端
```bash
cd frontend
npm install
npm run dev
```

## API 文档

主要 API 端点：
- `/api/v1/tools/excel/process` - Excel 处理
- `/api/v1/tools/excel/download` - 下载处理后的 Excel

## 主要更新

### v3.0.0 (最新)
- ✨ 移除仪表盘、用例管理、测试执行和性能测试模块
- ✨ 新增 Excel 处理工具（去除 &lt;br&gt; 标签并替换为换行）
- ✨ 优化 UI 布局设计，提升用户体验
- ✨ 修复依赖版本不兼容问题
- 📦 代码总量减少约 8,000 行，更加轻量级

### v2.0.0
- ✨ 移除登录认证模块，无需登录即可使用
- ✨ 删除用户管理、报告管理、鲁棒性测试模块
- ✨ 清理无用代码，优化系统架构
- ✨ 修复缩进错误，提升代码质量

### v1.5.0
- ✨ 添加测试工具集（编码转换、时间转换、二维码等）
- ✨ 优化性能测试功能
- 🐛 修复已知问题

## 功能说明

### Excel 处理工具
- 支持上传 Excel 文件（.xlsx, .xls）
- 自动去除 &lt;br&gt; 标签并替换为换行
- 可选去除首尾空格
- 实时显示处理进度和统计信息
- 支持下载处理后的 Excel 文件

### 其他测试工具
- **Cron 表达式生成器**：生成和验证 Cron 表达式
- **编码转换工具**：支持 UTF-8、Base64、Hex、URL 等编码格式转换
- **时间转换工具**：支持时区转换、时间差计算、时间叠加
- **二维码工具**：生成和识别二维码
- **正则表达式工具**：生成和测试正则表达式
- **加密解密工具**：支持多种加密算法

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 联系方式

- GitHub: https://github.com/as1285/test_platform
- Issues: https://github.com/as1285/test_platform/issues
