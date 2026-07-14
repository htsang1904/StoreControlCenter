import asyncio
import uuid
import os
from datetime import datetime, timedelta
from typing import Any, List, Optional
from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from sqlalchemy import func, or_, and_, delete as sa_delete, update as sa_update
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import SessionDep, CurrentUser
from app.core.datetime_utils import parse_datetime_to_utc_naive, utc_now_naive
from app.models.org import Store
from app.models.notification import Notification
from app.models.ticket import Ticket, TicketLog, ticket_assignees
from app.models.user import User
from app.schemas.ticket import TicketResponse, TicketCreate, TicketDetailResponse, TicketLogResponse, TicketUpdate
from app.schemas.user import UserMinimalResponse
from app.services.notification_service import (
    build_ticket_activity_notifications,
    build_ticket_created_notifications,
    emit_notification_created_events,
)
from app.services.realtime import realtime_manager
from app.services.ticket_policy import (
    can_access_ticket,
    can_assign_handler,
    can_claim_ticket,
    can_reject_ticket,
    can_reopen_ticket,
    can_resolve_ticket,
    validate_direct_status_update,
)

router = APIRouter()

TICKET_STATUS_LABELS = {
    "new": "Mới",
    "assigned": "Đã phân công",
    "in_progress": "Đang xử lý",
    "resolved": "Đã xử lý",
    "closed": "Đã đóng",
    "rejected": "Từ chối",
}

def _utcnow_naive() -> datetime:
    return utc_now_naive()

async def _emit_ticket_event(ticket_id: int, event: str, ticket_payload: TicketResponse) -> None:
    await realtime_manager.emit_ticket_event(
        ticket_id,
        event,
        {
            "ticket_id": ticket_id,
            "ticket": ticket_payload.model_dump(mode="json"),
        },
    )

async def _get_ticket_with_details(session: AsyncSession, ticket_id: int) -> Optional[Ticket]:
    """Helper to fetch a ticket with all nested relationships for rich responses."""
    query = select(Ticket).options(
        selectinload(Ticket.requester),
        selectinload(Ticket.store),
        selectinload(Ticket.responsible_department),
        selectinload(Ticket.assignees)
    ).where(Ticket.id == ticket_id)
    result = await session.execute(query)
    return result.scalar_one_or_none()

def _get_user_store_ids(current_user: CurrentUser) -> set[int]:
    return {s.id for s in current_user.stores if getattr(s, "id", None) is not None}

async def _resolve_store_entity(session: AsyncSession, store_ref: object) -> Optional[Store]:
    raw_ref = str(store_ref or "").strip()
    if not raw_ref:
        return None

    # Prefer external StoreID for boundary API compatibility.
    result = await session.execute(select(Store).where(Store.storeId == raw_ref).limit(1))
    store = result.scalar_one_or_none()
    if store:
        return store

    try:
        internal_id = int(raw_ref)
    except (TypeError, ValueError):
        return None

    result = await session.execute(select(Store).where(Store.id == internal_id).limit(1))
    return result.scalar_one_or_none()

async def _can_access_ticket(session: AsyncSession, ticket: Ticket, current_user: CurrentUser) -> bool:
    is_assignee = False
    if current_user.role == "handler":
        is_assignee = await _is_handler_assignee(session, ticket.id, current_user.id)

    return can_access_ticket(
        user_role=current_user.role,
        user_id=current_user.id,
        user_department_id=current_user.department_id,
        user_store_ids=_get_user_store_ids(current_user),
        ticket_store_id=ticket.store_id,
        ticket_department_id=ticket.responsible_department_id,
        ticket_requester_id=ticket.requester_id,
        is_assignee=is_assignee,
    )

async def _ensure_ticket_access(session: AsyncSession, ticket: Ticket, current_user: CurrentUser) -> None:
    if not await _can_access_ticket(session, ticket, current_user):
        raise HTTPException(status_code=403, detail="Không có quyền truy cập ticket này")

async def _write_file(file_path: str, contents: bytes) -> None:
    def _sync_write() -> None:
        with open(file_path, "wb") as f:
            f.write(contents)

    await asyncio.to_thread(_sync_write)

