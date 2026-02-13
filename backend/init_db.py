#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
数据库初始化脚本
"""

from app.models import db
from run import create_app

app = create_app()

with app.app_context():
    # 删除所有表
    db.drop_all()
    print("已删除所有表")
    
    # 创建所有表
    db.create_all()
    print("数据库表结构创建完成")
