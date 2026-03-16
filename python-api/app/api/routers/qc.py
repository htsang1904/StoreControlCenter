import uuid
from datetime import datetime
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep, CurrentUser
from app.models.qc_session import QCSession, QCSessionItem, QCDraft
from app.models.qc_form import QCForm, QCFormVersion, QCCriterion

router = APIRouter()

@router.get("/drafts", response_model=dict)
async def read_qc_drafts(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Read all QC drafts for current auditor."""
    query = select(QCDraft).where(QCDraft.auditor_id == current_user.id)
    result = await session.execute(query)
    drafts = result.scalars().all()
    return {"data": drafts}

from app.schemas.qc import QCSessionResponse, QCSessionCreate, QCSessionDetailResponse

@router.get("/forms", response_model=dict)
async def read_qc_forms(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Read all active QC forms."""
    query = select(QCForm).where(QCForm.is_active == True)
    result = await session.execute(query)
    items = result.scalars().all()
    # Strapi typically returns a flat list in this custom format if we want to avoid extra wrappers
    return {"data": {"items": items}}

@router.get("/forms/{id}", response_model=dict)
async def read_qc_form(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Read QC form details including criteria."""
    query = select(QCForm).where(QCForm.id == id)
    result = await session.execute(query)
    form = result.scalar_one_or_none()
    
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
        
    return {"data": {"item": form}}

@router.get("/sessions/overview", response_model=dict)
async def read_qc_sessions_overview(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Overview of QC sessions."""
    query = select(QCSession).order_by(QCSession.created_at.desc())
    result = await session.execute(query)
    sessions = result.scalars().all()
    return {"data": {"sessions": sessions, "summary": {}, "pagination": {}}}

@router.post("/sessions/create", response_model=dict)
async def create_qc_session(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    qc_session_in: Any
) -> Any:
    """Create a new QC Session with items."""
    data = qc_session_in if isinstance(qc_session_in, dict) else qc_session_in.model_dump()
    
    items_data = data.pop("criteria", [])
    
    data["auditor_id"] = current_user.id
    if "auditedAt" in data:
        data["audited_at"] = data.pop("auditedAt")
    if "formVersionId" in data:
        data["form_version_id"] = data.pop("formVersionId")
        
    data["code"] = f"QC-{datetime.utcnow().strftime('%y%m')}-{uuid.uuid4().hex[:4].upper()}"
    data["audited_at"] = datetime.fromisoformat(data["audited_at"].replace("Z", "+00:00")) if isinstance(data.get("audited_at"), str) else data.get("audited_at", datetime.utcnow())
        
    qc_session = QCSession(**data)
    session.add(qc_session)
    await session.flush()
    
    for item_in in items_data:
        item_obj = QCSessionItem(
            session_id=qc_session.id,
            criterion_id=item_in.get("id") if isinstance(item_in.get("id"), int) else None,
            criterion_name=item_in.get("name", ""),
            mode_snapshot=item_in.get("mode", "point"),
            max_score_snapshot=item_in.get("maxScore", 0),
            result=item_in.get("status", "pending"),
            score=item_in.get("score"),
            note=item_in.get("note"),
            attachments=item_in.get("attachments")
        )
        session.add(item_obj)
        
    await session.commit()
    await session.refresh(qc_session)
    return {"success": True, "data": {"session": qc_session}}
