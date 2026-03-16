from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.db.database import Base

class Role(Base):
    __tablename__ = "up_roles" # keeping Strapi-like naming convention but cleaner

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    description = Column(String(255))
    type = Column(String(255), unique=True) # e.g. authenticated, public
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    users = relationship("User", back_populates="role")

class User(Base):
    __tablename__ = "up_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(255), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    provider = Column(String(255), default="local")
    password = Column(String(255), nullable=False)
    reset_password_token = Column(String(255), nullable=True)
    confirmation_token = Column(String(255), nullable=True)
    confirmed = Column(Boolean, default=False)
    blocked = Column(Boolean, default=False)
    
    role_id = Column(Integer, ForeignKey("up_roles.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    role = relationship("Role", back_populates="users")
    # Will add user_info relationship later in Phase 3
