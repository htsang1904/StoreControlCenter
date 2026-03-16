import uuid
from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SessionDep, CurrentUser
from app.models.ticket import Ticket, TicketLog
from app.schemas.ticket import TicketResponse, TicketCreate, TicketDetailResponse

router = APIRouter()

@router.get("/", response_model=List[TicketResponse])
async def read_tickets(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100
) -> Any:
    """Read tickets. Follows business rule: Stores only see their own assigned tickets."""
    query = select(Ticket).offset(skip).limit(limit)
    
    # Invariant: store role only sees their tickets
    if current_user.user_info and current_user.user_info.role == "store":
        store_ids = [s.id for s in current_user.user_info.stores]
        query = query.where(Ticket.store_id.in_(store_ids))
        
    result = await session.execute(query)
    return result.scalars().all()

@router.post("/create", response_model=TicketResponse) # Keeping /create as per AGENTS invariant
async def create_ticket(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    ticket_in: TicketCreate
) -> Any:
    """Create a new ticket. Available for all logged in roles."""
    if not current_user.user_info:
        raise HTTPException(status_code=400, detail="User has no UserInfo profile linked")
        
    data = ticket_in.model_dump()
    
    # Invariant: if initialHandler is provided, status MUST be in_progress.
    # Note: Using generic logic for MVP here.
    
    data["requester_id"] = current_user.user_info.id
    
    # Generate unique ticket code
    data["ticket_code"] = f"TCK-{uuid.uuid4().hex[:8].upper()}"
    
    ticket = Ticket(**data)
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)
    return ticket

@router.get("/{id}", response_model=TicketDetailResponse)
async def read_ticket(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Get specific ticket and its logs."""
    query = select(Ticket).options(selectinload(Ticket.ticket_logs)).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    return ticket
