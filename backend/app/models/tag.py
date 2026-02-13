from datetime import datetime
from app.models import db

class Tag(db.Model):
    __tablename__ = 'tag'
    
    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    name = db.Column(db.String(50), unique=True, nullable=False, index=True)
    create_time = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关联关系
    case_tags = db.relationship('CaseTag', backref='tag', lazy='dynamic')
    
    def __repr__(self):
        return f'<Tag {self.name}>'
