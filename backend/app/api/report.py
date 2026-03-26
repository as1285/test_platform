from flask import request, send_from_directory, abort
from flask_restx import Resource
from app.api import api_bp, api
from app.services import report_service
from app.schemas.report import ReportCreate, ReportResponse
from app.schemas import BaseResponse, PaginatedResponse
import os

# 创建报告命名空间
report_ns = api.namespace('report', description='报告管理相关接口')

@report_ns.route('/')
class ReportList(Resource):
    @report_ns.doc('create_report')
        def post(self):
        """创建报告"""
        try:
            user_id = 1
            data = request.json
            
            success, result = report_service.create_report(data, user_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            report = result
            report_data = {
                'id': report.id,
                'name': report.name,
                'user_id': report.user_id,
                'type': report.type,
                'report_url': report.report_url,
                'created_at': report.created_at.isoformat() if report.created_at else None
            }
            
            return BaseResponse(data=report_data).dict(), 201
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500
    
    @report_ns.doc('get_reports')
        def get(self):
        """获取报告列表"""
        try:
            user_id = 1
            page = request.args.get('page', 1, type=int)
            page_size = request.args.get('page_size', 10, type=int)
            
            result = report_service.get_reports(user_id, page, page_size)
            
            return PaginatedResponse(
                data={'reports': result['reports']},
                pagination={
                    'page': result['page'],
                    'page_size': result['page_size'],
                    'total': result['total']
                }
            ).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

@report_ns.route('/<int:report_id>')
class Report(Resource):
    @report_ns.doc('get_report')
        def get(self, report_id):
        """获取报告详情"""
        try:
            report_data = report_service.get_report_by_id(report_id)
            if not report_data:
                return BaseResponse(code=404, message='Report not found').dict(), 404
            
            return BaseResponse(data=report_data).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500
    
    @report_ns.doc('delete_report')
        def delete(self, report_id):
        """删除报告"""
        try:
            success, result = report_service.delete_report(report_id)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            return BaseResponse(message=result).dict(), 200
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

@report_ns.route('/compare')
class ReportCompare(Resource):
    @report_ns.doc('compare_reports')
        def post(self):
        """对比报告"""
        try:
            data = request.json
            report_ids = data.get('report_ids', [])
            
            success, result = report_service.compare_reports(report_ids)
            if not success:
                return BaseResponse(code=400, message=result).dict(), 400
            
            report = result
            report_data = {
                'id': report.id,
                'name': report.name,
                'user_id': report.user_id,
                'type': report.type,
                'report_url': report.report_url,
                'created_at': report.created_at.isoformat() if report.created_at else None
            }
            
            return BaseResponse(data=report_data).dict(), 201
        except Exception as e:
            return BaseResponse(code=500, message=str(e)).dict(), 500

@report_ns.route('/file/<path:filename>')
class ReportFile(Resource):
    @report_ns.doc('get_report_file')
    def get(self, filename):
        """获取报告文件"""
        try:
            directory = os.path.join(os.getcwd(), 'reports')
            if not os.path.exists(os.path.join(directory, filename)):
                return abort(404)
            return send_from_directory(directory, filename)
        except Exception:
            return abort(404)
