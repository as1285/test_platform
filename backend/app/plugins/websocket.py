import asyncio
import websockets
from .base import PluginBase

class WebSocketPlugin(PluginBase):
    """WebSocket测试插件"""
    
    def __init__(self):
        super().__init__()
        self.name = 'websocket'
        self.description = 'WebSocket test plugin'
        self.result = {}
    
    def execute(self, config):
        """执行WebSocket测试"""
        try:
            url = config.get('url')
            message = config.get('message')
            timeout = config.get('timeout', 5)
            
            # 执行WebSocket测试
            asyncio.run(self._test_websocket(url, message, timeout))
            
            return True
        except Exception as e:
            self.result['error'] = str(e)
            return False
    
    async def _test_websocket(self, url, message, timeout):
        """WebSocket测试逻辑"""
        try:
            async with websockets.connect(url, timeout=timeout) as websocket:
                # 发送消息
                await websocket.send(message)
                # 接收响应
                response = await websocket.recv()
                
                self.result = {
                    'status': 'success',
                    'url': url,
                    'message': message,
                    'response': response
                }
        except Exception as e:
            self.result = {
                'status': 'error',
                'url': url,
                'message': message,
                'error': str(e)
            }
    
    def validate_config(self, config):
        """验证配置"""
        required_fields = ['url', 'message']
        for field in required_fields:
            if field not in config:
                return False, f'Missing required field: {field}'
        return True, 'Config valid'
    
    def get_result(self):
        """获取执行结果"""
        return self.result
