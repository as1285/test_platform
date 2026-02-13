#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
检查Flask服务器状态
"""

import requests
import sys
sys.path.insert(0, 'v:\\test_platform\\backend')

from run import create_app

app = create_app()

print("=" * 60)
print("Flask应用URL映射")
print("=" * 60)

# 打印所有路由
for rule in app.url_map.iter_rules():
    methods = ','.join(rule.methods - {'HEAD', 'OPTIONS'})
    print(f"{rule.endpoint:30s} {methods:15s} {rule.rule}")

print("=" * 60)

# 使用Flask测试客户端测试
with app.test_client() as client:
    print("\n使用Flask测试客户端测试:")
    response = client.post('/api/v1/user/register',
                          json={
                              'username': 'testuser5',
                              'email': 'test5@example.com',
                              'password': '123456'
                          })
    print(f"Status: {response.status_code}")
    print(f"Response: {response.get_json()}")

print("\n" + "=" * 60)
print("使用requests测试外部服务器:")
print("=" * 60)

# 使用requests测试外部服务器
try:
    response = requests.post('http://localhost:5000/api/v1/user/register',
                            json={
                                'username': 'testuser6',
                                'email': 'test6@example.com',
                                'password': '123456'
                            })
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {e}")
