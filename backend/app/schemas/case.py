from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class CaseGroupBase(BaseModel):
    name: str
    parent_id: Optional[int] = None

class CaseGroupCreate(CaseGroupBase):
    pass

class CaseGroupUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None

class CaseGroupResponse(CaseGroupBase):
    id: int
    user_id: int
    create_time: datetime
    update_time: datetime
    
    class Config:
        from_attributes = True

class TestCaseBase(BaseModel):
    name: str
    group_id: int
    description: Optional[str] = None
    status: Optional[str] = "enabled"
    method: str = "GET"
    url: str
    headers: Optional[Dict[str, Any]] = None
    body: Optional[str] = None
    validate: Optional[List[Dict[str, Any]]] = None
    extract: Optional[List[Dict[str, Any]]] = None
    variables: Optional[Dict[str, Any]] = None

class TestCaseCreate(TestCaseBase):
    pass

class TestCaseUpdate(BaseModel):
    name: Optional[str] = None
    group_id: Optional[int] = None
    description: Optional[str] = None
    status: Optional[str] = None
    method: Optional[str] = None
    url: Optional[str] = None
    headers: Optional[Dict[str, Any]] = None
    body: Optional[str] = None
    validate: Optional[List[Dict[str, Any]]] = None
    extract: Optional[List[Dict[str, Any]]] = None
    variables: Optional[Dict[str, Any]] = None

class TestCaseResponse(TestCaseBase):
    id: int
    user_id: int
    create_time: datetime
    update_time: datetime
    
    class Config:
        from_attributes = True

class TestStepBase(BaseModel):
    case_id: int
    step_order: int
    name: str
    method: str
    url: str
    headers: Optional[Dict[str, Any]] = None
    body: Optional[str] = None
    validate: Optional[List[Dict[str, Any]]] = None
    extract: Optional[List[Dict[str, Any]]] = None

class TestStepCreate(TestStepBase):
    pass

class TestStepUpdate(BaseModel):
    step_order: Optional[int] = None
    name: Optional[str] = None
    method: Optional[str] = None
    url: Optional[str] = None
    headers: Optional[Dict[str, Any]] = None
    body: Optional[str] = None
    validate: Optional[List[Dict[str, Any]]] = None
    extract: Optional[List[Dict[str, Any]]] = None

class TestStepResponse(TestStepBase):
    id: int
    create_time: datetime
    
    class Config:
        from_attributes = True

class TagBase(BaseModel):
    name: str

class TagCreate(TagBase):
    pass

class TagResponse(TagBase):
    id: int
    create_time: datetime
    
    class Config:
        from_attributes = True

class CaseTagBase(BaseModel):
    case_id: int
    tag_id: int

class CaseTagCreate(CaseTagBase):
    pass

class CaseTagResponse(CaseTagBase):
    id: int
    create_time: datetime
    
    class Config:
        from_attributes = True
