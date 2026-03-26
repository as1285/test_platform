#!/usr/bin/env python3
"""
移除JWT认证的脚本
"""
import os
import re

def remove_jwt_auth(file_path):
    """移除文件中的JWT认证"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 移除导入
    content = re.sub(r'from flask_jwt_extended import jwt_required, get_jwt_identity\n', '', content)
    content = re.sub(r'from flask_jwt_extended import jwt_required, get_jwt_identity\n', '', content)
    
    # 移除装饰器
    content = re.sub(r'@jwt_required\(\)\s*\n', '', content)
    
    # 移除get_jwt_identity调用，替换为固定值1
    content = re.sub(r'user_id = get_jwt_identity\(\)', 'user_id = 1', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f"已处理: {file_path}")

if __name__ == '__main__':
    api_files = [
        '/root/test_platform/backend/app/api/case.py',
        '/root/test_platform/backend/app/api/test.py',
        '/root/test_platform/backend/app/api/report.py',
        '/root/test_platform/backend/app/api/docs.py'
    ]
    
    for file_path in api_files:
        if os.path.exists(file_path):
            remove_jwt_auth(file_path)