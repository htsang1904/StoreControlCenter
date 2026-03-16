from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Table
from sqlalchemy.orm import relationship

from app.db.database import Base

# Association Table for UserInfo <-> Store (Many-to-Many as per Strapi schema `stores` relation)
user_info_stores = Table(
    'user_info_stores',
    Base.metadata,
    Column('user_info_id', Integer, ForeignKey('user_infos.id'), primary_key=True),
    Column('store_id', Integer, ForeignKey('stores.id'), primary_key=True)
)

class UserInfo(Base):
    __tablename__ = "user_infos"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255))
    email = Column(String(255), unique=True, index=True)
    suite_token = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    
    refresh_token_hash = Column(String(255), nullable=True)
    refresh_token_expires_at = Column(DateTime, nullable=True)
    token_version = Column(Integer, default=0)
    
    # Store enum values from Strapi: "store", "handler", "qc", "admin"
    role = Column(String(50), default="store", nullable=False)
    
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)
    
    # We should also link this profile to the Authentication `User`
    user_id = Column(Integer, ForeignKey("up_users.id"), unique=True, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    department = relationship("Department", back_populates="users")
    stores = relationship("Store", secondary=user_info_stores, back_populates="user_infos")
    auth_user = relationship("User", backref="user_info", uselist=False)
    
    from app.models.ticket import ticket_assignees
    assigned_tickets = relationship("Ticket", secondary=ticket_assignees, back_populates="assignees")
    
    from app.models.notification import Notification
    notifications = relationship("Notification", foreign_keys="Notification.recipient_id")
