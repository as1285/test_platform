from datetime import datetime
from app.models import db

class TestResult(db.Model):
    __tablename__ = 'test_result'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    execution_id = db.Column(db.Integer, db.ForeignKey('test_execution.id', ondelete='CASCADE'), nullable=False, index=True)
    status = db.Column(db.String(20), nullable=False, index=True)
    response = db.Column(db.Text)
    error_message = db.Column(db.Text)
    response_time = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    
    def __repr__(self):
        return f'<TestResult {self.id} status={self.status}>'
