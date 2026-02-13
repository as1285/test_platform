#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试Flask应用的路由
"""

import sys
sys.path.insert(0, 'v:\\test_platform\\backend')

from run import create_app

app = create_app()

# 打印所有路由
print("Flask应用路由列表:")
print("=" * 60)
for rule in app.url_map.iter_rules():
    methods = ','.join(rule.methods - {'HEAD', 'OPTIONS'})
    print(f"{rule.endpoint:30s} {methods:15s} {rule.rule}")
print("=" * 60)

# 测试客户端
with app.test_client() as client:
    # 测试注册接口 - 使用新的邮箱
    print("\n测试用户注册接口:")
    import time
    unique_email = f"test{int(time.time())}@example.com"
    response = client.post('/api/v1/user/register', 
                          json={
                              'username': f'testuser{int(time.time())}',
                              'email': unique_email,
                              'password': 'password123'
                          })
    print(f"Status: {response.status_code}")
    print(f"Response: {response.get_json()}")
    
    # 测试登录接口
    print("\n测试用户登录接口:")
    response = client.post('/api/v1/user/login',
                          json={
                              'email': unique_email,
                              'password': 'password123'
                          })
    print(f"Status: {response.status_code}")
    print(f"Response: {response.get_json()}")
