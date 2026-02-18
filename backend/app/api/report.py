from flask import request, jsonify, send_from_directory, abort
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.api import api_bp
from app.services import report_service
from app.schemas.report import ReportCreate, ReportResponse
from app.schemas import BaseResponse, PaginatedResponse
import os

@api_bp.route('/report', methods=['POST'])
@jwt_required()
def create_report():
    """创建报告"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        
        success, result = report_service.create_report(data, user_id)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        report = result
        report_data = {
            'id': report.id,
            'name': report.name,
            'user_id': report.user_id,
            'type': report.type,
            'report_url': report.report_url,
            'created_at': report.created_at.isoformat() if report.created_at else None
        }
        
        return jsonify(BaseResponse(data=report_data).dict()), 201
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/report', methods=['GET'])
@jwt_required()
def get_reports():
    """获取报告列表"""
    try:
        user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        page_size = request.args.get('page_size', 10, type=int)
        
        result = report_service.get_reports(user_id, page, page_size)
        
        return jsonify(PaginatedResponse(
            data={'reports': result['reports']},
            pagination={
                'page': result['page'],
                'page_size': result['page_size'],
                'total': result['total']
            }
        ).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/report/<int:report_id>', methods=['GET'])
@jwt_required()
def get_report(report_id):
    """获取报告详情"""
    try:
        report = report_service.get_report_by_id(report_id)
        if not report:
            return jsonify(BaseResponse(code=404, message='Report not found').dict()), 404
        
        report_data = {
            'id': report.id,
            'name': report.name,
            'user_id': report.user_id,
            'type': report.type,
            'report_url': report.report_url,
            'created_at': report.created_at.isoformat() if report.created_at else None
        }
        
        return jsonify(BaseResponse(data=report_data).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/report/<int:report_id>', methods=['DELETE'])
@jwt_required()
def delete_report(report_id):
    """删除报告"""
    try:
        success, result = report_service.delete_report(report_id)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        return jsonify(BaseResponse(message=result).dict()), 200
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/report/compare', methods=['POST'])
@jwt_required()
def compare_reports():
    """对比报告"""
    try:
        data = request.json
        report_ids = data.get('report_ids', [])
        
        success, result = report_service.compare_reports(report_ids)
        if not success:
            return jsonify(BaseResponse(code=400, message=result).dict()), 400
        
        report = result
        report_data = {
            'id': report.id,
            'name': report.name,
            'user_id': report.user_id,
            'type': report.type,
            'report_url': report.report_url,
            'created_at': report.created_at.isoformat() if report.created_at else None
        }
        
        return jsonify(BaseResponse(data=report_data).dict()), 201
    except Exception as e:
        return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@api_bp.route('/report/file/<path:filename>', methods=['GET'])
def get_report_file(filename):
    try:
        directory = os.path.join(os.getcwd(), 'reports')
        if not os.path.exists(os.path.join(directory, filename)):
            return abort(404)
        return send_from_directory(directory, filename)
    except Exception:
        return abort(404)
