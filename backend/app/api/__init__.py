from flask import Blueprint
from flask_restx import Api

api_bp = Blueprint('api', __name__, url_prefix='/api/v1')

# 创建 API 对象，用于生成 Swagger 文档
api = Api(
    api_bp,
    version='1.0',
    title='测试平台 API',
    description='测试平台后端 API 文档',
    doc='/swagger'
)

from .tools import excel_bp

# 注册工具相关的蓝图
api_bp.register_blueprint(excel_bp)
