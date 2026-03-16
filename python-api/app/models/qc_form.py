from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Numeric, ForeignKey, JSON
from sqlalchemy.orm import relationship

from app.db.database import Base

class QCForm(Base):
    __tablename__ = "qc_forms"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    versions = relationship("QCFormVersion", back_populates="form")

class QCFormVersion(Base):
    __tablename__ = "qc_form_versions"

    id = Column(Integer, primary_key=True, index=True)
    form_id = Column(Integer, ForeignKey("qc_forms.id"), nullable=False, index=True)
    version_no = Column(String(50), nullable=False)
    
    # Enums: "draft", "published", "archived"
    status = Column(String(50), default="draft", nullable=False)
    
    pass_rule = Column(JSON, nullable=True)
    effective_from = Column(DateTime, nullable=True)
    effective_to = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    form = relationship("QCForm", back_populates="versions")
    form_criteria = relationship("QCFormCriterion", back_populates="form_version")
    sessions = relationship("QCSession", back_populates="form_version")

class QCCriterion(Base):
    __tablename__ = "qc_criteria"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    
    # Enum: "pass_fail", "point"
    default_mode = Column(String(50), default="point", nullable=False)
    default_max_score = Column(Numeric(10, 2), default=0)
    is_active = Column(Boolean, default=True)
    
    parent_id = Column(Integer, ForeignKey("qc_criteria.id"), nullable=True)
    level = Column(Integer, default=1)
    ordering = Column(String(50), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Self-referential relationship for tree structure
    parent = relationship("QCCriterion", remote_side=[id], back_populates="children")
    children = relationship("QCCriterion", back_populates="parent")
    
    form_criteria_links = relationship("QCFormCriterion", back_populates="criterion")
    session_items = relationship("QCSessionItem", back_populates="criterion")

class QCFormCriterion(Base):
    """Mapping between a Form Version and a Criterion"""
    __tablename__ = "qc_form_criteria"

    id = Column(Integer, primary_key=True, index=True)
    form_version_id = Column(Integer, ForeignKey("qc_form_versions.id"), nullable=False, index=True)
    criterion_id = Column(Integer, ForeignKey("qc_criteria.id"), nullable=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    form_version = relationship("QCFormVersion", back_populates="form_criteria")
    criterion = relationship("QCCriterion", back_populates="form_criteria_links")
