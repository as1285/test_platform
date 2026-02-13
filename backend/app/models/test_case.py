from app.models import db
from datetime import datetime

class TestCase(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    group_id = db.Column(db.Integer, db.ForeignKey('case_group.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    method = db.Column(db.String(10), nullable=False, default='GET')
    url = db.Column(db.String(500), nullable=False)
    headers = db.Column(db.JSON, nullable=True)
    body = db.Column(db.Text, nullable=True)
    extract = db.Column(db.JSON, nullable=True)
    validate = db.Column(db.JSON, nullable=True)
    variables = db.Column(db.JSON, nullable=True)
    status = db.Column(db.String(20), nullable=False, default='enabled')
    create_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    update_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    # 关联关系 - 级联删除
    test_steps = db.relationship('TestStep', backref='case', lazy='dynamic', cascade='all, delete-orphan')
    test_executions = db.relationship('TestExecution', backref='case', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<TestCase {self.name}>'
