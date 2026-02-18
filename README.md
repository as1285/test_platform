# 测试平台 (Test Platform)

一个基于 Flask + Vue.js 的自动化测试平台，支持接口测试、性能测试和鲁棒性测试。

## 功能特性

### 用户管理
- ✅ 用户注册/登录
- ✅ JWT Token 认证
- ✅ 用户信息管理
- ✅ 用户权限控制

### 用例管理
- ✅ 用例分组管理（支持层级结构）
- ✅ 测试用例 CRUD 操作
- ✅ 测试步骤管理
- ✅ 标签管理

### 测试执行
- ✅ 单条/批量测试执行
- ✅ 支持多种 HTTP 方法（GET、POST、PUT、DELETE 等）
- ✅ 请求头、请求体配置
- ✅ 响应断言（支持多种断言类型）
- ✅ 变量提取与参数化
- ✅ 测试执行历史记录

### 报告管理
- ✅ 测试报告生成
- ✅ 报告对比分析
- ✅ 执行结果统计

## 技术栈

### 后端
- **框架**: Flask 3.0.3
- **数据库**: MySQL 8.0
- **ORM**: SQLAlchemy 2.0.35
- **认证**: Flask-JWT-Extended 4.6.0
- **缓存**: Redis
- **其他**: Pydantic、PyMySQL、Requests

### 前端
- **框架**: Vue.js 3
- **构建工具**: Vite
- **UI 组件**: Element Plus
- **状态管理**: Pinia
- **路由**: Vue Router
- **HTTP 客户端**: Axios

## 项目结构

```
test_platform/
├── backend/                 # 后端项目
│   ├── app/
│   │   ├── api/            # API 路由
│   │   ├── models/         # 数据库模型
│   │   ├── schemas/        # Pydantic 模型
│   │   ├── services/       # 业务逻辑
│   │   └── utils/          # 工具函数
│   ├── config.py           # 配置文件
│   ├── run.py              # 启动入口
│   └── requirements.txt    # 依赖列表
├── frontend/               # 前端项目
│   ├── src/
│   │   ├── api/            # API 接口
│   │   ├── components/     # 组件
│   │   ├── views/          # 页面视图
│   │   ├── router/         # 路由配置
│   │   └── stores/         # 状态管理
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 系统架构概览

```text
                  ┌────────────────────────────┐
                  │          浏览器            │
                  │  Vue3 单页应用 (SPA)       │
                  │  - 仪表盘 / 用例管理       │
                  │  - 测试执行 / 报告查看     │
                  └────────────┬─────────────┘
                               │ HTTP(8081)
                               ▼
                 ┌─────────────────────────────┐
                 │   frontend 容器 (Nginx)     │
                 │   端口: 80 -> 宿主:8081     │
                 │                             │
                 │  静态资源: /                │
                 │    - index.html             │
                 │    - JS/CSS (Vite 构建)     │
                 │                             │
                 │  反向代理:                  │
                 │    /api/   -> backend:5000  │
                 │    /reports/ -> 重写成      │
                 │        /api/v1/report/file/ │
                 └────────────┬────────────────┘
                              │ Docker 内部网络 app-network
                              ▼
     ┌──────────────────────────────────────────────────────┐
     │                 backend 容器 (Flask)                 │
     │       端口: 5000 (Gunicorn 多 worker)               │
     │                                                      │
     │  API 层 (app/api)                                   │
     │  ┌──────────────────────────────────────────────┐    │
     │  │ /api/v1/auth      登录、JWT                   │    │
     │  │ /api/v1/case      用例&分组管理              │    │
     │  │ /api/v1/test      测试执行                    │    │
     │  │ /api/v1/report    报告创建/列表/详情         │    │
     │  │ /api/v1/report/file/<name> 报告文件访问      │    │
     │  │ /api/v1/dashboard 仪表盘统计                 │    │
     │  └──────────────────────────────────────────────┘    │
     │                                                      │
     │  Service 层 (app/services)                           │
     │  ┌──────────────────────────────────────────────┐    │
     │  │ test_service    实际发 HTTP 请求, 执行断言   │    │
     │  │ report_service  统计执行结果, 生成 HTML/MD   │    │
     │  │ case_service    用例 CRUD / 分组组织         │    │
     │  │ dashboard_service 仪表盘统计聚合             │    │
     │  └──────────────────────────────────────────────┘    │
     │                                                      │
     │  Model & Schema                                      │
     │  ┌──────────────────────────────────────────────┐    │
     │  │ models: TestCase, TestExecution, TestResult  │    │
     │  │         Report, User, ...                    │    │
     │  │ schemas: Pydantic 请求/响应校验              │    │
     │  └──────────────────────────────────────────────┘    │
     └───────────────┬─────────────────────┬────────────────┘
                     │                     │
                     │SQLAlchemy           │Redis 客户端
                     ▼                     ▼
        ┌─────────────────────┐   ┌─────────────────────┐
        │   db 容器 (MySQL)   │   │ redis 容器 (Redis)  │
        │ test_platform 库    │   │ 缓存报告/统计等      │
        │ - 用例/执行/报告表  │   └─────────────────────┘
        └─────────────────────┘
