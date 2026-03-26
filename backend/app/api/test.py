from flask import request
from flask_restx import Resource
from app.api import api_bp, api
from app.services import test_service
from app.schemas.test import (
    TestRunRequest,
    TestRunBatchRequest,
    TestRunPerformanceRequest,
    TestRunRobustnessRequest,
    TestRunPerformanceCustomRequest,
    PerformanceConfigCreate,
)
from app.schemas import BaseResponse

# 创建测试命名空间
test_ns = api.namespace('test', description='测试执行相关接口')

# 自动化测试相关接口
@test_ns.route('/run')
class TestRun(Resource):
    @test_ns.doc('run_test')
        def post(self):
        """执行单个测试用例"""
        try:
            user_id = 1
            data = request.json
            test_data = TestRunRequest(**data)
            
            success, result = test_service.run_test(test_data, user_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            return BaseResponse(data=result).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

@test_ns.route('/run/batch')
class TestBatchRun(Resource):
    @test_ns.doc('run_batch_tests')
        def post(self):
        """批量执行测试用例"""
        try:
            user_id = 1
            data = request.json
            test_data = TestRunBatchRequest(**data)
            
            success, result = test_service.run_batch_tests(test_data, user_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            return BaseResponse(data=result).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

# 性能测试相关接口
@test_ns.route('/performance')
class TestPerformance(Resource):
    @test_ns.doc('run_performance_test')
        def post(self):
        """执行性能测试"""
        try:
            user_id = 1
            data = request.json
            test_data = TestRunPerformanceRequest(**data)
            
            success, result = test_service.run_performance_test(test_data, user_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            return BaseResponse(data=result).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

@test_ns.route('/performance/custom')
class TestCustomPerformance(Resource):
    @test_ns.doc('run_performance_test_custom')
        def post(self):
        """执行自定义目标的性能测试"""
        try:
            user_id = 1
            data = request.json
            test_data = TestRunPerformanceCustomRequest(**data)
            
            success, result = test_service.run_performance_test_custom(test_data, user_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            return BaseResponse(data=result).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

# 鲁棒性测试相关接口
@test_ns.route('/robustness')
class TestRobustness(Resource):
    @test_ns.doc('run_robustness_test')
        def post(self):
        """执行鲁棒性测试"""
        try:
            user_id = 1
            data = request.json
            test_data = TestRunRobustnessRequest(**data)
            
            success, result = test_service.run_robustness_test(test_data, user_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            return BaseResponse(data=result).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

# 性能测试配置相关接口
@test_ns.route('/performance/config')
class PerformanceConfigList(Resource):
    @test_ns.doc('save_performance_config')
        def post(self):
        """保存性能测试配置"""
        try:
            user_id = 1
            data = request.json
            success, result = test_service.save_performance_config(data, user_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            return BaseResponse(data={
                "id": result.id,
                "name": result.name,
                "created_at": result.created_at.isoformat()
            }).dict(), 201
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500
    
    @test_ns.doc('get_performance_configs')
        def get(self):
        """获取用户的性能测试配置列表"""
        try:
            user_id = 1
            success, result = test_service.get_performance_configs(user_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            configs = []
            for config in result:
                configs.append({
                    "id": config.id,
                    "name": config.name,
                    "case_id": config.case_id,
                    "target_url": config.target_url,
                    "method": config.method,
                    "headers": config.headers,
                    "body": config.body,
                    "concurrency_type": config.concurrency_type,
                    "concurrency": config.concurrency,
                    "initial_concurrency": config.initial_concurrency,
                    "target_concurrency": config.target_concurrency,
                    "step_count": config.step_count,
                    "step_duration": config.step_duration,
                    "duration": config.duration,
                    "interval": config.interval,
                    "timeout": config.timeout,
                    "created_at": config.created_at.isoformat(),
                    "updated_at": config.updated_at.isoformat()
                })
            
            return BaseResponse(data=configs).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

@test_ns.route('/performance/config/<int:config_id>')
class PerformanceConfig(Resource):
    @test_ns.doc('get_performance_config')
        def get(self, config_id):
        """根据ID获取性能测试配置"""
        try:
            user_id = 1
            success, result = test_service.get_performance_config_by_id(config_id, user_id)
            if not success:
                return BaseResponse(code=404, message=result).dict(), 404
            
            return BaseResponse(data={
                "id": result.id,
                "name": result.name,
                "case_id": result.case_id,
                "target_url": result.target_url,
                "method": result.method,
                "headers": result.headers,
                "body": result.body,
                "concurrency_type": result.concurrency_type,
                "concurrency": result.concurrency,
                "initial_concurrency": result.initial_concurrency,
                "target_concurrency": result.target_concurrency,
                "step_count": result.step_count,
                "step_duration": result.step_duration,
                "duration": result.duration,
                "interval": result.interval,
                "timeout": result.timeout,
                "created_at": result.created_at.isoformat(),
                "updated_at": result.updated_at.isoformat()
            }).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500
    
    @test_ns.doc('delete_performance_config')
        def delete(self, config_id):
        """删除性能测试配置"""
        try:
            user_id = 1
            success, result = test_service.delete_performance_config(config_id, user_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            return BaseResponse(message=result).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

# 测试执行记录相关接口
@test_ns.route('/execution')
class TestExecutionList(Resource):
    @test_ns.doc('get_test_executions')
        def get(self):
        """获取测试执行记录列表"""
        try:
            user_id = 1
            executions = test_service.get_test_executions(user_id)
            
            executions_data = []
            for execution in executions:
                executions_data.append({
                    'id': execution.id,
                    'case_id': execution.case_id,
                    'user_id': execution.user_id,
                    'status': execution.status,
                    'start_time': execution.start_time.isoformat() if execution.start_time else None,
                    'end_time': execution.end_time.isoformat() if execution.end_time else None,
                    'execution_log': execution.execution_log,
                    'created_at': execution.created_at.isoformat()
                })
            
            return BaseResponse(data=executions_data).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

@test_ns.route('/execution/<int:execution_id>')
class TestExecution(Resource):
    @test_ns.doc('get_test_execution')
        def get(self, execution_id):
        """获取测试执行记录"""
        try:
            execution = test_service.get_test_execution(execution_id)
            if not execution:
                return BaseResponse(code=404, message='Execution not found').dict(), 404
            
            execution_data = {
                'id': execution.id,
                'case_id': execution.case_id,
                'user_id': execution.user_id,
                'status': execution.status,
                'start_time': execution.start_time.isoformat() if execution.start_time else None,
                'end_time': execution.end_time.isoformat() if execution.end_time else None,
                'execution_log': execution.execution_log,
                'created_at': execution.created_at.isoformat()
            }
            
            return BaseResponse(data=execution_data).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

@test_ns.route('/execution/<int:execution_id>/result')
class TestResult(Resource):
    @test_ns.doc('get_test_results')
        def get(self, execution_id):
        """获取测试结果"""
        try:
            results = test_service.get_test_results(execution_id)
            
            results_data = []
            for result in results:
                results_data.append({
                    'id': result.id,
                    'execution_id': result.execution_id,
                    'status': result.status,
                    'response': result.response,
                    'error_message': result.error_message,
                    'response_time': result.response_time,
                    'created_at': result.created_at.isoformat()
                })
            
            return BaseResponse(data=results_data).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

# 创建仪表板命名空间
dashboard_ns = api.namespace('dashboard', description='仪表板相关接口')

@dashboard_ns.route('/overview')
class DashboardOverview(Resource):
    @dashboard_ns.doc('get_dashboard_overview')
        def get(self):
        """获取仪表盘概览"""
        try:
            user_id = 1
            success, result = test_service.get_dashboard_overview(user_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            return BaseResponse(data=result).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500
