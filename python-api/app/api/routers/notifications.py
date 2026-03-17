from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, update
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api.deps import SessionDep, CurrentUser
from app.models.notification import Notification
from app.schemas.notification import NotificationResponse

router = APIRouter()

@router.get("/", response_model=Any)
async def read_notifications(
    session: SessionDep,
    current_user: CurrentUser,
    page: int = 1,
    pageSize: int = 10
) -> Any:
    """Read notifications for current user with pagination."""
    skip = (page - 1) * pageSize
    
    # Count total
    count_query = select(func.count()).select_from(Notification).where(Notification.recipient_id == current_user.id)
    total_result = await session.execute(count_query)
    total = total_result.scalar() or 0
    
    # Get items
    query = select(Notification).where(
        Notification.recipient_id == current_user.id
    ).order_by(Notification.created_at.desc()).offset(skip).limit(pageSize)
    
    result = await session.execute(query)
    items = result.scalars().all()
    
    page_count = (total + pageSize - 1) // pageSize if pageSize > 0 else 1
    
    # Count unread
    unread_query = select(func.count()).select_from(Notification).where(
        Notification.recipient_id == current_user.id,
        Notification.is_read == False
    )
    unread_result = await session.execute(unread_query)
    unread_count = unread_result.scalar() or 0
    
    serialized_items = [NotificationResponse.model_validate(item) for item in items]
    return {
        "success": True,
        "data": serialized_items,
        "unread_count": unread_count,
        "pagination": {
            "page": page,
            "pageSize": pageSize,
            "total": total,
            "pageCount": page_count
        }
    }

@router.patch("/{id}/read", response_model=dict)
async def mark_notification_as_read(
    id: int,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Mark a single notification as read."""
    query = select(Notification).where(
        Notification.id == id,
        Notification.recipient_id == current_user.id
    )
    result = await session.execute(query)
    notification = result.scalar_one_or_none()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notification.is_read = True
    notification.read_at = func.now()
    session.add(notification)
    await session.commit()
    
    # Return unread count
    unread_query = select(func.count()).select_from(Notification).where(
        Notification.recipient_id == current_user.id,
        Notification.is_read == False
    )
    unread_result = await session.execute(unread_query)
    unread_count = unread_result.scalar() or 0
    
    return {"success": True, "unread_count": unread_count}

@router.patch("/read-all", response_model=dict)
async def mark_all_notifications_as_read(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """Mark all notifications as read for current user."""
    stmt = (
        update(Notification)
        .where(
            Notification.recipient_id == current_user.id,
            Notification.is_read == False
        )
        .values(is_read=True, read_at=func.now())
    )
    await session.execute(stmt)
    await session.commit()
    
    return {"success": True, "unread_count": 0, "message": "Đã đánh dấu tất cả đã đọc"}
