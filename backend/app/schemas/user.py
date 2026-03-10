from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class UserBase(BaseModel):
    username: str
    email: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None

class UserPasswordUpdate(BaseModel):
    password: str

class UserResponse(UserBase):
    id: int
    role: Optional[str] = None
    status: Optional[str] = None
    create_time: Optional[datetime] = None
    update_time: Optional[datetime] = None
    last_login_time: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = 'Bearer'
    user: UserResponse