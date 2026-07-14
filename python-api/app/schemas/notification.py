from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, ConfigDict

class NotificationBase(BaseModel):
    title: str
    message: str
    type: str = "info"
    is_read: bool = False
    read_at: Optional[datetime] = None
    meta_info: Optional[Any] = None
    recipient_id: int
    actor_id: Optional[int] = None
    ticket_id: Optional[int] = None

class NotificationResponse(NotificationBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    
    model_config = ConfigDict(from_attributes=True)
