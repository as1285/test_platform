#!/usr/bin/env python3
"""
修复 case.py 中的缩进错误
"""
import re

file_path = '/root/test_platform/backend/app/api/case.py'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 修复方法定义的缩进错误
# 将"        def "替换为"    def "
content = re.sub(r'\n        def ', '\n    def ', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("已修复 case.py 中的缩进错误")
