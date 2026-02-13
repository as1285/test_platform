from datetime import datetime
from app.models import db

class RobustnessTest(db.Model):
    __tablename__ = 'robustness_test'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    execution_id = db.Column(db.Integer, db.ForeignKey('test_execution.id', ondelete='CASCADE'), unique=True, nullable=False, index=True)
    fault_injection_config = db.Column(db.Text, nullable=False)
    tolerance_result = db.Column(db.Text)
    score = db.Column(db.Float, default=0, index=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<RobustnessTest {self.id} score={self.score}>'
