from app.models import db
from datetime import datetime

class CaseGroup(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('case_group.id', ondelete='CASCADE'), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id', ondelete='CASCADE'), nullable=False)
    create_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    update_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    children = db.relationship('CaseGroup', backref=db.backref('parent', remote_side=[id]), cascade='all, delete-orphan')
    cases = db.relationship('TestCase', backref='group', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<CaseGroup {self.name}>'
