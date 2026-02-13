from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.api import api_bp
from app.services import case_service
from app.schemas.case import CaseGroupCreate, CaseGroupUpdate, TestCaseCreate, TestCaseUpdate, TestStepCreate, TestStepUpdate, TagCreate
from app.schemas import BaseResponse, PaginatedResponse

# 用例分组相关接口
@api_bp.route('/case/group', methods=['POST'])
@jwt_required()
def create_case_group():
    """创建用例分组"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        group_data = CaseGroupCreate(**data)
        
        success, result = case_service.create_case_group(group_data, user_id)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        # 构建返回数据
        group_data = {
            'id': result.id,
            'name': result.name,
            'parent_id': result.parent_id,
            'user_id': result.user_id,
            'create_time': result.create_time.isoformat() if result.create_time else None,
            'update_time': result.update_time.isoformat() if result.update_time else None
        }
        
        return jsonify(BaseResponse(data=group_data).dict()), 201
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/case/group', methods=['GET'])
@jwt_required()
def get_case_groups():
    """获取用例分组列表"""
    try:
        user_id = get_jwt_identity()
        groups = case_service.get_case_groups(user_id)
        
        groups_data = []
        for group in groups:
            groups_data.append({
                'id': group.id,
                'name': group.name,
                'parent_id': group.parent_id,
                'user_id': group.user_id,
                'create_time': group.create_time.isoformat() if group.create_time else None,
                'update_time': group.update_time.isoformat() if group.update_time else None
            })
        
        return jsonify(BaseResponse(data=groups_data).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/case/group/<int:group_id>', methods=['PUT'])
@jwt_required()
def update_case_group(group_id):
    """更新用例分组"""
    try:
        data = request.json
        group_data = CaseGroupUpdate(**data)
        
        success, result = case_service.update_case_group(group_id, group_data)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        # 构建返回数据
        group_data = {
            'id': result.id,
            'name': result.name,
            'parent_id': result.parent_id,
            'user_id': result.user_id,
            'create_time': result.create_time.isoformat() if result.create_time else None,
            'update_time': result.update_time.isoformat() if result.update_time else None
        }
        
        return jsonify(BaseResponse(data=group_data).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/case/group/<int:group_id>', methods=['DELETE'])
@jwt_required()
def delete_case_group(group_id):
    """删除用例分组"""
    try:
        success, result = case_service.delete_case_group(group_id)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        return jsonify(BaseResponse(message=result).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

# 测试用例相关接口
@api_bp.route('/case', methods=['POST'])
@jwt_required()
def create_test_case():
    """创建测试用例"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        case_data = TestCaseCreate(**data)
        
        success, result = case_service.create_test_case(case_data, user_id)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        # 构建返回数据
        case_data = {
            'id': result.id,
            'name': result.name,
            'group_id': result.group_id,
            'user_id': result.user_id,
            'description': result.description,
            'status': result.status,
            'method': result.method,
            'url': result.url,
            'headers': result.headers,
            'body': result.body,
            'validate': result.validate,
            'extract': result.extract,
            'variables': result.variables,
            'create_time': result.create_time.isoformat() if result.create_time else None,
            'update_time': result.update_time.isoformat() if result.update_time else None
        }
        
        return jsonify(BaseResponse(data=case_data).dict()), 201
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/case', methods=['GET'])
@jwt_required()
def get_test_cases():
    """获取测试用例列表"""
    try:
        user_id = get_jwt_identity()
        group_id = request.args.get('group_id', type=int)
        
        cases = case_service.get_test_cases(user_id, group_id)
        
        cases_data = []
        for case in cases:
            cases_data.append({
                'id': case.id,
                'name': case.name,
                'group_id': case.group_id,
                'user_id': case.user_id,
                'description': case.description,
                'status': case.status,
                'method': case.method,
                'url': case.url,
                'create_time': case.create_time.isoformat() if case.create_time else None,
                'update_time': case.update_time.isoformat() if case.update_time else None
            })
        
        return jsonify(BaseResponse(data=cases_data).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/case/<int:case_id>', methods=['GET'])
@jwt_required()
def get_test_case(case_id):
    """获取测试用例详情"""
    try:
        case = case_service.get_test_case_by_id(case_id)
        if not case:
            return jsonify(BaseResponse(code=404, message='Test case not found').dict()), 404
        
        case_data = {
            'id': case.id,
            'name': case.name,
            'group_id': case.group_id,
            'user_id': case.user_id,
            'description': case.description,
            'status': case.status,
            'method': case.method,
            'url': case.url,
            'headers': case.headers,
            'body': case.body,
            'validate': case.validate,
            'extract': case.extract,
            'variables': case.variables,
            'create_time': case.create_time.isoformat() if case.create_time else None,
            'update_time': case.update_time.isoformat() if case.update_time else None
        }
        
        return jsonify(BaseResponse(data=case_data).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/case/<int:case_id>', methods=['PUT'])
@jwt_required()
def update_test_case(case_id):
    """更新测试用例"""
    try:
        data = request.json
        case_data = TestCaseUpdate(**data)
        
        success, result = case_service.update_test_case(case_id, case_data)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        # 构建返回数据
        case_data = {
            'id': result.id,
            'name': result.name,
            'group_id': result.group_id,
            'user_id': result.user_id,
            'description': result.description,
            'status': result.status,
            'method': result.method,
            'url': result.url,
            'headers': result.headers,
            'body': result.body,
            'validate': result.validate,
            'extract': result.extract,
            'variables': result.variables,
            'create_time': result.create_time.isoformat() if result.create_time else None,
            'update_time': result.update_time.isoformat() if result.update_time else None
        }
        
        return jsonify(BaseResponse(data=case_data).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/case/<int:case_id>', methods=['DELETE'])
@jwt_required()
def delete_test_case(case_id):
    """删除测试用例"""
    try:
        success, result = case_service.delete_test_case(case_id)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        return jsonify(BaseResponse(message=result).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

# 测试步骤相关接口
@api_bp.route('/case/step', methods=['POST'])
@jwt_required()
def create_test_step():
    """创建测试步骤"""
    try:
        data = request.json
        step_data = TestStepCreate(**data)
        
        success, result = case_service.create_test_step(step_data)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        # 构建返回数据
        step_data = {
            'id': result.id,
            'case_id': result.case_id,
            'step_order': result.step_order,
            'name': result.name,
            'method': result.method,
            'url': result.url,
            'headers': result.headers,
            'body': result.body,
            'validate': result.validate,
            'extract': result.extract,
            'create_time': result.create_time.isoformat() if result.create_time else None
        }
        
        return jsonify(BaseResponse(data=step_data).dict()), 201
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/case/step/<int:case_id>', methods=['GET'])
@jwt_required()
def get_test_steps(case_id):
    """获取测试步骤列表"""
    try:
        steps = case_service.get_test_steps(case_id)
        
        steps_data = []
        for step in steps:
            steps_data.append({
                'id': step.id,
                'case_id': step.case_id,
                'step_order': step.step_order,
                'name': step.name,
                'method': step.method,
                'url': step.url,
                'headers': step.headers,
                'body': step.body,
                'validate': step.validate,
                'extract': step.extract,
                'create_time': step.create_time.isoformat() if step.create_time else None
            })
        
        return jsonify(BaseResponse(data=steps_data).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/case/step/<int:step_id>', methods=['PUT'])
@jwt_required()
def update_test_step(step_id):
    """更新测试步骤"""
    try:
        data = request.json
        step_data = TestStepUpdate(**data)
        
        success, result = case_service.update_test_step(step_id, step_data)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        # 构建返回数据
        step_data = {
            'id': result.id,
            'case_id': result.case_id,
            'step_order': result.step_order,
            'name': result.name,
            'method': result.method,
            'url': result.url,
            'headers': result.headers,
            'body': result.body,
            'validate': result.validate,
            'extract': result.extract,
            'create_time': result.create_time.isoformat() if result.create_time else None
        }
        
        return jsonify(BaseResponse(data=step_data).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/case/step/<int:step_id>', methods=['DELETE'])
@jwt_required()
def delete_test_step(step_id):
    """删除测试步骤"""
    try:
        success, result = case_service.delete_test_step(step_id)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        return jsonify(BaseResponse(message=result).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

# 标签相关接口
@api_bp.route('/case/tag', methods=['POST'])
@jwt_required()
def create_tag():
    """创建标签"""
    try:
        data = request.json
        tag_data = TagCreate(**data)
        
        success, result = case_service.create_tag(tag_data)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        # 构建返回数据
        tag_data = {
            'id': result.id,
            'name': result.name,
            'create_time': result.create_time.isoformat() if result.create_time else None
        }
        
        return jsonify(BaseResponse(data=tag_data).dict()), 201
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/case/tag', methods=['GET'])
@jwt_required()
def get_tags():
    """获取标签列表"""
    try:
        tags = case_service.get_tags()
        
        tags_data = []
        for tag in tags:
            tags_data.append({
                'id': tag.id,
                'name': tag.name,
                'create_time': tag.create_time.isoformat() if tag.create_time else None
            })
        
        return jsonify(BaseResponse(data=tags_data).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/case/<int:case_id>/tag/<int:tag_id>', methods=['POST'])
@jwt_required()
def add_tag_to_case(case_id, tag_id):
    """给用例添加标签"""
    try:
        success, result = case_service.add_tag_to_case(case_id, tag_id)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        return jsonify(BaseResponse(message=result).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/case/<int:case_id>/tag/<int:tag_id>', methods=['DELETE'])
@jwt_required()
def remove_tag_from_case(case_id, tag_id):
    """从用例移除标签"""
    try:
        success, result = case_service.remove_tag_from_case(case_id, tag_id)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        return jsonify(BaseResponse(message=result).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/case/<int:case_id>/tag', methods=['GET'])
@jwt_required()
def get_case_tags(case_id):
    """获取用例的标签"""
    try:
        tags = case_service.get_case_tags(case_id)
        
        tags_data = []
        for tag in tags:
            tags_data.append({
                'id': tag.id,
                'name': tag.name,
                'create_time': tag.create_time.isoformat() if tag.create_time else None
            })
        
        return jsonify(BaseResponse(data=tags_data).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500
