from datetime import datetime
from app.models import db

class TestStep(db.Model):
    __tablename__ = 'test_step'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    case_id = db.Column(db.Integer, db.ForeignKey('test_case.id'), nullable=False, index=True)
    step_order = db.Column(db.Integer, nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    method = db.Column(db.String(10), nullable=False, default='GET')
    url = db.Column(db.String(500), nullable=False)
    headers = db.Column(db.JSON, nullable=True)
    body = db.Column(db.Text, nullable=True)
    validate = db.Column(db.JSON, nullable=True)
    extract = db.Column(db.JSON, nullable=True)
    create_time = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<TestStep {self.id} for case {self.case_id}>'