```

## 快速开始

### 环境要求
- Python 3.10+
- Node.js 16+
- MySQL 8.0+
- Redis

### 后端部署

1. 创建虚拟环境
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或
venv\Scripts\activate  # Windows
```

2. 安装依赖
```bash
pip install -r requirements.txt
```

3. 配置数据库
修改 `config.py` 中的数据库连接信息：
```python
SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://username:password@localhost/test_platform'
```

4. 初始化数据库
```bash
python init_db.py
```

5. 启动服务
```bash
python run.py
```

后端服务将在 http://localhost:5000 启动

### 前端部署

1. 安装依赖
```bash
cd frontend
npm install
```

2. 配置 API 地址
修改 `.env` 文件：
```
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

3. 启动开发服务器
```bash
npm run dev
```

前端服务将在 http://localhost:3001 启动

## API 接口文档

### 用户管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/user/register | 用户注册 |
| POST | /api/v1/user/login | 用户登录 |
| GET | /api/v1/user/me | 获取当前用户信息 |
| PUT | /api/v1/user/me | 更新当前用户信息 |
| GET | /api/v1/user | 获取用户列表 |
| GET | /api/v1/user/{id} | 获取指定用户信息 |
| PUT | /api/v1/user/{id} | 更新指定用户信息 |
| DELETE | /api/v1/user/{id} | 删除用户 |

### 用例分组
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/case/group | 创建分组 |
| GET | /api/v1/case/group | 获取分组列表 |
| PUT | /api/v1/case/group/{id} | 更新分组 |
| DELETE | /api/v1/case/group/{id} | 删除分组 |

### 测试用例
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/case | 创建用例 |
| GET | /api/v1/case | 获取用例列表 |
| GET | /api/v1/case/{id} | 获取用例详情 |
| PUT | /api/v1/case/{id} | 更新用例 |
| DELETE | /api/v1/case/{id} | 删除用例 |

### 测试执行
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/test/run | 执行测试 |
| GET | /api/v1/test/execution | 获取执行记录列表 |
| GET | /api/v1/test/execution/{id} | 获取执行详情 |

### 报告管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/report | 获取报告列表 |
| GET | /api/v1/report/{id} | 获取报告详情 |
| DELETE | /api/v1/report/{id} | 删除报告 |

## 测试用例格式

### 创建测试用例
```json
{
  "name": "测试用例名称",
  "group_id": 1,
  "description": "用例描述",
  "status": "enabled",
  "method": "GET",
  "url": "https://api.example.com/test",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{}",
  "validate": [
    {"eq": ["status_code", 200]},
    {"contains": ["response.body", "expected_content"]}
  ],
  "extract": [],
  "variables": {}
}
```

### 支持的断言类型
- `eq`: 等于
- `contains`: 包含
- `gt`: 大于
- `lt`: 小于
- `status_code`: 状态码
- `status_code_in`: 状态码在列表中
- `jsonpath`: JSONPath 匹配
- `regex`: 正则匹配
- `exists`: 字段存在
- `not_exists`: 字段不存在
- `type`: 类型检查
- `length`: 长度检查

## 数据库模型

### 用户表 (user)
- id: 主键
- username: 用户名
- email: 邮箱
- password_hash: 密码哈希
- role: 角色
- status: 状态
- create_time: 创建时间
- update_time: 更新时间

### 用例分组表 (case_group)
- id: 主键
- name: 分组名称
- parent_id: 父分组ID
- user_id: 用户ID
- create_time: 创建时间
- update_time: 更新时间

### 测试用例表 (test_case)
- id: 主键
- name: 用例名称
- group_id: 分组ID
- user_id: 用户ID
- method: HTTP方法
- url: 请求URL
- headers: 请求头
- body: 请求体
- validate: 断言配置
- extract: 提取配置
- variables: 变量
- status: 状态
- create_time: 创建时间
- update_time: 更新时间

### 测试执行表 (test_execution)
- id: 主键
- case_id: 用例ID
- user_id: 用户ID
- status: 执行状态
- start_time: 开始时间
- end_time: 结束时间
- execution_log: 执行日志
- created_at: 创建时间

## 开发计划

- [ ] 性能测试模块
- [ ] 鲁棒性测试模块
- [ ] 测试计划调度
- [ ] 邮件通知
- [ ] WebSocket 实时推送
- [ ] 数据导入导出
- [ ] 接口文档自动生成

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

[MIT](LICENSE)

## 联系方式

如有问题或建议，请提交 Issue 或联系维护者。
