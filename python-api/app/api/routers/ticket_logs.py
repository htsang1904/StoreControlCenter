from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SessionDep, CurrentUser
from app.models.ticket import TicketLog, Ticket
from app.schemas.ticket import TicketLogCreate, TicketLogResponse

router = APIRouter()

@router.post("/create", response_model=TicketLogResponse)
async def create_ticket_log(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    log_in: TicketLogCreate
) -> Any:
    """Create a new ticket log entry."""
    data = log_in.model_dump()
    data["sender_id"] = current_user.id
    
    # Optional: Validate ticket exists
    if "ticket_id" not in data:
         raise HTTPException(status_code=400, detail="ticket_id is required")

    log = TicketLog(**data)
    session.add(log)
    await session.commit()
    await session.refresh(log)
    return log
