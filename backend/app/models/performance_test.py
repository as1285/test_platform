from datetime import datetime
from app.models import db

class PerformanceTest(db.Model):
    __tablename__ = 'performance_test'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    execution_id = db.Column(db.Integer, db.ForeignKey('test_execution.id', ondelete='CASCADE'), unique=True, nullable=False, index=True)
    concurrency = db.Column(db.Integer, nullable=False)
    duration = db.Column(db.Integer, nullable=False)
    ramp_up_config = db.Column(db.Text)
    metrics = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<PerformanceTest {self.id} concurrency={self.concurrency}>'
