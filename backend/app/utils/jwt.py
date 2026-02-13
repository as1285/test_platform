import jwt
from flask import current_app
from datetime import datetime, timedelta

class JWTUtil:
    @staticmethod
    def generate_token(user_id):
        """生成JWT token"""
        payload = {
            'sub': str(user_id),  # sub claim是JWT标准要求的
            'user_id': user_id,
            'exp': datetime.utcnow() + timedelta(seconds=current_app.config['JWT_ACCESS_TOKEN_EXPIRES']),
            'iat': datetime.utcnow()
        }
        return jwt.encode(payload, current_app.config['JWT_SECRET_KEY'], algorithm='HS256')
    
    @staticmethod
    def verify_token(token):
        """验证JWT token"""
        try:
            payload = jwt.decode(token, current_app.config['JWT_SECRET_KEY'], algorithms=['HS256'])
            return payload['user_id']
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
