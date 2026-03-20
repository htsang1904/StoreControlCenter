from datetime import timedelta
from typing import Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, and_
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep, CurrentUser
from app.core.datetime_utils import parse_datetime_to_utc_naive, utc_now_naive
from app.models.ticket import Ticket, TicketLog
from app.models.org import Store
from app.models.user import User

router = APIRouter()

def normalize_dashboard_status(status: str) -> str:
    val = str(status or "").lower()
    if val == "assigned":
        return "in_progress"
    return val

@router.get("/overview", response_model=dict)
@router.get("/overview/", response_model=dict)
async def get_dashboard_overview(
    session: SessionDep,
    current_user: CurrentUser,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    store_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
    top_stores_limit: int = Query(5),
    activity_limit: int = Query(8)
) -> Any:
    """
    Lấy dữ liệu tổng quan dashboard bao gồm thống kê ticket, cửa hàng hàng đầu và nhật ký hoạt động.
    Ported từ Strapi `ticket.dashboardOverview`.
    """
    # 1. Xử lý khoảng thời gian (Date Range) như Strapi
    # Sử dụng Naive Datetime đại diện cho UTC vì models đang dùng Naive DateTime
    now = utc_now_naive()
    
    # Mặc định: 7 ngày gần nhất (bao gồm hôm nay)
    default_to = now.date().isoformat()
    default_from = (now - timedelta(days=6)).date().isoformat()
    
    date_from_str = date_from or default_from
    date_to_str = date_to or default_to
    
    try:
        # Chuyển về 00:00:00 cho ngày bắt đầu và 23:59:59 cho ngày kết thúc
        # Loại bỏ tzinfo để tránh lỗi "can't subtract offset-naive and offset-aware datetimes"
        date_from_dt = parse_datetime_to_utc_naive(date_from_str).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        date_to_dt = parse_datetime_to_utc_naive(date_to_str).replace(
            hour=23, minute=59, second=59, microsecond=999999
        )
    except ValueError:
        date_from_dt = (now - timedelta(days=6)).replace(hour=0, minute=0, second=0, microsecond=0)
        date_to_dt = now.replace(hour=23, minute=59, second=59, microsecond=999999)

    # 2. Bộ lọc cơ bản
    base_filters = [
        Ticket.created_at >= date_from_dt,
        Ticket.created_at <= date_to_dt
    ]

    if store_id:
        base_filters.append(Ticket.store_id == store_id)
    if department_id:
        base_filters.append(Ticket.responsible_department_id == department_id)

    # 3. Phân quyền dữ liệu (RBAC)
    if current_user.role == "store":
        user_store_ids = [s.id for s in current_user.stores]
        base_filters.append(or_(
            Ticket.requester_id == current_user.id,
            Ticket.store_id.in_(user_store_ids)
        ))
    elif current_user.role == "handler":
        base_filters.append(or_(
            Ticket.responsible_department_id == current_user.department_id,
            Ticket.assignees.any(id=current_user.id)
        ))

    # 4. Truy vấn tất cả ticket trong khoảng thời gian để tính toán (như Strapi dùng walkDashboardTickets)
    # Tuy nhiên để tối ưu, ta dùng aggregation SQL nếu có thể. 
    # Nhưng Strapi tính Top Stores dựa trên count ticket trong batch, ta sẽ làm tương tự bằng SQL.

    # 4a. Thống kê theo trạng thái
    status_query = (
        select(Ticket.status, func.count(Ticket.id))
        .where(and_(*base_filters))
        .group_by(Ticket.status)
    )
    status_results = await session.execute(status_query)
    raw_status_counts = {s: c for s, c in status_results.all()}
    
    # Normalize status (assigned -> in_progress)
    status_counts = {"new": 0, "in_progress": 0, "resolved": 0, "rejected": 0}
    for s, c in raw_status_counts.items():
        norm_s = normalize_dashboard_status(s)
        if norm_s in status_counts:
            status_counts[norm_s] += c

    total_ticket = sum(raw_status_counts.values())
    in_progress = status_counts["in_progress"]
    resolved = status_counts["resolved"]
    
    # 5. Ticket sắp quá hạn (Overdue Soon - trong vòng 48h)
    soon_threshold = now + timedelta(days=2)
    overdue_query = select(func.count(Ticket.id)).where(
        and_(
            *base_filters,
            Ticket.end_date != None,
            Ticket.end_date >= now,
            Ticket.end_date <= soon_threshold,
            ~Ticket.status.in_(["resolved", "closed", "rejected", "rejected"]) # Đã khớp Strapi
        )
    )
    overdue_res = await session.execute(overdue_query)
    overdue_soon = overdue_res.scalar() or 0

    # 6. Top Stores (Cửa hàng nhiều ticket nhất)
    top_stores_query = (
        select(Store.id, Store.shortAddress, Store.address, Store.code, func.count(Ticket.id))
        .join(Store, Ticket.store_id == Store.id)
        .where(and_(*base_filters))
        .group_by(Store.id, Store.shortAddress, Store.address, Store.code)
        .order_by(func.count(Ticket.id).desc())
        .limit(top_stores_limit)
    )
    top_stores_res = await session.execute(top_stores_query)
    top_stores = []
    for sid, sa, addr, code, count in top_stores_res.all():
        top_stores.append({
            "store_id": sid,
            "count": count,
            "name": sa or addr or code or f"Store #{sid}"
        })

    # 7. Nhật ký hoạt động (Activity Feed)
    # Strapi lọc logs dựa trên filter của ticket
    activity_query = (
        select(TicketLog)
        .join(Ticket, TicketLog.ticket_id == Ticket.id)
        .options(selectinload(TicketLog.sender), selectinload(TicketLog.ticket))
        .where(and_(
            TicketLog.created_at >= date_from_dt,
            TicketLog.created_at <= date_to_dt,
            *base_filters # Kế thừa bộ lọc ticket cho hoạt động
        ))
        .order_by(TicketLog.created_at.desc())
        .limit(activity_limit)
    )
    activity_res = await session.execute(activity_query)
    activity_feed = []
    for log in activity_res.scalars().all():
        sender_name = log.sender.name if log.sender else ("Bộ phận xử lý" if log.sender_type == "handler" else "Cửa hàng")
        ticket_code = log.ticket.ticket_code if log.ticket else f"#{log.ticket_id}"
        
        message = (log.message or "").strip()
        if len(message) > 120:
            message = message[:120] + "..."
            
        is_system = log.sender_type == "system"
        content = message if is_system else f"{sender_name} phản hồi ticket {ticket_code}: {message or '(không có nội dung)'}"
        
        activity_feed.append({
            "at": log.created_at.isoformat(),
            "time": log.created_at.strftime("%H:%M"),
            "content": content
        })

    return {
        "success": True,
        "message": "Lấy dữ liệu dashboard thành công",
        "data": {
            "filters": {
                "date_from": date_from_str,
                "date_to": date_to_str,
            },
            "summary": {
                "total_ticket": total_ticket,
                "in_progress": in_progress,
                "resolved": resolved,
                "overdue": overdue_soon,
            },
            "status": [
                {"key": "new", "label": "Mới tạo", "value": status_counts["new"]},
                {"key": "in_progress", "label": "Đang xử lý", "value": status_counts["in_progress"]},
                {"key": "resolved", "label": "Đã xử lý", "value": status_counts["resolved"]},
                {"key": "rejected", "label": "Từ chối", "value": status_counts["rejected"]},
            ],
            "top_stores": top_stores,
            "activity_feed": activity_feed
        }
    }
