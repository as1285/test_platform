from app.models import CaseGroup, TestCase, TestStep, Tag, CaseTag, db
from app.schemas.case import CaseGroupCreate, CaseGroupUpdate, TestCaseCreate, TestCaseUpdate, TestStepCreate, TestStepUpdate, TagCreate
from app.utils.redis import redis_util

class CaseService:
    """用例服务"""
    
    # 用例分组相关
    def create_case_group(self, group_data: CaseGroupCreate, user_id: int):
        """创建用例分组"""
        try:
            if not group_data.name:
                return False, 'Group name is required'
            
            case_group = CaseGroup(
                name=group_data.name,
                parent_id=group_data.parent_id,
                user_id=user_id
            )
            db.session.add(case_group)
            db.session.commit()
            
            return True, case_group
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def get_case_groups(self, user_id: int):
        """获取用户的用例分组"""
        try:
            groups = CaseGroup.query.filter_by(user_id=user_id).all()
            return groups
        except Exception as e:
            print(f"Get case groups error: {e}")
            return []
    
    def update_case_group(self, group_id: int, group_data: CaseGroupUpdate):
        """更新用例分组"""
        try:
            group = CaseGroup.query.get(group_id)
            if not group:
                return False, 'Case group not found'
            
            if group_data.name:
                group.name = group_data.name
            if group_data.parent_id is not None:
                group.parent_id = group_data.parent_id
            
            db.session.commit()
            return True, group
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def delete_case_group(self, group_id: int):
        """删除用例分组"""
        try:
            group = CaseGroup.query.get(group_id)
            if not group:
                return False, 'Case group not found'
            
            db.session.delete(group)
            db.session.commit()
            return True, 'Case group deleted successfully'
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    # 测试用例相关
    def create_test_case(self, case_data: TestCaseCreate, user_id: int):
        """创建测试用例"""
        try:
            if not case_data.name:
                return False, 'Case name is required'
            if not case_data.url:
                return False, 'URL is required'
            
            test_case = TestCase(
                name=case_data.name,
                group_id=case_data.group_id,
                user_id=user_id,
                description=case_data.description,
                status=case_data.status or 'enabled',
                method=case_data.method or 'GET',
                url=case_data.url,
                headers=case_data.headers,
                body=case_data.body,
                validate=case_data.validate,
                extract=case_data.extract,
                variables=case_data.variables
            )
            db.session.add(test_case)
            db.session.commit()
            
            return True, test_case
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def get_test_cases(self, user_id: int, group_id: int = None):
        """获取测试用例"""
        try:
            query = TestCase.query.filter_by(user_id=user_id)
            if group_id:
                query = query.filter_by(group_id=group_id)
            cases = query.all()
            return cases
        except Exception as e:
            print(f"Get test cases error: {e}")
            return []
    
    def get_test_case_by_id(self, case_id: int):
        """根据ID获取测试用例"""
        try:
            case = TestCase.query.get(case_id)
            return case
        except Exception as e:
            print(f"Get test case error: {e}")
            return None
    
    def update_test_case(self, case_id: int, case_data: TestCaseUpdate):
        """更新测试用例"""
        try:
            case = TestCase.query.get(case_id)
            if not case:
                return False, 'Test case not found'
            
            if case_data.name:
                case.name = case_data.name
            if case_data.group_id:
                case.group_id = case_data.group_id
            if case_data.description is not None:
                case.description = case_data.description
            if case_data.status:
                case.status = case_data.status
            if case_data.method:
                case.method = case_data.method
            if case_data.url:
                case.url = case_data.url
            if case_data.headers is not None:
                case.headers = case_data.headers
            if case_data.body is not None:
                case.body = case_data.body
            if case_data.validate is not None:
                case.validate = case_data.validate
            if case_data.extract is not None:
                case.extract = case_data.extract
            if case_data.variables is not None:
                case.variables = case_data.variables
            
            db.session.commit()
            return True, case
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def delete_test_case(self, case_id: int):
        """删除测试用例"""
        try:
            case = TestCase.query.get(case_id)
            if not case:
                return False, 'Test case not found'
            
            db.session.delete(case)
            db.session.commit()
            return True, 'Test case deleted successfully'
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    # 测试步骤相关
    def create_test_step(self, step_data: TestStepCreate):
        """创建测试步骤"""
        try:
            test_step = TestStep(
                case_id=step_data.case_id,
                step_order=step_data.step_order,
                name=step_data.name,
                method=step_data.method,
                url=step_data.url,
                headers=step_data.headers,
                body=step_data.body,
                validate=step_data.validate,
                extract=step_data.extract
            )
            db.session.add(test_step)
            db.session.commit()
            return True, test_step
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def get_test_steps(self, case_id: int):
        """获取测试步骤"""
        try:
            steps = TestStep.query.filter_by(case_id=case_id).order_by(TestStep.step_order).all()
            return steps
        except Exception as e:
            print(f"Get test steps error: {e}")
            return []
    
    def update_test_step(self, step_id: int, step_data: TestStepUpdate):
        """更新测试步骤"""
        try:
            step = TestStep.query.get(step_id)
            if not step:
                return False, 'Test step not found'
            
            if step_data.step_order is not None:
                step.step_order = step_data.step_order
            if step_data.name:
                step.name = step_data.name
            if step_data.method:
                step.method = step_data.method
            if step_data.url:
                step.url = step_data.url
            if step_data.headers is not None:
                step.headers = step_data.headers
            if step_data.body is not None:
                step.body = step_data.body
            if step_data.validate is not None:
                step.validate = step_data.validate
            if step_data.extract is not None:
                step.extract = step_data.extract
            
            db.session.commit()
            return True, step
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def delete_test_step(self, step_id: int):
        """删除测试步骤"""
        try:
            step = TestStep.query.get(step_id)
            if not step:
                return False, 'Test step not found'
            
            db.session.delete(step)
            db.session.commit()
            return True, 'Test step deleted successfully'
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    # 标签相关
    def create_tag(self, tag_data: TagCreate):
        """创建标签"""
        try:
            if not tag_data.name:
                return False, 'Tag name is required'
            
            existing_tag = Tag.query.filter_by(name=tag_data.name).first()
            if existing_tag:
                return False, 'Tag already exists'
            
            tag = Tag(name=tag_data.name)
            db.session.add(tag)
            db.session.commit()
            return True, tag
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def get_tags(self):
        """获取所有标签"""
        try:
            tags = Tag.query.all()
            return tags
        except Exception as e:
            print(f"Get tags error: {e}")
            return []
    
    def add_tag_to_case(self, case_id: int, tag_id: int):
        """给用例添加标签"""
        try:
            existing_case_tag = CaseTag.query.filter_by(case_id=case_id, tag_id=tag_id).first()
            if existing_case_tag:
                return False, 'Tag already added to case'
            
            case_tag = CaseTag(case_id=case_id, tag_id=tag_id)
            db.session.add(case_tag)
            db.session.commit()
            return True, 'Tag added to case successfully'
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def remove_tag_from_case(self, case_id: int, tag_id: int):
        """从用例移除标签"""
        try:
            case_tag = CaseTag.query.filter_by(case_id=case_id, tag_id=tag_id).first()
            if not case_tag:
                return False, 'Tag not found in case'
            
            db.session.delete(case_tag)
            db.session.commit()
            return True, 'Tag removed from case successfully'
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def get_case_tags(self, case_id: int):
        """获取用例的标签"""
        try:
            case_tags = CaseTag.query.filter_by(case_id=case_id).all()
            tag_ids = [ct.tag_id for ct in case_tags]
            tags = Tag.query.filter(Tag.id.in_(tag_ids)).all()
            return tags
        except Exception as e:
            print(f"Get case tags error: {e}")
            return []