async def _is_handler_assignee(session: AsyncSession, ticket_id: int, user_id: int) -> bool:
    assigned_result = await session.execute(
        select(func.count())
        .select_from(Ticket)
        .where(Ticket.id == ticket_id, Ticket.assignees.any(id=user_id))
    )
    return (assigned_result.scalar() or 0) > 0


async def _load_ticket_created_notification_recipient_ids(session: AsyncSession, ticket: Ticket) -> list[int]:
    recipient_query = select(User.id).where(
        User.is_active == True,  # noqa: E712
        or_(
            User.role == "admin",
            and_(
                User.role == "handler",
                User.department_id == ticket.responsible_department_id,
            ),
        ),
    )
    result = await session.execute(recipient_query)
    return [int(user_id) for user_id in result.scalars().all()]


def _ticket_participant_ids(ticket: Ticket, *additional_user_ids: int | None) -> list[int | None]:
    return [
        ticket.requester_id,
        *[assignee.id for assignee in ticket.assignees],
        *additional_user_ids,
    ]


def _stage_ticket_activity_notifications(
    session: AsyncSession,
    *,
    ticket: Ticket,
    current_user: CurrentUser,
    recipient_ids: list[int | None],
    title: str,
    message: str,
    kind: str,
    notification_type: str = "info",
    extra_meta: dict | None = None,
) -> list[Notification]:
    notifications = build_ticket_activity_notifications(
        recipient_ids=recipient_ids,
        actor_id=current_user.id,
        actor_name=current_user.name or "",
        ticket_id=ticket.id,
        ticket_code=ticket.ticket_code,
        title=title,
        message=message,
        kind=kind,
        notification_type=notification_type,
        extra_meta=extra_meta,
    )
    if notifications:
        session.add_all(notifications)
    return notifications

@router.get("/", response_model=dict)
async def read_tickets(
    session: SessionDep,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    pageSize: int = Query(10, ge=1, le=100),
    q: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    store_ids: Optional[str] = Query(None)
) -> Any:
    """Read tickets with RBAC, pagination and filtering."""
    skip = (page - 1) * pageSize
    
    # Base Query
    query = select(Ticket).options(
        selectinload(Ticket.requester),
        selectinload(Ticket.store),
        selectinload(Ticket.responsible_department),
        selectinload(Ticket.assignees)
    ).order_by(Ticket.created_at.desc())
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
            status_filters = []
            direct_statuses = [s for s in status_list if s not in {"unconfirmed", "processing_late"}]
            if direct_statuses:
                status_filters.append(Ticket.status.in_(direct_statuses))
            if "unconfirmed" in status_list:
                status_filters.append(and_(Ticket.processing_started_at.is_(None), Ticket.status.in_(["new", "assigned"])))
            if "processing_late" in status_list:
                status_filters.append(and_(
                    Ticket.processing_started_at.is_not(None),
                    Ticket.resolved_at.is_(None),
                    Ticket.status == "in_progress",
                    Ticket.processing_started_at < _utcnow_naive() - timedelta(hours=24),
                ))
            if status_filters:
                filters.append(or_(*status_filters))

    # Date Filters
    if date_from:
        try:
            date_from_dt = parse_datetime_to_utc_naive(date_from).replace(hour=0, minute=0, second=0, microsecond=0)
            filters.append(Ticket.created_at >= date_from_dt)
        except ValueError:
            pass

    if date_to:
        try:
            date_to_dt = parse_datetime_to_utc_naive(date_to).replace(hour=23, minute=59, second=59, microsecond=999999)
            filters.append(Ticket.created_at <= date_to_dt)
        except ValueError:
            pass

    # Global Store IDs Filter
    if store_ids and current_user.role != "store":
        ids = [int(i.strip()) for i in store_ids.split(",") if i.strip().isdigit()]
        if ids:
            filters.append(Ticket.store_id.in_(ids))
            
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

    resolved_store = await _resolve_store_entity(session, data.get("store_id"))
    if not resolved_store:
        raise HTTPException(status_code=400, detail="store_id/storeId không hợp lệ hoặc không tồn tại")
    
    # Gap 5: Store role scoping — only allow creating tickets for assigned stores
    if current_user.role == "store":
        user_store_ids = _get_user_store_ids(current_user)
        if resolved_store.id not in user_store_ids:
            raise HTTPException(
                status_code=403,
                detail="Không có quyền tạo ticket cho cửa hàng này"
            )

    data["store_id"] = resolved_store.id
    
    data["requester_id"] = current_user.id
    data["ticket_code"] = f"TCK-{uuid.uuid4().hex[:8].upper()}"
    
    # Explicitly set timestamps since Strapi schema might lack DB-level defaults
    now = _utcnow_naive()
    data["created_at"] = now
    data["updated_at"] = now
    
    ticket = Ticket(**data)
    session.add(ticket)
    await session.flush()

    notification_recipient_ids = await _load_ticket_created_notification_recipient_ids(session, ticket)
    notifications = build_ticket_created_notifications(
        recipient_ids=notification_recipient_ids,
        actor_id=current_user.id,
        actor_name=current_user.name or "",
        ticket_id=ticket.id,
        ticket_code=ticket.ticket_code,
        ticket_title=ticket.title,
    )
    if notifications:
        session.add_all(notifications)

    await session.commit()
    
    updated_ticket = await _get_ticket_with_details(session, ticket.id)
    serialized_ticket = TicketResponse.model_validate(updated_ticket)
    await _emit_ticket_event(ticket.id, "ticket.created", serialized_ticket)
    await emit_notification_created_events(session, notifications)
    return {"success": True, "message": "Tạo phiếu thành công", "data": serialized_ticket}

