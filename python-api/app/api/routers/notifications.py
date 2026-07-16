import logging
from typing import Any
from fastapi import APIRouter, HTTPException
from sqlalchemy import func, update
from sqlalchemy.future import select

from app.api.deps import SessionDep, CurrentUser
from app.models.notification import Notification
from app.models.notification_subscription import NotificationSubscription
from app.schemas.notification import NotificationSubscriptionCreate
from app.services.notification_service import emit_notification_unread_count_event
from app.services.onesignal_client import set_subscription_staff_tag

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/subscriptions", response_model=dict)
async def upsert_notification_subscription(
    payload: NotificationSubscriptionCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    subscription_id = payload.subscription_id.strip()
    if not subscription_id:
        raise HTTPException(status_code=400, detail="Subscription ID không hợp lệ")

    staff_id = str(current_user.suite_staff_id or current_user.id).strip()
    onesignal_id = str(payload.onesignal_id or "").strip()
    result = await session.execute(
        select(NotificationSubscription).where(
            NotificationSubscription.subscription_id == subscription_id
        )
    )
    subscription = result.scalar_one_or_none()

    if subscription:
        subscription.user_id = current_user.id
        subscription.external_id = staff_id
        subscription.platform = payload.platform or "web"
        subscription.is_active = True
        subscription.last_seen_at = func.now()
    else:
        subscription = NotificationSubscription(
            user_id=current_user.id,
            subscription_id=subscription_id,
            external_id=staff_id,
            platform=payload.platform or "web",
            is_active=True,
            last_seen_at=func.now(),
        )
        session.add(subscription)

    await session.commit()
    await session.refresh(subscription)

    tag_result = (
        await set_subscription_staff_tag(
            onesignal_id=onesignal_id,
            staff_id=staff_id,
        )
        if onesignal_id
        else None
    )
    if tag_result and not tag_result.success:
        logger.warning(
            "OneSignal staff tag sync failed: subscription_id=%s staff_id=%s status=%s error=%s body=%s",
            subscription_id,
            staff_id,
            tag_result.status_code,
            tag_result.error,
            (tag_result.response_body or "")[:500],
        )

    return {
        "success": True,
        "data": {
            "subscription_id": subscription.subscription_id,
            "tag_synced": bool(tag_result and tag_result.success),
        },
    }


@router.delete("/subscriptions/{subscription_id}", response_model=dict)
async def deactivate_notification_subscription(
    subscription_id: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    result = await session.execute(
        select(NotificationSubscription).where(
            NotificationSubscription.subscription_id == subscription_id.strip(),
            NotificationSubscription.user_id == current_user.id,
        )
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        return {"success": True}

    subscription.is_active = False
    subscription.last_seen_at = func.now()
    await session.commit()
    return {"success": True}

def serialize_notification(notification: Notification) -> dict:
    created_at = notification.created_at.isoformat() if notification.created_at else None
    updated_at = notification.updated_at.isoformat() if notification.updated_at else None
    read_at = notification.read_at.isoformat() if notification.read_at else None
    return {
        "id": notification.id,
        "title": notification.title,
        "message": notification.message,
        "type": notification.type,
        "is_read": notification.is_read,
        "read_at": read_at,
        "meta_info": notification.meta_info,
        "meta": notification.meta_info or {},
        "recipient_id": notification.recipient_id,
        "actor_id": notification.actor_id,
        "ticket_id": notification.ticket_id,
        "created_at": created_at,
        "updated_at": updated_at,
        "createdAt": created_at,
        "updatedAt": updated_at,
    }

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
    
    serialized_items = [serialize_notification(item) for item in items]
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

    await emit_notification_unread_count_event(current_user.id, int(unread_count))
    
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

    await emit_notification_unread_count_event(current_user.id, 0)
    
    return {"success": True, "unread_count": 0, "message": "Đã đánh dấu tất cả đã đọc"}
