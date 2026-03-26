from flask import request
from flask_restx import Resource
from app.api import api_bp, api
from app.services import case_service
from app.schemas.case import CaseGroupCreate, CaseGroupUpdate, TestCaseCreate, TestCaseUpdate, TestStepCreate, TestStepUpdate, TagCreate
from app.schemas import BaseResponse, PaginatedResponse
from app.models.user import User

# 创建用例命名空间
case_ns = api.namespace('case', description='用例管理相关接口')

# 用例分组相关接口
@case_ns.route('/group')
class CaseGroupList(Resource):
    @case_ns.doc('create_case_group')
        def post(self):
        """创建用例分组"""
        try:
            user_id = 1
            data = request.json
            group_data = CaseGroupCreate(**data)
            
            success, result = case_service.create_case_group(group_data, user_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            # 构建返回数据
            group_data = {
                'id': result.id,
                'name': result.name,
                'parent_id': result.parent_id,
                'user_id': result.user_id,
                'create_time': result.create_time.isoformat() if result.create_time else None,
                'update_time': result.update_time.isoformat() if result.update_time else None
            }
            
            return BaseResponse(data=group_data).dict(), 201
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500
    
    @case_ns.doc('get_case_groups')
        def get(self):
        """获取用例分组列表"""
        try:
            user_id = 1
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
            
            return BaseResponse(data=groups_data).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

@case_ns.route('/group/<int:group_id>')
class CaseGroup(Resource):
    @case_ns.doc('update_case_group')
        def put(self, group_id):
        """更新用例分组"""
        try:
            data = request.json
            group_data = CaseGroupUpdate(**data)
            
            success, result = case_service.update_case_group(group_id, group_data)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            # 构建返回数据
            group_data = {
                'id': result.id,
                'name': result.name,
                'parent_id': result.parent_id,
                'user_id': result.user_id,
                'create_time': result.create_time.isoformat() if result.create_time else None,
                'update_time': result.update_time.isoformat() if result.update_time else None
            }
            
            return BaseResponse(data=group_data).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500
    
    @case_ns.doc('delete_case_group')
        def delete(self, group_id):
        """删除用例分组"""
        try:
            success, result = case_service.delete_case_group(group_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            return BaseResponse(message=result).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=f"An unexpected error occurred: {str(e)}").dict(), 500

# 测试用例相关接口
@case_ns.route('/')
class TestCaseList(Resource):
    @case_ns.doc('create_test_case')
        def post(self):
        """创建测试用例"""
        try:
            user_id = 1
            data = request.json
            case_data = TestCaseCreate(**data)
            
            success, result = case_service.create_test_case(case_data, user_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            # 获取创建人信息
            creator = User.query.filter_by(id=user_id).first()
            creator_name = creator.username if creator else '未知用户'
            
            # 构建返回数据
            case_data = {
                'id': result.id,
                'name': result.name,
                'group_id': result.group_id,
                'user_id': result.user_id,
                'creator': creator_name,
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
            
            return BaseResponse(data=case_data).dict(), 201
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500
    
    @case_ns.doc('get_test_cases')
        def get(self):
        """获取测试用例列表"""
        try:
            user_id = 1
            group_id = request.args.get('group_id', type=int)
            
            cases = case_service.get_test_cases(user_id, group_id)
            
            cases_data = []
            for case in cases:
                # 获取创建人信息
                creator = User.query.filter_by(id=case.user_id).first()
                creator_name = creator.username if creator else '未知用户'
                
                cases_data.append({
                    'id': case.id,
                    'name': case.name,
                    'group_id': case.group_id,
                    'user_id': case.user_id,
                    'creator': creator_name,
                    'description': case.description,
                    'status': case.status,
                    'method': case.method,
                    'url': case.url,
                    'create_time': case.create_time.isoformat() if case.create_time else None,
                    'update_time': case.update_time.isoformat() if case.update_time else None
                })
            
            return BaseResponse(data=cases_data).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

@case_ns.route('/<int:case_id>')
class TestCase(Resource):
    @case_ns.doc('get_test_case')
        def get(self, case_id):
        """获取测试用例详情"""
        try:
            case = case_service.get_test_case_by_id(case_id)
            if not case:
                return BaseResponse(code=404, message='Test case not found').dict(), 404
            
            # 获取创建人信息
            creator = User.query.filter_by(id=case.user_id).first()
            creator_name = creator.username if creator else '未知用户'
            
            case_data = {
                'id': case.id,
                'name': case.name,
                'group_id': case.group_id,
                'user_id': case.user_id,
                'creator': creator_name,
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
            
            return BaseResponse(data=case_data).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500
    
    @case_ns.doc('update_test_case')
        def put(self, case_id):
        """更新测试用例"""
        try:
            data = request.json
            case_data = TestCaseUpdate(**data)
            
            success, result = case_service.update_test_case(case_id, case_data)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            # 获取创建人信息
            creator = User.query.filter_by(id=result.user_id).first()
            creator_name = creator.username if creator else '未知用户'
            
            # 构建返回数据
            case_data = {
                'id': result.id,
                'name': result.name,
                'group_id': result.group_id,
                'user_id': result.user_id,
                'creator': creator_name,
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
            
            return BaseResponse(data=case_data).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500
    
    @case_ns.doc('delete_test_case')
        def delete(self, case_id):
        """删除测试用例"""
        try:
            success, result = case_service.delete_test_case(case_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            return BaseResponse(message=result).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

@case_ns.route('/batch')
class TestCaseBatch(Resource):
    @case_ns.doc('delete_test_cases')
        def delete(self):
        """批量删除测试用例"""
        try:
            user_id = 1
            data = request.json
            case_ids = data.get('case_ids', [])
            
            if not case_ids:
                return BaseResponse(code=400, message='Case IDs are required').dict(), 400
                
            success, result = case_service.delete_test_cases(case_ids, user_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            return BaseResponse(message=result).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

# 测试步骤相关接口
@case_ns.route('/step')
class TestStepCreator(Resource):
    @case_ns.doc('create_test_step')
        def post(self):
        """创建测试步骤"""
        try:
            data = request.json
            step_data = TestStepCreate(**data)
            
            success, result = case_service.create_test_step(step_data)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
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
            
            return BaseResponse(data=step_data).dict(), 201
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

@case_ns.route('/step/<int:case_id>')
class TestStepList(Resource):
    @case_ns.doc('get_test_steps')
        def get(self, case_id):
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
            
            return BaseResponse(data=steps_data).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

@case_ns.route('/step/<int:step_id>')
class TestStep(Resource):
    @case_ns.doc('update_test_step')
        def put(self, step_id):
        """更新测试步骤"""
        try:
            data = request.json
            step_data = TestStepUpdate(**data)
            
            success, result = case_service.update_test_step(step_id, step_data)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
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
            
            return BaseResponse(data=step_data).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500
    
    @case_ns.doc('delete_test_step')
        def delete(self, step_id):
        """删除测试步骤"""
        try:
            success, result = case_service.delete_test_step(step_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            return BaseResponse(message=result).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

# 标签相关接口
@case_ns.route('/tag')
class TagList(Resource):
    @case_ns.doc('create_tag')
        def post(self):
        """创建标签"""
        try:
            data = request.json
            tag_data = TagCreate(**data)
            
            success, result = case_service.create_tag(tag_data)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            # 构建返回数据
            tag_data = {
                'id': result.id,
                'name': result.name,
                'create_time': result.create_time.isoformat() if result.create_time else None
            }
            
            return BaseResponse(data=tag_data).dict(), 201
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500
    
    @case_ns.doc('get_tags')
        def get(self):
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
            
            return BaseResponse(data=tags_data).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

@case_ns.route('/<int:case_id>/tag/<int:tag_id>')
class CaseTag(Resource):
    @case_ns.doc('add_tag_to_case')
        def post(self, case_id, tag_id):
        """给用例添加标签"""
        try:
            success, result = case_service.add_tag_to_case(case_id, tag_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            return BaseResponse(message=result).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500
    
    @case_ns.doc('remove_tag_from_case')
        def delete(self, case_id, tag_id):
        """从用例移除标签"""
        try:
            success, result = case_service.remove_tag_from_case(case_id, tag_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            return BaseResponse(message=result).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

@case_ns.route('/<int:case_id>/tag')
class CaseTagList(Resource):
    @case_ns.doc('get_case_tags')
        def get(self, case_id):
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
            
            return BaseResponse(data=tags_data).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

@case_ns.route('/import')
class CaseImport(Resource):
    @case_ns.doc('import_case_from_doc')
        def post(self):
        """从接口文档导入测试用例"""
        try:
            user_id = 1
            data = request.json
            
            if not data:
                return BaseResponse(code=400, message='Import data is required').dict(), 400
            
            group_id = data.get('group_id')
            if not group_id:
                return BaseResponse(code=400, message='Group ID is required').dict(), 400
            
            api_docs = data.get('api_docs')
            if not api_docs:
                return BaseResponse(code=400, message='API docs are required').dict(), 400
            
            success, result = case_service.import_cases_from_docs(api_docs, group_id, user_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            return BaseResponse(data=result).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500