@router.post("/upload-attachments", response_model=dict)
async def upload_ticket_attachments(
    current_user: CurrentUser,
    files: List[UploadFile] = File(...),
) -> Any:
    """Upload multiple images for tickets."""
    ALLOWED_MIMES = {"image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"}
    
    if len(files) > 5:
        raise HTTPException(status_code=400, detail="Tối đa 5 ảnh một lần")
        
    uploaded_files = []
    upload_dir = "static/uploads"
    os.makedirs(upload_dir, exist_ok=True)
    
    for file in files:
        # Gap 6: MIME type validation
        if file.content_type not in ALLOWED_MIMES:
            raise HTTPException(
                status_code=400,
                detail=f"File {file.filename} không phải ảnh (chỉ chấp nhận JPEG, PNG, GIF, WebP)"
            )
        
        contents = await file.read()
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"File {file.filename} vượt quá 5MB")
            
        file_ext = os.path.splitext(file.filename)[1]
        new_filename = f"ticket_{uuid.uuid4().hex}{file_ext}"
        file_path = os.path.join(upload_dir, new_filename)
        
        await _write_file(file_path, contents)
            
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
        selectinload(Ticket.responsible_department)
    ).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")

    await _ensure_ticket_access(session, ticket, current_user)
        
    # We use TicketDetailResponse for manual validation because it has nested items/logs
    return {"success": True, "data": TicketDetailResponse.model_validate(ticket)}

