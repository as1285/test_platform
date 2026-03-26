#!/usr/bin/env python3
"""
插入测试账号并设置token不过期
"""
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from run import create_app
from app.models import db, User
import hashlib

def create_test_user():
    """创建测试账号"""
    app = create_app()
    
    with app.app_context():
        # 检查用户是否已存在
        existing_user = User.query.filter_by(username='1').first()
        if existing_user:
            print(f"用户 '1' 已存在，ID: {existing_user.id}")
            return existing_user
        
        # 密码加密
        hashed_password = hashlib.sha256('1'.encode()).hexdigest()
        
        # 创建用户
        user = User(
            username='1',
            email='1@test.com',
            password_hash=hashed_password,
            role='admin',  # 设置为管理员角色
            status='active'
        )
        
        db.session.add(user)
        db.session.commit()
        
        print(f"测试账号创建成功！")
        print(f"用户名: 1")
        print(f"密码: 1")
        print(f"邮箱: 1@test.com")
        print(f"用户ID: {user.id}")
        print(f"角色: admin")
        
        return user

if __name__ == '__main__':
    create_test_user()