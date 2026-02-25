from datetime import datetime
from app.models import db

class PerformanceConfig(db.Model):
    __tablename__ = 'performance_config'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False, index=True)
    case_id = db.Column(db.Integer, db.ForeignKey('test_case.id', ondelete='SET NULL'), nullable=True)
    target_url = db.Column(db.String(500), nullable=True)
    method = db.Column(db.String(10), nullable=False, default='GET')
    headers = db.Column(db.JSON, nullable=True)
    body = db.Column(db.Text, nullable=True)
    concurrency_type = db.Column(db.String(20), nullable=False, default='固定并发')
    concurrency = db.Column(db.Integer, nullable=True)
    initial_concurrency = db.Column(db.Integer, nullable=True)
    target_concurrency = db.Column(db.Integer, nullable=True)
    step_count = db.Column(db.Integer, nullable=True)
    step_duration = db.Column(db.Integer, nullable=True)
    duration = db.Column(db.Integer, nullable=False, default=300)
    interval = db.Column(db.Integer, nullable=True, default=0)
    timeout = db.Column(db.Integer, nullable=True, default=30)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<PerformanceConfig {self.name}>'