@router.put("/{id}", response_model=dict)
async def update_ticket(
    *,
    session: SessionDep,
    current_user: CurrentUser,
    id: int,
    ticket_in: TicketUpdate
) -> Any:
    """Update ticket info."""
    query = select(Ticket).options(selectinload(Ticket.assignees)).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")

    await _ensure_ticket_access(session, ticket, current_user)
    
    update_data = ticket_in.model_dump(exclude_unset=True)
    previous_status = ticket.status

    if "store_id" in update_data:
        resolved_store = await _resolve_store_entity(session, update_data.get("store_id"))
        if not resolved_store:
            raise HTTPException(status_code=400, detail="store_id/storeId không hợp lệ hoặc không tồn tại")

        # Invariant: store role chỉ được sửa ticket trong danh sách store được gán
        if current_user.role == "store":
            user_store_ids = _get_user_store_ids(current_user)
            if resolved_store.id not in user_store_ids:
                raise HTTPException(status_code=403, detail="Không có quyền sửa ticket sang cửa hàng này")

        update_data["store_id"] = resolved_store.id

    if "status" in update_data:
        is_allowed, err = validate_direct_status_update(
            user_role=current_user.role,
            old_status=ticket.status,
            new_status=update_data["status"],
        )
        if update_data["status"] == ticket.status:
            update_data.pop("status", None)
        elif not is_allowed:
            status_code = 403 if "Chỉ admin" in err else 400
            raise HTTPException(status_code=status_code, detail=err)

    for field, value in update_data.items():
        setattr(ticket, field, value)

    notifications: list[Notification] = []
    if "status" in update_data and ticket.status != previous_status:
        previous_label = TICKET_STATUS_LABELS.get(previous_status, previous_status)
        current_label = TICKET_STATUS_LABELS.get(ticket.status, ticket.status)
        notifications = _stage_ticket_activity_notifications(
            session,
            ticket=ticket,
            current_user=current_user,
            recipient_ids=_ticket_participant_ids(ticket),
            title=f"Trạng thái thay đổi - {ticket.ticket_code}",
            message=(
                "{actor_name} đã chuyển ticket {ticket_code} "
                f"từ {previous_label} sang {current_label}."
            ),
            kind="ticket_status_changed",
            extra_meta={"old_status": previous_status, "status": ticket.status},
        )

    session.add(ticket)
    await session.commit()
    
    updated_ticket = await _get_ticket_with_details(session, ticket.id)
    serialized_ticket = TicketResponse.model_validate(updated_ticket)
    await _emit_ticket_event(ticket.id, "ticket.updated", serialized_ticket)
    await emit_notification_created_events(session, notifications)
    return {"success": True, "message": "Cập nhật phiếu thành công", "data": serialized_ticket}

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

    await _ensure_ticket_access(session, ticket, current_user)
        
    serialized_assignees = [UserMinimalResponse.model_validate(u) for u in ticket.assignees]
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

    await _ensure_ticket_access(session, ticket, current_user)
        
    if not ticket.responsible_department_id:
        return {"success": True, "data": {"handlers": []}}
        
    h_query = select(User).where(
        User.department_id == ticket.responsible_department_id,
        User.role == "handler",
        User.is_active == True
    )
    h_result = await session.execute(h_query)
    handlers = h_result.scalars().all()
    serialized_handlers = [UserMinimalResponse.model_validate(h) for h in handlers]
    
    return {"success": True, "data": serialized_handlers}

