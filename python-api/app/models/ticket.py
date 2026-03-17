from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Table, JSON, func
from sqlalchemy.orm import relationship

from app.db.database import Base

# Association Table for Ticket <-> User (Many-to-Many - Assignees)
ticket_assignees = Table(
    'ticket_assignees',
    Base.metadata,
    Column('ticket_id', Integer, ForeignKey('tickets.id'), primary_key=True),
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True)
)

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    ticket_code = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    
    # Store enum values: "new", "assigned", "in_progress", "resolved", "closed", "rejected"
    status = Column(String(50), default="new", nullable=False)
    type = Column(String(50), nullable=True) # Type/Category text
    
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    handler_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False, index=True)
    responsible_department_id = Column(Integer, ForeignKey("departments.id"), nullable=False, index=True)
    ticket_category_id = Column(Integer, nullable=True) # Unmapped external ID?

    start_date = Column(DateTime, nullable=True)
    processing_started_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    
    # Storing file paths / metadata
    attachments = Column(JSON, nullable=True)
    attachments_media = Column(JSON, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    requester = relationship("User", foreign_keys=[requester_id])
    handler = relationship("User", foreign_keys=[handler_id])
    store = relationship("Store", backref="tickets")
    responsible_department = relationship("Department", back_populates="tickets")
    assignees = relationship("User", secondary=ticket_assignees, back_populates="assigned_tickets")
    
    ticket_logs = relationship("TicketLog", back_populates="ticket", cascade="all, delete-orphan")
    # Will add `notifications` later

class TicketLog(Base):
    __tablename__ = "ticket_logs"

    id = Column(Integer, primary_key=True, index=True)
    message = Column(Text, nullable=False)
    attachments = Column(JSON, nullable=True)
    
    # Enum: "store", "handler", "system"
    sender_type = Column(String(50), default="store", nullable=False)
    
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    ticket = relationship("Ticket", back_populates="ticket_logs")
    sender = relationship("User", foreign_keys=[sender_id])
