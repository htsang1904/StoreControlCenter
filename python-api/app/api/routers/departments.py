from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.future import select

from app.api.deps import SessionDep, CurrentUser
from app.models.org import Department
from app.schemas.org import DepartmentResponse

router = APIRouter()

@router.get("/", response_model=List[DepartmentResponse])
async def read_departments(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100
) -> Any:
    """Read all departments."""
    result = await session.execute(select(Department).offset(skip).limit(limit))
    return result.scalars().all()

@router.get("/active", response_model=List[DepartmentResponse])
async def read_active_departments(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Read all active departments."""
    # Assuming all departments for now, could filter by an is_active flag if added to model
    result = await session.execute(select(Department))
    return result.scalars().all()