@router.post("/{id}/assignees", response_model=dict)
async def assign_assignee(
    id: int,
    payload: dict,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Assign a user to the ticket."""
    assignee_id = payload.get("assignee_id")
    if not assignee_id:
        raise HTTPException(status_code=400, detail="Thiếu assignee_id")
        
    query = select(Ticket).options(selectinload(Ticket.assignees)).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")

    await _ensure_ticket_access(session, ticket, current_user)
    allowed, err = can_assign_handler(current_user.role, ticket.status)
    if not allowed:
        raise HTTPException(status_code=403 if "Chỉ admin" in err else 400, detail=err)
        
    h_query = select(User).where(User.id == assignee_id)
    h_result = await session.execute(h_query)
    handler = h_result.scalar_one_or_none()
    
    if not handler or handler.role != "handler":
        raise HTTPException(status_code=400, detail="Handler không hợp lệ")
    if ticket.responsible_department_id and handler.department_id != ticket.responsible_department_id:
        raise HTTPException(status_code=400, detail="Handler không thuộc đúng bộ phận phụ trách")

    if ticket.status == "new":
        ticket.status = "in_progress"
        ticket.processing_started_at = _utcnow_naive()
        
    notifications: list[Notification] = []
    if handler not in ticket.assignees:
        ticket.assignees.append(handler)
        
        system_log = TicketLog(
            ticket_id=ticket.id,
            message=f"{current_user.name} đã phân công cho {handler.name} xử lý yêu cầu.",
            sender_type="system",
            sender_id=current_user.id
        )
        session.add(system_log)

        notifications = _stage_ticket_activity_notifications(
            session,
            ticket=ticket,
            current_user=current_user,
            recipient_ids=[ticket.requester_id, handler.id],
            title=f"Được phân công - {ticket.ticket_code}",
            message=f"{{actor_name}} đã phân công {handler.name} xử lý ticket {{ticket_code}}.",
            kind="ticket_assigned",
            extra_meta={"assignee_id": handler.id, "status": ticket.status},
        )
        
    session.add(ticket)
    await session.commit()
    
    updated_ticket = await _get_ticket_with_details(session, ticket.id)
    serialized_ticket = TicketResponse.model_validate(updated_ticket)
    await _emit_ticket_event(ticket.id, "ticket.updated", serialized_ticket)
    await emit_notification_created_events(session, notifications)
    return {"success": True, "message": "Phân công thành công", "data": serialized_ticket}

@router.post("/{id}/resolve", response_model=dict)
async def resolve_ticket(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Mark ticket as resolved."""
    query = select(Ticket).options(selectinload(Ticket.assignees)).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")

    await _ensure_ticket_access(session, ticket, current_user)
    is_assignee = await _is_handler_assignee(session, ticket.id, current_user.id) if current_user.role == "handler" else False
    allowed, err = can_resolve_ticket(current_user.role, ticket.status, is_assignee=is_assignee)
    if not allowed:
        raise HTTPException(
            status_code=403 if ("Không có quyền" in err or "Handler cần" in err) else 400,
            detail=err,
        )
        
    ticket.status = "resolved"
    ticket.resolved_at = _utcnow_naive()
    
    system_log = TicketLog(
        ticket_id=ticket.id,
        message=f"{current_user.name} đã đánh dấu yêu cầu được xử lý xong.",
        sender_type="system",
        sender_id=current_user.id
    )
    session.add(system_log)

    notifications = _stage_ticket_activity_notifications(
        session,
        ticket=ticket,
        current_user=current_user,
        recipient_ids=_ticket_participant_ids(ticket),
        title=f"Ticket đã xử lý - {ticket.ticket_code}",
        message="{actor_name} đã đánh dấu ticket {ticket_code} là đã xử lý.",
        kind="ticket_resolved",
        notification_type="success",
        extra_meta={"status": ticket.status},
    )
    
    session.add(ticket)
    await session.commit()
    
    updated_ticket = await _get_ticket_with_details(session, ticket.id)
    serialized_ticket = TicketResponse.model_validate(updated_ticket)
    await _emit_ticket_event(ticket.id, "ticket.updated", serialized_ticket)
    await emit_notification_created_events(session, notifications)
    return {"success": True, "message": "Đã giải quyết phiếu", "data": serialized_ticket}

@router.post("/{id}/reopen", response_model=dict)
async def reopen_ticket(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Reopen a ticket."""
    query = select(Ticket).options(selectinload(Ticket.assignees)).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")

    await _ensure_ticket_access(session, ticket, current_user)
    allowed, err = can_reopen_ticket(current_user.role, ticket.status)
    if not allowed:
        raise HTTPException(status_code=403 if "Chỉ admin hoặc store" in err else 400, detail=err)
        
    ticket.status = "in_progress"
    ticket.resolved_at = None
    
    system_log = TicketLog(
        ticket_id=ticket.id,
        message=f"{current_user.name} đã mở lại yêu cầu.",
        sender_type="system",
        sender_id=current_user.id
    )
    session.add(system_log)

    notifications = _stage_ticket_activity_notifications(
        session,
        ticket=ticket,
        current_user=current_user,
        recipient_ids=_ticket_participant_ids(ticket),
        title=f"Ticket được mở lại - {ticket.ticket_code}",
        message="{actor_name} đã mở lại ticket {ticket_code}.",
        kind="ticket_reopened",
        notification_type="warning",
        extra_meta={"status": ticket.status},
    )
    
    session.add(ticket)
    await session.commit()
    
    updated_ticket = await _get_ticket_with_details(session, ticket.id)
    serialized_ticket = TicketResponse.model_validate(updated_ticket)
    await _emit_ticket_event(ticket.id, "ticket.updated", serialized_ticket)
    await emit_notification_created_events(session, notifications)
    return {"success": True, "message": "Đã mở lại phiếu", "data": serialized_ticket}

@router.post("/{id}/reject", response_model=dict)
async def reject_ticket(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Reject a ticket."""
    query = select(Ticket).options(selectinload(Ticket.assignees)).where(Ticket.id == id)
    result = await session.execute(query)
    ticket = result.scalar_one_or_none()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")

    await _ensure_ticket_access(session, ticket, current_user)
    allowed, err = can_reject_ticket(current_user.role, ticket.status)
    if not allowed:
        raise HTTPException(status_code=403 if "Chỉ admin" in err else 400, detail=err)
        
    ticket.status = "rejected"
    notifications = _stage_ticket_activity_notifications(
        session,
        ticket=ticket,
        current_user=current_user,
        recipient_ids=_ticket_participant_ids(ticket),
        title=f"Ticket bị từ chối - {ticket.ticket_code}",
        message="{actor_name} đã từ chối ticket {ticket_code}.",
        kind="ticket_rejected",
        notification_type="error",
        extra_meta={"status": ticket.status},
    )
    session.add(ticket)
    await session.commit()
    
    updated_ticket = await _get_ticket_with_details(session, ticket.id)
    serialized_ticket = TicketResponse.model_validate(updated_ticket)
    await _emit_ticket_event(ticket.id, "ticket.updated", serialized_ticket)
    await emit_notification_created_events(session, notifications)
    return {"success": True, "message": "Đã từ chối phiếu", "data": serialized_ticket}

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

    await _ensure_ticket_access(session, ticket, current_user)
    allowed, err = can_claim_ticket(current_user.role, ticket.status)
    if not allowed:
        raise HTTPException(
            status_code=403 if "Chỉ handler/admin" in err else 400,
            detail=err,
        )
        
    notifications: list[Notification] = []
    if current_user not in ticket.assignees:
        ticket.assignees.append(current_user)
        if ticket.status == "new":
            ticket.status = "in_progress"
            ticket.processing_started_at = _utcnow_naive()
            
        system_log = TicketLog(
            ticket_id=ticket.id,
            message=f"{current_user.name} đã nhận xử lý yêu cầu.",
            sender_type="system",
            sender_id=current_user.id
        )
        session.add(system_log)

        notifications = _stage_ticket_activity_notifications(
            session,
            ticket=ticket,
            current_user=current_user,
            recipient_ids=_ticket_participant_ids(ticket),
            title=f"Ticket đang được xử lý - {ticket.ticket_code}",
            message="{actor_name} đã nhận xử lý ticket {ticket_code}.",
            kind="ticket_claimed",
            extra_meta={"assignee_id": current_user.id, "status": ticket.status},
        )
        
        session.add(ticket)
        await session.commit()
        
    updated_ticket = await _get_ticket_with_details(session, ticket.id)
    serialized_ticket = TicketResponse.model_validate(updated_ticket)
    await _emit_ticket_event(ticket.id, "ticket.updated", serialized_ticket)
    await emit_notification_created_events(session, notifications)
    return {"success": True, "message": "Đã nhận xử lý", "data": serialized_ticket}

@router.get("/{id}/logs", response_model=dict)
async def read_ticket_logs(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Get all logs for a ticket."""
    ticket = await session.get(Ticket, id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")
    await _ensure_ticket_access(session, ticket, current_user)

    query = select(TicketLog).options(selectinload(TicketLog.sender)).where(TicketLog.ticket_id == id).order_by(TicketLog.created_at.desc())
    result = await session.execute(query)
    logs = result.scalars().all()
    serialized_logs = [TicketLogResponse.model_validate(l) for l in logs]
    return {"success": True, "data": serialized_logs}

@router.delete("/{id}", response_model=dict)
async def delete_ticket(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Delete a ticket. Only admin or the original requester can delete."""
    ticket = await session.get(Ticket, id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Phiếu không tồn tại")
    
    # Only admin or the requester can delete
    if current_user.role != "admin" and ticket.requester_id != current_user.id:
        raise HTTPException(status_code=403, detail="Không có quyền xóa phiếu này")

    # Keep notification history while preventing FK violations on old schemas.
    await session.execute(
        sa_update(Notification)
        .where(Notification.ticket_id == id)
        .values(ticket_id=None)
    )
    # Defensive cleanup for schemas without ON DELETE CASCADE.
    await session.execute(sa_delete(TicketLog).where(TicketLog.ticket_id == id))
    await session.execute(sa_delete(ticket_assignees).where(ticket_assignees.c.ticket_id == id))

    await session.delete(ticket)
    await session.commit()
    await realtime_manager.emit_ticket_event(
        id,
        "ticket.deleted",
        {
            "ticket_id": id,
        },
    )
    
    return {"success": True, "message": "Đã xóa phiếu thành công"}
