import pytest
from app.services.user_service import UserService
from app.schemas.user import UserCreate, UserUpdate
from app.models.user import User
from app.models import db

@pytest.fixture
def user_service():
    return UserService()

def test_create_user(app, user_service):
    with app.app_context():
        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="password123",
            role="tester"
        )
        success, result = user_service.create_user(user_data)
        assert success is True
        assert result.username == "testuser"
        assert result.email == "test@example.com"
        
        # Verify password hashing
        assert result.password_hash != "password123"
        assert user_service.verify_password(result, "password123") is True

def test_create_duplicate_user(app, user_service):
    with app.app_context():
        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="password123",
            role="tester"
        )
        user_service.create_user(user_data)
        
        # Try to create same user again
        success, result = user_service.create_user(user_data)
        assert success is False
        assert result == "Email already exists"

def test_get_user(app, user_service):
    with app.app_context():
        # Create user
        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="password123",
            role="tester"
        )
        _, user = user_service.create_user(user_data)
        user_id = user.id
        
        # Get by ID
        fetched_user = user_service.get_user_by_id(user_id)
        assert fetched_user is not None
        assert fetched_user.id == user_id
        
        # Get by Email
        fetched_user_email = user_service.get_user_by_email("test@example.com")
        assert fetched_user_email is not None
        assert fetched_user_email.id == user_id

def test_update_user(app, user_service):
    with app.app_context():
        # Create user
        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="password123",
            role="tester"
        )
        _, user = user_service.create_user(user_data)
        
        # Update user
        update_data = UserUpdate(username="newname")
        success, updated_user = user_service.update_user(user.id, update_data)
        
        assert success is True
        assert updated_user.username == "newname"
        assert updated_user.email == "test@example.com"  # Email should not change

def test_delete_user(app, user_service):
    with app.app_context():
        # Create user
        user_data = UserCreate(
            username="testuser",
            email="test@example.com",
            password="password123",
            role="tester"
        )
        _, user = user_service.create_user(user_data)
        user_id = user.id
        
        # Delete user
        success, message = user_service.delete_user(user_id)
        assert success is True
        
        # Verify deletion
        deleted_user = user_service.get_user_by_id(user_id)
        assert deleted_user is None
