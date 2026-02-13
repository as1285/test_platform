import re
import html
from typing import Optional

class Validator:
    @staticmethod
    def validate_email(email: str) -> bool:
        """验证邮箱格式"""
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, email) is not None
    
    @staticmethod
    def validate_password(password: str) -> bool:
        """验证密码强度"""
        # 至少8位，包含字母和数字
        if len(password) < 8:
            return False
        if not re.search(r'[a-zA-Z]', password):
            return False
        if not re.search(r'[0-9]', password):
            return False
        return True
    
    @staticmethod
    def sanitize_input(input_str: str) -> str:
        """清理输入，防止XSS攻击"""
        return html.escape(input_str)
    
    @staticmethod
    def validate_url(url: str) -> bool:
        """验证URL格式"""
        pattern = r'^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$'
        return re.match(pattern, url) is not None
    
    @staticmethod
    def validate_json(json_str: str) -> bool:
        """验证JSON格式"""
        try:
            import json
            json.loads(json_str)
            return True
        except json.JSONDecodeError:
            return False
    
    @staticmethod
    def check_sql_injection(input_str: str) -> bool:
        """检查SQL注入攻击"""
        sql_patterns = [
            r'select.*from',
            r'insert.*into',
            r'update.*set',
            r'delete.*from',
            r'drop.*table',
            r'alter.*table',
            r'create.*table',
            r'\bor\b',
            r'\band\b',
            r'\bnot\b',
            r'\bunion\b',
            r'\bselect\b',
            r'\bfrom\b',
            r'\bwhere\b',
            r'\blike\b',
            r'\bin\b',
            r'\bbetween\b',
            r'\bexists\b',
            r'\binto\b',
            r'\bvalues\b',
            r'\bset\b',
            r'\bdelete\b',
            r'\bdrop\b',
            r'\balter\b',
            r'\bcreate\b',
            r'\breplace\b',
            r'\btruncate\b',
            r'--',
            r';',
            r'\bexec\b',
            r'\bexecute\b',
            r'\bsp_',
            r'\bxp_',
        ]
        input_lower = input_str.lower()
        for pattern in sql_patterns:
            if re.search(pattern, input_lower):
                return True
        return False
