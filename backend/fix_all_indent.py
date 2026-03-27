#!/usr/bin/env python3
"""
修复所有 API 文件中的缩进错误
"""
import re
import os

api_dir = '/root/test_platform/backend/app/api'

for filename in os.listdir(api_dir):
    if filename.endswith('.py') and filename not in ['__init__.py']:
        file_path = os.path.join(api_dir, filename)
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # 修复方法定义的缩进错误
        # 将"        def "替换为"    def "
        content = re.sub(r'\n        def ', '\n    def ', content)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"已修复：{filename}")

print("\n所有文件修复完成！")
