class PluginBase:
    """插件基类"""
    
    def __init__(self):
        self.name = 'base'
        self.description = 'Base plugin'
    
    def execute(self, config):
        """执行插件"""
        raise NotImplementedError
    
    def validate_config(self, config):
        """验证配置"""
        raise NotImplementedError
    
    def get_result(self):
        """获取执行结果"""
        raise NotImplementedError
