from flask import Flask
from flask_cors import CORS
from app.api import api_bp, jwt
from app.models import db
from app.utils.redis import RedisUtil
from config import config

def create_app(config_name='default'):
    """创建Flask应用"""
    app = Flask(__name__)
    app.config.from_object(config[config_name])
    
    # 初始化CORS
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # 初始化数据库
    db.init_app(app)
    
    # 初始化JWT
    jwt.init_app(app)
    
    # 初始化Redis
    redis_util = RedisUtil()
    
    # 注册蓝图
    app.register_blueprint(api_bp, url_prefix=app.config['API_PREFIX'])
    
    # 创建数据库表
    with app.app_context():
        db.create_all()
    
    # 健康检查接口
    @app.route('/health')
    def health_check():
        return {'status': 'ok'}
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(host='0.0.0.0', port=5000)
