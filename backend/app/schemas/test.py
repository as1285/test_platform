from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime

class TestExecutionBase(BaseModel):
    case_id: int
    status: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    execution_log: Optional[str] = None

class TestExecutionCreate(TestExecutionBase):
    pass

class TestExecutionUpdate(BaseModel):
    status: Optional[str] = None
    end_time: Optional[datetime] = None
    execution_log: Optional[str] = None

class TestExecutionResponse(TestExecutionBase):
    id: int
    user_id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

class TestResultBase(BaseModel):
    execution_id: int
    status: str
    response: Optional[str] = None
    error_message: Optional[str] = None
    response_time: Optional[float] = None

class TestResultCreate(TestResultBase):
    pass

class TestResultResponse(TestResultBase):
    id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

class PerformanceTestBase(BaseModel):
    execution_id: int
    concurrency: int
    duration: int
    ramp_up_config: Optional[str] = None
    metrics: str

class PerformanceTestCreate(PerformanceTestBase):
    pass

class PerformanceTestResponse(PerformanceTestBase):
    id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

class RobustnessTestBase(BaseModel):
    execution_id: int
    fault_injection_config: str
    tolerance_result: Optional[str] = None
    score: Optional[float] = 0

class RobustnessTestCreate(RobustnessTestBase):
    pass

class RobustnessTestResponse(RobustnessTestBase):
    id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

class TestRunRequest(BaseModel):
    case_ids: List[int]
    parameters: Optional[str] = None

class TestRunBatchRequest(BaseModel):
    case_ids: List[int]
    parameters: Optional[str] = None

class TestRunPerformanceRequest(BaseModel):
    case_id: int
    concurrency: int
    duration: int
    ramp_up_config: Optional[str] = None

class TestRunRobustnessRequest(BaseModel):
    case_id: int
    fault_injection_config: str

class TestRunPerformanceCustomRequest(BaseModel):
    target_url: str
    method: str = "GET"
    headers: Optional[Dict[str, Any]] = None
    body: Optional[str] = None
    concurrency: int
    duration: int
    ramp_up_config: Optional[str] = None
    timeout: Optional[int] = 30
