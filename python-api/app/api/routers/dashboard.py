from datetime import timedelta
from typing import Any, Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, and_, case, literal
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep, CurrentUser
from app.core.datetime_utils import parse_datetime_to_utc_naive, utc_now_naive
from app.models.ticket import Ticket, TicketLog
from app.models.qc_session import QCSession
from app.models.org import Store
from app.models.user import User

router = APIRouter()

def normalize_dashboard_status(status: str) -> str:
    val = str(status or "").lower()
    if val == "assigned":
        return "in_progress"
    return val


def format_store_label(name: Optional[str], short_address: Optional[str], address: Optional[str], store_id: int) -> str:
    return name or short_address or address or f"Store #{store_id}"

class DashboardOverviewRequest(BaseModel):
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    store_ids: Optional[str] = None
    department_id: Optional[int] = None
    top_stores_limit: int = 5
    activity_limit: int = 8
    chart_group_by: Optional[str] = None


def build_ticket_base_filters(
    date_from_dt,
    date_to_dt,
    request: DashboardOverviewRequest,
    current_user: User,
) -> list:
    filters = [
        Ticket.created_at >= date_from_dt,
        Ticket.created_at <= date_to_dt,
    ]

    if request.store_ids:
        ids = [int(i.strip()) for i in request.store_ids.split(",") if i.strip().isdigit()]
        if ids:
            filters.append(Ticket.store_id.in_(ids))
    if request.department_id:
        filters.append(Ticket.responsible_department_id == request.department_id)

    if current_user.role == "store":
        user_store_ids = [s.id for s in current_user.stores]
        filters.append(or_(
            Ticket.requester_id == current_user.id,
            Ticket.store_id.in_(user_store_ids)
        ))
    elif current_user.role == "handler":
        filters.append(or_(
            Ticket.responsible_department_id == current_user.department_id,
            Ticket.assignees.any(id=current_user.id)
        ))

    return filters

def build_ticket_scope_filters(
    request: DashboardOverviewRequest,
    current_user: User,
) -> list:
    filters = []

    if request.store_ids:
        ids = [int(i.strip()) for i in request.store_ids.split(",") if i.strip().isdigit()]
        if ids:
            filters.append(Ticket.store_id.in_(ids))
    if request.department_id:
        filters.append(Ticket.responsible_department_id == request.department_id)

    if current_user.role == "store":
        user_store_ids = [s.id for s in current_user.stores]
        filters.append(or_(
            Ticket.requester_id == current_user.id,
            Ticket.store_id.in_(user_store_ids)
        ))
    elif current_user.role == "handler":
        filters.append(or_(
            Ticket.responsible_department_id == current_user.department_id,
            Ticket.assignees.any(id=current_user.id)
        ))

    return filters


def calculate_delta(current: float, previous: float, lower_is_better: bool = False) -> dict:
    current_value = float(current or 0)
    previous_value = float(previous or 0)

    if previous_value == 0:
        percent = 100.0 if current_value > 0 else 0.0
    else:
        percent = round(((current_value - previous_value) / previous_value) * 100, 1)

    direction = "up" if current_value > previous_value else "down" if current_value < previous_value else "flat"
    if direction == "flat" or percent == 0:
        sentiment = "neutral"
    elif lower_is_better:
        sentiment = "good" if direction == "down" else "bad"
    else:
        sentiment = "good" if direction == "up" else "bad"

    return {
        "current": current_value,
        "previous": previous_value,
        "percent": abs(percent),
        "direction": direction,
        "sentiment": sentiment,
    }


