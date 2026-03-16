from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.db.database import Base

class QCSession(Base):
    __tablename__ = "qc_sessions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False, index=True)
    form_version_id = Column(Integer, ForeignKey("qc_form_versions.id"), nullable=False, index=True)
    auditor_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    # Enums: "draft", "submitted", "needs_fix", "closed"
    status = Column(String(50), default="draft", nullable=False)
    
    audited_at = Column(DateTime, nullable=False)
    submitted_at = Column(DateTime, nullable=True)
    
    # Enum: "pending", "pass", "fail"
    result = Column(String(50), default="pending", nullable=False)
    
    total_score = Column(Numeric(10, 2), default=0)
    max_score = Column(Numeric(10, 2), default=0)
    note = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    store = relationship("Store")
    form_version = relationship("QCFormVersion", back_populates="sessions")
    auditor = relationship("User")
    
    items = relationship("QCSessionItem", back_populates="session", cascade="all, delete-orphan")
    findings = relationship("QCFinding", back_populates="session", cascade="all, delete-orphan")

class QCSessionItem(Base):
    __tablename__ = "qc_session_items"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("qc_sessions.id"), nullable=False, index=True)
    criterion_id = Column(Integer, ForeignKey("qc_criteria.id"), nullable=True, index=True)
    
    criterion_code = Column(String(50), nullable=True)
    criterion_name = Column(String(255), nullable=False)
    
    # Enums: "pass_fail", "point"
    mode_snapshot = Column(String(50), nullable=False)
    max_score_snapshot = Column(Numeric(10, 2), default=0)
    
    # Enums: "pending", "pass", "fail", "na", "skipped_weekly"
    result = Column(String(50), default="pending", nullable=False)
    score = Column(Numeric(10, 2), nullable=True)
    applicable = Column(Boolean, default=True)
    requires_fix = Column(Boolean, default=False)
    
    note = Column(Text, nullable=True)
    attachments = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    session = relationship("QCSession", back_populates="items")
    criterion = relationship("QCCriterion", back_populates="session_items")


class QCDraft(Base):
    __tablename__ = "qc_drafts"

    id = Column(Integer, primary_key=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False, index=True)
    auditor_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    template_id = Column(String(50), nullable=False) # Maps to form version or form id roughly
    audited_at = Column(DateTime, nullable=False)
    note = Column(Text, nullable=True)
    criteria_states = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    store = relationship("Store")
    auditor = relationship("User")

class QCFinding(Base):
    __tablename__ = "qc_findings"

    id = Column(Integer, primary_key=True, index=True)
    finding_code = Column(String(50), unique=True, index=True, nullable=False)
    
    session_id = Column(Integer, ForeignKey("qc_sessions.id"), nullable=False, index=True)
    session_item_id = Column(Integer, ForeignKey("qc_session_items.id"), nullable=True, index=True)
    store_id = Column(Integer, ForeignKey("stores.id"), nullable=False, index=True)
    
    criterion_name = Column(String(255), nullable=True)
    
    # Enum: "low", "medium", "high", "critical"
    severity = Column(String(50), default="medium")
    # Enum: "open", "in_progress", "resolved", "verified", "rejected"
    status = Column(String(50), default="open")
    
    assignee_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    due_date = Column(DateTime, nullable=True) # Strapi mapped to `date` but we use datetime here
    
    corrective_action = Column(Text, nullable=True)
    corrective_note = Column(Text, nullable=True)
    
    resolved_at = Column(DateTime, nullable=True)
    verified_at = Column(DateTime, nullable=True)
    verifier_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    
    evidence = Column(JSON, nullable=True)
    meta_info = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    session = relationship("QCSession", back_populates="findings")
    session_item = relationship("QCSessionItem")
    store = relationship("Store")
    assignee = relationship("User", foreign_keys=[assignee_id])
    verifier = relationship("User", foreign_keys=[verifier_id])
