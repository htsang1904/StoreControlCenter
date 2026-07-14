from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, update
from sqlalchemy.future import select

from app.api.deps import SessionDep, CurrentUser
from app.core.config import settings
from app.models.notification import Notification
from app.models.notification_subscription import NotificationSubscription
from app.schemas.notification import (
    NotificationResponse,
    NotificationSubscriptionCreate,
    NotificationSubscriptionResponse,
)
from app.services.notification_service import emit_notification_unread_count_event
from app.services.onesignal_client import get_last_push_result, send_push_to_subscriptions

router = APIRouter()


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

@router.get("/subscriptions/status", response_model=dict)
async def read_notification_subscription_status(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    count_result = await session.execute(
        select(func.count()).select_from(NotificationSubscription).where(
            NotificationSubscription.user_id == current_user.id,
            NotificationSubscription.is_active == True,
        )
    )
    active_count = int(count_result.scalar() or 0)
    latest_result = await session.execute(
        select(NotificationSubscription)
        .where(
            NotificationSubscription.user_id == current_user.id,
            NotificationSubscription.is_active == True,
        )
        .order_by(NotificationSubscription.last_seen_at.desc(), NotificationSubscription.id.desc())
        .limit(1)
    )
    latest_subscription = latest_result.scalar_one_or_none()

    return {
        "success": True,
        "data": {
            "subscribed": active_count > 0,
            "active_count": active_count,
            "subscription_id": latest_subscription.subscription_id if latest_subscription else None,
        },
    }

@router.get("/subscriptions/debug", response_model=dict)
async def read_notification_subscription_debug_status(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    result = await session.execute(
        select(NotificationSubscription)
        .where(NotificationSubscription.user_id == current_user.id)
        .order_by(NotificationSubscription.is_active.desc(), NotificationSubscription.last_seen_at.desc(), NotificationSubscription.id.desc())
    )
    subscriptions = result.scalars().all()

    return {
        "success": True,
        "data": {
            "backend_app_id": settings.ONESIGNAL_APP_ID,
            "api_url": settings.ONESIGNAL_API_URL,
            "has_rest_api_key": bool(settings.ONESIGNAL_REST_API_KEY),
            "subscriptions": [
                {
                    "id": subscription.id,
                    "subscription_id": subscription.subscription_id,
                    "platform": subscription.platform,
                    "is_active": subscription.is_active,
                    "last_seen_at": subscription.last_seen_at.isoformat() if subscription.last_seen_at else None,
                    "created_at": subscription.created_at.isoformat() if subscription.created_at else None,
                    "updated_at": subscription.updated_at.isoformat() if subscription.updated_at else None,
                }
                for subscription in subscriptions
            ],
            "last_push_result": get_last_push_result(),
        },
    }

@router.post("/subscriptions/test-push", response_model=dict)
async def send_current_user_test_push(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    result = await session.execute(
        select(NotificationSubscription).where(
            NotificationSubscription.user_id == current_user.id,
            NotificationSubscription.is_active == True,
        )
    )
    subscriptions = result.scalars().all()
    subscription_ids = [subscription.subscription_id for subscription in subscriptions]
    if not subscription_ids:
        return {
            "success": False,
            "message": "Không có subscription active để gửi test push",
            "data": {"subscription_ids": []},
        }

    target_url = f"{settings.APP_PUBLIC_URL.rstrip('/')}/notifications" if settings.APP_PUBLIC_URL else "/notifications"
    send_result = await send_push_to_subscriptions(
        subscription_ids=subscription_ids,
        heading="Kiểm tra thông báo",
        content="Đây là thông báo test từ Store Control Center.",
        url=target_url,
        data={"kind": "debug_test", "url": target_url},
        recipient_id=int(current_user.id),
    )
    if send_result.invalid_subscription_ids:
        await session.execute(
            update(NotificationSubscription)
            .where(NotificationSubscription.subscription_id.in_(send_result.invalid_subscription_ids))
            .values(is_active=False, last_seen_at=func.now())
        )
        await session.commit()

    return {
        "success": send_result.success,
        "data": {
            "status_code": send_result.status_code,
            "response_body": send_result.response_body,
            "error": send_result.error,
            "invalid_subscription_ids": send_result.invalid_subscription_ids,
            "subscription_ids": subscription_ids,
        },
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


@router.post("/subscriptions", response_model=dict)
async def upsert_notification_subscription(
    payload: NotificationSubscriptionCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    subscription_id = payload.subscription_id.strip()
    if not subscription_id:
        raise HTTPException(status_code=400, detail="Subscription ID không hợp lệ")

    result = await session.execute(
        select(NotificationSubscription).where(
            NotificationSubscription.subscription_id == subscription_id
        )
    )
    subscription = result.scalar_one_or_none()

    if subscription:
        subscription.user_id = current_user.id
        subscription.external_id = payload.external_id
        subscription.platform = payload.platform or "web"
        subscription.is_active = True
        subscription.last_seen_at = func.now()
    else:
        subscription = NotificationSubscription(
            user_id=current_user.id,
            subscription_id=subscription_id,
            external_id=payload.external_id,
            platform=payload.platform or "web",
            is_active=True,
            last_seen_at=func.now(),
        )
        session.add(subscription)

    await session.execute(
        update(NotificationSubscription)
        .where(
            NotificationSubscription.user_id == current_user.id,
            NotificationSubscription.subscription_id != subscription_id,
            NotificationSubscription.is_active == True,
        )
        .values(is_active=False, last_seen_at=func.now())
    )

    await session.commit()
    await session.refresh(subscription)

    return {
        "success": True,
        "data": NotificationSubscriptionResponse.model_validate(subscription),
    }


@router.delete("/subscriptions", response_model=dict)
async def deactivate_current_user_notification_subscriptions(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    stmt = (
        update(NotificationSubscription)
        .where(
            NotificationSubscription.user_id == current_user.id,
            NotificationSubscription.is_active == True,
        )
        .values(is_active=False, last_seen_at=func.now())
    )
    result = await session.execute(stmt)
    await session.commit()

    return {
        "success": True,
        "deactivated_count": int(result.rowcount or 0),
    }

@router.delete("/subscriptions/{subscription_id:path}", response_model=dict)
async def deactivate_notification_subscription(
    subscription_id: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    result = await session.execute(
        select(NotificationSubscription).where(
            NotificationSubscription.subscription_id == subscription_id,
            NotificationSubscription.user_id == current_user.id,
        )
    )
    subscription = result.scalar_one_or_none()
    if subscription:
        subscription.is_active = False
        subscription.last_seen_at = func.now()
        await session.commit()

    return {"success": True}
