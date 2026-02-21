from flask import jsonify
from flask_jwt_extended import jwt_required
from app.api import api_bp
from app.schemas import BaseResponse


API_DOCS = [
    {
        "category": "认证与用户",
        "description": "用户注册、登录以及当前登录用户信息相关接口",
        "apis": [
            {
                "name": "用户注册",
                "method": "POST",
                "path": "/user/register",
                "requires_auth": False,
                "description": "创建新用户账号",
                "request": {
                    "body": [
                        {"name": "username", "type": "string", "required": True, "description": "用户名"},
                        {"name": "email", "type": "string", "required": True, "description": "登录邮箱"},
                        {"name": "password", "type": "string", "required": True, "description": "登录密码"}
                    ]
                },
                "response": {
                    "description": "返回操作是否成功及提示信息",
                    "fields": [
                        {"name": "code", "type": "int", "required": True, "description": "业务状态码，200表示成功"},
                        {"name": "message", "type": "string", "required": False, "description": "错误或提示信息"},
                        {"name": "data", "type": "object", "required": False, "description": "当前接口未返回具体数据"}
                    ]
                }
            },
            {
                "name": "用户登录",
                "method": "POST",
                "path": "/user/login",
                "requires_auth": False,
                "description": "用户通过邮箱和密码登录，获取访问令牌",
                "request": {
                    "body": [
                        {"name": "email", "type": "string", "required": True, "description": "登录邮箱"},
                        {"name": "password", "type": "string", "required": True, "description": "登录密码"}
                    ]
                },
                "response": {
                    "description": "返回JWT访问令牌以及当前用户信息",
                    "fields": [
                        {"name": "code", "type": "int", "required": True, "description": "业务状态码，200表示成功"},
                        {"name": "message", "type": "string", "required": False, "description": "错误或提示信息"},
                        {"name": "data.access_token", "type": "string", "required": True, "description": "后续接口调用使用的JWT令牌"},
                        {"name": "data.user.id", "type": "int", "required": True, "description": "用户ID"},
                        {"name": "data.user.username", "type": "string", "required": True, "description": "用户名"},
                        {"name": "data.user.email", "type": "string", "required": True, "description": "用户邮箱"}
                    ]
                }
            },
            {
                "name": "获取当前用户信息",
                "method": "GET",
                "path": "/user/me",
                "requires_auth": True,
                "description": "根据当前登录态获取用户信息",
                "request": {
                    "headers": [
                        {"name": "Authorization", "type": "string", "required": True, "description": "格式为 Bearer <access_token>"}
                    ]
                },
                "response": {
                    "description": "返回当前登录用户的详细信息",
                    "fields": [
                        {"name": "code", "type": "int", "required": True, "description": "业务状态码"},
                        {"name": "data.id", "type": "int", "required": True, "description": "用户ID"},
                        {"name": "data.username", "type": "string", "required": True, "description": "用户名"},
                        {"name": "data.email", "type": "string", "required": True, "description": "邮箱"},
                        {"name": "data.create_time", "type": "string", "required": False, "description": "创建时间ISO字符串"}
                    ]
                }
            }
        ]
    },
    {
        "category": "用例管理",
        "description": "测试用例分组、用例本身、测试步骤和标签管理相关接口",
        "apis": [
            {
                "name": "获取用例分组列表",
                "method": "GET",
                "path": "/case/group",
                "requires_auth": True,
                "description": "列出当前用户下的所有用例分组",
                "request": {
                    "headers": [
                        {"name": "Authorization", "type": "string", "required": True, "description": "登录后的JWT令牌"}
                    ]
                },
                "response": {
                    "description": "返回用例分组数组",
                    "fields": [
                        {"name": "data[].id", "type": "int", "required": True, "description": "分组ID"},
                        {"name": "data[].name", "type": "string", "required": True, "description": "分组名称"},
                        {"name": "data[].description", "type": "string", "required": False, "description": "分组描述"},
                        {"name": "data[].create_time", "type": "string", "required": False, "description": "创建时间"}
                    ]
                }
            },
            {
                "name": "创建测试用例",
                "method": "POST",
                "path": "/case",
                "requires_auth": True,
                "description": "在指定分组下创建接口测试用例",
                "request": {
                    "body": [
                        {"name": "name", "type": "string", "required": True, "description": "用例名称"},
                        {"name": "description", "type": "string", "required": False, "description": "用例描述"},
                        {"name": "group_id", "type": "int", "required": True, "description": "所属分组ID"},
                        {"name": "method", "type": "string", "required": True, "description": "HTTP方法，如GET/POST"},
                        {"name": "url", "type": "string", "required": True, "description": "被测接口URL"},
                        {"name": "headers", "type": "object", "required": False, "description": "请求头字典"},
                        {"name": "body", "type": "string", "required": False, "description": "请求体内容，通常为JSON字符串"},
                        {"name": "extract", "type": "array", "required": False, "description": "从响应中提取变量的规则"},
                        {"name": "validate", "type": "array", "required": False, "description": "断言规则，例如状态码、字段值校验"},
                        {"name": "variables", "type": "object", "required": False, "description": "用例级变量定义"}
                    ]
                },
                "response": {
                    "description": "返回新建用例的详细信息",
                    "fields": [
                        {"name": "data.id", "type": "int", "required": True, "description": "用例ID"},
                        {"name": "data.name", "type": "string", "required": True, "description": "用例名称"},
                        {"name": "data.method", "type": "string", "required": True, "description": "HTTP方法"},
                        {"name": "data.url", "type": "string", "required": True, "description": "请求URL"},
                        {"name": "data.headers", "type": "object", "required": False, "description": "请求头配置"},
                        {"name": "data.body", "type": "string", "required": False, "description": "请求体内容"},
                        {"name": "data.validate", "type": "array", "required": False, "description": "断言配置"},
                        {"name": "data.extract", "type": "array", "required": False, "description": "变量提取配置"}
                    ]
                }
            },
            {
                "name": "获取测试用例列表",
                "method": "GET",
                "path": "/case",
                "requires_auth": True,
                "description": "按分组获取当前用户的用例列表",
                "request": {
                    "query": [
                        {"name": "group_id", "type": "int", "required": False, "description": "可选，指定分组ID过滤"}
                    ]
                },
                "response": {
                    "description": "返回用例简要信息数组",
                    "fields": [
                        {"name": "data[].id", "type": "int", "required": True, "description": "用例ID"},
                        {"name": "data[].name", "type": "string", "required": True, "description": "用例名称"},
                        {"name": "data[].status", "type": "string", "required": True, "description": "用例状态，如enabled/disabled"},
                        {"name": "data[].method", "type": "string", "required": True, "description": "HTTP方法"},
                        {"name": "data[].url", "type": "string", "required": True, "description": "请求URL"}
                    ]
                }
            }
        ]
    },
    {
        "category": "测试执行",
        "description": "自动化测试、性能测试和鲁棒性测试相关接口",
        "apis": [
            {
                "name": "执行单个用例测试",
                "method": "POST",
                "path": "/test/run",
                "requires_auth": True,
                "description": "执行单个测试用例并返回执行结果",
                "request": {
                    "body": [
                        {"name": "case_id", "type": "int", "required": True, "description": "要执行的用例ID"},
                        {"name": "parameters", "type": "object", "required": False, "description": "可选，运行时变量覆盖"}
                    ]
                },
                "response": {
                    "description": "返回单次测试执行的结果详情",
                    "fields": [
                        {"name": "data.status", "type": "string", "required": True, "description": "执行状态，如success/failed"},
                        {"name": "data.response_time", "type": "float", "required": False, "description": "响应时间，单位秒"},
                        {"name": "data.asserts", "type": "array", "required": False, "description": "断言结果列表"}
                    ]
                }
            },
            {
                "name": "批量执行测试用例",
                "method": "POST",
                "path": "/test/run/batch",
                "requires_auth": True,
                "description": "一次执行多个测试用例，返回整体执行情况",
                "request": {
                    "body": [
                        {"name": "case_ids", "type": "array[int]", "required": True, "description": "待执行的用例ID列表"},
                        {"name": "parameters", "type": "object", "required": False, "description": "可选，全局参数覆盖"}
                    ]
                },
                "response": {
                    "description": "返回批量执行的结果和统计",
                    "fields": [
                        {"name": "data.total", "type": "int", "required": True, "description": "总用例数"},
                        {"name": "data.passed", "type": "int", "required": True, "description": "通过用例数"},
                        {"name": "data.failed", "type": "int", "required": True, "description": "失败用例数"}
                    ]
                }
            },
            {
                "name": "按用例执行性能测试",
                "method": "POST",
                "path": "/test/performance",
                "requires_auth": True,
                "description": "基于已有测试用例触发性能压测",
                "request": {
                    "body": [
                        {"name": "case_id", "type": "int", "required": True, "description": "被压测的用例ID"},
                        {"name": "concurrency", "type": "int", "required": True, "description": "并发用户数"},
                        {"name": "duration", "type": "int", "required": True, "description": "压测持续时间，单位秒"},
                        {"name": "ramp_up_config", "type": "string", "required": False, "description": "阶梯加压配置JSON字符串"}
                    ]
                },
                "response": {
                    "description": "返回性能指标和服务器资源占用情况",
                    "fields": [
                        {"name": "data.metrics.tps", "type": "float", "required": True, "description": "每秒事务数"},
                        {"name": "data.metrics.qps", "type": "float", "required": True, "description": "每秒请求数"},
                        {"name": "data.metrics.avg_response_time", "type": "float", "required": True, "description": "平均响应时间，秒"},
                        {"name": "data.metrics.max_response_time", "type": "float", "required": False, "description": "最大响应时间，秒"},
                        {"name": "data.metrics.min_response_time", "type": "float", "required": False, "description": "最小响应时间，秒"},
                        {"name": "data.metrics.error_rate", "type": "float", "required": False, "description": "错误率，0-1之间"},
                        {"name": "data.metrics.server_metrics.cpu_percent", "type": "float", "required": False, "description": "压测期间CPU占用百分比"},
                        {"name": "data.metrics.server_metrics.memory_percent", "type": "float", "required": False, "description": "压测期间内存占用百分比"}
                    ]
                }
            },
            {
                "name": "自定义URL性能测试",
                "method": "POST",
                "path": "/test/performance/custom",
                "requires_auth": True,
                "description": "不依赖用例，直接对任意URL发起性能压测",
                "request": {
                    "body": [
                        {"name": "target_url", "type": "string", "required": True, "description": "被压测的目标URL"},
                        {"name": "method", "type": "string", "required": True, "description": "HTTP方法"},
                        {"name": "headers", "type": "object", "required": False, "description": "请求头字典"},
                        {"name": "body", "type": "string", "required": False, "description": "请求体内容"},
                        {"name": "concurrency", "type": "int", "required": True, "description": "并发用户数"},
                        {"name": "duration", "type": "int", "required": True, "description": "持续时间，单位秒"},
                        {"name": "ramp_up_config", "type": "string", "required": False, "description": "阶梯加压配置JSON字符串"},
                        {"name": "timeout", "type": "int", "required": False, "description": "单次请求超时时间，秒"}
                    ]
                },
                "response": {
                    "description": "结构与按用例执行性能测试接口一致",
                    "fields": [
                        {"name": "data.metrics", "type": "object", "required": True, "description": "性能指标同/test/performance"},
                        {"name": "data.log", "type": "array", "required": False, "description": "压测过程日志"}
                    ]
                }
            },
            {
                "name": "鲁棒性测试",
                "method": "POST",
                "path": "/test/robustness",
                "requires_auth": True,
                "description": "对指定用例注入异常场景进行鲁棒性验证",
                "request": {
                    "body": [
                        {"name": "case_id", "type": "int", "required": True, "description": "被测试的用例ID"},
                        {"name": "fault_injection_config", "type": "string", "required": True, "description": "异常注入配置，如boundary、sql_injection等"}
                    ]
                },
                "response": {
                    "description": "返回鲁棒性场景执行结果",
                    "fields": [
                        {"name": "data.summary", "type": "object", "required": False, "description": "整体执行概览"},
                        {"name": "data.details", "type": "array", "required": False, "description": "各注入场景的详细结果"}
                    ]
                }
            }
        ]
    },
    {
        "category": "报告与统计",
        "description": "测试报告列表与仪表盘统计接口",
        "apis": [
            {
                "name": "获取报告列表",
                "method": "GET",
                "path": "/report",
                "requires_auth": True,
                "description": "分页获取测试报告列表",
                "request": {
                    "query": [
                        {"name": "page", "type": "int", "required": False, "description": "页码，默认1"},
                        {"name": "page_size", "type": "int", "required": False, "description": "每页条数，默认10"}
                    ]
                },
                "response": {
                    "description": "返回报告数组及分页信息",
                    "fields": [
                        {"name": "data.reports[].id", "type": "int", "required": True, "description": "报告ID"},
                        {"name": "data.reports[].name", "type": "string", "required": True, "description": "报告名称"},
                        {"name": "data.reports[].type", "type": "string", "required": True, "description": "报告类型，如automation/performance"},
                        {"name": "pagination.page", "type": "int", "required": True, "description": "当前页码"},
                        {"name": "pagination.page_size", "type": "int", "required": True, "description": "每页大小"},
                        {"name": "pagination.total", "type": "int", "required": True, "description": "总记录数"}
                    ]
                }
            },
            {
                "name": "仪表盘概览数据",
                "method": "GET",
                "path": "/dashboard/overview",
                "requires_auth": True,
                "description": "获取首页仪表盘统计数据",
                "request": {},
                "response": {
                    "description": "返回用例数、执行次数和成功率等数据",
                    "fields": [
                        {"name": "data.stats.total_cases", "type": "int", "required": True, "description": "总用例数"},
                        {"name": "data.stats.total_executions", "type": "int", "required": True, "description": "总执行次数"},
                        {"name": "data.stats.success_rate", "type": "float", "required": True, "description": "整体成功率百分比"}
                    ]
                }
            }
        ]
    }
]


@api_bp.route("/docs", methods=["GET"])
@jwt_required()
def get_api_docs():
    response = BaseResponse(data={"categories": API_DOCS})
    return jsonify(response.dict()), 200

