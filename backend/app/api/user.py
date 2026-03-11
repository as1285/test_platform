from flask import request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from pydantic import ValidationError
from flask_restx import Resource
from app.api import api_bp, api
from app.services import user_service
from app.schemas.user import UserCreate, UserLogin, UserUpdate, UserPasswordUpdate, UserResponse, TokenResponse
from app.schemas import BaseResponse

# 创建用户命名空间
user_ns = api.namespace('user', description='用户管理相关接口')

@user_ns.route('/register')
class Register(Resource):
    @user_ns.doc('register')
    def post(self):
        """用户注册"""
        try:
            data = request.json
            user_data = UserCreate(**data)
            
            success, result = user_service.create_user(user_data)
            if not success:
                return jsonify(BaseResponse(code=400, message=result).dict()), 400
            
            user = result
            user_response = UserResponse.from_orm(user)
            
            return jsonify(BaseResponse(data=user_response.dict()).dict()), 201
        except ValidationError as e:
            return jsonify(BaseResponse(code=400, message=str(e)).dict()), 400
        except Exception as e:
            return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@user_ns.route('/login')
class Login(Resource):
    @user_ns.doc('login')
    def post(self):
        """用户登录"""
        try:
            data = request.json
            user_data = UserLogin(**data)
            
            # 获取用户
            user = user_service.get_user_by_email(user_data.email)
            if not user:
                return jsonify(BaseResponse(code=401, message='Invalid email or password').dict()), 401
            
            # 验证密码
            if not user_service.verify_password(user, user_data.password):
                return jsonify(BaseResponse(code=401, message='Invalid email or password').dict()), 401
            
            # 生成token
            from app.utils.jwt import JWTUtil
            token = JWTUtil.generate_token(user.id)
            
            user_response = UserResponse.from_orm(user)
            token_response = TokenResponse(
                access_token=token,
                token_type='Bearer',
                user=user_response
            )
            
            return jsonify(BaseResponse(data=token_response.dict()).dict()), 200
        except ValidationError as e:
            return jsonify(BaseResponse(code=400, message=str(e)).dict()), 400
        except Exception as e:
            return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@user_ns.route('/me')
class CurrentUser(Resource):
    @user_ns.doc('get_current_user')
    @jwt_required()
    def get(self):
        """获取当前用户信息"""
        try:
            user_id = get_jwt_identity()
            user = user_service.get_user_by_id(user_id)
            if not user:
                return jsonify(BaseResponse(code=404, message='User not found').dict()), 404
            
            user_response = UserResponse.from_orm(user)
            return jsonify(BaseResponse(data=user_response.dict()).dict()), 200
        except Exception as e:
            return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500
    
    @user_ns.doc('update_current_user')
    @jwt_required()
    def put(self):
        """更新当前用户信息"""
        try:
            user_id = get_jwt_identity()
            data = request.json
            user_data = UserUpdate(**data)
            
            success, result = user_service.update_user(user_id, user_data)
            if not success:
                return jsonify(BaseResponse(code=400, message=result).dict()), 400
            
            user = result
            user_response = UserResponse.from_orm(user)
            return jsonify(BaseResponse(data=user_response.dict()).dict()), 200
        except Exception as e:
            return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@user_ns.route('/<int:user_id>')
class User(Resource):
    @user_ns.doc('get_user')
    @jwt_required()
    def get(self, user_id):
        """获取用户信息"""
        try:
            user = user_service.get_user_by_id(user_id)
            if not user:
                return jsonify(BaseResponse(code=404, message='User not found').dict()), 404
            
            user_response = UserResponse.from_orm(user)
            return jsonify(BaseResponse(data=user_response.dict()).dict()), 200
        except Exception as e:
            return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500
    
    @user_ns.doc('update_user')
    @jwt_required()
    def put(self, user_id):
        """更新用户信息"""
        try:
            data = request.json
            user_data = UserUpdate(**data)
            
            success, result = user_service.update_user(user_id, user_data)
            if not success:
                return jsonify(BaseResponse(code=400, message=result).dict()), 400
            
            user = result
            user_response = UserResponse.from_orm(user)
            return jsonify(BaseResponse(data=user_response.dict()).dict()), 200
        except Exception as e:
            return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500
    
    @user_ns.doc('delete_user')
    @jwt_required()
    def delete(self, user_id):
        """删除用户"""
        try:
            success, result = user_service.delete_user(user_id)
            if not success:
                return jsonify(BaseResponse(code=400, message=result).dict()), 400
            
            return jsonify(BaseResponse(message=result).dict()), 200
        except Exception as e:
            return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@user_ns.route('/<int:user_id>/password')
class UserPassword(Resource):
    @user_ns.doc('update_user_password')
    @jwt_required()
    def put(self, user_id):
        """更新用户密码"""
        try:
            data = request.json
            password_data = UserPasswordUpdate(**data)
            
            success, result = user_service.update_user_password(user_id, password_data.password)
            if not success:
                return jsonify(BaseResponse(code=400, message=result).dict()), 400
            
            return jsonify(BaseResponse(message=result).dict()), 200
        except ValidationError as e:
            return jsonify(BaseResponse(code=400, message=str(e)).dict()), 400
        except Exception as e:
            return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500

@user_ns.route('/')
class UserList(Resource):
    @user_ns.doc('get_users')
    @jwt_required()
    def get(self):
        """获取用户列表"""
        try:
            # 获取查询参数
            page = request.args.get('page', 1, type=int)
            size = request.args.get('size', 10, type=int)
            username = request.args.get('username', None)
            role = request.args.get('role', None)
            status = request.args.get('status', None)
            
            # 获取用户列表
            success, result = user_service.get_users(page, size, username, role, status)
            
            if not success:
                return jsonify(BaseResponse(code=400, message=result).dict()), 400
            
            # 转换用户数据
            users = result['items']
            total = result['total']
            
            user_responses = [UserResponse.from_orm(user).dict() for user in users]
            
            return jsonify(BaseResponse(data={
                'items': user_responses,
                'total': total,
                'page': page,
                'size': size
            }).dict()), 200
        except Exception as e:
            return jsonify(BaseResponse(code=500, message=str(e)).dict()), 500