async def get_ticket_summary_metrics(session: SessionDep, filters: list, now) -> dict:
    where_clause = and_(*filters) if filters else literal(True)
    status_query = (
        select(Ticket.status, func.count(Ticket.id))
        .where(where_clause)
        .group_by(Ticket.status)
    )
    status_results = await session.execute(status_query)
    raw_status_counts = {s: c for s, c in status_results.all()}

    status_counts = {"new": 0, "in_progress": 0, "resolved": 0, "closed": 0, "rejected": 0}
    for status, count in raw_status_counts.items():
        normalized_status = normalize_dashboard_status(status)
        if normalized_status in status_counts:
            status_counts[normalized_status] += count

    avg_support_time_expr = func.avg(
        case(
            (Ticket.status.in_(["resolved", "closed"]), func.extract('epoch', Ticket.resolved_at) - func.extract('epoch', Ticket.created_at)),
            else_=None
        )
    )
    avg_proc_res = await session.execute(select(avg_support_time_expr).where(where_clause))
    global_avg_sec = avg_proc_res.scalar()
    global_avg_hours = round(float(global_avg_sec) / 3600.0, 1) if global_avg_sec else 0.0

    due_soon_threshold = now + timedelta(days=2)
    due_soon_res = await session.execute(
        select(func.count(Ticket.id)).where(
            and_(
                where_clause,
                Ticket.end_date != None,
                Ticket.end_date >= now,
                Ticket.end_date <= due_soon_threshold,
                ~Ticket.status.in_(["resolved", "closed", "rejected"]),
            )
        )
    )
    confirmation_late_threshold = now - timedelta(hours=2)
    processing_late_threshold = now - timedelta(hours=24)
    overdue_res = await session.execute(
        select(func.count(Ticket.id)).where(
            and_(
                where_clause,
                or_(
                    and_(
                        Ticket.processing_started_at.is_(None),
                        Ticket.created_at < confirmation_late_threshold,
                        Ticket.status.in_(["new", "assigned"]),
                    ),
                    and_(
                        Ticket.processing_started_at.is_not(None),
                        Ticket.resolved_at.is_(None),
                        Ticket.processing_started_at < processing_late_threshold,
                        Ticket.status == "in_progress",
                    ),
                ),
            )
        )
    )

    return {
        "total_ticket": sum(raw_status_counts.values()),
        "in_progress": status_counts["in_progress"],
        "resolved": status_counts["resolved"],
        "closed": status_counts["closed"],
        "rejected": status_counts["rejected"],
        "due_soon": due_soon_res.scalar() or 0,
        "overdue": overdue_res.scalar() or 0,
        "avg_processing_time": global_avg_hours,
        "status_counts": status_counts,
        "avg_support_time_expr": avg_support_time_expr,
    }


def build_qc_base_filters(
    date_from_dt,
    date_to_dt,
    request: DashboardOverviewRequest,
    current_user: User,
) -> list:
    filters = [
        QCSession.audited_at >= date_from_dt,
        QCSession.audited_at <= date_to_dt,
    ]

    if current_user.role != "admin":
        user_store_ids = [s.id for s in current_user.stores]
        filters.append(QCSession.store_id.in_(user_store_ids))
    elif request.store_ids:
        ids = [int(i.strip()) for i in request.store_ids.split(",") if i.strip().isdigit()]
        if ids:
            filters.append(QCSession.store_id.in_(ids))

    return filters

def build_qc_scope_filters(
    request: DashboardOverviewRequest,
    current_user: User,
) -> list:
    filters = []

    if current_user.role != "admin":
        user_store_ids = [s.id for s in current_user.stores]
        filters.append(QCSession.store_id.in_(user_store_ids))
    elif request.store_ids:
        ids = [int(i.strip()) for i in request.store_ids.split(",") if i.strip().isdigit()]
        if ids:
            filters.append(QCSession.store_id.in_(ids))

    return filters


async def get_qc_summary_metrics(session: SessionDep, filters: list) -> dict:
    where_clause = and_(*filters) if filters else literal(True)
    query = select(
        func.count(QCSession.id),
        func.sum(case((QCSession.result == "pass", 1), else_=0)),
        func.sum(case((QCSession.result == "fail", 1), else_=0)),
    ).where(where_clause)
    result = await session.execute(query)
    total_sessions, passed, failed = result.one()
    total_sessions = int(total_sessions or 0)
    passed = int(passed or 0)
    failed = int(failed or 0)

    return {
        "totalSessions": total_sessions,
        "passed": passed,
        "failed": failed,
        "passRate": round((passed / total_sessions * 100), 1) if total_sessions > 0 else 0,
    }

