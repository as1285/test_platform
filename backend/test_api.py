#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
API接口测试脚本
测试所有后端API接口并报告问题
"""

import requests
import json
import sys

BASE_URL = "http://127.0.0.1:5000/api/v1"

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.results = []
        
    def log(self, message, level="INFO"):
        """记录测试结果"""
        prefix = {"INFO": "[INFO]", "ERROR": "[ERROR]", "SUCCESS": "[SUCCESS]", "WARN": "[WARN]"}.get(level, "[INFO]")
        print(f"{prefix} {message}")
        self.results.append({"level": level, "message": message})
        
    def test_register(self):
        """测试用户注册接口"""
        self.log("\n=== 测试用户注册接口 ===")
        try:
            data = {
                "username": "testuser123",
                "email": "test123@example.com",
                "password": "password123"
            }
            response = self.session.post(f"{BASE_URL}/user/register", json=data)
            self.log(f"状态码: {response.status_code}")
            self.log(f"响应: {response.text[:200]}")
            
            if response.status_code == 201:
                self.log("用户注册成功", "SUCCESS")
                return True
            elif response.status_code == 400 and "已存在" in response.text:
                self.log("用户已存在，跳过注册", "WARN")
                return True
            else:
                self.log(f"用户注册失败: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"用户注册异常: {str(e)}", "ERROR")
            return False
            
    def test_login(self):
        """测试用户登录接口"""
        self.log("\n=== 测试用户登录接口 ===")
        try:
            data = {
                "username": "testuser123",
                "password": "password123"
            }
            response = self.session.post(f"{BASE_URL}/user/login", json=data)
            self.log(f"状态码: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                self.token = result.get("data", {}).get("access_token")
                if self.token:
                    self.session.headers.update({"Authorization": f"Bearer {self.token}"})
                    self.log("用户登录成功，获取到token", "SUCCESS")
                    return True
            
            self.log(f"用户登录失败: {response.text}", "ERROR")
            return False
        except Exception as e:
            self.log(f"用户登录异常: {str(e)}", "ERROR")
            return False
            
    def test_get_user_info(self):
        """测试获取用户信息接口"""
        self.log("\n=== 测试获取用户信息接口 ===")
        try:
            response = self.session.get(f"{BASE_URL}/user/me")
            self.log(f"状态码: {response.status_code}")
            self.log(f"响应: {response.text[:200]}")
            
            if response.status_code == 200:
                self.log("获取用户信息成功", "SUCCESS")
                return True
            else:
                self.log(f"获取用户信息失败: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"获取用户信息异常: {str(e)}", "ERROR")
            return False
            
    def test_case_group_create(self):
        """测试创建用例分组接口"""
        self.log("\n=== 测试创建用例分组接口 ===")
        try:
            data = {
                "name": "测试分组",
                "parent_id": None
            }
            response = self.session.post(f"{BASE_URL}/api/cases/groups", json=data)
            self.log(f"状态码: {response.status_code}")
            self.log(f"响应: {response.text[:200]}")
            
            if response.status_code == 201:
                self.log("创建用例分组成功", "SUCCESS")
                return True
            else:
                self.log(f"创建用例分组失败: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"创建用例分组异常: {str(e)}", "ERROR")
            return False
            
    def test_case_group_list(self):
        """测试获取用例分组列表接口"""
        self.log("\n=== 测试获取用例分组列表接口 ===")
        try:
            response = self.session.get(f"{BASE_URL}/api/cases/groups")
            self.log(f"状态码: {response.status_code}")
            self.log(f"响应: {response.text[:200]}")
            
            if response.status_code == 200:
                self.log("获取用例分组列表成功", "SUCCESS")
                return True
            else:
                self.log(f"获取用例分组列表失败: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"获取用例分组列表异常: {str(e)}", "ERROR")
            return False
            
    def test_case_create(self):
        """测试创建测试用例接口"""
        self.log("\n=== 测试创建测试用例接口 ===")
        try:
            data = {
                "name": "测试用例1",
                "description": "这是一个测试用例",
                "group_id": 1,
                "method": "GET",
                "url": "https://api.example.com/test",
                "headers": json.dumps({"Content-Type": "application/json"}),
                "body": "{}",
                "extract": json.dumps([]),
                "validate": json.dumps([{"eq": ["status_code", 200]}]),
                "variables": json.dumps({})
            }
            response = self.session.post(f"{BASE_URL}/api/cases", json=data)
            self.log(f"状态码: {response.status_code}")
            self.log(f"响应: {response.text[:200]}")
            
            if response.status_code == 201:
                self.log("创建测试用例成功", "SUCCESS")
                return True
            else:
                self.log(f"创建测试用例失败: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"创建测试用例异常: {str(e)}", "ERROR")
            return False
            
    def test_case_list(self):
        """测试获取测试用例列表接口"""
        self.log("\n=== 测试获取测试用例列表接口 ===")
        try:
            response = self.session.get(f"{BASE_URL}/api/cases")
            self.log(f"状态码: {response.status_code}")
            self.log(f"响应: {response.text[:200]}")
            
            if response.status_code == 200:
                self.log("获取测试用例列表成功", "SUCCESS")
                return True
            else:
                self.log(f"获取测试用例列表失败: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"获取测试用例列表异常: {str(e)}", "ERROR")
            return False
            
    def test_execute_automation_test(self):
        """测试执行自动化测试接口"""
        self.log("\n=== 测试执行自动化测试接口 ===")
        try:
            data = {
                "case_ids": [1],
                "environment": "test",
                "concurrent": False,
                "timeout": 60
            }
            response = self.session.post(f"{BASE_URL}/api/tests/execute", json=data)
            self.log(f"状态码: {response.status_code}")
            self.log(f"响应: {response.text[:200]}")
            
            if response.status_code == 200:
                self.log("执行自动化测试成功", "SUCCESS")
                return True
            else:
                self.log(f"执行自动化测试失败: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"执行自动化测试异常: {str(e)}", "ERROR")
            return False
            
    def test_execute_performance_test(self):
        """测试执行性能测试接口"""
        self.log("\n=== 测试执行性能测试接口 ===")
        try:
            data = {
                "target_url": "https://api.example.com/test",
                "method": "GET",
                "concurrency": 10,
                "duration": 10,
                "timeout": 30
            }
            response = self.session.post(f"{BASE_URL}/api/tests/performance", json=data)
            self.log(f"状态码: {response.status_code}")
            self.log(f"响应: {response.text[:200]}")
            
            if response.status_code == 200:
                self.log("执行性能测试成功", "SUCCESS")
                return True
            else:
                self.log(f"执行性能测试失败: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"执行性能测试异常: {str(e)}", "ERROR")
            return False
            
    def test_execute_robustness_test(self):
        """测试执行鲁棒性测试接口"""
        self.log("\n=== 测试执行鲁棒性测试接口 ===")
        try:
            data = {
                "target_url": "https://api.example.com/test",
                "method": "GET",
                "injection_types": ["boundary"],
                "circuit_breaker_test": True,
                "degradation_test": True,
                "error_format_test": True,
                "recovery_test": True
            }
            response = self.session.post(f"{BASE_URL}/api/tests/robustness", json=data)
            self.log(f"状态码: {response.status_code}")
            self.log(f"响应: {response.text[:200]}")
            
            if response.status_code == 200:
                self.log("执行鲁棒性测试成功", "SUCCESS")
                return True
            else:
                self.log(f"执行鲁棒性测试失败: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"执行鲁棒性测试异常: {str(e)}", "ERROR")
            return False
            
    def test_report_list(self):
        """测试获取报告列表接口"""
        self.log("\n=== 测试获取报告列表接口 ===")
        try:
            response = self.session.get(f"{BASE_URL}/api/reports")
            self.log(f"状态码: {response.status_code}")
            self.log(f"响应: {response.text[:200]}")
            
            if response.status_code == 200:
                self.log("获取报告列表成功", "SUCCESS")
                return True
            else:
                self.log(f"获取报告列表失败: {response.text}", "ERROR")
                return False
        except Exception as e:
            self.log(f"获取报告列表异常: {str(e)}", "ERROR")
            return False
            
    def run_all_tests(self):
        """运行所有测试"""
        self.log("开始测试所有API接口...")
        self.log(f"基础URL: {BASE_URL}")
        
        tests = [
            ("用户注册", self.test_register),
            ("用户登录", self.test_login),
            ("获取用户信息", self.test_get_user_info),
            ("创建用例分组", self.test_case_group_create),
            ("获取用例分组列表", self.test_case_group_list),
            ("创建测试用例", self.test_case_create),
            ("获取测试用例列表", self.test_case_list),
            ("执行自动化测试", self.test_execute_automation_test),
            ("执行性能测试", self.test_execute_performance_test),
            ("执行鲁棒性测试", self.test_execute_robustness_test),
            ("获取报告列表", self.test_report_list),
        ]
        
        passed = 0
        failed = 0
        
        for name, test_func in tests:
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                self.log(f"测试 '{name}' 发生异常: {str(e)}", "ERROR")
                failed += 1
                
        self.log("\n" + "="*50)
        self.log(f"测试完成: 通过 {passed} 个, 失败 {failed} 个")
        self.log("="*50)
        
        return passed, failed

if __name__ == "__main__":
    tester = APITester()
    passed, failed = tester.run_all_tests()
    
    # 输出测试报告
    print("\n" + "="*50)
    print("详细测试报告:")
    print("="*50)
    for result in tester.results:
        print(f"[{result['level']}] {result['message']}")
    
    # 根据测试结果退出
    sys.exit(0 if failed == 0 else 1)
