#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
测试删除用户功能
"""

import requests

BASE_URL = "http://127.0.0.1:5000/api/v1"

def test_delete_user():
    print("="*60)
    print("测试删除用户功能（带级联删除）")
    print("="*60)
    
    # 注册新用户
    print("\n1. 注册新用户...")
    register_response = requests.post(f"{BASE_URL}/user/register", json={
        "username": "delete_test_user",
        "email": "delete_test@example.com",
        "password": "password123"
    })
    print(f"   注册: {register_response.status_code}")
    
    # 登录
    print("\n2. 登录...")
    login_response = requests.post(f"{BASE_URL}/user/login", json={
        "email": "delete_test@example.com",
        "password": "password123"
    })
    print(f"   登录: {login_response.status_code}")
    
    if login_response.status_code != 200:
        print("   ❌ 登录失败")
        return
    
    token = login_response.json()["data"]["access_token"]
    user_id = login_response.json()["data"]["user"]["id"]
    print(f"   用户ID: {user_id}")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 创建分组
    print("\n3. 创建用例分组...")
    group_response = requests.post(f"{BASE_URL}/case/group", headers=headers, json={
        "name": "Test Group",
        "parent_id": None
    })
    print(f"   创建分组: {group_response.status_code}")
    
    if group_response.status_code not in [200, 201]:
        print("   ❌ 创建分组失败")
        return
    
    group_id = group_response.json()["data"]["id"]
    print(f"   分组ID: {group_id}")
    
    # 创建用例
    print("\n4. 创建测试用例...")
    case_response = requests.post(f"{BASE_URL}/case", headers=headers, json={
        "name": "Test Case",
        "group_id": group_id,
        "description": "Test",
        "status": "enabled",
        "method": "GET",
        "url": "https://example.com",
        "headers": {},
        "body": "",
        "validate": [],
        "extract": [],
        "variables": {}
    })
    print(f"   创建用例: {case_response.status_code}")
    
    if case_response.status_code not in [200, 201]:
        print("   ❌ 创建用例失败")
        return
    
    case_id = case_response.json()["data"]["id"]
    print(f"   用例ID: {case_id}")
    
    # 执行测试
    print("\n5. 执行测试...")
    test_response = requests.post(f"{BASE_URL}/test/run", headers=headers, json={
        "case_ids": [case_id]
    })
    print(f"   执行测试: {test_response.status_code}")
    
    # 删除用户（应该级联删除分组、用例、执行记录）
    print("\n6. 删除用户（级联删除）...")
    delete_response = requests.delete(f"{BASE_URL}/user/{user_id}", headers=headers)
    print(f"   删除用户: {delete_response.status_code}")
    
    if delete_response.status_code == 200:
        print("   ✅ 删除用户成功（级联删除正常）")
    else:
        print(f"   ❌ 删除用户失败: {delete_response.text[:200]}")
    
    print("\n" + "="*60)
    print("测试完成")
    print("="*60)

if __name__ == "__main__":
    test_delete_user()