@router.post("/overview", response_model=dict)
@router.post("/overview/", response_model=dict)
async def get_dashboard_overview(
    request: DashboardOverviewRequest,
    session: SessionDep,
    current_user: CurrentUser,
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
    
    date_from_str = request.date_from or default_from
    date_to_str = request.date_to or default_to
    
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

    # 2. Bộ lọc cơ bản + phân quyền dữ liệu (RBAC)
    base_filters = build_ticket_base_filters(date_from_dt, date_to_dt, request, current_user)
    period_duration = date_to_dt - date_from_dt
    previous_to_dt = date_from_dt - timedelta(microseconds=1)
    previous_from_dt = previous_to_dt - period_duration
    previous_filters = build_ticket_base_filters(previous_from_dt, previous_to_dt, request, current_user)

    # 4. Truy vấn tất cả ticket trong khoảng thời gian để tính toán (như Strapi dùng walkDashboardTickets)
    # Tuy nhiên để tối ưu, ta dùng aggregation SQL nếu có thể. 
    # Nhưng Strapi tính Top Stores dựa trên count ticket trong batch, ta sẽ làm tương tự bằng SQL.

    current_metrics = await get_ticket_summary_metrics(session, base_filters, now)
    previous_metrics = await get_ticket_summary_metrics(session, previous_filters, now)
    live_metrics = await get_ticket_summary_metrics(
        session,
        build_ticket_scope_filters(request, current_user),
        now,
    )
    current_qc_metrics = await get_qc_summary_metrics(
        session,
        build_qc_base_filters(date_from_dt, date_to_dt, request, current_user),
    )
    previous_qc_metrics = await get_qc_summary_metrics(
        session,
        build_qc_base_filters(previous_from_dt, previous_to_dt, request, current_user),
    )
    live_qc_metrics = await get_qc_summary_metrics(
        session,
        build_qc_scope_filters(request, current_user),
    )
    status_counts = current_metrics["status_counts"]
    avg_support_time_expr = current_metrics["avg_support_time_expr"]

    # 6. Top Stores (Cửa hàng nhiều ticket nhất)
    top_stores_query = (
        select(Store.id, Store.shortAddress, Store.address, Store.code, Store.storeId, Store.name, func.count(Ticket.id), avg_support_time_expr)
        .join(Store, Ticket.store_id == Store.id)
        .where(and_(*base_filters))
        .group_by(Store.id, Store.shortAddress, Store.address, Store.code, Store.storeId, Store.name)
        .order_by(func.count(Ticket.id).desc())
        .limit(request.top_stores_limit)
    )
    top_stores_res = await session.execute(top_stores_query)
    top_stores = []
    for sid, sa, addr, code, store_no, name, count, avg_sec in top_stores_res.all():
        avg_hours = round(float(avg_sec) / 3600.0, 1) if avg_sec else 0.0
        top_stores.append({
            "store_id": sid,
            "storeCode": code,
            "storeNo": store_no,
            "count": count,
            "avgSupportTime": avg_hours,
            "name": format_store_label(name, sa, addr, sid)
        })

    # 6b. Chart Data
    days_diff = (date_to_dt - date_from_dt).days
    
    requested_group_by = str(request.chart_group_by or "").lower()
    if requested_group_by in {"day", "week", "month"}:
        trunc_type = requested_group_by
    elif days_diff <= 14:
        trunc_type = 'day'
    elif days_diff > 45:
        trunc_type = 'month'
    else:
        trunc_type = 'week'
        
    period_expr = func.date_trunc(literal(trunc_type), Ticket.created_at)

    chart_query = (
        select(
            period_expr.label('period'),
            func.count(Ticket.id),
            avg_support_time_expr
        )
        .where(and_(*base_filters))
        .group_by(period_expr)
        .order_by(period_expr.asc())
    )
    chart_res = await session.execute(chart_query)
    
    # Generate full categories to ensure chart has 0-values
    full_categories = []
    chart_tickets = []
    chart_support_time = []
    cat_map = {}
    
    if trunc_type == 'day':
        for i in range(days_diff + 1):
            d = date_from_dt + timedelta(days=i)
            cat = d.strftime('%d/%m')
            # For mapping later, store canonical date string
            cat_map[d.date().isoformat()] = len(full_categories)
            full_categories.append(cat)
            chart_tickets.append(0)
            chart_support_time.append(0.0)
    elif trunc_type == 'month':
        cur = date_from_dt.replace(day=1)
        end = date_to_dt.date()
        while cur.date() <= end:
            cat = cur.strftime('%m/%Y')
            cat_map[cur.strftime('%Y-%m')] = len(full_categories)
            full_categories.append(cat)
            chart_tickets.append(0)
            chart_support_time.append(0.0)
            m = cur.month + 1
            y = cur.year
            if m > 12:
                m = 1
                y += 1
            cur = cur.replace(year=y, month=m)
    else: # week
        cur = date_from_dt - timedelta(days=date_from_dt.weekday())
        end = date_to_dt.date()
        while cur.date() <= end:
            week_num = cur.isocalendar()[1]
            year_num = cur.isocalendar()[0]
            week_start = cur.strftime('%d/%m')
            week_end = (cur + timedelta(days=6)).strftime('%d/%m')
            cat = f"{week_start} - {week_end}"
            cat_map[f"{year_num}-{week_num}"] = len(full_categories)
            full_categories.append(cat)
            chart_tickets.append(0)
            chart_support_time.append(0.0)
            cur += timedelta(days=7)
            
    # Fill actual data
    for period_ts, count, avg_sec in chart_res.all():
        if period_ts is None:
            continue
        try:
            if trunc_type == 'day':
                key = period_ts.date().isoformat()
            elif trunc_type == 'month':
                key = period_ts.strftime('%Y-%m')
            else:
                week_num = period_ts.isocalendar()[1]
                year_num = period_ts.isocalendar()[0]
                key = f"{year_num}-{week_num}"
                
            if key in cat_map:
                idx = cat_map[key]
                chart_tickets[idx] += count
                chart_support_time[idx] = round(float(avg_sec) / 3600.0, 1) if avg_sec else 0.0
        except Exception:
            pass

    chart_data = {
        "categories": full_categories,
        "tickets": chart_tickets,
        "supportTime": chart_support_time
    }

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
        .limit(request.activity_limit)
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
                "total_ticket": current_metrics["total_ticket"],
                "in_progress": current_metrics["in_progress"],
                "resolved": current_metrics["resolved"],
                "closed": current_metrics["closed"],
                "rejected": current_metrics["rejected"],
                "due_soon": current_metrics["due_soon"],
                "overdue": current_metrics["overdue"],
                "avg_processing_time": current_metrics["avg_processing_time"],
            },
            "live_summary": {
                "total_ticket": live_metrics["total_ticket"],
                "in_progress": live_metrics["in_progress"],
                "resolved": live_metrics["resolved"],
                "closed": live_metrics["closed"],
                "rejected": live_metrics["rejected"],
                "due_soon": live_metrics["due_soon"],
                "overdue": live_metrics["overdue"],
                "avg_processing_time": live_metrics["avg_processing_time"],
                "qc_pass_rate": live_qc_metrics["passRate"],
                "qc_total_sessions": live_qc_metrics["totalSessions"],
                "qc_passed": live_qc_metrics["passed"],
                "qc_failed": live_qc_metrics["failed"],
            },
            "previous_summary": {
                "date_from": previous_from_dt.date().isoformat(),
                "date_to": previous_to_dt.date().isoformat(),
                "total_ticket": previous_metrics["total_ticket"],
                "in_progress": previous_metrics["in_progress"],
                "resolved": previous_metrics["resolved"],
                "closed": previous_metrics["closed"],
                "rejected": previous_metrics["rejected"],
                "due_soon": previous_metrics["due_soon"],
                "overdue": previous_metrics["overdue"],
                "avg_processing_time": previous_metrics["avg_processing_time"],
            },
            "trends": {
                "total_ticket": calculate_delta(current_metrics["total_ticket"], previous_metrics["total_ticket"]),
                "avg_processing_time": calculate_delta(current_metrics["avg_processing_time"], previous_metrics["avg_processing_time"], lower_is_better=True),
                "in_progress": calculate_delta(current_metrics["in_progress"], previous_metrics["in_progress"], lower_is_better=True),
                "resolved": calculate_delta(current_metrics["resolved"], previous_metrics["resolved"]),
                "due_soon": calculate_delta(current_metrics["due_soon"], previous_metrics["due_soon"], lower_is_better=True),
                "overdue": calculate_delta(current_metrics["overdue"], previous_metrics["overdue"], lower_is_better=True),
                "qc_pass_rate": calculate_delta(current_qc_metrics["passRate"], previous_qc_metrics["passRate"]),
            },
            "qc_summary": current_qc_metrics,
            "previous_qc_summary": {
                "date_from": previous_from_dt.date().isoformat(),
                "date_to": previous_to_dt.date().isoformat(),
                **previous_qc_metrics,
            },
            "status": [
                {"key": "new", "label": "Mới tạo", "value": status_counts["new"]},
                {"key": "in_progress", "label": "Đang xử lý", "value": status_counts["in_progress"]},
                {"key": "resolved", "label": "Đã xử lý", "value": status_counts["resolved"]},
                {"key": "closed", "label": "Đã đóng", "value": status_counts["closed"]},
                {"key": "rejected", "label": "Từ chối", "value": status_counts["rejected"]},
            ],
            "top_stores": top_stores,
            "activity_feed": activity_feed,
            "chart_data": chart_data
        }
    }
