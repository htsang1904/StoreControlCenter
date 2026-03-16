from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.future import select

from app.api.deps import SessionDep, CurrentUser
from app.models.qc_session import QCSession
from app.schemas.qc import QCSessionResponse, QCSessionCreate, QCSessionDetailResponse

router = APIRouter()

@router.get("/", response_model=List[QCSessionResponse])
async def read_qc_sessions(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100
) -> Any:
    """Read QC Sessions."""
    query = select(QCSession).offset(skip).limit(limit)
    result = await session.execute(query)
    return result.scalars().all()

@router.post("/", response_model=QCSessionResponse)
async def create_qc_session(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    qc_session_in: QCSessionCreate
) -> Any:
    """Create a new QC Session."""
    data = qc_session_in.model_dump()
    
    if current_user.user_info:
        data["auditor_id"] = current_user.user_info.id
        
    qc_session = QCSession(**data)
    session.add(qc_session)
    await session.commit()
    await session.refresh(qc_session)
    return qc_session
