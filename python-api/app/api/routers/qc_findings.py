import uuid
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, and_
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SessionDep, CurrentUser
from app.core.datetime_utils import utc_now_naive
from app.models.qc_session import QCFinding, QCSession, QCSessionItem
from app.models.org import Store
from app.models.user import User
from app.schemas.qc_finding import QCFindingCreate, QCFindingUpdate, QCFindingResponse

router = APIRouter()

def serialize_finding(finding: QCFinding) -> dict:
    """Helper to match Strapi's finding serialization."""
    return {
        "id": finding.id,
        "finding_code": finding.finding_code,
        "criterion_name": finding.criterion_name,
        "severity": finding.severity,
        "status": finding.status,
        "due_date": finding.due_date.isoformat() if finding.due_date else None,
        "corrective_action": finding.corrective_action,
        "corrective_note": finding.corrective_note,
        "resolved_at": finding.resolved_at.isoformat() if finding.resolved_at else None,
        "verified_at": finding.verified_at.isoformat() if finding.verified_at else None,
        "evidence": finding.evidence or [],
        "createdAt": finding.created_at.isoformat(),
        "updatedAt": finding.updated_at.isoformat(),
        "session": {"id": finding.session_id} if finding.session_id else None,
        "session_item": {"id": finding.session_item_id} if finding.session_item_id else None,
        "store": {
            "id": finding.store.id,
            "name": finding.store.name,
            "code": finding.store.code
        } if finding.store else None,
        "assignee": {
            "id": finding.assignee.id,
            "name": finding.assignee.name,
            "email": finding.assignee.email
        } if finding.assignee else None,
        "verifier": {
            "id": finding.verifier.id,
            "name": finding.verifier.name,
            "email": finding.verifier.email
        } if finding.verifier else None,
    }

@router.get("/", response_model=dict)
async def list_findings(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(0),
    limit: int = Query(200),
    status: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    store_id: Optional[int] = Query(None),
) -> Any:
    """List QC findings with filtering and RBAC."""
    query = select(QCFinding).options(
        selectinload(QCFinding.store),
        selectinload(QCFinding.assignee),
        selectinload(QCFinding.verifier)
    ).offset(skip).limit(limit).order_by(QCFinding.created_at.desc())

    filters = []
    if status:
        filters.append(QCFinding.status == status)
    if severity:
        filters.append(QCFinding.severity == severity)
    if store_id:
        filters.append(QCFinding.store_id == store_id)

    # RBAC Scoping
    if current_user.role == "admin":
        pass  # Admin sees all
    elif current_user.role == "handler":
        # Handlers see findings assigned to them or in their stores
        filters.append(QCFinding.assignee_id == current_user.id)
    else:
        # store, qc roles: filter by assigned stores
        user_store_ids = [s.id for s in current_user.stores]
        filters.append(QCFinding.store_id.in_(user_store_ids))

    if filters:
        query = query.where(and_(*filters))

    result = await session.execute(query)
    findings = result.scalars().all()
    
    return {
        "success": True,
        "message": "Lấy danh sách QC finding thành công",
        "data": [serialize_finding(f) for f in findings]
    }

@router.post("/", response_model=dict)
async def create_finding(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    finding_in: QCFindingCreate
) -> Any:
    """Create a manual QC finding."""
    data = finding_in.model_dump()
    
    if not data.get("finding_code"):
        timestamp = utc_now_naive().strftime("%y%m%d%H%M%S")
        random_part = uuid.uuid4().hex[:4].upper()
        data["finding_code"] = f"QCF-{timestamp}-{random_part}"

    finding = QCFinding(**data)
    session.add(finding)
    await session.commit()
    
    # Reload with relationships
    query = select(QCFinding).options(
        selectinload(QCFinding.store),
        selectinload(QCFinding.assignee),
        selectinload(QCFinding.verifier)
    ).where(QCFinding.id == finding.id)
    result = await session.execute(query)
    finding = result.scalar_one()

    return {
        "success": True,
        "message": "Tạo QC finding thành công",
        "data": serialize_finding(finding)
    }

@router.get("/{id}", response_model=dict)
async def read_finding(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Get finding details."""
    query = select(QCFinding).options(
        selectinload(QCFinding.store),
        selectinload(QCFinding.assignee),
        selectinload(QCFinding.verifier)
    ).where(QCFinding.id == id)
    result = await session.execute(query)
    finding = result.scalar_one_or_none()
    
    if not finding:
        raise HTTPException(status_code=404, detail="QC finding không tồn tại")
        
    return {
        "success": True,
        "data": serialize_finding(finding)
    }

@router.put("/{id}", response_model=dict)
async def update_finding(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
    finding_in: QCFindingUpdate
) -> Any:
    """Update a QC finding."""
    query = select(QCFinding).where(QCFinding.id == id)
    result = await session.execute(query)
    finding = result.scalar_one_or_none()
    
    if not finding:
        raise HTTPException(status_code=404, detail="QC finding không tồn tại")
    
    update_data = finding_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(finding, field, value)
        
    if "status" in update_data and update_data["status"] == "resolved":
        finding.resolved_at = utc_now_naive()
    if "status" in update_data and update_data["status"] == "verified":
        finding.verified_at = utc_now_naive()
        finding.verifier_id = current_user.id

    session.add(finding)
    await session.commit()
    
    # Reload with relationships
    query = select(QCFinding).options(
        selectinload(QCFinding.store),
        selectinload(QCFinding.assignee),
        selectinload(QCFinding.verifier)
    ).where(QCFinding.id == finding.id)
    result = await session.execute(query)
    finding = result.scalar_one()

    return {
        "success": True,
        "message": "Cập nhật QC finding thành công",
        "data": serialize_finding(finding)
    }
