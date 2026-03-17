from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep, CurrentUser
from app.models.ticket import Ticket, TicketLog
from app.schemas.ticket import TicketLogCreate, TicketLogResponse

router = APIRouter()

REPLY_ALLOWED_STATUSES = {"new", "assigned", "in_progress"}

@router.post("/create", response_model=dict)
async def create_ticket_log(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    log_in: TicketLogCreate
) -> Any:
    """Create a new ticket log entry (reply to ticket)."""
    data = log_in.model_dump()
    
    # Validate ticket exists
    ticket = await session.get(Ticket, data["ticket_id"])
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket không tồn tại")
    
    # Validate ticket status allows replies (Business Invariant)
    if ticket.status not in REPLY_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Ticket đã ở trạng thái '{ticket.status}', không thể phản hồi"
        )
    
    data["sender_id"] = current_user.id
    
    log = TicketLog(**data)
    session.add(log)
    await session.commit()
    
    # Reload with sender details
    query = select(TicketLog).options(
        selectinload(TicketLog.sender)
    ).where(TicketLog.id == log.id)
    result = await session.execute(query)
    log = result.scalar_one()
    
    return {"success": True, "message": "Phản hồi thành công", "data": TicketLogResponse.model_validate(log)}
