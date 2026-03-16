
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
    if current_user.role == "store":
        store_ids = [s.id for s in current_user.stores]
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
    data = ticket_in.model_dump()
    
    # Invariant: if initialHandler is provided, status MUST be in_progress.
    if data.get("handler_id"):
        data["status"] = "in_progress"
        data["processing_started_at"] = datetime.now(timezone.utc)
    
    data["requester_id"] = current_user.id
    
    # Generate unique ticket code
    data["ticket_code"] = f"TCK-{uuid.uuid4().hex[:8].upper()}"
    
    ticket = Ticket(**data)
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)
    return ticket

@router.post("/upload-attachments", response_model=dict)
async def upload_ticket_attachments(
    current_user: CurrentUser,
) -> Any:
    """Stub for file uploads. Max 5 images, 5MB each as per AGENTS invariant."""
    return {"success": True, "message": "File upload stub. Implementing storage engine next."}

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

@router.put("/{id}", response_model=TicketResponse)
async def update_ticket(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    ticket_in: Any # Using Any for quick update logic
) -> Any:
    """Update ticket info."""
    query = select(Ticket).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    update_data = ticket_in if isinstance(ticket_in, dict) else ticket_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(ticket, field, value)
        
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)
    return ticket

@router.get("/{id}/assignees", response_model=List[Any])
async def list_ticket_assignees(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """List users assigned to this ticket."""
    query = select(Ticket).options(selectinload(Ticket.assignees)).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    return ticket.assignees if ticket else []

@router.post("/{id}/resolve", response_model=TicketResponse)
async def resolve_ticket(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Mark ticket as resolved."""
    query = select(Ticket).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    ticket.status = "resolved"
    ticket.resolved_at = datetime.utcnow()
    
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)
    return ticket

@router.post("/{id}/reopen", response_model=TicketResponse)
async def reopen_ticket(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Reopen a resolved or closed ticket."""
    query = select(Ticket).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    ticket.status = "in_progress"
    ticket.resolved_at = None
    
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)
    return ticket

@router.get("/{id}/logs", response_model=List[Any])
async def read_ticket_logs(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Get all logs for a ticket."""
    query = select(TicketLog).where(TicketLog.ticket_id == id).order_by(TicketLog.created_at.desc())
    result = await session.execute(query)
    return result.scalars().all()
