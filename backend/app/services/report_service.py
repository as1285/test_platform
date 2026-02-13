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
                # 获取执行记录
                execution = TestExecution.query.get(execution_id)
                if execution:
                    # 构建报告数据
                    report_content = {
                        'report_name': report_data.get('name', f'Execution_Report_{execution_id}'),
                        'execution_id': execution.id,
                        'case_id': execution.case_id,
                        'status': execution.status,
                        'start_time': execution.start_time.isoformat() if execution.start_time else None,
                        'end_time': execution.end_time.isoformat() if execution.end_time else None,
                        'execution_log': json.loads(execution.execution_log) if execution.execution_log else [],
                        'created_at': datetime.utcnow().isoformat()
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
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>{report_data.get('report_name', 'Test Report')}</title>
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
            <h1>{report_data.get('report_name', 'Test Report')}</h1>
            <div class="summary">
                <h2>Summary</h2>
                <p><strong>Execution ID:</strong> {report_data.get('execution_id')}</p>
                <p><strong>Case ID:</strong> {report_data.get('case_id')}</p>
                <p><strong>Status:</strong> <span class="{report_data.get('status').lower()}">{report_data.get('status')}</span></p>
                <p><strong>Start Time:</strong> {report_data.get('start_time')}</p>
                <p><strong>End Time:</strong> {report_data.get('end_time')}</p>
                <p><strong>Generated At:</strong> {report_data.get('created_at')}</p>
            </div>
            <h2>Execution Log</h2>
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
# {report_data.get('report_name', 'Test Report')}

## Summary

- **Execution ID:** {report_data.get('execution_id')}
- **Case ID:** {report_data.get('case_id')}
- **Status:** {report_data.get('status')}
- **Start Time:** {report_data.get('start_time')}
- **End Time:** {report_data.get('end_time')}
- **Generated At:** {report_data.get('created_at')}

## Execution Log

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
            
            # 生成文件名
            file_name = f"report_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{report_type}"
            file_path = os.path.join(report_dir, file_name)
            
            # 写入文件
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            # 返回相对路径
            return file_path
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
