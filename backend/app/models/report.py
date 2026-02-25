from datetime import datetime
from app.models import db

class Report(db.Model):
    __tablename__ = 'report'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(100), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False, index=True)
    execution_id = db.Column(db.Integer, db.ForeignKey('test_execution.id', ondelete='CASCADE'), nullable=True, index=True)
    type = db.Column(db.String(20), nullable=False, index=True)
    report_url = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关联关系
    execution = db.relationship('TestExecution', backref=db.backref('reports', lazy='dynamic'))
    
    def __repr__(self):
        return f'<Report {self.name} type={self.type}>'
