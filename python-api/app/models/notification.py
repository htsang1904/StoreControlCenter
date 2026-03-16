from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.db.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    # Enums: "info", "success", "warning", "error"
    type = Column(String(50), default="info", nullable=False)
    
    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime, nullable=True)
    meta_info = Column(JSON, nullable=True) # "meta" is often a reserved word
    
    recipient_id = Column(Integer, ForeignKey("user_infos.id"), nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("user_infos.id"), nullable=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    recipient = relationship("UserInfo", foreign_keys=[recipient_id])
    actor = relationship("UserInfo", foreign_keys=[actor_id])
    ticket = relationship("Ticket", backref="notifications")
