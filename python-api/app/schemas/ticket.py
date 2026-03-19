from datetime import datetime
from typing import Optional, List, Any, Literal
from pydantic import BaseModel, ConfigDict
from app.schemas.user import UserMinimalResponse, DepartmentResponse, StoreResponse

# Base schema reflecting both Ticket and TicketLog
class TicketLogBase(BaseModel):
    message: str
    attachments: Optional[Any] = None
    sender_type: str = "store"

class TicketLogCreate(TicketLogBase):
    ticket_id: int

class TicketLogResponse(TicketLogBase):
    id: int
    ticket_id: int
    sender_id: Optional[int] = None
    sender: Optional[UserMinimalResponse] = None
    created_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class TicketBase(BaseModel):
    title: str
    description: str
    status: Literal["new", "assigned", "in_progress", "resolved", "closed", "rejected"] = "new"
    type: Optional[str] = None
    
    store_id: int
    responsible_department_id: int
    ticket_category_id: Optional[int] = None

class TicketCreate(TicketBase):
    # The requester is typically the logged-in user, but if admin creates it for someone else:
    requester_id: Optional[int] = None 
    attachments: Optional[Any] = None

class TicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    handler_id: Optional[int] = None
    responsible_department_id: Optional[int] = None
    
class TicketResponse(TicketBase):
    id: int
    ticket_code: str
    requester_id: Optional[int] = None
    requester: Optional[UserMinimalResponse] = None
    handler_id: Optional[int] = None
    handler: Optional[UserMinimalResponse] = None
    store: Optional[StoreResponse] = None
    responsible_department: Optional[DepartmentResponse] = None
    assignees: List[UserMinimalResponse] = []
    
    start_date: Optional[datetime] = None
    processing_started_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    end_date: Optional[datetime] = None
    
    attachments: Optional[Any] = None
    attachments_media: Optional[Any] = None
    
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)

class TicketDetailResponse(TicketResponse):
    ticket_logs: List[TicketLogResponse] = []
