import uuid
import os
from datetime import datetime, timedelta, timezone
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
from sqlalchemy import func, or_, and_
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SessionDep, CurrentUser
from app.models.ticket import Ticket, TicketLog
from app.models.org import Store
from app.models.user import User
from app.schemas.ticket import TicketResponse, TicketCreate, TicketDetailResponse, TicketLogResponse
from app.schemas.user import UserResponse

router = APIRouter()

from .dashboard import get_dashboard_overview as dashboard_backup
router.add_api_route("/dashboard/overview", dashboard_backup, methods=["GET"], tags=["Dashboard (Backup)"])
router.add_api_route("/dashboard/overview/", dashboard_backup, methods=["GET"], tags=["Dashboard (Backup)"])

@router.get("/", response_model=dict)
async def read_tickets(
    session: SessionDep,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
) -> Any:
    """Read tickets with RBAC, pagination and filtering."""
    skip = (page - 1) * pageSize
    
    # Base Query
    query = select(Ticket).order_by(Ticket.created_at.desc())
    count_query = select(func.count()).select_from(Ticket)
    
    filters = []
    
    # RBAC Filters
    if current_user.role == "store":
        store_ids = [s.id for s in current_user.stores]
        filters.append(Ticket.store_id.in_(store_ids))
    elif current_user.role == "handler":
        filters.append(or_(
            Ticket.responsible_department_id == current_user.department_id,
            Ticket.assignees.any(id=current_user.id)
        ))
        
    # Search Filter
    if q:
        filters.append(or_(
            Ticket.title.ilike(f"%{q}%"),
            Ticket.ticket_code.ilike(f"%{q}%"),
            Ticket.description.ilike(f"%{q}%")
        ))
        
    # Status Filter
    if status:
        status_list = [s.strip() for s in status.split(",") if s.strip()]
        if status_list:
            filters.append(Ticket.status.in_(status_list))
            
    if filters:
        query = query.where(and_(*filters))
        count_query = count_query.where(and_(*filters))
        
    # Execute Count
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0
    
    # Execute Items
    result = await session.execute(query.offset(skip).limit(pageSize))
    tickets = result.scalars().all()
    
    serialized_items = [TicketResponse.model_validate(t) for t in tickets]
    page_count = (total + pageSize - 1) // pageSize if pageSize > 0 else 0
    
    return {
        "success": True, 
        "data": serialized_items,
        "pagination": {
            "page": page,
            "pageSize": pageSize,
            "total": total,
            "pageCount": page_count
        }
    }

@router.post("/create", response_model=dict)
async def create_ticket(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    ticket_in: TicketCreate
) -> Any:
    """Create a new ticket."""
    data = ticket_in.model_dump()
    
    if data.get("handler_id"):
        data["status"] = "in_progress"
        data["processing_started_at"] = datetime.now(timezone.utc)
    
    data["requester_id"] = current_user.id
    data["ticket_code"] = f"TCK-{uuid.uuid4().hex[:8].upper()}"
    
    ticket = Ticket(**data)
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)
    return {"success": True, "message": "Tạo phiếu thành công", "data": {"ticket": TicketResponse.model_validate(ticket)}}

@router.post("/upload-attachments", response_model=dict)
async def upload_ticket_attachments(
    current_user: CurrentUser,
    files: List[UploadFile] = File(...),
) -> Any:
    """Upload multiple images for tickets."""
    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Tối đa 5 ảnh một lần")
        
    uploaded_files = []
    upload_dir = "static/uploads"
    os.makedirs(upload_dir, exist_ok=True)
    
    for file in files:
        contents = await file.read()
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"File {file.filename} vượt quá 5MB")
            
        file_ext = os.path.splitext(file.filename)[1]
        new_filename = f"ticket_{uuid.uuid4().hex}{file_ext}"
        file_path = os.path.join(upload_dir, new_filename)
        
        with open(file_path, "wb") as f:
            f.write(contents)
            
        uploaded_files.append({
            "id": uuid.uuid4().hex,
            "url": f"/static/uploads/{new_filename}",
            "name": file.filename,
            "size": len(contents)
        })
        
    return {"success": True, "message": "Upload thành công", "data": {"files": uploaded_files}}

