#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
调试脚本 - 检查Flask应用的路由
"""

from run import create_app

app = create_app()

print("=" * 60)
print("Flask应用路由列表")
print("=" * 60)

for rule in app.url_map.iter_rules():
    methods = ','.join(rule.methods - {'HEAD', 'OPTIONS'})
    print(f"{rule.endpoint:30s} {methods:15s} {rule.rule}")

print("=" * 60)
print(f"总路由数: {len(list(app.url_map.iter_rules()))}")
print("=" * 60)
