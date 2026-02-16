from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.api import api_bp
from app.services import test_service
from app.schemas.test import TestRunRequest, TestRunBatchRequest, TestRunPerformanceRequest, TestRunRobustnessRequest
from app.schemas import BaseResponse

# 自动化测试相关接口
@api_bp.route('/test/run', methods=['POST'])
@jwt_required()
def run_test():
    """执行单个测试用例"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        test_data = TestRunRequest(**data)
        
        success, result = test_service.run_test(test_data, user_id)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        return jsonify(BaseResponse(data=result).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/test/run/batch', methods=['POST'])
@jwt_required()
def run_batch_tests():
    """批量执行测试用例"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        test_data = TestRunBatchRequest(**data)
        
        success, result = test_service.run_batch_tests(test_data, user_id)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        return jsonify(BaseResponse(data=result).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

# 性能测试相关接口
@api_bp.route('/test/performance', methods=['POST'])
@jwt_required()
def run_performance_test():
    """执行性能测试"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        test_data = TestRunPerformanceRequest(**data)
        
        success, result = test_service.run_performance_test(test_data, user_id)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        return jsonify(BaseResponse(data=result).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

# 鲁棒性测试相关接口
@api_bp.route('/test/robustness', methods=['POST'])
@jwt_required()
def run_robustness_test():
    """执行鲁棒性测试"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        test_data = TestRunRobustnessRequest(**data)
        
        success, result = test_service.run_robustness_test(test_data, user_id)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        return jsonify(BaseResponse(data=result).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

# 测试执行记录相关接口
@api_bp.route('/test/execution', methods=['GET'])
@jwt_required()
def get_test_executions():
    """获取测试执行记录列表"""
    try:
        user_id = get_jwt_identity()
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
        
        return jsonify(BaseResponse(data=executions_data).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/test/execution/<int:execution_id>', methods=['GET'])
@jwt_required()
def get_test_execution(execution_id):
    """获取测试执行记录"""
    try:
        execution = test_service.get_test_execution(execution_id)
        if not execution:
            return jsonify(BaseResponse(code=404, message='Execution not found').dict()), 404
        
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
        
        return jsonify(BaseResponse(data=execution_data).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/test/execution/<int:execution_id>/result', methods=['GET'])
@jwt_required()
def get_test_results(execution_id):
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
        
        return jsonify(BaseResponse(data=results_data).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/dashboard/overview', methods=['GET'])
@jwt_required()
def get_dashboard_overview():
    try:
        user_id = get_jwt_identity()
        success, result = test_service.get_dashboard_overview(user_id)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        return jsonify(BaseResponse(data=result).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500
