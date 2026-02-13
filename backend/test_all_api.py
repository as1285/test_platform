#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
完整API测试脚本
测试所有后端API接口
"""

import requests
import json

BASE_URL = "http://127.0.0.1:5000/api/v1"

def test_api():
    print("=" * 60)
    print("开始测试所有API接口")
    print("=" * 60)
    
    # 1. 用户注册
    print("\n1. 测试用户注册...")
    register_data = {
        "username": "testuser_new",
        "email": "testnew@example.com",
        "password": "password123"
    }
    response = requests.post(f"{BASE_URL}/user/register", json=register_data)
    print(f"   状态码: {response.status_code}")
    if response.status_code in [200, 201]:
        print("   ✅ 注册成功")
    else:
        print(f"   ⚠️ 注册失败: {response.text[:100]}")
    
    # 2. 用户登录
    print("\n2. 测试用户登录...")
    login_data = {
        "email": "testnew@example.com",
        "password": "password123"
    }
    response = requests.post(f"{BASE_URL}/user/login", json=login_data)
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        result = response.json()
        token = result.get("data", {}).get("access_token")
        print("   ✅ 登录成功")
        print(f"   Token: {token[:30]}...")
    else:
        print(f"   ❌ 登录失败: {response.text[:100]}")
        return
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 3. 获取用户信息
    print("\n3. 测试获取用户信息...")
    response = requests.get(f"{BASE_URL}/user/me", headers=headers)
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        print("   ✅ 获取用户信息成功")
    else:
        print(f"   ❌ 获取用户信息失败: {response.text[:100]}")
    
    # 4. 获取用户列表
    print("\n4. 测试获取用户列表...")
    response = requests.get(f"{BASE_URL}/user", headers=headers)
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        print("   ✅ 获取用户列表成功")
    else:
        print(f"   ❌ 获取用户列表失败: {response.text[:100]}")
    
    # 5. 创建用例分组
    print("\n5. 测试创建用例分组...")
    group_data = {
        "name": "测试分组1",
        "parent_id": None
    }
    response = requests.post(f"{BASE_URL}/case/group", headers=headers, json=group_data)
    print(f"   状态码: {response.status_code}")
    if response.status_code in [200, 201]:
        print("   ✅ 创建分组成功")
        group_id = response.json().get("data", {}).get("id")
    else:
        print(f"   ❌ 创建分组失败: {response.text[:100]}")
        group_id = None
    
    # 6. 获取用例分组列表
    print("\n6. 测试获取用例分组列表...")
    response = requests.get(f"{BASE_URL}/case/group", headers=headers)
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        print("   ✅ 获取分组列表成功")
    else:
        print(f"   ❌ 获取分组列表失败: {response.text[:100]}")
    
    # 7. 创建测试用例
    print("\n7. 测试创建测试用例...")
    if group_id:
        case_data = {
            "name": "测试用例1",
            "group_id": group_id,
            "description": "这是一个测试用例",
            "status": "enabled",
            "method": "GET",
            "url": "https://api.example.com/test",
            "headers": json.dumps({"Content-Type": "application/json"}),
            "body": "{}",
            "validate": json.dumps([{"eq": ["status_code", 200]}]),
            "extract": json.dumps([]),
            "variables": json.dumps({})
        }
        response = requests.post(f"{BASE_URL}/case", headers=headers, json=case_data)
        print(f"   状态码: {response.status_code}")
        if response.status_code in [200, 201]:
            print("   ✅ 创建用例成功")
            case_id = response.json().get("data", {}).get("id")
        else:
            print(f"   ❌ 创建用例失败: {response.text[:100]}")
            case_id = None
    else:
        print("   ⚠️ 跳过（没有分组ID）")
        case_id = None
    
    # 8. 获取测试用例列表
    print("\n8. 测试获取测试用例列表...")
    response = requests.get(f"{BASE_URL}/case", headers=headers)
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        print("   ✅ 获取用例列表成功")
    else:
        print(f"   ❌ 获取用例列表失败: {response.text[:100]}")
    
    # 9. 执行测试
    print("\n9. 测试执行自动化测试...")
    if case_id:
        test_data = {
            "case_ids": [case_id],
            "environment": "test",
            "concurrent": False,
            "timeout": 60
        }
        response = requests.post(f"{BASE_URL}/test/run", headers=headers, json=test_data)
        print(f"   状态码: {response.status_code}")
        if response.status_code == 200:
            print("   ✅ 执行测试成功")
        else:
            print(f"   ⚠️ 执行测试失败: {response.text[:100]}")
    else:
        print("   ⚠️ 跳过（没有用例ID）")
    
    # 10. 获取报告列表
    print("\n10. 测试获取报告列表...")
    response = requests.get(f"{BASE_URL}/report", headers=headers)
    print(f"   状态码: {response.status_code}")
    if response.status_code == 200:
        print("   ✅ 获取报告列表成功")
    else:
        print(f"   ❌ 获取报告列表失败: {response.text[:100]}")
    
    print("\n" + "=" * 60)
    print("API测试完成")
    print("=" * 60)

if __name__ == "__main__":
    test_api()
