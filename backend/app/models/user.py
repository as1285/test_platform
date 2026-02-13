from app.models import db
from datetime import datetime

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='tester')
    status = db.Column(db.String(20), nullable=False, default='active')
    create_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    update_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_login_time = db.Column(db.DateTime, nullable=True)

    # 关联关系 - 级联删除
    case_groups = db.relationship('CaseGroup', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    test_cases = db.relationship('TestCase', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    test_executions = db.relationship('TestExecution', backref='user', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<User {self.username}>'
