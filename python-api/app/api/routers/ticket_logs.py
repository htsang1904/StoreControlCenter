from typing import Any
from fastapi import APIRouter, HTTPException
from sqlalchemy import func
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep, CurrentUser
from app.models.ticket import Ticket, TicketLog
from app.schemas.ticket import TicketLogCreate, TicketLogResponse
from app.services.ticket_policy import OPEN_TICKET_STATUSES, can_access_ticket

router = APIRouter()

def _get_user_store_ids(current_user: CurrentUser) -> set[int]:
    return {s.id for s in current_user.stores if getattr(s, "id", None) is not None}

async def _ensure_ticket_access(session: SessionDep, ticket: Ticket, current_user: CurrentUser) -> None:
    is_assignee = False
    if current_user.role == "handler":
        assigned_result = await session.execute(
            select(func.count())
            .select_from(Ticket)
            .where(Ticket.id == ticket.id, Ticket.assignees.any(id=current_user.id))
        )
        is_assignee = (assigned_result.scalar() or 0) > 0

    allowed = can_access_ticket(
        user_role=current_user.role,
        user_id=current_user.id,
        user_department_id=current_user.department_id,
        user_store_ids=_get_user_store_ids(current_user),
        ticket_store_id=ticket.store_id,
        ticket_department_id=ticket.responsible_department_id,
        ticket_handler_id=ticket.handler_id,
        ticket_requester_id=ticket.requester_id,
        is_assignee=is_assignee,
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập ticket này")

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

    await _ensure_ticket_access(session, ticket, current_user)
    
    # Validate ticket status allows replies (Business Invariant)
    if ticket.status not in OPEN_TICKET_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Ticket đã ở trạng thái '{ticket.status}', không thể phản hồi"
        )
    
    data["sender_type"] = "handler" if current_user.role in {"handler", "admin", "qc"} else "store"
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
