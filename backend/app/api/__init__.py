from flask import Blueprint
from flask_jwt_extended import JWTManager

api_bp = Blueprint('api', __name__)
jwt = JWTManager()

from .user import *
from .case import *
from .test import *
from .report import *
from .docs import *
