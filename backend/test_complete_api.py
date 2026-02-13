#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
完整API测试脚本 - 测试所有后端API接口
"""

import requests
import json

BASE_URL = "http://127.0.0.1:5000/api/v1"

class APITester:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.group_id = None
        self.case_id = None
        self.execution_id = None
        
    def login(self):
        """登录获取token"""
        print("\n" + "="*60)
        print("1. 用户登录")
        print("="*60)
        
        # 先尝试登录
        response = requests.post(f"{BASE_URL}/user/login", json={
            "email": "test2@example.com",
            "password": "password123"
        })
        
        if response.status_code == 200:
            data = response.json()
            self.token = data["data"]["access_token"]
            self.user_id = data["data"]["user"]["id"]
            print(f"✅ 登录成功")
            print(f"   Token: {self.token[:30]}...")
            print(f"   User ID: {self.user_id}")
            return True
        else:
            # 如果登录失败，尝试注册
            print("登录失败，尝试注册新用户...")
            return self.register()
    
    def register(self):
        """注册用户"""
        response = requests.post(f"{BASE_URL}/user/register", json={
            "username": "testuser_api",
            "email": "testapi@example.com",
            "password": "password123"
        })
        
        if response.status_code in [200, 201]:
            print("✅ 注册成功")
            # 注册后登录
            return self.login()
        else:
            print(f"❌ 注册失败: {response.text[:100]}")
            return False
    
    def get_headers(self):
        """获取请求头"""
        return {"Authorization": f"Bearer {self.token}"}
    
    def test_user_apis(self):
        """测试用户管理接口"""
        print("\n" + "="*60)
        print("2. 用户管理接口测试")
        print("="*60)
        
        # 获取当前用户信息
        print("\n2.1 获取当前用户信息...")
        response = requests.get(f"{BASE_URL}/user/me", headers=self.get_headers())
        if response.status_code == 200:
            print("✅ 获取当前用户信息成功")
        else:
            print(f"❌ 获取当前用户信息失败: {response.text[:100]}")
        
        # 获取用户列表
        print("\n2.2 获取用户列表...")
        response = requests.get(f"{BASE_URL}/user", headers=self.get_headers())
        if response.status_code == 200:
            print("✅ 获取用户列表成功")
        else:
            print(f"❌ 获取用户列表失败: {response.text[:100]}")
        
        # 获取指定用户信息
        print(f"\n2.3 获取指定用户信息 (ID: {self.user_id})...")
        response = requests.get(f"{BASE_URL}/user/{self.user_id}", headers=self.get_headers())
        if response.status_code == 200:
            print("✅ 获取指定用户信息成功")
        else:
            print(f"❌ 获取指定用户信息失败: {response.text[:100]}")
        
        # 更新当前用户信息
        print("\n2.4 更新当前用户信息...")
        import time
        response = requests.put(f"{BASE_URL}/user/me", headers=self.get_headers(), json={
            "username": f"testuser_{int(time.time())}"
        })
        if response.status_code == 200:
            print("✅ 更新当前用户信息成功")
        else:
            print(f"❌ 更新当前用户信息失败: {response.text[:100]}")
        
        # 更新指定用户信息
        print(f"\n2.5 更新指定用户信息 (ID: {self.user_id})...")
        response = requests.put(f"{BASE_URL}/user/{self.user_id}", headers=self.get_headers(), json={
            "username": "testuser_updated2",
            "email": "testapi@example.com",
            "role": "tester",
            "status": "active"
        })
        if response.status_code == 200:
            print("✅ 更新指定用户信息成功")
        else:
            print(f"❌ 更新指定用户信息失败: {response.text[:100]}")
    
    def test_case_group_apis(self):
        """测试用例分组接口"""
        print("\n" + "="*60)
        print("3. 用例分组接口测试")
        print("="*60)
        
        # 创建分组
        print("\n3.1 创建用例分组...")
        response = requests.post(f"{BASE_URL}/case/group", headers=self.get_headers(), json={
            "name": "API测试分组",
            "parent_id": None
        })
        if response.status_code in [200, 201]:
            self.group_id = response.json()["data"]["id"]
            print(f"✅ 创建分组成功，ID: {self.group_id}")
        else:
            print(f"❌ 创建分组失败: {response.text[:100]}")
            return False
        
        # 获取分组列表
        print("\n3.2 获取用例分组列表...")
        response = requests.get(f"{BASE_URL}/case/group", headers=self.get_headers())
        if response.status_code == 200:
            print("✅ 获取分组列表成功")
        else:
            print(f"❌ 获取分组列表失败: {response.text[:100]}")
        
        # 更新分组
        print(f"\n3.3 更新用例分组 (ID: {self.group_id})...")
        response = requests.put(f"{BASE_URL}/case/group/{self.group_id}", headers=self.get_headers(), json={
            "name": "API测试分组-已更新"
        })
        if response.status_code == 200:
            print("✅ 更新分组成功")
        else:
            print(f"❌ 更新分组失败: {response.text[:100]}")
        
        return True
    
    def test_case_apis(self):
        """测试用例接口"""
        print("\n" + "="*60)
        print("4. 测试用例接口测试")
        print("="*60)
        
        if not self.group_id:
            print("⚠️ 没有分组ID，跳过后续测试")
            return False
        
        # 创建用例
        print("\n4.1 创建测试用例...")
        response = requests.post(f"{BASE_URL}/case", headers=self.get_headers(), json={
            "name": "API测试用例",
            "group_id": self.group_id,
            "description": "用于API测试的用例",
            "status": "enabled",
            "method": "GET",
            "url": "https://www.example.com",
            "headers": {},
            "body": "",
            "validate": [{"eq": ["status_code", 200]}],
            "extract": [],
            "variables": {}
        })
        if response.status_code in [200, 201]:
            self.case_id = response.json()["data"]["id"]
            print(f"✅ 创建用例成功，ID: {self.case_id}")
        else:
            print(f"❌ 创建用例失败: {response.text[:100]}")
            return False
        
        # 获取用例列表
        print("\n4.2 获取测试用例列表...")
        response = requests.get(f"{BASE_URL}/case", headers=self.get_headers())
        if response.status_code == 200:
            print("✅ 获取用例列表成功")
        else:
            print(f"❌ 获取用例列表失败: {response.text[:100]}")
        
        # 获取用例详情
        print(f"\n4.3 获取测试用例详情 (ID: {self.case_id})...")
        response = requests.get(f"{BASE_URL}/case/{self.case_id}", headers=self.get_headers())
        if response.status_code == 200:
            print("✅ 获取用例详情成功")
        else:
            print(f"❌ 获取用例详情失败: {response.text[:100]}")
        
        # 更新用例
        print(f"\n4.4 更新测试用例 (ID: {self.case_id})...")
        response = requests.put(f"{BASE_URL}/case/{self.case_id}", headers=self.get_headers(), json={
            "name": "API测试用例-已更新",
            "description": "更新后的描述"
        })
        if response.status_code == 200:
            print("✅ 更新用例成功")
        else:
            print(f"❌ 更新用例失败: {response.text[:100]}")
        
        return True
    
    def test_execution_apis(self):
        """测试执行接口"""
        print("\n" + "="*60)
        print("5. 测试执行接口测试")
        print("="*60)
        
        if not self.case_id:
            print("⚠️ 没有用例ID，跳过后续测试")
            return False
        
        # 执行测试
        print(f"\n5.1 执行测试 (Case ID: {self.case_id})...")
        response = requests.post(f"{BASE_URL}/test/run", headers=self.get_headers(), json={
            "case_ids": [self.case_id],
            "environment": "test",
            "concurrent": False,
            "timeout": 60
        })
        if response.status_code == 200:
            result = response.json()
            print("✅ 执行测试成功")
            print(f"   总用例数: {result['data']['total']}")
            print(f"   成功: {result['data']['success_count']}")
            print(f"   失败: {result['data']['failed_count']}")
        else:
            print(f"❌ 执行测试失败: {response.text[:100]}")
        
        # 获取执行记录
        print("\n5.2 获取执行记录...")
        response = requests.get(f"{BASE_URL}/test/execution", headers=self.get_headers())
        if response.status_code == 200:
            print("✅ 获取执行记录成功")
        else:
            print(f"⚠️ 获取执行记录: {response.status_code}")
    
    def test_report_apis(self):
        """测试报告接口"""
        print("\n" + "="*60)
        print("6. 报告管理接口测试")
        print("="*60)
        
        # 获取报告列表
        print("\n6.1 获取报告列表...")
        response = requests.get(f"{BASE_URL}/report", headers=self.get_headers())
        if response.status_code == 200:
            print("✅ 获取报告列表成功")
        else:
            print(f"❌ 获取报告列表失败: {response.text[:100]}")
    
    def test_delete_operations(self):
        """测试删除操作"""
        print("\n" + "="*60)
        print("7. 删除操作测试")
        print("="*60)
        
        # 删除用例（会级联删除执行记录）
        if self.case_id:
            print(f"\n7.1 删除测试用例 (ID: {self.case_id})...")
            response = requests.delete(f"{BASE_URL}/case/{self.case_id}", headers=self.get_headers())
            if response.status_code == 200:
                print("✅ 删除用例成功")
            else:
                print(f"❌ 删除用例失败: {response.text[:100]}")
        
        # 删除分组
        if self.group_id:
            print(f"\n7.2 删除用例分组 (ID: {self.group_id})...")
            response = requests.delete(f"{BASE_URL}/case/group/{self.group_id}", headers=self.get_headers())
            if response.status_code == 200:
                print("✅ 删除分组成功")
            else:
                print(f"❌ 删除分组失败: {response.text[:100]}")
    
    def run_all_tests(self):
        """运行所有测试"""
        print("\n" + "="*60)
        print("开始完整API测试")
        print("="*60)
        
        if not self.login():
            print("❌ 登录/注册失败，终止测试")
            return
        
        self.test_user_apis()
        self.test_case_group_apis()
        self.test_case_apis()
        self.test_execution_apis()
        self.test_report_apis()
        self.test_delete_operations()
        
        print("\n" + "="*60)
        print("API测试完成")
        print("="*60)

if __name__ == "__main__":
    tester = APITester()
    tester.run_all_tests()
