from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

class BaseResponse(BaseModel):
    code: int = 200
    message: str = 'success'
    data: Optional[Any] = None

class Pagination(BaseModel):
    page: int = 1
    page_size: int = 10
    total: int = 0

class PaginatedResponse(BaseResponse):
    data: Optional[dict] = None
    pagination: Optional[Pagination] = None
