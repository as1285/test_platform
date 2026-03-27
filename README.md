# 测试平台 (Test Platform)

一个基于 Flask + Vue.js 的轻量化接口测试平台，支持接口测试、性能测试和测试工具集。

## 📊 代码统计

| 语言 | 代码行数 | 说明 |
|------|---------|------|
| Python | ~4,048 行 | 后端核心代码（不含依赖） |
| TypeScript/Vue | ~7,524 行 | 前端核心代码 |
| **总计** | **~11,572 行** | 纯业务代码 |

## 功能特性

### ✅ 核心功能

#### 仪表盘
- ✅ 用例统计（总数、执行数、成功率）
- ✅ 实时概览数据
- ✅ 执行结果分析

#### 用例管理
- ✅ 用例分组管理（支持层级结构）
- ✅ 测试用例 CRUD 操作
- ✅ 测试步骤管理
- ✅ 标签管理
- ✅ 从接口文档导入用例
- ✅ 支持多种 HTTP 方法（GET、POST、PUT、DELETE 等）
- ✅ 请求头、请求体配置
- ✅ 响应断言（支持多种断言类型）
- ✅ 变量提取与参数化

#### 测试执行
- ✅ 单条/批量测试执行
- ✅ 测试执行历史记录
- ✅ 执行结果详情查看
- ✅ 错误日志分析

#### 性能测试
- ✅ 基于测试用例的性能压测
- ✅ 自定义 URL 性能测试
- ✅ 固定并发与阶梯加压模式
- ✅ TPS/QPS 实时监控
- ✅ 响应时间分析
- ✅ 服务器资源占用监控（CPU、内存、磁盘）
- ✅ 性能测试配置保存与管理
- ✅ 性能测试报告生成

#### 测试工具集
- ✅ Cron 表达式生成器
- ✅ 编码转换工具（UTF-8、Base64、Hex、URL 等）
- ✅ 时间转换工具（时区转换、时间差计算、时间叠加）
- ✅ 二维码生成与识别
- ✅ 正则表达式生成与测试
- ✅ 加密解密工具（ASCII、Hex、Base64、MD5、SHA、AES、DES 等）

### ❌ 已移除模块

以下模块已在最新版本中移除，以简化系统架构：
- ❌ 用户管理（无需登录即可使用）
- ❌ 登录认证（移除 JWT 认证）
- ❌ 鲁棒性测试
- ❌ 报告管理
- ❌ 独立接口文档模块（集成到 Swagger）

## 技术栈

### 后端
- **框架**: Flask 2.0.1
- **数据库**: MySQL 8.0
- **ORM**: SQLAlchemy 1.4.39
- **缓存**: Redis
- **并发**: gevent
- **其他**: Pydantic、PyMySQL、Requests、psutil、Markdown

### 前端
- **框架**: Vue.js 3.5.13
- **构建工具**: Vite 6.0.3
- **UI 组件**: Element Plus 2.8.4
- **状态管理**: Pinia 2.3.0
- **路由**: Vue Router 4.4.5
- **图表**: ECharts 5.5.1
- **HTTP 客户端**: Axios 1.7.9
- **类型**: TypeScript 5.6.2

## 项目结构

```
test_platform/
├── backend/                 # 后端项目
│   ├── app/
│   │   ├── api/            # API 路由
│   │   │   ├── __init__.py
│   │   │   ├── case.py     # 用例管理接口
│   │   │   └── test.py     # 测试执行接口 (含性能测试)
│   │   ├── models/         # 数据库模型
│   │   │   ├── __init__.py
│   │   │   ├── case_group.py
│   │   │   ├── test_case.py
│   │   │   ├── test_step.py
│   │   │   ├── tag.py
│   │   │   ├── case_tag.py
│   │   │   ├── test_execution.py
│   │   │   ├── test_result.py
│   │   │   ├── performance_test.py
│   │   │   └── performance_config.py
│   │   ├── services/       # 业务逻辑层
│   │   │   ├── __init__.py
│   │   │   ├── case_service.py
│   │   │   └── test_service.py
│   │   ├── schemas/        # Pydantic 模型
│   │   │   ├── __init__.py
│   │   │   ├── case.py
│   │   │   └── test.py
│   │   ├── utils/          # 工具类
│   │   │   ├── __init__.py
│   │   │   ├── redis.py
│   │   │   └── validator.py
│   │   └── plugins/        # 插件
│   │       ├── __init__.py
│   │       ├── base.py
│   │       └── websocket.py
│   ├── tests/              # 测试代码
│   ├── config.py           # 配置文件
│   ├── run.py              # 启动文件
│   └── requirements.txt    # Python 依赖
├── frontend/               # 前端项目
│   ├── src/
│   │   ├── api/           # API 请求
│   │   │   └── index.ts
│   │   ├── components/    # 公共组件
│   │   ├── router/        # 路由配置
│   │   │   └── index.ts
│   │   ├── types/         # TypeScript 类型定义
│   │   │   └── index.ts
│   │   ├── utils/         # 工具函数
│   │   │   └── index.ts
│   │   ├── views/         # 页面组件
│   │   │   ├── 404/
│   │   │   │   └── 404.vue
│   │   │   ├── case/
│   │   │   │   └── Case.vue
│   │   │   ├── dashboard/
│   │   │   │   └── Dashboard.vue
│   │   │   ├── performance/
│   │   │   │   └── Performance.vue
│   │   │   ├── test/
│   │   │   │   └── Test.vue
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
- Swagger 文档：http://localhost:8081/swagger

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

访问 Swagger UI 查看完整的 API 文档：
```
http://localhost:8081/swagger
```

主要 API 端点：
- `/api/v1/case` - 用例管理
- `/api/v1/test` - 测试执行
- `/api/v1/performance` - 性能测试

## 主要更新

### v2.0.0 (最新)
- ✨ 移除登录认证模块，无需登录即可使用
- ✨ 删除用户管理、报告管理、鲁棒性测试模块
- ✨ 清理无用代码，优化系统架构
- ✨ 修复缩进错误，提升代码质量
- 📦 代码总量减少约 3,600 行

### v1.5.0
- ✨ 添加测试工具集（编码转换、时间转换、二维码等）
- ✨ 优化性能测试功能
- 🐛 修复已知问题

## 功能截图

### 仪表盘
显示用例统计、执行统计、成功率分析等实时数据。

### 用例管理
支持用例分组、CRUD 操作、步骤管理、标签管理等完整功能。

### 测试执行
单条或批量执行测试用例，查看详细的执行结果和日志。

### 性能测试
配置并发数、压测时长，实时监控 TPS、响应时间等指标。

### 测试工具
集成多种实用工具，提升测试效率。

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 联系方式

- GitHub: https://github.com/as1285/test_platform
- Issues: https://github.com/as1285/test_platform/issues
