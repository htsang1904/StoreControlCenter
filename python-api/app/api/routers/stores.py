from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.future import select

from app.api.deps import SessionDep, CurrentUser
from app.models.org import Store
from app.schemas.org import StoreResponse, StoreCreate

router = APIRouter()

@router.get("/", response_model=List[StoreResponse])
async def read_stores(
    session: SessionDep,
    current_user: CurrentUser, # Guard route
    skip: int = 0,
    limit: int = 100
) -> Any:
    """Read all stores."""
    result = await session.execute(select(Store).offset(skip).limit(limit))
    return result.scalars().all()

@router.post("/", response_model=StoreResponse)
async def create_store(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    store_in: StoreCreate
) -> Any:
    """Create a new store."""
    if current_user.role and current_user.role.name != "Admin":
         raise HTTPException(status_code=403, detail="Not enough permissions")
         
    store = Store(**store_in.model_dump())
    session.add(store)
    await session.commit()
    await session.refresh(store)
    return store
