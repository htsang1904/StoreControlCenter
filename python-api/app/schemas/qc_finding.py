from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, ConfigDict, Field

class QCFindingBase(BaseModel):
    finding_code: Optional[str] = None
    session_id: int
    session_item_id: Optional[int] = None
    store_id: int
    criterion_name: Optional[str] = None
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    status: Literal["open", "in_progress", "resolved", "verified", "rejected"] = "open"
    assignee_id: Optional[int] = None
    due_date: Optional[datetime] = None
    corrective_action: Optional[str] = None
    corrective_note: Optional[str] = None
    evidence: Optional[list[dict[str, object]]] = None
    meta_info: Optional[dict[str, object]] = None

class QCFindingCreate(QCFindingBase):
    pass

class QCFindingUpdate(BaseModel):
    severity: Optional[str] = None
    status: Optional[str] = None
    assignee_id: Optional[int] = None
    due_date: Optional[datetime] = None
    corrective_action: Optional[str] = None
    corrective_note: Optional[str] = None
    resolved_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    verifier_id: Optional[int] = None
    evidence: Optional[list[dict[str, object]]] = None
    meta_info: Optional[dict[str, object]] = None

class QCFindingResolveRequest(BaseModel):
    corrective_action: Optional[str] = None
    corrective_note: str = Field(min_length=1)
    evidence: Optional[list[dict[str, object]]] = None

class QCFindingVerifyRequest(BaseModel):
    verify_note: Optional[str] = None

class QCFindingRejectRequest(BaseModel):
    rejection_reason: str = Field(min_length=1)

class QCFindingShortResponse(BaseModel):
    id: int
    finding_code: str
    status: str
    severity: str
    criterion_name: Optional[str]
    due_date: Optional[datetime]
    
    model_config = ConfigDict(from_attributes=True)

class QCFindingResponse(QCFindingBase):
    id: int
    finding_code: str
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None
    verifier_id: Optional[int] = None
    
    model_config = ConfigDict(from_attributes=True)
