import logging
from collections import defaultdict
from typing import Iterable

from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.config import settings
from app.core.datetime_utils import utc_now_naive
from app.models.notification import Notification
from app.models.notification_subscription import NotificationSubscription
from app.services.onesignal_client import send_push_to_subscription_ids
from app.services.realtime import realtime_manager

logger = logging.getLogger(__name__)


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


def normalize_recipient_ids(recipient_ids: Iterable[int | None], *, exclude_user_id: int | None = None) -> list[int]:
    unique_ids: list[int] = []
    seen: set[int] = set()

    for raw_id in recipient_ids:
        if raw_id is None:
            continue
        try:
            user_id = int(raw_id)
        except (TypeError, ValueError):
            continue
        if user_id <= 0:
            continue
        if exclude_user_id is not None and user_id == exclude_user_id:
            continue
        if user_id in seen:
            continue
        seen.add(user_id)
        unique_ids.append(user_id)

    return unique_ids


def build_ticket_reply_notifications(
    *,
    recipient_ids: Iterable[int | None],
    actor_id: int,
    actor_name: str,
    ticket_id: int,
    ticket_code: str,
    log_id: int,
    message_preview: str,
    include_actor: bool = False,
) -> list[Notification]:
    recipients = normalize_recipient_ids(
        recipient_ids,
        exclude_user_id=None if include_actor else actor_id,
    )
    if not recipients:
        return []

    actor_display_name = actor_name.strip() if actor_name and actor_name.strip() else f"User #{actor_id}"
    notification_title = f"Phản hồi mới - {ticket_code}"
    notification_message = f"{actor_display_name} vừa phản hồi ticket {ticket_code}: {message_preview}"
    now = utc_now_naive()

    notifications: list[Notification] = []
    for recipient_id in recipients:
        notifications.append(
            Notification(
                title=notification_title,
                message=notification_message,
                type="info",
                recipient_id=recipient_id,
                actor_id=actor_id,
                ticket_id=ticket_id,
                meta_info={
                    "ticket_id": ticket_id,
                    "ticket_code": ticket_code,
                    "ticket_log_id": log_id,
                    "kind": "ticket_reply",
                },
                created_at=now,
                updated_at=now,
            )
        )
    return notifications


def build_ticket_created_notifications(
    *,
    recipient_ids: Iterable[int | None],
    actor_id: int,
    actor_name: str,
    ticket_id: int,
    ticket_code: str,
    ticket_title: str,
) -> list[Notification]:
    recipients = normalize_recipient_ids(recipient_ids, exclude_user_id=actor_id)
    if not recipients:
        return []

    actor_display_name = actor_name.strip() if actor_name and actor_name.strip() else f"User #{actor_id}"
    title_preview = " ".join(str(ticket_title or "").split()) or "(không có tiêu đề)"
    if len(title_preview) > 120:
        title_preview = f"{title_preview[:117]}..."
    now = utc_now_naive()

    notifications: list[Notification] = []
    for recipient_id in recipients:
        notifications.append(
            Notification(
                title=f"Ticket mới - {ticket_code}",
                message=f"{actor_display_name} vừa tạo ticket {ticket_code}: {title_preview}",
                type="info",
                recipient_id=recipient_id,
                actor_id=actor_id,
                ticket_id=ticket_id,
                meta_info={
                    "ticket_id": ticket_id,
                    "ticket_code": ticket_code,
                    "kind": "ticket_created",
                },
                created_at=now,
                updated_at=now,
            )
        )
    return notifications


def build_ticket_activity_notifications(
    *,
    recipient_ids: Iterable[int | None],
    actor_id: int,
    actor_name: str,
    ticket_id: int,
    ticket_code: str,
    title: str,
    message: str,
    kind: str,
    notification_type: str = "info",
    extra_meta: dict | None = None,
) -> list[Notification]:
    recipients = normalize_recipient_ids(recipient_ids, exclude_user_id=actor_id)
    if not recipients:
        return []

    actor_display_name = actor_name.strip() if actor_name and actor_name.strip() else f"User #{actor_id}"
    now = utc_now_naive()
    meta_info = {
        "ticket_id": ticket_id,
        "ticket_code": ticket_code,
        "kind": kind,
        **(extra_meta or {}),
    }

    return [
        Notification(
            title=title,
            message=message.format(actor_name=actor_display_name, ticket_code=ticket_code),
            type=notification_type,
            recipient_id=recipient_id,
            actor_id=actor_id,
            ticket_id=ticket_id,
            meta_info=meta_info,
            created_at=now,
            updated_at=now,
        )
        for recipient_id in recipients
    ]


