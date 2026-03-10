# 测试平台 (Test Platform)

一个基于 Flask + Vue.js 的自动化测试平台,支持接口测试、性能测试和鲁棒性测试。

## 功能特性

### 用户管理
- ✅ 用户注册/登录
- ✅ JWT Token 认证
- ✅ 用户信息管理
- ✅ 用户权限控制

### 用例管理
- ✅ 用例分组管理(支持层级结构)
- ✅ 测试用例 CRUD 操作
- ✅ 测试步骤管理
- ✅ 标签管理

### 测试执行
- ✅ 单条/批量测试执行
- ✅ 支持多种 HTTP 方法(GET、POST、PUT、DELETE 等)
- ✅ 请求头、请求体配置
- ✅ 响应断言(支持多种断言类型)
- ✅ 变量提取与参数化
- ✅ 测试执行历史记录

### 性能测试
- ✅ 基于测试用例的性能压测
- ✅ 自定义 URL 性能测试
- ✅ 固定并发与阶梯加压模式
- ✅ TPS/QPS 实时监控
- ✅ 响应时间分析
- ✅ 服务器资源占用监控(CPU、内存、磁盘)
- ✅ 性能测试配置保存与管理
- ✅ 性能测试报告生成

### 鲁棒性测试
- ✅ 参数越界测试
- ✅ SQL 注入试探
- ✅ 请求频率超限测试
- ✅ 返回数据格式错误测试
- ✅ 熔断检测
- ✅ 降级检测
- ✅ 异常返回规范检测
- ✅ 恢复速度检测
- ✅ 鲁棒性评分与分析建议

### 报告管理
- ✅ 测试报告生成
- ✅ 报告对比分析
- ✅ 执行结果统计
- ✅ 性能测试报告
- ✅ 鲁棒性测试报告

### 仪表盘
- ✅ 用例统计
- ✅ 执行统计
- ✅ 成功率分析
- ✅ 实时概览数据

## 技术栈

