from app.models import Report, TestExecution, db
from app.schemas.report import ReportCreate
from app.utils.redis import redis_util
import json
import os
import time
from datetime import datetime
import markdown

class ReportService:
    """报告服务"""
    
    def create_report(self, report_data: dict, user_id: int):
        """创建报告"""
        try:
            # 生成报告内容
            report_content = self._generate_report_content(report_data)
            
            # 生成报告文件
            report_url = self._save_report_file(report_content, report_data.get('type', 'html'))
            
            # 创建报告记录
            report = Report(
                name=report_data.get('name', f'Report_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}'),
                user_id=user_id,
                type=report_data.get('type', 'html'),
                report_url=report_url
            )
            db.session.add(report)
            db.session.commit()
            
            return True, report
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def get_report_by_id(self, report_id: int):
        """根据ID获取报告"""
        try:
            # 检查缓存
            cache_key = f'report:{report_id}'
            cached_report = redis_util.get(cache_key)
            if cached_report:
                return cached_report
            
            # 从数据库获取
            report = Report.query.get(report_id)
            if report:
                # 更新缓存
                report_data = {
                    'id': report.id,
                    'name': report.name,
                    'user_id': report.user_id,
                    'type': report.type,
                    'report_url': report.report_url,
                    'created_at': report.created_at.isoformat() if report.created_at else None
                }
                redis_util.set(cache_key, report_data, 3600)
                return report
            return None
        except Exception as e:
            print(f"Get report error: {e}")
            return None
    
    def get_reports(self, user_id: int, page: int = 1, page_size: int = 10):
        """获取用户的报告列表"""
        try:
            # 计算偏移量
            offset = (page - 1) * page_size
            
            # 查询报告
            reports = Report.query.filter_by(user_id=user_id).order_by(Report.created_at.desc()).offset(offset).limit(page_size).all()
            total = Report.query.filter_by(user_id=user_id).count()
            
            # 构建响应
            report_list = []
            for report in reports:
                report_list.append({
                    'id': report.id,
                    'name': report.name,
                    'type': report.type,
                    'created_at': report.created_at.isoformat() if report.created_at else None
                })
            
            return {
                'reports': report_list,
                'total': total,
                'page': page,
                'page_size': page_size
            }
        except Exception as e:
            print(f"Get reports error: {e}")
            return {
                'reports': [],
                'total': 0,
                'page': page,
                'page_size': page_size
            }
    
    def delete_report(self, report_id: int):
        """删除报告"""
        try:
            report = Report.query.get(report_id)
            if not report:
                return False, 'Report not found'
            
            # 删除报告文件
            if report.report_url:
                try:
                    file_path = os.path.join('reports', os.path.basename(report.report_url))
                    if os.path.exists(file_path):
                        os.remove(file_path)
                except Exception as e:
                    print(f"Delete report file error: {e}")
            
            # 删除报告记录
            db.session.delete(report)
            db.session.commit()
            
            # 清除缓存
            redis_util.delete(f'report:{report_id}')
            
            return True, 'Report deleted successfully'
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def compare_reports(self, report_ids: list):
        """对比多个报告"""
        try:
            # 获取报告列表
            reports = []
            for report_id in report_ids:
                report = self.get_report_by_id(report_id)
                if report:
                    reports.append(report)
            
            if len(reports) < 2:
                return False, 'Need at least 2 reports to compare'
            
            # 生成对比报告
            comparison_data = self._generate_comparison_data(reports)
            comparison_report = self._generate_comparison_report(comparison_data)
            
            # 保存对比报告
            report_url = self._save_report_file(comparison_report, 'html')
            
            # 创建对比报告记录
            comparison_report_record = Report(
                name=f'Comparison_Report_{datetime.utcnow().strftime("%Y%m%d_%H%M%S")}',
                user_id=reports[0].user_id,
                type='html',
                report_url=report_url
            )
            db.session.add(comparison_report_record)
            db.session.commit()
            
            return True, comparison_report_record
        except Exception as e:
            db.session.rollback()
            return False, str(e)
    
    def _generate_report_content(self, report_data):
        """生成报告内容"""
        try:
            report_type = report_data.get('type', 'html')
            execution_id = report_data.get('execution_id')
            
            if execution_id:
                execution = TestExecution.query.get(execution_id)
                if execution:
                    from app.models import TestResult, TestCase, PerformanceTest
                    results = TestResult.query.filter_by(execution_id=execution.id).all()
                    total_results = len(results)
                    success_results = len([r for r in results if r.status == 'success'])
                    failed_results = len([r for r in results if r.status != 'success'])
                    avg_response_time = 0
                    if total_results > 0:
                        times = [r.response_time or 0 for r in results]
                        avg_response_time = sum(times) / len(times) if times else 0
                    total_cases = TestCase.query.count()
                    if total_cases > 0:
                        covered_cases = 1 if getattr(execution, 'case_id', None) is not None else 0
                        case_coverage = (covered_cases / total_cases) * 100
                    else:
                        covered_cases = 0
                        case_coverage = 0
                    performance = PerformanceTest.query.filter_by(execution_id=execution.id).first()
                    performance_metrics = {}
                    if performance and performance.metrics:
                        try:
                            performance_metrics = json.loads(performance.metrics)
                        except Exception:
                            performance_metrics = {}
                    report_content = {
                        'report_name': report_data.get('name', f'Execution_Report_{execution_id}'),
                        'execution_id': execution.id,
                        'case_id': execution.case_id,
                        'status': execution.status,
                        'start_time': execution.start_time.isoformat() if execution.start_time else None,
                        'end_time': execution.end_time.isoformat() if execution.end_time else None,
                        'execution_log': json.loads(execution.execution_log) if execution.execution_log else [],
                        'created_at': datetime.utcnow().isoformat(),
                        'metrics': {
                            'total_results': total_results,
                            'success_results': success_results,
                            'failed_results': failed_results,
                            'avg_response_time': avg_response_time,
                            'performance': performance_metrics
                        },
                        'coverage': {
                            'total_cases': total_cases,
                            'covered_cases': covered_cases,
                            'case_coverage': case_coverage
                        }
                    }
                    if report_type == 'json':
                        return json.dumps(report_content, indent=2)
                    elif report_type == 'html':
                        return self._generate_html_report(report_content)
                    elif report_type == 'markdown':
                        return self._generate_markdown_report(report_content)
            
            # 默认报告
            return f"Report generated at {datetime.utcnow().isoformat()}"
        except Exception as e:
            return f"Report generation error: {e}"
    
    def _generate_html_report(self, report_data):
        """生成HTML格式报告"""
        html_template = f"""
        <!DOCTYPE html>
        <html lang="zh-CN">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{report_data.get('report_name', '测试报告')}</title>
            <style>
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                h1, h2, h3 {{
                    color: #2c3e50;
                }}
                .summary {{
                    background-color: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 5px;
                    padding: 20px;
                    margin-bottom: 20px;
                }}
                .log {{
                    background-color: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 5px;
                    padding: 20px;
                    white-space: pre-wrap;
                    font-family: 'Courier New', Courier, monospace;
                }}
                .success {{ color: #28a745; }}
                .failed {{ color: #dc3545; }}
                .info {{ color: #17a2b8; }}
            </style>
        </head>
        <body>
            <h1>{report_data.get('report_name', '测试报告')}</h1>
            <div class="summary">
                <h2>概要</h2>
                <p><strong>执行ID：</strong> {report_data.get('execution_id')}</p>
                <p><strong>用例ID：</strong> {report_data.get('case_id')}</p>
                <p><strong>状态：</strong> <span class="{report_data.get('status').lower()}">{report_data.get('status')}</span></p>
                <p><strong>开始时间：</strong> {report_data.get('start_time')}</p>
                <p><strong>结束时间：</strong> {report_data.get('end_time')}</p>
                <p><strong>生成时间：</strong> {report_data.get('created_at')}</p>
                <h3>覆盖率</h3>
                <p><strong>用例总数：</strong> {report_data.get('coverage', {}).get('total_cases')}</p>
                <p><strong>已覆盖用例数：</strong> {report_data.get('coverage', {}).get('covered_cases')}</p>
                <p><strong>用例覆盖率：</strong> {report_data.get('coverage', {}).get('case_coverage')}%</p>
                <h3>指标</h3>
                <p><strong>结果总数：</strong> {report_data.get('metrics', {}).get('total_results')}</p>
                <p><strong>成功数量：</strong> {report_data.get('metrics', {}).get('success_results')}</p>
                <p><strong>失败数量：</strong> {report_data.get('metrics', {}).get('failed_results')}</p>
                <p><strong>平均响应时间：</strong> {report_data.get('metrics', {}).get('avg_response_time')}s</p>
            </div>
            <h2>执行日志</h2>
            <div class="log">
                {chr(10).join(report_data.get('execution_log', []))}
            </div>
        </body>
        </html>
        """
        return html_template
    
    def _generate_markdown_report(self, report_data):
        """生成Markdown格式报告"""
        markdown_content = f"""
# {report_data.get('report_name', '测试报告')}

## 概要

- **执行ID：** {report_data.get('execution_id')}
- **用例ID：** {report_data.get('case_id')}
- **状态：** {report_data.get('status')}
- **开始时间：** {report_data.get('start_time')}
- **结束时间：** {report_data.get('end_time')}
- **生成时间：** {report_data.get('created_at')}

## 覆盖率

- **用例总数：** {report_data.get('coverage', {}).get('total_cases')}
- **已覆盖用例数：** {report_data.get('coverage', {}).get('covered_cases')}
- **用例覆盖率：** {report_data.get('coverage', {}).get('case_coverage')}%

## 指标

- **结果总数：** {report_data.get('metrics', {}).get('total_results')}
- **成功数量：** {report_data.get('metrics', {}).get('success_results')}
- **失败数量：** {report_data.get('metrics', {}).get('failed_results')}
- **平均响应时间：** {report_data.get('metrics', {}).get('avg_response_time')}s

## 执行日志

```
{chr(10).join(report_data.get('execution_log', []))}
```
        """
        return markdown_content
    
    def _save_report_file(self, content, report_type):
        """保存报告文件"""
        try:
            # 确保报告目录存在
            report_dir = 'reports'
            if not os.path.exists(report_dir):
                os.makedirs(report_dir)
            
            file_name = f"report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{report_type}"
            file_path = os.path.join(report_dir, file_name)
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return f"/api/v1/report/file/{file_name}"
        except Exception as e:
            raise Exception(f"Save report file error: {e}")
    
    def _generate_comparison_data(self, reports):
        """生成对比数据"""
        try:
            comparison_data = {
                'reports': [],
                'metrics': {
                    'total_executions': 0,
                    'success_rate': 0,
                    'avg_execution_time': 0
                }
            }
            
            total_executions = 0
            successful_executions = 0
            total_execution_time = 0
            
            for report in reports:
                # 解析报告内容
                report_info = {
                    'id': report.id,
                    'name': report.name,
                    'created_at': report.created_at.isoformat() if report.created_at else None,
                    'type': report.type
                }
                
                # 尝试从报告文件中提取执行信息
                try:
                    if os.path.exists(report.report_url):
                        with open(report.report_url, 'r', encoding='utf-8') as f:
                            content = f.read()
                            # 简单解析HTML报告
                            if 'execution_id' in content:
                                report_info['has_execution_data'] = True
                except Exception:
                    pass
                
                comparison_data['reports'].append(report_info)
                total_executions += 1
            
            # 计算metrics
            comparison_data['metrics']['total_executions'] = total_executions
            if total_executions > 0:
                comparison_data['metrics']['success_rate'] = (successful_executions / total_executions) * 100
                if total_execution_time > 0:
                    comparison_data['metrics']['avg_execution_time'] = total_execution_time / total_executions
            
            return comparison_data
        except Exception as e:
            return {'error': str(e)}
    
    def _generate_comparison_report(self, comparison_data):
        """生成对比报告"""
        html_template = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Comparison Report</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                h1, h2, h3 {{
                    color: #2c3e50;
                }}
                .summary {{
                    background-color: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 5px;
                    padding: 20px;
                    margin-bottom: 20px;
                }}
                .report-list {{
                    background-color: #f8f9fa;
                    border: 1px solid #dee2e6;
                    border-radius: 5px;
                    padding: 20px;
                    margin-bottom: 20px;
                }}
                .report-item {{
                    border-bottom: 1px solid #dee2e6;
                    padding: 10px 0;
                }}
                .report-item:last-child {{
                    border-bottom: none;
                }}
            </style>
        </head>
        <body>
            <h1>Comparison Report</h1>
            <div class="summary">
                <h2>Metrics</h2>
                <p><strong>Total Reports:</strong> {comparison_data.get('metrics', {}).get('total_executions', 0)}</p>
                <p><strong>Success Rate:</strong> {comparison_data.get('metrics', {}).get('success_rate', 0):.2f}%</p>
                <p><strong>Average Execution Time:</strong> {comparison_data.get('metrics', {}).get('avg_execution_time', 0):.2f}s</p>
                <p><strong>Generated At:</strong> {datetime.utcnow().isoformat()}</p>
            </div>
            <h2>Compared Reports</h2>
            <div class="report-list">
                {''.join([f'<div class="report-item"><strong>{report.get("name")}</strong> (ID: {report.get("id")}, Created: {report.get("created_at")})</div>' for report in comparison_data.get('reports', [])])}
            </div>
        </body>
        </html>
        """
        return html_template
