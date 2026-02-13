from datetime import datetime
from app.models import db

class TestExecution(db.Model):
    __tablename__ = 'test_execution'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    case_id = db.Column(db.Integer, db.ForeignKey('test_case.id', ondelete='CASCADE'), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    status = db.Column(db.String(20), nullable=False, index=True)
    start_time = db.Column(db.DateTime, index=True)
    end_time = db.Column(db.DateTime)
    execution_log = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关联关系
    test_results = db.relationship('TestResult', backref='execution', lazy='dynamic', cascade='all, delete-orphan')
    performance_test = db.relationship('PerformanceTest', backref='execution', uselist=False, cascade='all, delete-orphan')
    robustness_test = db.relationship('RobustnessTest', backref='execution', uselist=False, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<TestExecution {self.id} status={self.status}>'