@router.get("/{id}", response_model=dict)
async def read_ticket(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Get specific ticket and its logs."""
    query = select(Ticket).options(
        selectinload(Ticket.ticket_logs).selectinload(TicketLog.sender),
        selectinload(Ticket.store),
        selectinload(Ticket.requester),
        selectinload(Ticket.assignees),
        selectinload(Ticket.handler),
        selectinload(Ticket.responsible_department)
    ).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")
        
    # We use TicketDetailResponse for manual validation because it has nested items/logs
    return {"success": True, "data": TicketDetailResponse.model_validate(ticket)}

@router.put("/{id}", response_model=dict)
async def update_ticket(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    ticket_in: Any
) -> Any:
    """Update ticket info."""
    query = select(Ticket).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")
    
    update_data = ticket_in if isinstance(ticket_in, dict) else ticket_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(ticket, field):
            setattr(ticket, field, value)
        
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)
    return {"success": True, "message": "Cập nhật phiếu thành công", "data": TicketResponse.model_validate(ticket)}

@router.get("/{id}/assignees", response_model=dict)
async def list_ticket_assignees(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """List users assigned to this ticket."""
    query = select(Ticket).options(selectinload(Ticket.assignees)).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")
        
    serialized_assignees = [UserResponse.model_validate(u) for u in ticket.assignees]
    return {"success": True, "data": serialized_assignees}

@router.get("/{id}/assignable-handlers", response_model=dict)
async def list_assignable_handlers(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """List handlers that can be assigned to this ticket's department."""
    query = select(Ticket).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")
        
    if not ticket.responsible_department_id:
        return {"success": True, "data": {"handlers": []}}
        
    h_query = select(User).where(
        User.department_id == ticket.responsible_department_id,
        User.role == "handler",
        User.is_active == True
    )
    h_result = await session.execute(h_query)
    handlers = h_result.scalars().all()
    serialized_handlers = [UserResponse.model_validate(h) for h in handlers]
    
    return {"success": True, "data": serialized_handlers}

@router.post("/{id}/assignees", response_model=dict)
async def assign_handler(
    id: int,
    payload: dict,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Assign a handler to the ticket."""
    handler_id = payload.get("handler_id")
    if not handler_id:
        raise HTTPException(status_code=400, detail="Thiếu handler_id")
        
    query = select(Ticket).options(selectinload(Ticket.assignees)).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")
        
    h_query = select(User).where(User.id == handler_id)
    h_result = await session.execute(h_query)
    handler = h_result.scalar_one_or_none()
    
    if not handler or handler.role != "handler":
        raise HTTPException(status_code=400, detail="Handler không hợp lệ")

    if ticket.status == "new":
        ticket.status = "in_progress"
        ticket.processing_started_at = datetime.now(timezone.utc)
        
    if handler not in ticket.assignees:
        ticket.assignees.append(handler)
        
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)
    return {"success": True, "message": "Phân công thành công", "data": TicketResponse.model_validate(ticket)}

@router.post("/{id}/resolve", response_model=dict)
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
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")
        
    ticket.status = "resolved"
    ticket.resolved_at = datetime.now(timezone.utc)
    
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)
    return {"success": True, "message": "Đã giải quyết phiếu", "data": TicketResponse.model_validate(ticket)}

@router.post("/{id}/reopen", response_model=dict)
async def reopen_ticket(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Reopen a ticket."""
    query = select(Ticket).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")
        
    ticket.status = "in_progress"
    ticket.resolved_at = None
    
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)
    return {"success": True, "message": "Đã mở lại phiếu", "data": TicketResponse.model_validate(ticket)}

@router.post("/{id}/reject", response_model=dict)
async def reject_ticket(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Reject a ticket."""
    query = select(Ticket).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")
        
    ticket.status = "rejected"
    session.add(ticket)
    await session.commit()
    await session.refresh(ticket)
    return {"success": True, "message": "Đã từ chối phiếu", "data": TicketResponse.model_validate(ticket)}

@router.post("/{id}/assignees/me", response_model=dict)
async def assign_ticket_to_me(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Self-assign to ticket."""
    query = select(Ticket).options(selectinload(Ticket.assignees)).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")
        
    if current_user not in ticket.assignees:
        ticket.assignees.append(current_user)
        if ticket.status == "new":
            ticket.status = "in_progress"
            ticket.processing_started_at = datetime.now(timezone.utc)
            
        session.add(ticket)
        await session.commit()
        await session.refresh(ticket)
        
    return {"success": True, "message": "Đã nhận xử lý", "data": TicketResponse.model_validate(ticket)}

@router.get("/{id}/logs", response_model=dict)
async def read_ticket_logs(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Get all logs for a ticket."""
    query = select(TicketLog).options(selectinload(TicketLog.sender)).where(TicketLog.ticket_id == id).order_by(TicketLog.created_at.desc())
    result = await session.execute(query)
    logs = result.scalars().all()
    serialized_logs = [TicketLogResponse.model_validate(l) for l in logs]
    return {"success": True, "data": serialized_logs}