async def emit_notification_created_events(
    session: AsyncSession,
    notifications: list[Notification],
) -> None:
    if not notifications:
        logger.info("Notification emit skipped: no notification records.")
        return

    recipient_ids = normalize_recipient_ids([item.recipient_id for item in notifications])
    unread_count_by_user = await _load_unread_count_by_user(session, recipient_ids)

    for notification in notifications:
        payload = serialize_notification(notification)
        await realtime_manager.emit_user_event(
            int(notification.recipient_id),
            "notification.created",
            {
                "notification": payload,
                "unread_count": unread_count_by_user.get(int(notification.recipient_id), 0),
            },
        )

    await send_onesignal_notifications(session, notifications)

async def emit_notification_unread_count_event(user_id: int, unread_count: int) -> None:
    await realtime_manager.emit_user_event(
        int(user_id),
        "notification.unread_count.updated",
        {"unread_count": int(unread_count)},
    )


async def _load_unread_count_by_user(
    session: AsyncSession,
    recipient_ids: list[int],
) -> dict[int, int]:
    if not recipient_ids:
        return {}

    query = (
        select(Notification.recipient_id, func.count(Notification.id))
        .where(
            Notification.recipient_id.in_(recipient_ids),
            Notification.is_read == False,  # noqa: E712
        )
        .group_by(Notification.recipient_id)
    )
    result = await session.execute(query)
    rows = result.all()

    unread_count_by_user = {recipient_id: 0 for recipient_id in recipient_ids}
    for recipient_id, unread_count in rows:
        unread_count_by_user[int(recipient_id)] = int(unread_count or 0)

    return unread_count_by_user


def _build_push_target(notification: Notification) -> tuple[str | None, dict]:
    meta_info = notification.meta_info or {}
    ticket_id = notification.ticket_id or meta_info.get("ticket_id")
    target_path = f"/ticket/inbox?ticket={ticket_id}" if ticket_id else "/dashboard"
    public_url = settings.APP_PUBLIC_URL.rstrip("/")
    target_url = f"{public_url}{target_path}" if public_url else None

    return target_url, {
        "ticket_id": ticket_id,
        "kind": meta_info.get("kind"),
        "url": target_url or target_path,
    }


async def send_onesignal_notifications(
    session: AsyncSession,
    notifications: list[Notification],
) -> None:
    recipient_ids = normalize_recipient_ids([item.recipient_id for item in notifications])
    result = await session.execute(
        select(NotificationSubscription).where(
            NotificationSubscription.user_id.in_(recipient_ids),
            NotificationSubscription.is_active == True,
        )
    )
    subscriptions_by_user: dict[int, list[str]] = {}
    for subscription in result.scalars().all():
        subscriptions_by_user.setdefault(int(subscription.user_id), []).append(subscription.subscription_id)

    grouped_notifications: dict[tuple[str, str, str | None, int | None, str | None], list[Notification]] = defaultdict(list)

    for notification in notifications:
        target_url, data = _build_push_target(notification)
        key = (
            notification.title,
            notification.message,
            target_url,
            data.get("ticket_id"),
            data.get("kind"),
        )
        grouped_notifications[key].append(notification)

    for (heading, content, target_url, ticket_id, kind), grouped_items in grouped_notifications.items():
        subscription_ids = [
            subscription_id
            for item in grouped_items
            for subscription_id in subscriptions_by_user.get(int(item.recipient_id), [])
        ]
        if not subscription_ids:
            continue

        result = await send_push_to_subscription_ids(
            subscription_ids=subscription_ids,
            heading=heading,
            content=content,
            url=target_url,
            data={
                "ticket_id": ticket_id,
                "kind": kind,
                "url": target_url or (f"/ticket/inbox?ticket={ticket_id}" if ticket_id else "/dashboard"),
            },
        )
        if result.success:
            logger.info(
                "OneSignal push sent: message_id=%s recipients=%s kind=%s.",
                result.message_id,
                len(subscription_ids),
                kind,
            )
            continue

        logger.warning(
            "OneSignal push failed: recipients=%s kind=%s status=%s error=%s body=%s",
            subscription_ids,
            kind,
            result.status_code,
            result.error,
            (result.response_body or "")[:500],
        )
