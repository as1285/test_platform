import pytest
from app.services.case_service import CaseService
from app.schemas.case import CaseGroupCreate, TestCaseCreate
from app.models.case_group import CaseGroup
from app.models.test_case import TestCase

@pytest.fixture
def case_service():
    return CaseService()

@pytest.fixture
def user(app):
    from app.models.user import User
    from app.models import db
    with app.app_context():
        user = User(username="testuser", email="test@example.com", password_hash="hash")
        db.session.add(user)
        db.session.commit()
        # Refresh to get ID
        db.session.refresh(user)
        user_id = user.id
        return user_id

def test_create_case_group(app, case_service, user):
    user_id = user
    with app.app_context():
        group_data = CaseGroupCreate(name="Test Group")
        success, group = case_service.create_case_group(group_data, user_id)
        
        assert success is True
        assert group.name == "Test Group"
        assert group.user_id == user_id

def test_create_test_case(app, case_service, user):
    user_id = user
    with app.app_context():
        # Create group first
        group_data = CaseGroupCreate(name="Test Group")
        _, group = case_service.create_case_group(group_data, user_id)
        
        # Create test case
        case_data = TestCaseCreate(
            name="Test Case 1",
            group_id=group.id,
            url="http://example.com",
            method="GET"
        )
        success, case = case_service.create_test_case(case_data, user_id)
        
        assert success is True
        assert case.name == "Test Case 1"
        assert case.url == "http://example.com"
        assert case.method == "GET"
        assert case.group_id == group.id

def test_get_test_cases(app, case_service, user):
    user_id = user
    with app.app_context():
        # Create group
        group_data = CaseGroupCreate(name="Test Group")
        _, group = case_service.create_case_group(group_data, user_id)
        
        # Create test case 1
        case_data1 = TestCaseCreate(
            name="Case 1",
            group_id=group.id,
            url="http://example.com/1",
            method="GET"
        )
        case_service.create_test_case(case_data1, user_id)
        
        # Create test case 2
        case_data2 = TestCaseCreate(
            name="Case 2",
            group_id=group.id,
            url="http://example.com/2",
            method="POST"
        )
        case_service.create_test_case(case_data2, user_id)
        
        # Get cases
        cases = case_service.get_test_cases(user_id)
        assert len(cases) == 2
        
        # Get cases by group
        cases_in_group = case_service.get_test_cases(user_id, group.id)
        assert len(cases_in_group) == 2

def test_delete_test_case(app, case_service, user):
    user_id = user
    with app.app_context():
        # Create group and case
        group_data = CaseGroupCreate(name="Test Group")
        _, group = case_service.create_case_group(group_data, user_id)
        
        case_data = TestCaseCreate(
            name="To Delete",
            group_id=group.id,
            url="http://example.com",
            method="DELETE"
        )
        _, case = case_service.create_test_case(case_data, user_id)
        case_id = case.id
        
        # Delete case
        success, message = case_service.delete_test_case(case_id)
        assert success is True
        
        # Verify deletion
        deleted_case = case_service.get_test_case_by_id(case_id)
        assert deleted_case is None
