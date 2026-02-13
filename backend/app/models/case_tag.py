from datetime import datetime
from app.models import db

class CaseTag(db.Model):
    __tablename__ = 'case_tag'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    case_id = db.Column(db.Integer, db.ForeignKey('test_case.id'), nullable=False, index=True)
    tag_id = db.Column(db.Integer, db.ForeignKey('tag.id'), nullable=False, index=True)
    create_time = db.Column(db.DateTime, default=datetime.utcnow)
    
    def __repr__(self):
        return f'<CaseTag case={self.case_id} tag={self.tag_id}>'
