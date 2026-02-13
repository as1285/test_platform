from app.models import User, db
from app.schemas.user import UserCreate, UserUpdate
from app.utils.validator import Validator
from app.utils.redis import redis_util
import hashlib

class UserService:
    """用户服务"""
    
    def create_user(self, user_data: UserCreate):
        """创建用户"""
        try:
            # 验证邮箱格式
            if not Validator.validate_email(user_data.email):
                return False, 'Invalid email format'
            
            # 验证密码强度
            if not Validator.validate_password(user_data.password):
                return False, 'Password must be at least 8 characters and contain letters and numbers'
            
            # 检查邮箱是否已存在
            existing_user = User.query.filter_by(email=user_data.email).first()
            if existing_user:
                return False, 'Email already exists'
            
            # 密码加密
            hashed_password = hashlib.sha256(user_data.password.encode()).hexdigest()
            
            # 创建用户
            user = User(
                username=user_data.username,
                email=user_data.email,
                password_hash=hashed_password
            )
            db.session.add(user)
            db.session.commit()
            
            return True, user
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def get_user_by_id(self, user_id: int):
        """根据ID获取用户"""
        try:
            # 检查缓存
            cache_key = f'user:{user_id}'
            cached_user = redis_util.get(cache_key)
            if cached_user:
                return cached_user
            
            # 从数据库获取
            user = User.query.get(user_id)
            if user:
                # 更新缓存
                user_data = {
                    'id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'role': user.role
                }
                redis_util.set(cache_key, user_data, 3600)
                return user
            return None
        except Exception as e:
            print(f"Get user error: {e}")
            return None
    
    def get_user_by_email(self, email: str):
        """根据邮箱获取用户"""
        try:
            return User.query.filter_by(email=email).first()
        except Exception as e:
            print(f"Get user by email error: {e}")
            return None
    
    def update_user(self, user_id: int, user_data: UserUpdate):
        """更新用户"""
        try:
            user = User.query.get(user_id)
            if not user:
                return False, 'User not found'
            
            # 更新字段
            if user_data.username and user_data.username != user.username:
                # 检查用户名是否已被其他用户使用
                existing_user = User.query.filter(
                    User.username == user_data.username,
                    User.id != user_id
                ).first()
                if existing_user:
                    return False, 'Username already exists'
                user.username = user_data.username
            
            if user_data.password:
                # 验证密码强度
                if not Validator.validate_password(user_data.password):
                    return False, 'Password must be at least 8 characters and contain letters and numbers'
                # 密码加密
                user.password_hash = hashlib.sha256(user_data.password.encode()).hexdigest()
            
            db.session.commit()
            
            # 清除缓存
            cache_key = f'user:{user_id}'
            redis_util.delete(cache_key)
            
            return True, user
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def delete_user(self, user_id: int):
        """删除用户"""
        try:
            user = User.query.get(user_id)
            if not user:
                return False, 'User not found'
            
            db.session.delete(user)
            db.session.commit()
            
            # 清除缓存
            cache_key = f'user:{user_id}'
            redis_util.delete(cache_key)
            
            return True, 'User deleted successfully'
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def verify_password(self, user: User, password: str):
        """验证密码"""
        hashed_password = hashlib.sha256(password.encode()).hexdigest()
        return user.password_hash == hashed_password
    
    def get_users(self, page=1, size=10, username=None, role=None, status=None):
        """获取用户列表"""
        try:
            query = User.query
            
            # 应用筛选条件
            if username:
                query = query.filter(User.username.like(f'%{username}%'))
            if role:
                query = query.filter_by(role=role)
            if status:
                query = query.filter_by(status=status)
            
            # 获取总数
            total = query.count()
            
            # 分页
            users = query.offset((page - 1) * size).limit(size).all()
            
            return True, {'items': users, 'total': total}
        except Exception as e:
            return False, str(e)
