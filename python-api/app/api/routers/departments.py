from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.future import select

from app.api.deps import SessionDep, CurrentUser
from app.models.org import Department
from app.schemas.org import DepartmentResponse

router = APIRouter()

@router.get("/", response_model=dict)
async def read_departments(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100
) -> Any:
    """Read all departments."""
    result = await session.execute(select(Department).offset(skip).limit(limit))
    items = result.scalars().all()
    # Manual conversion to ensure serialization through Pydantic
    serialized_items = [DepartmentResponse.model_validate(item) for item in items]
    return {"success": True, "data": serialized_items}

@router.get("/active", response_model=dict)
async def read_active_departments(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Read all active departments."""
    result = await session.execute(select(Department).where(Department.is_active == True))
    items = result.scalars().all()
    serialized_items = [DepartmentResponse.model_validate(item) for item in items]
    return {"success": True, "data": serialized_items}
