from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, ConfigDict
from decimal import Decimal
from app.schemas.user import UserMinimalResponse, StoreResponse

# --- Base QC Form Schemas ---
class QCFormBase(BaseModel):
    code: str
    name: str

class QCFormResponse(QCFormBase):
    id: int
    is_active: bool
    model_config = ConfigDict(from_attributes=True)

# --- QC Session Schemas ---
class QCSessionBase(BaseModel):
    code: str
    status: str = "draft"
    result: str = "pending"
    total_score: Decimal = Decimal(0)
    max_score: Decimal = Decimal(0)
    note: Optional[str] = None
    
    store_id: int
    form_version_id: int
    auditor_id: Optional[int] = None
    audited_at: datetime

class QCSessionCreate(QCSessionBase):
    pass

class QCSessionResponse(QCSessionBase):
    id: int
    submitted_at: Optional[datetime] = None
    auditor: Optional[UserMinimalResponse] = None
    store: Optional[StoreResponse] = None
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class QCSessionDetailResponse(QCSessionResponse):
    # Will expand items and findings lists here
    items: List[Any] = []
    findings: List[Any] = []
