import requests
import random
import string
import json
import time
from datetime import datetime

BASE_URL = "http://127.0.0.1:8081/api/v1"

class DataGenerator:
    def __init__(self):
        self.users = []
        self.groups = []
        self.cases = []
        self.executions = []

    def random_string(self, length=8):
        return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

    def random_email(self):
        return f"user_{self.random_string(6)}@example.com"

    def log(self, message):
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def create_users(self, count=5):
        self.log(f"开始创建 {count} 个用户...")
        for _ in range(count):
            email = self.random_email()
            password = "password123"
            username = f"User_{self.random_string(4)}"
            
            # 注册
            payload = {
                "username": username,
                "password": password,
                "email": email,
                "role": "tester"
            }
            try:
                resp = requests.post(f"{BASE_URL}/user/register", json=payload)
                if resp.status_code == 201:
                    user_data = resp.json()['data']
                    self.log(f"用户注册成功: {email}")
                    
                    # 登录获取Token
                    login_payload = {"email": email, "password": password}
                    login_resp = requests.post(f"{BASE_URL}/user/login", json=login_payload)
                    if login_resp.status_code == 200:
                        token = login_resp.json()['data']['access_token']
                        self.users.append({
                            "id": user_data['id'],
                            "email": email,
                            "token": token,
                            "headers": {"Authorization": f"Bearer {token}"}
                        })
                else:
                    self.log(f"用户注册失败: {resp.text}")
            except Exception as e:
                self.log(f"创建用户异常: {str(e)}")

    def create_groups(self):
        self.log("开始创建用例分组...")
        if not self.users:
            self.log("没有可用用户，跳过创建分组")
            return

        group_names = ["登录模块", "支付模块", "用户中心", "商品管理", "订单流程", "搜索功能"]
        
        for user in self.users:
            # 每个用户创建 2-3 个分组
            for _ in range(random.randint(2, 3)):
                group_name = f"{random.choice(group_names)}_{self.random_string(4)}"
                payload = {
                    "name": group_name,
                    "parent_id": None
                }
                try:
                    resp = requests.post(f"{BASE_URL}/case/group", json=payload, headers=user['headers'])
                    if resp.status_code == 201:
                        group_data = resp.json()['data']
                        self.groups.append({
                            "id": group_data['id'],
                            "name": group_name,
                            "user_header": user['headers'],
                            "user_id": user['id']
                        })
                        self.log(f"用户 {user['email']} 创建分组: {group_name}")
                        
                        # 创建子分组
                        if random.choice([True, False]):
                            sub_payload = {
                                "name": f"{group_name}_子分组",
                                "parent_id": group_data['id']
                            }
                            sub_resp = requests.post(f"{BASE_URL}/case/group", json=sub_payload, headers=user['headers'])
                            if sub_resp.status_code == 201:
                                sub_group = sub_resp.json()['data']
                                self.groups.append({
                                    "id": sub_group['id'],
                                    "name": sub_group['name'],
                                    "user_header": user['headers'],
                                    "user_id": user['id']
                                })
                except Exception as e:
                    self.log(f"创建分组异常: {str(e)}")

    def create_cases(self):
        self.log("开始创建测试用例...")
        if not self.groups:
            self.log("没有可用分组，跳过创建用例")
            return

        methods = ["GET", "POST", "PUT", "DELETE"]
        
        for group in self.groups:
            # 每个分组创建 3-5 个用例
            for i in range(random.randint(3, 5)):
                case_name = f"测试用例_{self.random_string(4)}"
                # 构造一个真实的请求体，这里我们请求一些公共API或者模拟请求
                # 为了确保测试能跑通，我们请求后端的 health 接口
                
                payload = {
                    "name": case_name,
                    "description": f"这是属于 {group['name']} 的测试用例 {i+1}",
                    "group_id": group['id'],
                    "method": "GET",
                    "url": "http://test_platform_backend:5000/health",
                    "headers": {"Content-Type": "application/json"},
                    "body": "{}",
                    "extract": [],
                    "validate": [{"eq": ["status_code", 200]}],
                    "variables": {}
                }
                
                try:
                    resp = requests.post(f"{BASE_URL}/case", json=payload, headers=group['user_header'])
                    if resp.status_code == 201:
                        case_data = resp.json()['data']
                        self.cases.append({
                            "id": case_data['id'],
                            "name": case_name,
                            "user_header": group['user_header']
                        })
                        self.log(f"创建用例成功: {case_name} (ID: {case_data['id']})")
                    else:
                        self.log(f"创建用例失败: {resp.status_code} {resp.text}")
                except Exception as e:
                    self.log(f"创建用例异常: {str(e)}")

    def execute_tests(self):
        self.log("开始执行测试...")
        if not self.cases:
            self.log("没有可用用例，跳过执行")
            return

        # 1. 批量自动化测试
        for user in self.users:
            # 随机选几个该用户的用例（或者任意用例，只要权限允许）
            # 假设所有用户都能运行所有公开用例，或者我们只运行自己的。
            # 这里简单起见，随机选几个用例运行
            selected_cases = random.sample(self.cases, min(len(self.cases), 5))
            case_ids = [c['id'] for c in selected_cases]
            
            payload = {
                "case_ids": case_ids,
                "parameters": None
            }
            
            try:
                resp = requests.post(f"{BASE_URL}/test/run/batch", json=payload, headers=user['headers'])
                if resp.status_code == 200:
                    self.log(f"用户 {user['email']} 批量执行测试成功，包含 {len(case_ids)} 个用例")
                    # 记录执行结果ID以便后续生成报告（如果有返回执行ID的话）
                    # 实际接口返回结构：{"code": 200, "data": [{"case_id": 1, "result": {...}}]}
                    # 似乎没有直接返回一个聚合的 batch_execution_id，而是每个用例单独的 result
                    pass
            except Exception as e:
                self.log(f"批量执行异常: {str(e)}")

        # 2. 性能测试
        for _ in range(3):
            case = random.choice(self.cases)
            payload = {
                "case_id": case['id'],
                "concurrency": random.randint(2, 5),
                "duration": random.randint(3, 10),
                "ramp_up_config": None
            }
            try:
                resp = requests.post(f"{BASE_URL}/test/performance", json=payload, headers=case['user_header'])
                if resp.status_code == 200:
                    self.log(f"性能测试启动成功: 用例ID {case['id']}")
            except Exception as e:
                self.log(f"性能测试异常: {str(e)}")

        # 3. 鲁棒性测试
        for _ in range(3):
            case = random.choice(self.cases)
            payload = {
                "case_id": case['id'],
                "fault_injection_config": "boundary"
            }
            try:
                resp = requests.post(f"{BASE_URL}/test/robustness", json=payload, headers=case['user_header'])
                if resp.status_code == 200:
                    self.log(f"鲁棒性测试启动成功: 用例ID {case['id']}")
            except Exception as e:
                self.log(f"鲁棒性测试异常: {str(e)}")

    def create_reports(self):
        self.log("开始生成报告...")
        if not self.users:
            return

        for user in self.users:
            # 创建报告
            payload = {
                "name": f"自动化测试报告_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "type": "automation",
                "description": "系统自动生成的测试报告"
            }
            try:
                resp = requests.post(f"{BASE_URL}/report", json=payload, headers=user['headers'])
                if resp.status_code == 201:
                    self.log(f"用户 {user['email']} 创建报告成功")
            except Exception as e:
                self.log(f"创建报告异常: {str(e)}")

    def run(self):
        self.create_users(3)  # 创建3个用户
        self.create_groups()  # 创建分组
        self.create_cases()   # 创建用例
        self.execute_tests()  # 执行测试
        self.create_reports() # 创建报告
        self.log("所有数据生成任务完成！")

if __name__ == "__main__":
    generator = DataGenerator()
    generator.run()
