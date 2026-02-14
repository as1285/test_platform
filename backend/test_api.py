#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
API接口测试脚本
测试所有后端API接口并报告问题
"""

import requests
import json
import sys
import time

BASE_URL = "http://127.0.0.1:8081/api/v1"

class APITester:
    def __init__(self):
        self.session = requests.Session()
        self.token = None
        self.results = []
        self.case_group_id = None
        self.case_id = None
        
    def log(self, message, level="INFO"):
        """记录测试结果"""
        prefix = {"INFO": "[INFO]", "ERROR": "[ERROR]", "SUCCESS": "[SUCCESS]", "WARN": "[WARN]"}.get(level, "[INFO]")
        print(f"{prefix} {message}")
        self.results.append({"level": level, "message": message})
        
    def test_register(self):
        """测试用户注册接口"""
        self.log("\n=== 测试用户注册接口 ===")
        try:
            # 使用时间戳生成唯一用户，避免重复注册失败
            timestamp = int(time.time())
            data = {
                "username": f"testuser{timestamp}",
                "email": f"test{timestamp}@example.com",
                "password": "password123"
            }
            # 保存用于登录
            self.test_email = data["email"]
            self.test_password = data["password"]
            
            response = self.session.post(f"{BASE_URL}/user/register", json=data)
            self.log(f"状态码: {response.status_code}")
            self.log(f"响应: {response.text[:200]}")
            
            if response.status_code == 201:
                self.log("用户注册成功", "SUCCESS")
                return True
            elif response.status_code == 400 and "已存在" in response.text:
                self.log("用户已存在，跳过注册", "WARN")
                # 如果注册失败，尝试使用默认测试账号
                self.test_email = "test123@example.com"
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
                "email": getattr(self, "test_email", "test123@example.com"),
                "password": getattr(self, "test_password", "password123")
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
            # URL修正: /api/cases/groups -> /case/group
            response = self.session.post(f"{BASE_URL}/case/group", json=data)
            self.log(f"状态码: {response.status_code}")
            self.log(f"响应: {response.text[:200]}")
            
            if response.status_code == 201:
                result = response.json()
                self.case_group_id = result.get("data", {}).get("id")
                self.log(f"创建用例分组成功, ID: {self.case_group_id}", "SUCCESS")
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
            # URL修正: /api/cases/groups -> /case/group
            response = self.session.get(f"{BASE_URL}/case/group")
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
        if not self.case_group_id:
            self.log("缺少分组ID，跳过创建用例测试", "WARN")
            return False
            
        try:
            data = {
                "name": "测试用例1",
                "description": "这是一个测试用例",
                "group_id": self.case_group_id,
                "method": "GET",
                "url": "https://api.example.com/test",
                "headers": {"Content-Type": "application/json"},
                "body": "{}",
                "extract": [],
                "validate": [{"eq": ["status_code", 200]}],
                "variables": {}
            }
            # URL修正: /api/cases -> /case
            response = self.session.post(f"{BASE_URL}/case", json=data)
            self.log(f"状态码: {response.status_code}")
            self.log(f"响应: {response.text[:200]}")
            
            if response.status_code == 201:
                result = response.json()
                self.case_id = result.get("data", {}).get("id")
                self.log(f"创建测试用例成功, ID: {self.case_id}", "SUCCESS")
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
            # URL修正: /api/cases -> /case
            response = self.session.get(f"{BASE_URL}/case")
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
        if not self.case_id:
            self.log("缺少用例ID，跳过自动化测试", "WARN")
            return False
            
        try:
            # 修正Payload和URL
            data = {
                "case_ids": [self.case_id],
                "parameters": None
            }
            
            # URL修正: /api/tests/execute -> /test/run/batch
            response = self.session.post(f"{BASE_URL}/test/run/batch", json=data)
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
        if not self.case_id:
            self.log("缺少用例ID，跳过性能测试", "WARN")
            return False
            
        try:
            # 修正Payload和URL
            data = {
                "case_id": self.case_id,
                "concurrency": 2,
                "duration": 5,
                "ramp_up_config": None
            }
            # URL修正: /api/tests/performance -> /test/performance
            response = self.session.post(f"{BASE_URL}/test/performance", json=data)
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
        if not self.case_id:
            self.log("缺少用例ID，跳过鲁棒性测试", "WARN")
            return False
            
        try:
            # 修正Payload和URL
            data = {
                "case_id": self.case_id,
                "fault_injection_config": "boundary"
            }
            # URL修正: /api/tests/robustness -> /test/robustness
            response = self.session.post(f"{BASE_URL}/test/robustness", json=data)
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
            # URL修正: /api/reports -> /report
            response = self.session.get(f"{BASE_URL}/report")
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
