from flask import Blueprint
from flask_restx import Api

api_bp = Blueprint('api', __name__, url_prefix='/api/v1')

# 创建API对象，用于生成Swagger文档
api = Api(
    api_bp,
    version='1.0',
    title='测试平台API',
    description='测试平台后端API文档',
    doc='/swagger'
)

from .case import *
from .test import *
from .report import *
from .docs import *
