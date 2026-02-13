import redis
import json
from flask import current_app

class RedisUtil:
    def __init__(self):
        self._redis_client = None
    
    @property
    def redis_client(self):
        if self._redis_client is None:
            self._redis_client = redis.from_url(current_app.config['REDIS_URL'])
        return self._redis_client
    
    def set(self, key, value, expire=3600):
        """设置缓存"""
        try:
            if isinstance(value, dict) or isinstance(value, list):
                value = json.dumps(value)
            self.redis_client.setex(key, expire, value)
            return True
        except Exception as e:
            print(f"Redis set error: {e}")
            return False
    
    def get(self, key):
        """获取缓存"""
        try:
            value = self.redis_client.get(key)
            if value:
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    return value.decode('utf-8')
            return None
        except Exception as e:
            print(f"Redis get error: {e}")
            return None
    
    def delete(self, key):
        """删除缓存"""
        try:
            self.redis_client.delete(key)
            return True
        except Exception as e:
            print(f"Redis delete error: {e}")
            return False
    
    def exists(self, key):
        """检查缓存是否存在"""
        try:
            return self.redis_client.exists(key) > 0
        except Exception as e:
            print(f"Redis exists error: {e}")
            return False
    
    def incr(self, key, expire=3600):
        """递增计数器"""
        try:
            value = self.redis_client.incr(key)
            if expire:
                self.redis_client.expire(key, expire)
            return value
        except Exception as e:
            print(f"Redis incr error: {e}")
            return 0

redis_util = RedisUtil()