### 后端
- **框架**: Flask 2.0.1
- **数据库**: MySQL 8.0
- **ORM**: SQLAlchemy 1.4.39
- **认证**: Flask-JWT-Extended 4.4.4
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
│   │   │   ├── user.py     # 用户管理接口
│   │   │   ├── case.py     # 用例管理接口
│   │   │   ├── test.py     # 测试执行接口(含性能、鲁棒性)
│   │   │   ├── report.py   # 报告管理接口
│   │   │   └── docs.py     # API 文档接口
│   │   ├── models/         # 数据库模型
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── case_group.py
│   │   │   ├── test_case.py
│   │   │   ├── test_step.py
│   │   │   ├── tag.py
│   │   │   ├── case_tag.py
│   │   │   ├── test_execution.py
│   │   │   ├── test_result.py
│   │   │   ├── performance_test.py
│   │   │   ├── performance_config.py
│   │   │   ├── robustness_test.py
│   │   │   └── report.py
│   │   ├── schemas/        # Pydantic 模型
│   │   ├── services/       # 业务逻辑
│   │   │   ├── test_service.py
│   │   │   ├── case_service.py
│   │   │   ├── report_service.py
│   │   │   └── dashboard_service.py
│   │   └── utils/          # 工具函数
│   ├── config.py           # 配置文件
│   ├── run.py              # 启动入口
│   └── requirements.txt    # 依赖列表
├── frontend/               # 前端项目
│   ├── src/
│   │   ├── api/            # API 接口
│   │   ├── components/     # 组件
│   │   ├── views/          # 页面视图
│   │   │   ├── dashboard/  # 仪表盘
│   │   │   ├── login/      # 登录
│   │   │   ├── user/       # 用户管理
│   │   │   ├── case/       # 用例管理
│   │   │   ├── test/       # 测试执行
│   │   │   ├── performance/ # 性能测试
│   │   │   ├── robustness/  # 鲁棒性测试
│   │   │   ├── report/     # 报告管理
│   │   │   ├── docs/       # 接口文档
│   │   │   └── 404/        # 404 页面
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
                  │  - 性能测试 / 鲁棒性测试   │
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
     │  │   - /run          单条/批量测试               │    │
     │  │   - /performance  性能压测                    │    │
     │  │   - /robustness   鲁棒性测试                  │    │
     │  │ /api/v1/report    报告创建/列表/详情         │    │
     │  │ /api/v1/report/file/<name> 报告文件访问      │    │
     │  │ /api/v1/dashboard 仪表盘统计                 │    │
     │  └──────────────────────────────────────────────┘    │
     │                                                      │
     │  Service 层 (app/services)                           │
     │  ┌──────────────────────────────────────────────┐    │
     │  │ test_service    实际发 HTTP 请求, 执行断言   │    │
     │  │   - run_test              自动化测试          │    │
     │  │   - run_performance_test  性能压测            │    │
     │  │   - run_robustness_test   鲁棒性测试          │    │
     │  │ report_service  统计执行结果, 生成 HTML/MD   │    │
     │  │ case_service    用例 CRUD / 分组组织         │    │
     │  │ dashboard_service 仪表盘统计聚合             │    │
     │  └──────────────────────────────────────────────┘    │
     │                                                      │
     │  Model & Schema                                      │
     │  ┌──────────────────────────────────────────────┐    │
     │  │ models: TestCase, TestExecution, TestResult  │    │
     │  │         Report, User, PerformanceTest,       │    │
     │  │         RobustnessTest, PerformanceConfig    │    │
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
修改 `config.py` 中的数据库连接信息:
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
修改 `.env` 文件:
```
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

3. 启动开发服务器
```bash
npm run dev
```

前端服务将在 http://localhost:3001 启动

## API 接口文档

### 认证与用户
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

### 自动化测试
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/test/run | 执行单个测试 |
| POST | /api/v1/test/run/batch | 批量执行测试 |
| GET | /api/v1/test/execution | 获取执行记录列表 |
| GET | /api/v1/test/execution/{id} | 获取执行详情 |

### 性能测试
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/test/performance | 按用例执行性能测试 |
| POST | /api/v1/test/performance/custom | 自定义 URL 性能测试 |
| POST | /api/v1/test/performance/config | 保存性能测试配置 |
| GET | /api/v1/test/performance/config | 获取性能测试配置列表 |
| GET | /api/v1/test/performance/config/{id} | 获取性能测试配置详情 |
| DELETE | /api/v1/test/performance/config/{id} | 删除性能测试配置 |

### 鲁棒性测试
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/test/robustness | 执行鲁棒性测试 |

### 报告管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/report | 获取报告列表 |
| GET | /api/v1/report/{id} | 获取报告详情 |
| DELETE | /api/v1/report/{id} | 删除报告 |
| GET | /api/v1/report/file/{name} | 下载报告文件 |

### 仪表盘
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/dashboard/overview | 获取仪表盘概览数据 |

### API 文档
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/v1/docs | 获取完整的 API 文档 |

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

## 性能测试配置

### 基本配置
- **测试目标**: 选择测试用例或自定义 URL
- **请求方法**: GET/POST/PUT/DELETE
- **请求体**: JSON 格式
- **请求头**: 支持自定义多个请求头

### 压测参数
- **并发类型**: 固定并发 / 阶梯加压
- **并发数**: 固定并发模式下的并发用户数
- **初始并发**: 阶梯加压模式下的起始并发数
- **目标并发**: 阶梯加压模式下的目标并发数
- **阶梯数**: 阶梯加压的阶梯数量
- **每阶梯持续时间**: 每个阶梯的持续时间(秒)
- **持续时间**: 总压测持续时间(秒)
- **请求间隔**: 请求之间的间隔(毫秒)
- **超时时间**: 单次请求超时时间(秒)

### 高级配置
- **Cookie**: 是否启用 Cookie
- **重定向**: 是否启用重定向
- **最大重定向次数**: 最多跟随的重定向次数
- **保存响应**: 是否保存响应内容

## 鲁棒性测试配置

### 异常注入类型
- **参数越界**: 测试边界值处理
- **SQL 注入试探**: 测试 SQL 注入防护
- **请求频率超限**: 测试限流机制
- **返回数据格式错误**: 测试异常返回格式

### 容错验证
- **熔断检测**: 验证熔断机制
- **降级检测**: 验证降级机制
- **异常返回规范检测**: 验证异常返回格式
- **恢复速度检测**: 验证异常后的恢复速度

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

### 测试步骤表 (test_step)
- id: 主键
- case_id: 用例ID
- name: 步骤名称
- method: HTTP方法
- url: 请求URL
- headers: 请求头
- body: 请求体
- validate: 断言配置
- sort: 排序

### 标签表 (tag)
- id: 主键
- name: 标签名称
- user_id: 用户ID
- create_time: 创建时间

### 用例标签关联表 (case_tag)
- id: 主键
- case_id: 用例ID
- tag_id: 标签ID

### 测试执行表 (test_execution)
- id: 主键
- case_id: 用例ID
- user_id: 用户ID
- status: 执行状态
- start_time: 开始时间
- end_time: 结束时间
- execution_log: 执行日志
- created_at: 创建时间

### 测试结果表 (test_result)
- id: 主键
- execution_id: 执行记录ID
- status: 结果状态
- response: 响应内容
- error_message: 错误信息
- response_time: 响应时间
- created_at: 创建时间

### 性能测试表 (performance_test)
- id: 主键
- name: 测试名称
- case_id: 用例ID
- target_url: 目标URL
- method: HTTP方法
- headers: 请求头
- body: 请求体
- concurrency: 并发数
- duration: 持续时间
- metrics: 性能指标(JSON)
- server_metrics: 服务器指标(JSON)
- status: 执行状态
- created_at: 创建时间

### 性能配置表 (performance_config)
- id: 主键
- name: 配置名称
- case_id: 用例ID
- target_url: 目标URL
- method: HTTP方法
- headers: 请求头
- body: 请求体
- concurrency_type: 并发类型
- concurrency: 并发数
- initial_concurrency: 初始并发
- target_concurrency: 目标并发
- step_count: 阶梯数
- step_duration: 每阶梯持续时间
- duration: 持续时间
- interval: 请求间隔
- timeout: 超时时间
- created_at: 创建时间
- updated_at: 更新时间

### 鲁棒性测试表 (robustness_test)
- id: 主键
- name: 测试名称
- target_url: 目标URL
- method: HTTP方法
- body: 请求体
- injection_types: 注入类型(JSON)
- fault_injection_config: 注入配置(JSON)
- tolerance_config: 容错配置(JSON)
- metrics: 测试指标(JSON)
- status: 执行状态
- created_at: 创建时间

### 报告表 (report)
- id: 主键
- name: 报告名称
- execution_id: 执行记录ID
- type: 报告类型(automation/performance/robustness)
- content: 报告内容
- file_path: 报告文件路径
- created_at: 创建时间

## 开发计划

- [ ] 测试计划调度
- [ ] 邮件通知
- [ ] WebSocket 实时推送
- [ ] 数据导入导出
- [ ] 接口文档自动生成
- [ ] 测试用例模板
- [ ] 批量编辑用例
- [ ] 用例版本管理
- [ ] 回归测试支持
- [ ] 测试结果对比
- [ ] 移动端适配

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

[MIT](LICENSE)

## 联系方式

如有问题或建议,请提交 Issue 或联系维护者。
