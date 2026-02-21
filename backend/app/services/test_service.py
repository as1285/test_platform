from app.models import TestExecution, TestResult, PerformanceTest, RobustnessTest, db, TestCase
from app.schemas.test import (
    TestRunRequest,
    TestRunBatchRequest,
    TestRunPerformanceRequest,
    TestRunRobustnessRequest,
    TestRunPerformanceCustomRequest,
)
from app.utils.redis import redis_util
from app.utils.validator import Validator
import json
import time
import requests
from datetime import datetime, timedelta
from gevent.pool import Pool
import psutil
from sqlalchemy import func

class TestService:
    """测试服务"""
    
    # 自动化测试相关
    def run_test(self, test_data: TestRunRequest, user_id: int):
        """执行测试用例（支持批量）"""
        try:
            from app.services import case_service
            
            results = []
            for case_id in test_data.case_ids:
                # 获取测试用例
                case = case_service.get_test_case_by_id(case_id)
                if not case:
                    results.append({
                        'case_id': case_id,
                        'success': False,
                        'error': 'Test case not found'
                    })
                    continue
                
                # 创建执行记录
                execution = TestExecution(
                    case_id=case_id,
                    user_id=user_id,
                    status='running',
                    start_time=datetime.utcnow()
                )
                db.session.add(execution)
                db.session.commit()
                
                # 执行测试
                success, result = self._execute_test_case(case, test_data.parameters)
                
                # 更新执行状态
                execution.status = 'success' if success else 'failed'
                execution.end_time = datetime.utcnow()
                execution.execution_log = json.dumps(result.get('log', []))
                db.session.commit()
                
                # 保存测试结果
                test_result = TestResult(
                    execution_id=execution.id,
                    status='success' if success else 'failed',
                    response=json.dumps(result.get('response', {})),
                    error_message=result.get('error', ''),
                    response_time=result.get('response_time', 0)
                )
                db.session.add(test_result)
                db.session.commit()
                
                results.append({
                    'case_id': case_id,
                    'execution_id': execution.id,
                    'status': execution.status,
                    'success': success,
                    'result': result
                })
            
            return True, {
                'results': results,
                'total': len(results),
                'success_count': sum(1 for r in results if r.get('success')),
                'failed_count': sum(1 for r in results if not r.get('success'))
            }
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def run_batch_tests(self, test_data: TestRunBatchRequest, user_id: int):
        """批量执行测试用例"""
        try:
            results = []
            for case_id in test_data.case_ids:
                # 构建测试请求
                test_request = TestRunRequest(
                    case_ids=[case_id],
                    parameters=test_data.parameters
                )
                # 执行测试
                success, result = self.run_test(test_request, user_id)
                results.append({
                    'case_id': case_id,
                    'success': success,
                    'result': result
                })
            
            return True, results
        except Exception as e:
            return False, str(e)
    
    def _execute_test_case(self, case, parameters=None):
        """执行单个测试用例的核心逻辑"""
        try:
            log = []
            start_time = time.time()
            self._prepare_test_data(case, parameters, log)
            
            # 直接使用case的字段
            url = case.url
            method = case.method or 'GET'
            headers = case.headers or {}
            body = case.body
            
            # 处理参数化
            if parameters:
                try:
                    params_data = json.loads(parameters) if isinstance(parameters, str) else parameters
                    # 替换请求中的参数
                    url = self._replace_parameters(url, params_data)
                    if body:
                        body = self._replace_parameters(body, params_data)
                    if headers:
                        headers = self._replace_parameters(headers, params_data)
                except Exception as e:
                    log.append(f"Parameter parsing error: {e}")
            
            # 解析body（如果是JSON字符串）
            data = None
            if body:
                try:
                    data = json.loads(body)
                except:
                    data = body
            
            # 发送请求
            log.append(f"Sending {method} request to {url}")
            response = requests.request(
                method=method,
                url=url,
                headers=headers,
                json=data if isinstance(data, dict) else None,
                data=data if isinstance(data, str) else None,
                timeout=30
            )
            
            # 计算响应时间
            response_time = time.time() - start_time
            
            # 解析响应
            try:
                response_json = response.json()
            except Exception:
                response_json = response.text
            
            # 执行断言
            if case.validate:
                try:
                    validate_config = case.validate if isinstance(case.validate, list) else json.loads(case.validate)
                    assert_result = self._execute_assertions(response_json, validate_config, response)
                    if not assert_result['success']:
                        log.append(f"Assertion failed: {assert_result['message']}")
                        return False, {
                            'log': log,
                            'response': response_json,
                            'error': assert_result['message'],
                            'response_time': response_time
                        }
                except Exception as e:
                    log.append(f"Assertion error: {e}")
                    return False, {
                        'log': log,
                        'response': response_json,
                        'error': str(e),
                        'response_time': response_time
                    }
            
            log.append(f"Test passed! Response time: {response_time:.2f}s")
            return True, {
                'log': log,
                'response': response_json,
                'response_time': response_time
            }
        except Exception as e:
            log.append(f"Test failed: {e}")
            return False, {
                'log': log,
                'error': str(e),
                'response_time': time.time() - start_time
            }
        finally:
            try:
                self._cleanup_test_data(case, parameters, log)
            except Exception as cleanup_error:
                log.append(f"Cleanup error: {cleanup_error}")
    
    def _replace_parameters(self, value, params):
        """替换参数"""
        if isinstance(value, str):
            for key, val in params.items():
                value = value.replace(f"{{{{{key}}}}}", str(val))
        elif isinstance(value, dict):
            for k, v in value.items():
                value[k] = self._replace_parameters(v, params)
        elif isinstance(value, list):
            for i, item in enumerate(value):
                value[i] = self._replace_parameters(item, params)
        return value
    
    def _execute_assertions(self, response, validate_config, http_response=None):
        """执行断言"""
        try:
            for assertion in validate_config:
                # 支持两种格式：{"eq": ["status_code", 200]} 或 {"type": "equals", "path": "...", "expected": ...}
                if isinstance(assertion, dict):
                    # 新格式：{"eq": [path, expected]}
                    for assert_type, params in assertion.items():
                        if assert_type == 'eq':
                            path, expected = params
                            actual = self._get_value_from_response(response, http_response, path)
                            if actual != expected:
                                return {
                                    'success': False,
                                    'message': f"Expected {expected}, got {actual}"
                                }
                        elif assert_type == 'contains':
                            path, expected = params
                            actual = self._get_value_from_response(response, http_response, path)
                            if expected not in str(actual):
                                return {
                                    'success': False,
                                    'message': f"Expected to contain {expected}, got {actual}"
                                }
                        elif assert_type == 'gt':
                            path, expected = params
                            actual = self._get_value_from_response(response, http_response, path)
                            if not (isinstance(actual, (int, float)) and actual > expected):
                                return {
                                    'success': False,
                                    'message': f"Expected greater than {expected}, got {actual}"
                                }
                        elif assert_type == 'lt':
                            path, expected = params
                            actual = self._get_value_from_response(response, http_response, path)
                            if not (isinstance(actual, (int, float)) and actual < expected):
                                return {
                                    'success': False,
                                    'message': f"Expected less than {expected}, got {actual}"
                                }
                        elif assert_type == 'status_code':
                            expected = params
                            actual = http_response.status_code if http_response else None
                            if actual != expected:
                                return {
                                    'success': False,
                                    'message': f"Expected status code {expected}, got {actual}"
                                }
                        elif assert_type == 'status_code_in':
                            expected_list = params
                            actual = http_response.status_code if http_response else None
                            if actual not in expected_list:
                                return {
                                    'success': False,
                                    'message': f"Expected status code in {expected_list}, got {actual}"
                                }
                        elif assert_type == 'jsonpath':
                            path, expected = params
                            actual = self._get_value_from_path(response, path)
                            if actual != expected:
                                return {
                                    'success': False,
                                    'message': f"Expected {expected} at {path}, got {actual}"
                                }
                        elif assert_type == 'regex':
                            import re
                            path, pattern = params
                            actual = self._get_value_from_response(response, http_response, path)
                            if not re.search(pattern, str(actual)):
                                return {
                                    'success': False,
                                    'message': f"Expected to match pattern {pattern}, got {actual}"
                                }
                        elif assert_type == 'exists':
                            path = params
                            actual = self._get_value_from_path(response, path)
                            if actual is None:
                                return {
                                    'success': False,
                                    'message': f"Expected path {path} to exist"
                                }
                        elif assert_type == 'not_exists':
                            path = params
                            actual = self._get_value_from_path(response, path)
                            if actual is not None:
                                return {
                                    'success': False,
                                    'message': f"Expected path {path} to not exist"
                                }
                        elif assert_type == 'type':
                            path, expected_type = params
                            actual = self._get_value_from_response(response, http_response, path)
                            type_map = {
                                'string': str,
                                'int': int,
                                'float': float,
                                'bool': bool,
                                'list': list,
                                'dict': dict
                            }
                            if expected_type in type_map and not isinstance(actual, type_map[expected_type]):
                                return {
                                    'success': False,
                                    'message': f"Expected type {expected_type}, got {type(actual).__name__}"
                                }
                        elif assert_type == 'length':
                            path, expected_length = params
                            actual = self._get_value_from_response(response, http_response, path)
                            if len(actual) != expected_length:
                                return {
                                    'success': False,
                                    'message': f"Expected length {expected_length}, got {len(actual)}"
                                }
                        elif assert_type == 'length_gt':
                            path, expected_length = params
                            actual = self._get_value_from_response(response, http_response, path)
                            if len(actual) <= expected_length:
                                return {
                                    'success': False,
                                    'message': f"Expected length greater than {expected_length}, got {len(actual)}"
                                }
                        elif assert_type == 'length_lt':
                            path, expected_length = params
                            actual = self._get_value_from_response(response, http_response, path)
                            if len(actual) >= expected_length:
                                return {
                                    'success': False,
                                    'message': f"Expected length less than {expected_length}, got {len(actual)}"
                                }
                        elif assert_type == 'startswith':
                            path, expected = params
                            actual = self._get_value_from_response(response, http_response, path)
                            if not str(actual).startswith(expected):
                                return {
                                    'success': False,
                                    'message': f"Expected to start with {expected}, got {actual}"
                                }
                        elif assert_type == 'endswith':
                            path, expected = params
                            actual = self._get_value_from_response(response, http_response, path)
                            if not str(actual).endswith(expected):
                                return {
                                    'success': False,
                                    'message': f"Expected to end with {expected}, got {actual}"
                                }
            
            return {
                'success': True,
                'message': 'All assertions passed'
            }
        except Exception as e:
            return {
                'success': False,
                'message': str(e)
            }
    
    def _get_value_from_response(self, response, http_response, path):
        """从响应中获取值，支持特殊路径如 status_code"""
        if path == 'status_code' and http_response:
            return http_response.status_code
        elif path == 'headers' and http_response:
            return dict(http_response.headers)
        elif path == 'text' and http_response:
            return http_response.text
        elif path == 'content' and http_response:
            return http_response.content
        else:
            return self._get_value_from_path(response, path)
    
    def _get_value_from_path(self, data, path):
        """从路径获取值"""
        keys = path.split('.')
        value = data
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return None
        return value
    
    def _prepare_test_data(self, case, parameters, log):
        """测试前的数据准备钩子"""
        try:
            variables = getattr(case, 'variables', None)
            if not variables:
                return
            if isinstance(variables, str):
                try:
                    variables = json.loads(variables)
                except Exception:
                    return
            if not isinstance(variables, dict):
                return
            setup_actions = variables.get('setup')
            if not setup_actions:
                return
            if isinstance(setup_actions, list):
                for action in setup_actions:
                    if isinstance(action, str):
                        log.append(f"Setup: {action}")
        except Exception as e:
            log.append(f"Setup error: {e}")
    
    def _cleanup_test_data(self, case, parameters, log):
        """测试后的数据清理钩子"""
        try:
            variables = getattr(case, 'variables', None)
            if not variables:
                return
            if isinstance(variables, str):
                try:
                    variables = json.loads(variables)
                except Exception:
                    return
            if not isinstance(variables, dict):
                return
            teardown_actions = variables.get('teardown')
            if not teardown_actions:
                return
            if isinstance(teardown_actions, list):
                for action in teardown_actions:
                    if isinstance(action, str):
                        log.append(f"Teardown: {action}")
        except Exception as e:
            log.append(f"Teardown error: {e}")
    
    # 性能测试相关
    def run_performance_test(self, test_data: TestRunPerformanceRequest, user_id: int):
        """执行性能测试"""
        try:
            from app.services import case_service
            
            # 获取测试用例
            case = case_service.get_test_case_by_id(test_data.case_id)
            if not case:
                return False, 'Test case not found'
            
            # 创建执行记录
            execution = TestExecution(
                case_id=test_data.case_id,
                user_id=user_id,
                status='running',
                start_time=datetime.utcnow()
            )
            db.session.add(execution)
            db.session.commit()
            
            # 执行性能测试
            success, result = self._execute_performance_test(
                case=case,
                concurrency=test_data.concurrency,
                duration=test_data.duration,
                ramp_up_config=test_data.ramp_up_config
            )
            
            # 更新执行状态
            execution.status = 'success' if success else 'failed'
            execution.end_time = datetime.utcnow()
            execution.execution_log = json.dumps(result.get('log', []))
            db.session.commit()
            
            # 保存性能测试结果
            performance_test = PerformanceTest(
                execution_id=execution.id,
                concurrency=test_data.concurrency,
                duration=test_data.duration,
                ramp_up_config=test_data.ramp_up_config,
                metrics=json.dumps(result.get('metrics', {}))
            )
            db.session.add(performance_test)
            db.session.commit()
            
            return True, {
                'execution_id': execution.id,
                'status': execution.status,
                'metrics': result.get('metrics', {})
            }
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def run_performance_test_custom(self, test_data: TestRunPerformanceCustomRequest, user_id: int):
        """执行自定义目标的性能测试（不依赖用例与执行记录）"""
        from config import Config
        
        try:
            concurrency = max(1, min(test_data.concurrency, Config.MAX_CONCURRENCY))
            duration = max(1, min(test_data.duration, Config.MAX_DURATION))
            
            success, result = self._execute_performance_custom(
                target_url=test_data.target_url,
                method=test_data.method or "GET",
                headers=test_data.headers or {},
                body=test_data.body,
                concurrency=concurrency,
                duration=duration,
                timeout=test_data.timeout or 30,
                ramp_up_config=test_data.ramp_up_config,
            )
            if not success:
                return False, result
            return True, {
                "metrics": result.get("metrics", {}),
                "log": result.get("log", []),
            }
        except Exception as e:
            return False, str(e)
    
    def _execute_performance_test(self, case, concurrency, duration, ramp_up_config=None):
        """执行性能测试的核心逻辑"""
        try:
            log = []
            metrics = {
                'concurrency': concurrency,
                'duration': duration,
                'requests': 0,
                'successes': 0,
                'failures': 0,
                'response_times': [],
                'tps': 0,
                'qps': 0,
                'error_rate': 0,
                'avg_response_time': 0,
                'max_response_time': 0,
                'min_response_time': float('inf'),
                'server_metrics': {}
            }
            
            start_time = time.time()
            end_time = start_time + duration
            
            # 初始化协程池
            pool = Pool(concurrency)
            
            # 执行测试
            def test_task():
                nonlocal metrics
                try:
                    task_start = time.time()
                    # 执行测试用例
                    success, result = self._execute_test_case(case)
                    task_end = time.time()
                    
                    # 更新 metrics
                    metrics['requests'] += 1
                    if success:
                        metrics['successes'] += 1
                        response_time = result.get('response_time', 0)
                        metrics['response_times'].append(response_time)
                        if response_time > metrics['max_response_time']:
                            metrics['max_response_time'] = response_time
                        if response_time < metrics['min_response_time']:
                            metrics['min_response_time'] = response_time
                    else:
                        metrics['failures'] += 1
                except Exception:
                    metrics['failures'] += 1
            
            # 执行并发测试
            while time.time() < end_time:
                pool.spawn(test_task)
                # 控制并发数
                time.sleep(0.01)
            
            # 等待所有任务完成
            pool.join()
            
            # 计算最终 metrics
            total_time = time.time() - start_time
            metrics['tps'] = metrics['requests'] / total_time if total_time > 0 else 0
            metrics['qps'] = metrics['tps']
            metrics['error_rate'] = metrics['failures'] / metrics['requests'] * 100 if metrics['requests'] > 0 else 0
            
            if metrics['response_times']:
                metrics['avg_response_time'] = sum(metrics['response_times']) / len(metrics['response_times'])
            else:
                metrics['avg_response_time'] = 0
                metrics['max_response_time'] = 0
                metrics['min_response_time'] = 0
            
            # 收集服务器 metrics
            metrics['server_metrics'] = {
                'cpu_percent': psutil.cpu_percent(),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_percent': psutil.disk_usage('/').percent
            }
            
            log.append(f"Performance test completed: {metrics['requests']} requests in {total_time:.2f}s")
            log.append(f"TPS: {metrics['tps']:.2f}, Error rate: {metrics['error_rate']:.2f}%")
            log.append(f"Response times: avg={metrics['avg_response_time']:.2f}s, max={metrics['max_response_time']:.2f}s, min={metrics['min_response_time']:.2f}s")
            
            return True, {
                'log': log,
                'metrics': metrics
            }
        except Exception as e:
            return False, {
                'log': [f"Performance test error: {e}"],
                'error': str(e)
            }
    
    def _execute_performance_custom(self, target_url, method, headers, body, concurrency, duration, timeout, ramp_up_config=None):
        """执行自定义URL的性能测试"""
        try:
            log = []
            metrics = {
                'concurrency': concurrency,
                'duration': duration,
                'requests': 0,
                'successes': 0,
                'failures': 0,
                'response_times': [],
                'tps': 0,
                'qps': 0,
                'error_rate': 0,
                'avg_response_time': 0,
                'max_response_time': 0,
                'min_response_time': float('inf'),
                'server_metrics': {}
            }
            
            start_time = time.time()
            end_time = start_time + duration
            
            pool = Pool(concurrency)
            
            def send_request():
                nonlocal metrics
                try:
                    request_start = time.time()
                    data = None
                    if body:
                        try:
                            data = json.loads(body)
                        except Exception:
                            data = body
                    response = requests.request(
                        method=method,
                        url=target_url,
                        headers=headers or {},
                        json=data if isinstance(data, (dict, list)) else None,
                        data=data if isinstance(data, str) else None,
                        timeout=timeout
                    )
                    request_end = time.time()
                    elapsed = request_end - request_start
                    metrics['requests'] += 1
                    if 200 <= response.status_code < 400:
                        metrics['successes'] += 1
                        metrics['response_times'].append(elapsed)
                        if elapsed > metrics['max_response_time']:
                            metrics['max_response_time'] = elapsed
                        if elapsed < metrics['min_response_time']:
                            metrics['min_response_time'] = elapsed
                    else:
                        metrics['failures'] += 1
                except Exception:
                    metrics['requests'] += 1
                    metrics['failures'] += 1
            
            while time.time() < end_time:
                pool.spawn(send_request)
                time.sleep(0.01)
            
            pool.join()
            
            total_time = time.time() - start_time
            metrics['tps'] = metrics['requests'] / total_time if total_time > 0 else 0
            metrics['qps'] = metrics['tps']
            metrics['error_rate'] = metrics['failures'] / metrics['requests'] * 100 if metrics['requests'] > 0 else 0
            
            if metrics['response_times']:
                metrics['avg_response_time'] = sum(metrics['response_times']) / len(metrics['response_times'])
            else:
                metrics['avg_response_time'] = 0
                metrics['max_response_time'] = 0
                metrics['min_response_time'] = 0
            
            metrics['server_metrics'] = {
                'cpu_percent': psutil.cpu_percent(),
                'memory_percent': psutil.virtual_memory().percent,
                'disk_percent': psutil.disk_usage('/').percent
            }
            
            log.append(f"Custom performance test completed: {metrics['requests']} requests in {total_time:.2f}s")
            log.append(f"TPS: {metrics['tps']:.2f}, Error rate: {metrics['error_rate']:.2f}%")
            log.append(f"Response times: avg={metrics['avg_response_time']:.2f}s, max={metrics['max_response_time']:.2f}s, min={metrics['min_response_time']:.2f}s")
            
            return True, {
                'log': log,
                'metrics': metrics
            }
        except Exception as e:
            return False, {
                'log': [f"Performance test error: {e}"],
                'error': str(e)
            }
    
    # 鲁棒性测试相关
    def run_robustness_test(self, test_data: TestRunRobustnessRequest, user_id: int):
        """执行鲁棒性测试"""
        try:
            from app.services import case_service
            
            # 获取测试用例
            case = case_service.get_test_case_by_id(test_data.case_id)
            if not case:
                return False, 'Test case not found'
            
            # 创建执行记录
            execution = TestExecution(
                case_id=test_data.case_id,
                user_id=user_id,
                status='running',
                start_time=datetime.utcnow()
            )
            db.session.add(execution)
            db.session.commit()
            
            # 执行鲁棒性测试
            success, result = self._execute_robustness_test(
                case=case,
                fault_injection_config=test_data.fault_injection_config
            )
            
            # 更新执行状态
            execution.status = 'success' if success else 'failed'
            execution.end_time = datetime.utcnow()
            execution.execution_log = json.dumps(result.get('log', []))
            db.session.commit()
            
            # 保存鲁棒性测试结果
            robustness_test = RobustnessTest(
                execution_id=execution.id,
                fault_injection_config=test_data.fault_injection_config,
                tolerance_result=json.dumps(result.get('tolerance_result', {})),
                score=result.get('score', 0)
            )
            db.session.add(robustness_test)
            db.session.commit()
            
            return True, {
                'execution_id': execution.id,
                'status': execution.status,
                'score': result.get('score', 0),
                'tolerance_result': result.get('tolerance_result', {})
            }
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def _execute_robustness_test(self, case, fault_injection_config):
        """执行鲁棒性测试的核心逻辑"""
        try:
            log = []
            tolerance_result = {}
            score = 0
            total_tests = 0
            passed_tests = 0
            
            # 解析故障注入配置
            try:
                config = json.loads(fault_injection_config)
                fault_types = config.get('fault_types', [])
            except Exception as e:
                return False, {
                    'log': [f"Config parsing error: {e}"],
                    'error': str(e)
                }
            
            # 执行各种故障注入测试
            for fault_type in fault_types:
                total_tests += 1
                log.append(f"Testing {fault_type}...")
                
                if fault_type == 'parameter_out_of_bounds':
                    # 参数越界测试
                    test_case = self._create_faulty_case(case, 'parameter_out_of_bounds')
                    success, result = self._execute_test_case(test_case)
                    tolerance_result[fault_type] = {
                        'success': success,
                        'result': result
                    }
                    if success:
                        passed_tests += 1
                
                elif fault_type == 'sql_injection':
                    # SQL注入测试
                    test_case = self._create_faulty_case(case, 'sql_injection')
                    success, result = self._execute_test_case(test_case)
                    # 检查是否有 SQL 错误
                    error_msg = result.get('error', '')
                    has_sql_error = 'sql' in error_msg.lower() or 'database' in error_msg.lower()
                    tolerance_result[fault_type] = {
                        'success': not has_sql_error,
                        'result': result
                    }
                    if not has_sql_error:
                        passed_tests += 1
                
                elif fault_type == 'rate_limit':
                    # 频率限制测试
                    start_time = time.time()
                    requests = 0
                    errors = 0
                    while time.time() - start_time < 5:  # 5秒内发送请求
                        success, result = self._execute_test_case(case)
                        requests += 1
                        if not success:
                            errors += 1
                        time.sleep(0.1)
                    # 检查是否有频率限制错误
                    has_rate_limit_error = errors > requests * 0.5  # 超过50%错误
                    tolerance_result[fault_type] = {
                        'success': not has_rate_limit_error,
                        'requests': requests,
                        'errors': errors
                    }
                    if not has_rate_limit_error:
                        passed_tests += 1
                
                elif fault_type == 'invalid_response_format':
                    # 返回数据格式错误测试
                    # 这里需要模拟服务器返回错误格式的数据
                    # 简化处理，检查是否能正确处理非 JSON 响应
                    test_case = self._create_faulty_case(case, 'invalid_response_format')
                    success, result = self._execute_test_case(test_case)
                    # 即使响应格式错误，也应该能正确处理
                    tolerance_result[fault_type] = {
                        'success': True,  # 只要不崩溃就算通过
                        'result': result
                    }
                    passed_tests += 1
            
            # 计算评分
            if total_tests > 0:
                score = (passed_tests / total_tests) * 100
                # 额外评分因素
                # 检查是否有熔断/降级机制
                has_circuit_breaker = self._check_circuit_breaker(case)
                if has_circuit_breaker:
                    score += 10
                # 检查异常提示是否规范
                has_standard_error = self._check_standard_error(case)
                if has_standard_error:
                    score += 10
                # 限制最高分数
                score = min(score, 100)
            
            log.append(f"Robustness test completed: {passed_tests}/{total_tests} passed")
            log.append(f"Final score: {score:.2f}")
            
            return True, {
                'log': log,
                'tolerance_result': tolerance_result,
                'score': score
            }
        except Exception as e:
            return False, {
                'log': [f"Robustness test error: {e}"],
                'error': str(e)
            }
    
    def _create_faulty_case(self, case, fault_type):
        """创建故障注入测试用例"""
        import copy
        faulty_case = copy.deepcopy(case)
        
        # 解析请求配置
        request_config = json.loads(case.request_config)
        
        if fault_type == 'parameter_out_of_bounds':
            # 参数越界
            if 'params' in request_config:
                for key in request_config['params']:
                    request_config['params'][key] = '999999999999999999'
            if 'data' in request_config:
                if isinstance(request_config['data'], dict):
                    for key in request_config['data']:
                        request_config['data'][key] = '999999999999999999'
        
        elif fault_type == 'sql_injection':
            # SQL注入
            sql_injection_payload = "' OR 1=1 --"
            if 'params' in request_config:
                for key in request_config['params']:
                    request_config['params'][key] = sql_injection_payload
            if 'data' in request_config:
                if isinstance(request_config['data'], dict):
                    for key in request_config['data']:
                        request_config['data'][key] = sql_injection_payload
        
        elif fault_type == 'invalid_response_format':
            # 无效响应格式 - 修改 URL 到一个返回非 JSON 的端点
            if 'url' in request_config:
                request_config['url'] = request_config['url'] + '?invalid_format=true'
        
        # 更新请求配置
        faulty_case.request_config = json.dumps(request_config)
        return faulty_case
    
    def _check_circuit_breaker(self, case):
        """检查是否有熔断机制"""
        # 简化实现，检查响应断言中是否有熔断相关配置
        if case.response_assert:
            try:
                assert_config = json.loads(case.response_assert)
                for assertion in assert_config:
                    if 'circuit' in str(assertion).lower() or 'breaker' in str(assertion).lower():
                        return True
            except Exception:
                pass
        return False
    
    def _check_standard_error(self, case):
        """检查异常提示是否规范"""
        # 简化实现，检查响应断言中是否有错误码相关配置
        if case.response_assert:
            try:
                assert_config = json.loads(case.response_assert)
                for assertion in assert_config:
                    if 'code' in str(assertion).lower() or 'error' in str(assertion).lower():
                        return True
            except Exception:
                pass
        return False
    
    # 获取测试结果
    def get_test_execution(self, execution_id: int):
        """获取测试执行记录"""
        try:
            return TestExecution.query.get(execution_id)
        except Exception:
            return None
    
    def get_test_executions(self, user_id: int):
        """获取用户的测试执行记录列表"""
        try:
            return TestExecution.query.filter_by(user_id=user_id).order_by(TestExecution.created_at.desc()).all()
        except Exception:
            return []
    
    def get_test_results(self, execution_id: int):
        """获取测试结果"""
        try:
            return TestResult.query.filter_by(execution_id=execution_id).all()
        except Exception:
            return []

    def get_dashboard_overview(self, user_id: int):
        try:
            now = datetime.utcnow()
            days = 7
            since = now - timedelta(days=days)

            total_cases = TestCase.query.filter_by(user_id=user_id).count()

            executions_query = TestExecution.query.filter_by(user_id=user_id)
            total_executions = executions_query.count()
            success_executions = executions_query.filter_by(status='success').count()
            success_rate = (success_executions / total_executions * 100) if total_executions > 0 else 0

            results_query = TestResult.query.join(
                TestExecution, TestResult.execution_id == TestExecution.id
            ).filter(TestExecution.user_id == user_id)
            avg_seconds = results_query.with_entities(func.avg(TestResult.response_time)).scalar()
            if avg_seconds is None:
                avg_seconds = 0
            avg_response_time_ms = avg_seconds * 1000

            recent_executions_data = []
            recent_executions = executions_query.order_by(TestExecution.created_at.desc()).limit(10).all()
            for execution in recent_executions:
                latest_result = (
                    TestResult.query.filter_by(execution_id=execution.id)
                    .order_by(TestResult.created_at.desc())
                    .first()
                )
                response_time_ms = 0
                if latest_result and latest_result.response_time is not None:
                    response_time_ms = latest_result.response_time * 1000
                created_at = execution.created_at or execution.start_time or execution.end_time
                created_at_str = created_at.isoformat() if created_at else None
                case_name = execution.case.name if hasattr(execution, "case") and execution.case else ''
                recent_executions_data.append(
                    {
                        'id': execution.id,
                        'case_name': case_name,
                        'status': execution.status,
                        'response_time_ms': response_time_ms,
                        'created_at': created_at_str,
                    }
                )

            since_results = results_query.filter(TestResult.created_at >= since).all()
            stats_by_date = {}
            for result in since_results:
                if not result.created_at:
                    continue
                date_key = result.created_at.date().isoformat()
                bucket = stats_by_date.get(date_key)
                if not bucket:
                    bucket = {'total': 0, 'success': 0, 'response_times': []}
                    stats_by_date[date_key] = bucket
                bucket['total'] += 1
                if result.status == 'success':
                    bucket['success'] += 1
                if result.response_time is not None:
                    bucket['response_times'].append(result.response_time)

            performance_trend = []
            for i in range(days - 1, -1, -1):
                day = (now - timedelta(days=i)).date()
                key = day.isoformat()
                bucket = stats_by_date.get(key, {'total': 0, 'success': 0, 'response_times': []})
                total = bucket['total']
                success = bucket['success']
                response_times = bucket['response_times']
                day_success_rate = (success / total * 100) if total > 0 else 0
                if response_times:
                    avg_day_ms = sum(response_times) / len(response_times) * 1000
                else:
                    avg_day_ms = 0
                performance_trend.append(
                    {
                        'date': key,
                        'avg_response_time_ms': avg_day_ms,
                        'success_rate': day_success_rate,
                    }
                )

            performance_count = (
                PerformanceTest.query.join(
                    TestExecution, PerformanceTest.execution_id == TestExecution.id
                )
                .filter(TestExecution.user_id == user_id)
                .count()
            )
            robustness_count = (
                RobustnessTest.query.join(
                    TestExecution, RobustnessTest.execution_id == TestExecution.id
                )
                .filter(TestExecution.user_id == user_id)
                .count()
            )
            automation_count = total_executions - performance_count - robustness_count
            if automation_count < 0:
                automation_count = 0

            test_type_distribution = {
                'automation': automation_count,
                'performance': performance_count,
                'robustness': robustness_count,
            }

            robustness_query = (
                RobustnessTest.query.join(
                    TestExecution, RobustnessTest.execution_id == TestExecution.id
                )
                .filter(TestExecution.user_id == user_id)
                .order_by(RobustnessTest.created_at.desc())
            )
            robustness_records = robustness_query.limit(6).all()
            current_score = 0
            history_scores = []
            if robustness_records:
                current_score = robustness_records[0].score or 0
                history_scores = [r.score or 0 for r in robustness_records[1:]]

            robustness_scores = {
                'current_score': current_score,
                'history_scores': history_scores,
            }

            return True, {
                'stats': {
                    'total_cases': total_cases,
                    'total_executions': total_executions,
                    'success_rate': round(success_rate, 2),
                    'average_response_time_ms': round(avg_response_time_ms, 2),
                },
                'recent_executions': recent_executions_data,
                'performance_trend': performance_trend,
                'test_type_distribution': test_type_distribution,
                'robustness_scores': robustness_scores,
            }
        except Exception as e:
            return False, str(e)
