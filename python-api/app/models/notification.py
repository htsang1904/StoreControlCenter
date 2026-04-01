from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, JSON, func
from sqlalchemy.orm import relationship

from app.db.database import Base
from app.db.types import UTCNaiveDateTime

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    
    # Enums: "info", "success", "warning", "error"
    type = Column(String(50), default="info", nullable=False)
    
    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(UTCNaiveDateTime(), nullable=True)
    meta_info = Column(JSON, nullable=True) # "meta" is often a reserved word
    
    recipient_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="SET NULL"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    recipient = relationship("User", foreign_keys=[recipient_id])
    actor = relationship("User", foreign_keys=[actor_id])
    ticket = relationship("Ticket", backref="notifications")

    def __str__(self):
        return self.title
